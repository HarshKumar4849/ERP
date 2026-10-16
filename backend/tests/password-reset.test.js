const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const qa = require('./qa-env');
const { seedFixtures, cleanupFixtures, emailFor } = require('./fixtures');

let server;
let fixtures;
let baseUrl;
let sentMessages = [];
let originalSend;
let AdminPassword;

test.before(async () => {
  fixtures = await seedFixtures();
  AdminPassword = mongoose.model('AdminPassword');
  const mail = require('../src/handlers/mail');
  originalSend = mail.send;
  mail.send = async (message) => {
    sentMessages.push(message);
    return { status: 'captured' };
  };
  const app = require('../src/app');
  server = await new Promise((resolve) => {
    const instance = app.listen(qa.PORT, qa.HOST, () => resolve(instance));
  });
  baseUrl = `http://${qa.HOST}:${server.address().port}/api`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  const mail = require('../src/handlers/mail');
  if (originalSend) mail.send = originalSend;
  await cleanupFixtures(fixtures);
});

async function post(path, body) {
  const response = await fetch(`${baseUrl}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

async function requestReset(email = emailFor('admin')) {
  sentMessages = [];
  const result = await post('forgetpassword', { email });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.success, true);
  const link = sentMessages[0]?.html.match(/href="([^"]+\/resetpassword\/[^\"]+)"/)?.[1];
  return { ...result, link };
}

function parseResetLink(link) {
  const url = new URL(link);
  const [, userId, resetToken] = url.pathname.match(/\/resetpassword\/([^/]+)\/([^/]+)$/) || [];
  assert.ok(userId && resetToken, 'captured email should include a reset link');
  return { userId, resetToken };
}

test('request response does not reveal whether an account exists', async () => {
  const known = await post('forgetpassword', { email: emailFor('admin') });
  sentMessages = [];
  const unknown = await post('forgetpassword', { email: 'not-registered@example.com' });
  assert.equal(known.response.status, unknown.response.status);
  assert.deepEqual(known.body, unknown.body);
  assert.equal(sentMessages.length, 0);
});

test('stores only a hashed, time-limited token and consumes it once; new password can log in', async () => {
  const previousLogin = await post('login', { email: emailFor('admin'), password: qa.PASSWORD });
  assert.equal(previousLogin.response.status, 200);
  const previousSessionToken = previousLogin.body.result.token;
  const { link } = await requestReset();
  const { userId, resetToken } = parseResetLink(link);
  const saved = await AdminPassword.findOne({ user: userId });
  assert.equal(saved.resetToken, crypto.createHash('sha256').update(resetToken).digest('hex'));
  assert.ok(saved.resetTokenExpires > new Date());
  assert.ok(saved.resetTokenExpires <= new Date(Date.now() + 60 * 60 * 1000 + 5000));
  const newPassword = 'QA-new-password-2026!';
  const reset = await post('resetpassword', { userId, resetToken, password: newPassword });
  assert.equal(reset.response.status, 200, reset.body.message);
  const consumed = await AdminPassword.findById(saved._id);
  assert.equal(consumed.resetToken, null);
  assert.equal(consumed.resetTokenExpires, null);
  assert.deepEqual(consumed.loggedSessions, []);
  const oldSession = await fetch(`${baseUrl}/admin/list`, {
    headers: { authorization: `Bearer ${previousSessionToken}` },
  });
  assert.equal(oldSession.status, 401, 'password reset should revoke previously issued sessions');

  const reused = await post('resetpassword', { userId, resetToken, password: newPassword });
  assert.equal(reused.response.status, 400);
  const login = await post('login', { email: emailFor('admin'), password: newPassword });
  assert.equal(login.response.status, 200, login.body.message);
  assert.equal(login.body.success, true);
  assert.ok(login.body.result?.token);
});

test('rejects invalid and expired reset tokens', async () => {
  const { link } = await requestReset();
  const { userId, resetToken } = parseResetLink(link);
  const invalid = await post('resetpassword', { userId, resetToken: 'a'.repeat(64), password: 'QA-new-password-2026!' });
  assert.equal(invalid.response.status, 400);

  await AdminPassword.updateOne({ user: userId }, { $set: { resetTokenExpires: new Date(Date.now() - 1000) } });
  const expired = await post('resetpassword', { userId, resetToken, password: 'QA-new-password-2026!' });
  assert.equal(expired.response.status, 400);
});

test('rejects weak passwords before looking up reset credentials', async () => {
  const response = await post('resetpassword', {
    userId: String(fixtures.admin.user._id),
    resetToken: 'a'.repeat(64),
    password: 'weak',
  });
  assert.equal(response.response.status, 409);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const qa = require('./qa-env');
const { seedFixtures, cleanupFixtures, emailFor } = require('./fixtures');

let server;
let fixtures;
let baseUrl;
let sentMessages = [];
let originalSend;

test.before(async () => {
  // Ensure local configuration for CLIENT_URL is active
  process.env.CLIENT_URL = 'http://localhost:3000';
  delete process.env.FRONTEND_URL;

  fixtures = await seedFixtures();
  const mail = require('../src/handlers/mail');
  originalSend = mail.send;
  mail.send = async (message) => {
    sentMessages.push(message);
    return { status: 'captured' };
  };

  const app = require('../src/app');
  server = await new Promise((resolve) => {
    const instance = app.listen(0, qa.HOST, () => resolve(instance));
  });
  baseUrl = `http://${qa.HOST}:${server.address().port}/api`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  const mail = require('../src/handlers/mail');
  if (originalSend) mail.send = originalSend;
  await cleanupFixtures(fixtures);
});

test('1. Generated reset link uses http://localhost:3000 and maps to /resetpassword/:userId/:resetToken', async () => {
  sentMessages = [];
  const adminEmail = emailFor('admin');

  const response = await fetch(`${baseUrl}/forgetpassword`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: adminEmail }),
  });

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(sentMessages.length, 1, 'Should capture exactly 1 reset email');

  const emailHtml = sentMessages[0].html;
  const linkMatch = emailHtml.match(/href="([^"]+)"/);
  assert.ok(linkMatch, 'Reset link must be present in email HTML');

  const resetLink = linkMatch[1];
  const url = new URL(resetLink);

  // Assert local frontend origin
  assert.equal(url.origin, 'http://localhost:3000', 'Origin must be local frontend http://localhost:3000');
  assert.equal(url.protocol, 'http:');
  assert.equal(url.hostname, 'localhost');
  assert.equal(url.port, '3000');

  // Assert route structure matches /resetpassword/:userId/:resetToken
  const pathMatch = url.pathname.match(/^\/resetpassword\/([^/]+)\/([^/]+)$/);
  assert.ok(pathMatch, `Path "${url.pathname}" must match /resetpassword/:userId/:resetToken`);

  const [, userId, resetToken] = pathMatch;
  assert.equal(userId, String(fixtures.admin.user._id), 'User ID in URL must match the admin user ID');
  assert.equal(resetToken.length, 64, 'Reset token must be a 64-character hex string');
});

test('2. useAppSettings defaults to http://localhost:3000 when no environment variable is set', () => {
  const originalClientUrl = process.env.CLIENT_URL;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  try {
    delete process.env.CLIENT_URL;
    delete process.env.FRONTEND_URL;

    const { useAppSettings } = require('../src/settings');
    const settings = useAppSettings();

    assert.equal(
      settings['idurar_base_url'],
      'http://localhost:3000',
      'idurar_base_url must default to http://localhost:3000'
    );
  } finally {
    process.env.CLIENT_URL = originalClientUrl;
    process.env.FRONTEND_URL = originalFrontendUrl;
  }
});

test('3. Reset link supports FRONTEND_URL environment variable if provided', async () => {
  sentMessages = [];
  delete process.env.CLIENT_URL;
  process.env.FRONTEND_URL = 'http://localhost:3000';

  const adminEmail = emailFor('admin');
  const response = await fetch(`${baseUrl}/forgetpassword`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: adminEmail }),
  });

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);

  const emailHtml = sentMessages[0].html;
  const linkMatch = emailHtml.match(/href="([^"]+)"/);
  const url = new URL(linkMatch[1]);
  assert.equal(url.origin, 'http://localhost:3000');
  assert.ok(/^\/resetpassword\/[^/]+\/[^/]+$/.test(url.pathname));

  process.env.CLIENT_URL = 'http://localhost:3000';
});

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const qa = require('./qa-env');
const { seedFixtures, cleanupFixtures, emailFor } = require('./fixtures');
const { createApiClient } = require('./api-client');

let server;
let fixtures;
let baseUrl;

test.before(async () => {
  fixtures = await seedFixtures();
  for (const file of ['../src/models/coreModels/Admin', '../src/models/coreModels/AdminPassword', '../src/models/appModels/Employee']) {
    require(file);
  }
  const app = require('../src/app');
  server = await new Promise((resolve) => {
    const instance = app.listen(qa.PORT, qa.HOST, () => resolve(instance));
  });
  baseUrl = `http://${qa.HOST}:${server.address().port}/api`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await cleanupFixtures(fixtures);
});

for (const role of ['admin', 'hr', 'employee']) {
  test(`${role} can log in`, async () => {
    const client = createApiClient(baseUrl);
    const { response, body } = await client.login(emailFor(role), qa.PASSWORD);
    assert.equal(response.status, 200, body.errorMessage || body.message || 'login failed');
    assert.equal(body.success, true);
    assert.ok(body.result?.token);
  });
}

test('authenticated admin can call a protected API route', async () => {
  const client = createApiClient(baseUrl);
  await client.login(emailFor('admin'), qa.PASSWORD);
  const response = await client.request('/admin/list');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
});

test('anonymous access is rejected', async () => {
  const response = await fetch(`${baseUrl}/admin/list`);
  assert.equal(response.status, 401);
});

test('employee cannot create office operations', async () => {
  const client = createApiClient(baseUrl);
  await client.login(emailFor('employee'), qa.PASSWORD);
  const response = await client.request('/office/create', { method: 'POST', body: { title: 'QA forbidden' } });
  assert.equal(response.status, 403);
});

test('frontend URL is independently configurable and the database is QA-only', () => {
  assert.match(qa.DATABASE, /qa|test/i);
  assert.equal(/production|prod|staging/i.test(qa.DATABASE), false);
  assert.ok(qa.FRONTEND_URL === '' || /^https?:\/\//.test(qa.FRONTEND_URL));
  assert.equal(mongoose.connection.readyState, 1);
});

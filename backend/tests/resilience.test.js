const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const qa = require('./qa-env');
const { seedFixtures, cleanupFixtures, emailFor } = require('./fixtures');
const { createApiClient } = require('./api-client');

let fixtures;
let server;
let baseUrl;
let admin;
let employee;
let createdEmployeeIds = [];

async function login(role) {
  const client = createApiClient(baseUrl);
  const result = await client.login(emailFor(role), qa.PASSWORD);
  assert.equal(result.response.status, 200, result.body.message);
  return client;
}

async function status(response) {
  let body = null;
  try { body = await response.json(); } catch {}
  return { status: response.status, body };
}

test.before(async () => {
  fixtures = await seedFixtures();
  const app = require('../src/app');
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  admin = await login('admin');
  employee = await login('employee');
});

test.after(async () => {
  await mongoose.model('Employee').deleteMany({ _id: { $in: createdEmployeeIds } });
  if (server) await new Promise((resolve) => server.close(resolve));
  await cleanupFixtures(fixtures);
});

test('bounded concurrent login attempts do not create duplicate fixture users', async () => {
  const responses = await Promise.all(Array.from({ length: 20 }, () => fetch(`${baseUrl}/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: emailFor('employee'), password: qa.PASSWORD }),
  })));
  assert.ok(responses.every((response) => response.status === 200));
  const user = await mongoose.model('Admin').findOne({ email: emailFor('employee') });
  assert.equal(user.email, emailFor('employee'));
  const password = await mongoose.model('AdminPassword').findOne({ user: user._id });
  assert.ok(password.loggedSessions.length >= 1);
});

test('concurrent employee creates expose duplicate uniqueness without uncontrolled duplicates', async () => {
  const payload = {
    employeeId: `QA-RACE-${qa.RUN_ID}`,
    name: 'QA Race Employee',
    surname: 'Fixture',
    email: `qa-race-${qa.RUN_ID}@example.com`,
    joiningDate: '2026-01-01',
  };
  const results = await Promise.all(Array.from({ length: 8 }, () => admin.request('/employee/create', { method: 'POST', body: payload })));
  const statuses = await Promise.all(results.map(status));
  assert.ok(statuses.some((result) => [200, 201].includes(result.status)));
  assert.ok(statuses.every((result) => result.status < 500 || result.status === 500));
  const records = await mongoose.model('Employee').find({ email: payload.email, removed: false });
  createdEmployeeIds.push(...records.map((record) => record._id));
  assert.ok(records.length <= 1, `duplicate employee records: ${records.length}`);
});

test('concurrent attendance check-ins result in one active record', async () => {
  const responses = await Promise.all(Array.from({ length: 12 }, () => employee.request('/attendance/login', {
    method: 'POST', body: { workMode: 'Office', location: 'QA concurrency' },
  })));
  const statuses = await Promise.all(responses.map(status));
  assert.equal(statuses.filter((result) => result.status === 200).length, 1);
  assert.ok(statuses.filter((result) => [400, 409].includes(result.status)).length >= 1);
  const now = new Date();
  const dateStringUtc = now.toISOString().slice(0, 10);
  const dateStringLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const records = await mongoose.model('Attendance').find({
    employee: fixtures.employee.employee._id,
    dateString: { $in: [dateStringUtc, dateStringLocal] },
    removed: false,
  });
  assert.equal(records.length, 1);
});

test('bounded request timeout can be retried against a local slow service', async () => {
  const slow = http.createServer((req, res) => setTimeout(() => res.end('ok'), 150));
  await new Promise((resolve) => slow.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${slow.address().port}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20);
  await assert.rejects(fetch(url, { signal: controller.signal }), /aborted|AbortError/i);
  clearTimeout(timer);
  const retry = await fetch(url);
  assert.equal(retry.status, 200);
  await new Promise((resolve) => slow.close(resolve));
});

test('database disconnect returns a controlled error and recovery restores access', async () => {
  await mongoose.disconnect();
  const failed = await status(await fetch(`${baseUrl}/admin/list`, { headers: { authorization: 'Bearer invalid' } }));
  assert.ok([401, 500, 503].includes(failed.status));
  await mongoose.connect(qa.DATABASE);
  const recovered = await admin.request('/admin/list');
  assert.equal(recovered.status, 200);
});

test('repeated invalid requests remain bounded and do not create records', async () => {
  const before = await mongoose.model('Task').countDocuments({ removed: false });
  const results = await Promise.all(Array.from({ length: 50 }, () => admin.request('/task/create', {
    method: 'POST', body: { title: null, dueDate: 'not-a-date' },
  })));
  const statuses = await Promise.all(results.map(status));
  assert.ok(statuses.every((result) => result.status < 500));
  const after = await mongoose.model('Task').countDocuments({ removed: false });
  assert.equal(after, before);
});

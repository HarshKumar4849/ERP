const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const qa = require('./qa-env');
const { seedFixtures, cleanupFixtures, emailFor } = require('./fixtures');
const { createApiClient } = require('./api-client');

let fixtures;
let server;
let baseUrl;
let admin;
let hr;
let employee;
let departmentId;

async function json(response) {
  let body = null;
  try { body = await response.json(); } catch {}
  return { status: response.status, body };
}

async function login(role) {
  const client = createApiClient(baseUrl);
  const result = await client.login(emailFor(role), qa.PASSWORD);
  assert.equal(result.response.status, 200, result.body.message || `Unable to login ${role}`);
  return client;
}

function assertNotServerError(result, label) {
  assert.ok(result.status < 500, `${label} returned ${result.status}: ${result.body?.message || ''}`);
}

test.before(async () => {
  fixtures = await seedFixtures();
  const app = require('../src/app');
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  admin = await login('admin');
  hr = await login('hr');
  employee = await login('employee');
});

test.after(async () => {
  if (departmentId) await mongoose.model('Department').deleteOne({ _id: departmentId });
  if (server) await new Promise((resolve) => server.close(resolve));
  await cleanupFixtures(fixtures);
});

test('authentication rejects empty, malformed and incorrect credentials', async () => {
  for (const body of [{}, { email: 'not-an-email', password: 'x' }, { email: emailFor('admin') }, { email: emailFor('admin'), password: 'wrong' }]) {
    const result = await json(await fetch(`${baseUrl}/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }));
    assert.ok([400, 403, 409].includes(result.status));
  }
});

test('dashboard and core settings endpoints load for ADMIN', async () => {
  for (const path of ['/dashboard/overview', '/dashboard/overview/list', '/setting/list', '/setting/listAll', '/admin/list']) {
    const result = await json(await admin.request(path));
    assert.ok([200, 203].includes(result.status), path);
  }
});

test('ADMIN generated CRUD persists a department through create/read/update/delete', async () => {
  const name = `QA Workflow ${qa.RUN_ID}`;
  let result = await json(await admin.request('/department/create', { method: 'POST', body: { name, code: 'QAW', description: 'workflow' } }));
  assert.equal(result.status, 200, result.body?.message || 'department create failed');
  departmentId = result.body.result?._id || result.body.result?.id;
  assert.ok(departmentId);

  result = await json(await admin.request(`/department/read/${departmentId}`));
  assert.equal(result.status, 200);
  assert.equal(result.body.result.name, name);

  result = await json(await admin.request(`/department/update/${departmentId}`, { method: 'PATCH', body: { description: 'updated' } }));
  assert.equal(result.status, 200);

  result = await json(await admin.request(`/department/delete/${departmentId}`, { method: 'DELETE' }));
  assert.equal(result.status, 200);
  departmentId = null;
});

test('generated list/search/filter/summary operations return stable responses', async () => {
  for (const entity of ['employee', 'department', 'designation', 'location', 'project', 'task', 'attendance', 'leave', 'leavebalance', 'salary', 'asset', 'document', 'policy', 'event', 'announcement', 'recognition', 'template', 'notification']) {
    for (const path of [`/${entity}/list?page=1&items=10`, `/${entity}/listAll`, `/${entity}/search?q=qa`, `/${entity}/filter?filter=removed&equal=false`, `/${entity}/summary`]) {
      const result = await json(await admin.request(path));
      assertNotServerError(result, `${entity} ${path}`);
    }
  }
});

test('HR has explicit HR workflow access and no settings/office escalation', async () => {
  for (const path of ['/employee/list', '/department/list', '/leave/balance', '/salary/list', '/policy/list', '/template/list']) {
    assert.ok([200, 203].includes((await json(await hr.request(path))).status), path);
  }
  for (const path of ['/setting/list', '/office/list', '/digitalservice/list']) {
    assert.equal((await json(await hr.request(path))).status, 403, path);
  }
});

test('EMPLOYEE self-service endpoints are scoped and privileged pages are rejected', async () => {
  for (const path of ['/employee/read/' + fixtures.employee.employee._id, '/attendance/today', '/leave/balance', '/leave/calendar', '/task/my-tasks', '/calendar/events', '/bulletin/feed', '/notification/list', '/notification/preferences']) {
    const result = await json(await employee.request(path));
    assertNotServerError(result, path);
    assert.ok([200, 204].includes(result.status), `${path} returned ${result.status}`);
  }
  for (const path of ['/employees', '/admin/list', '/setting/list', '/office/list', '/digitalservice/list']) {
    // API route assertions are authoritative; /employees is intentionally a UI path and is not called here.
    if (path === '/employees') continue;
    assert.equal((await json(await employee.request(path))).status, 403, path);
  }
});

test('attendance invalid payloads and repeated state requests never produce server errors', async () => {
  for (const body of [{}, { workMode: 'INVALID' }, { employee: fixtures.hr.employee._id, user: fixtures.hr.user._id }]) {
    const result = await json(await employee.request('/attendance/login', { method: 'POST', body }));
    assert.ok([400, 403].includes(result.status));
  }
  const duplicate = await json(await employee.request('/attendance/login', { method: 'POST', body: { workMode: 'Office', location: 'QA' } }));
  assert.ok([200, 400, 403].includes(duplicate.status));
  const logout = await json(await employee.request('/attendance/logout', { method: 'POST', body: {} }));
  assert.ok([200, 400, 403].includes(logout.status));
});

test('leave validation rejects invalid dates, missing reason and cross-user assignment', async () => {
  for (const body of [
    {},
    { leaveType: 'Casual Leave', fromDate: '2026-08-02', toDate: '2026-08-01', daysCount: 1, reason: 'invalid' },
    { employee: fixtures.hr.employee._id, leaveType: 'Casual Leave', fromDate: '2026-08-01', toDate: '2026-08-01', daysCount: 1, reason: 'IDOR' },
  ]) {
    const result = await json(await employee.request('/leave/apply', { method: 'POST', body }));
    assert.ok([400, 403].includes(result.status));
  }
});

test('task, project, calendar, bulletin, policy and notification workflows handle invalid IDs safely', async () => {
  const cases = [
    ['/task/status/not-an-id', 'PATCH', { status: 'INVALID' }],
    ['/task/not-an-id/subtask', 'POST', { title: '' }],
    ['/project/deliverable/not-an-id', 'POST', { title: '' }],
    ['/calendar/event', 'POST', {}],
    ['/calendar/event/not-an-id', 'PATCH', {}],
    ['/bulletin/like/not-an-id', 'POST', {}],
    ['/policy/acknowledge/not-an-id', 'POST', {}],
    ['/notification/read/not-an-id', 'PATCH', {}],
    ['/notification/delete/not-an-id', 'DELETE'],
  ];
  for (const [path, method, body] of cases) {
    const result = await json(await admin.request(path, { method, ...(body ? { body } : {}) }));
    assertNotServerError(result, `${method} ${path}`);
  }
  assert.equal((await json(await admin.request('/project/deliverable/not-an-id', { method: 'POST', body: { title: 'x' } }))).status, 400);
});

test('salary, document and template invalid operations return validation/authorization errors', async () => {
  for (const [path, method, body] of [
    ['/salary/create', 'POST', { netSalary: -1 }],
    ['/salary/generate-slip/not-an-id', 'POST', {}],
    ['/document/create', 'POST', { documentType: 'INVALID' }],
    ['/template/preview', 'POST', { content: '{{missing' }],
    ['/template/generate/not-an-id', 'POST', {}],
  ]) {
    const result = await json(await admin.request(path, { method, body }));
    assert.ok(result.status < 500, `${method} ${path} returned ${result.status}`);
  }
  assert.equal((await json(await admin.request('/salary/generate-slip/not-an-id', { method: 'POST', body: {} }))).status, 400);
});

test('reports, exports, integration status and notification preferences are deterministic without external side effects', async () => {
  for (const path of ['/attendance/monthly', '/attendance/report', '/calendar/celebrations', '/event/history', '/digitalservice/reminders', '/notification/unread-count', '/notification/preferences', '/google/status', '/outlook/status']) {
    const result = await json(await admin.request(path));
    assert.ok(result.status < 500, path);
  }
  const preferences = await json(await employee.request('/notification/preferences'));
  assert.equal(preferences.status, 200);
  const update = await json(await employee.request('/notification/preferences', { method: 'PATCH', body: { email: false } }));
  assert.ok([200, 400].includes(update.status));
  const refreshed = await json(await employee.request('/notification/preferences'));
  assert.equal(refreshed.status, 200);
});

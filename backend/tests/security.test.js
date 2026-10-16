const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const qa = require('./qa-env');
const { seedFixtures, cleanupFixtures, emailFor } = require('./fixtures');
const { createApiClient } = require('./api-client');
const { normalizeRole } = require('../src/rbac/roles');

let server;
let baseUrl;
let fixtures;
let adminToken;
let employeeToken;
let hrToken;
let salary;
let document;
let leave;
let legacyUsers = [];

async function login(roleOrEmail, password = qa.PASSWORD) {
  const email = roleOrEmail.includes('@') ? roleOrEmail : emailFor(roleOrEmail);
  const client = createApiClient(baseUrl);
  const result = await client.login(email, password);
  assert.equal(result.response.status, 200, result.body.message || 'fixture login failed');
  return { token: result.body.result.token, client };
}

async function responseJson(response) {
  const body = await response.json();
  return { status: response.status, body };
}

function walkForSecrets(value, path = '') {
  if (!value || typeof value !== 'object') return [];
  const found = [];
  for (const [key, child] of Object.entries(value)) {
    if (/password|salt|loggedSessions|resetToken|emailOtp/i.test(key)) found.push(`${path}.${key}`);
    found.push(...walkForSecrets(child, `${path}.${key}`));
  }
  return found;
}

test.before(async () => {
  fixtures = await seedFixtures();
  const Admin = mongoose.model('Admin');
  const AdminPassword = mongoose.model('AdminPassword');
  const salt = `security-salt-${qa.RUN_ID}`;

  for (const role of ['MANAGEMENT', 'FINANCE', 'DEPARTMENT_HEAD']) {
    const user = await Admin.create({
      email: `qa-${role.toLowerCase()}-${qa.RUN_ID}@example.com`,
      name: `QA ${role}`,
      role,
      enabled: true,
      removed: false,
    });
    await AdminPassword.create({
      user: user._id,
      salt,
      password: bcrypt.hashSync(salt + qa.PASSWORD),
      emailVerified: true,
    });
    legacyUsers.push(user);
  }

  // Bypass schema validation only for this QA fixture to prove unknown roles
  // are normalized down, never elevated. This never targets application data.
  const unknown = await Admin.create({
    email: `qa-unknown-${qa.RUN_ID}@example.com`,
    name: 'QA Unknown',
    role: 'EMPLOYEE',
    enabled: true,
    removed: false,
  });
  await Admin.updateOne({ _id: unknown._id }, { $set: { role: 'UNKNOWN_ROLE' } }, { runValidators: false });
  await AdminPassword.create({
    user: unknown._id,
    salt,
    password: bcrypt.hashSync(salt + qa.PASSWORD),
    emailVerified: true,
  });
  legacyUsers.push(unknown);

  const Salary = mongoose.model('Salary');
  salary = await Salary.create({
    employee: fixtures.hr.employee._id,
    user: fixtures.hr.user._id,
    month: 'January',
    year: 2026,
    netSalary: 100000,
    basic: 80000,
  });

  const Document = mongoose.model('Document');
  document = await Document.create({
    employee: fixtures.hr.employee._id,
    uploadedBy: fixtures.hr.user._id,
    documentType: 'Other HR Documents',
    file: {
      fileName: 'qa-private.pdf',
      originalName: 'private.pdf',
      path: 'qa-security/private.pdf',
      mimeType: 'application/pdf',
      size: 10,
    },
  });

  const Leave = mongoose.model('Leave');
  leave = await Leave.create({
    employee: fixtures.hr.employee._id,
    user: fixtures.hr.user._id,
    leaveType: 'Casual Leave',
    fromDate: new Date('2026-06-01'),
    toDate: new Date('2026-06-01'),
    daysCount: 1,
    reason: 'QA security fixture',
  });

  const app = require('../src/app');
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  adminToken = (await login('admin')).token;
  employeeToken = (await login('employee')).token;
  hrToken = (await login('hr')).token;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  const Admin = mongoose.model('Admin');
  await Admin.deleteMany({ _id: { $in: legacyUsers.map((user) => user._id) } });
  await cleanupFixtures(fixtures);
});

test('rejects unauthenticated protected APIs', async () => {
  for (const path of ['/admin/list', '/employee/list', '/salary/list', '/document/list', '/setting/list']) {
    const result = await responseJson(await fetch(`${baseUrl}${path}`));
    assert.equal(result.status, 401, path);
  }
});

test('rejects malformed, tampered and expired JWTs', async () => {
  for (const token of [
    'not-a-jwt',
    `${adminToken.slice(0, -1)}x`,
    jwt.sign({ id: fixtures.admin.user._id }, process.env.JWT_SECRET || 'wrong-secret', { expiresIn: -1 }),
  ]) {
    const result = await responseJson(await fetch(`${baseUrl}/admin/list`, {
      headers: { authorization: `Bearer ${token}` },
    }));
    assert.equal(result.status, 401);
  }
});

test('logout invalidates the exact session token', async () => {
  const session = await login('admin');
  const logout = await session.client.request('/logout', { method: 'POST' });
  assert.equal(logout.status, 200);
  const rejected = await session.client.request('/admin/list');
  assert.equal(rejected.status, 401);
});

test('normalizes legacy and unknown roles without privilege escalation', async () => {
  assert.equal(normalizeRole('MANAGEMENT'), 'ADMIN');
  assert.equal(normalizeRole('FINANCE'), 'EMPLOYEE');
  assert.equal(normalizeRole('DEPARTMENT_HEAD'), 'EMPLOYEE');
  assert.equal(normalizeRole('UNKNOWN_ROLE'), 'EMPLOYEE');

  const management = await login(`qa-management-${qa.RUN_ID}@example.com`);
  assert.equal((await management.client.request('/admin/list')).status, 200);

  for (const role of ['finance', 'department_head', 'unknown']) {
    const client = (await login(`qa-${role}-${qa.RUN_ID}@example.com`)).client;
    assert.equal((await client.request('/office/list')).status, 403, role);
    assert.equal((await client.request('/admin/list')).status, 403, role);
  }
});

test('employee cannot enumerate users through direct, search or pagination routes', async () => {
  const client = (await login('employee')).client;
  for (const path of [
    '/admin/list',
    '/admin/listAll',
    '/admin/search?q=qa',
    '/employee/list?page=1&items=1000&sortBy=email&sortValue=-1',
    '/employee/listAll',
    '/employee/search?q=qa',
  ]) assert.ok([403, 404].includes((await client.request(path)).status), path);
});

test('employee cannot read another employee profile or admin profile', async () => {
  const client = (await login('employee')).client;
  assert.equal((await client.request(`/employee/read/${fixtures.hr.employee._id}`)).status, 403);
  assert.equal((await client.request(`/admin/read/${fixtures.hr.user._id}`)).status, 403);
});

test('employee cannot access another employee document or salary', async () => {
  const client = (await login('employee')).client;
  for (const path of [
    `/document/read/${document._id}`,
    `/document/download/${document._id}`,
    `/salary/read/${salary._id}`,
    `/salary/slip/pdf/${salary._id}`,
    `/download/salary/${salary._id}.pdf`,
  ]) assert.ok([403, 404].includes((await client.request(path)).status), path);
});

test('employee cannot modify ownership, salary or verification state', async () => {
  const client = (await login('employee')).client;
  const payload = {
    employee: fixtures.admin.employee._id,
    user: fixtures.admin.user._id,
    uploadedBy: fixtures.admin.user._id,
    verificationStatus: 'Verified',
    netSalary: 999999999,
    status: 'Approved',
    $where: 'sleep(1)',
  };
  for (const [path, method] of [
    [`/document/update/${document._id}`, 'PATCH'],
    [`/document/verify/${document._id}`, 'PATCH'],
    [`/salary/update/${salary._id}`, 'PATCH'],
    [`/salary/delete/${salary._id}`, 'DELETE'],
  ]) assert.equal((await client.request(path, { method, body: payload })).status, 403, path);
});

test('employee cannot read, approve, cancel or create leave for another employee', async () => {
  const client = (await login('employee')).client;
  assert.equal((await client.request(`/leave/read/${leave._id}`)).status, 403);
  assert.equal((await client.request(`/leave/manager-approval/${leave._id}`, { method: 'PATCH', body: { status: 'Approved' } })).status, 403);
  assert.equal((await client.request(`/leave/hr-approval/${leave._id}`, { method: 'PATCH', body: { status: 'Approved' } })).status, 403);
  assert.equal((await client.request('/leave/apply', {
    method: 'POST',
    body: {
      employee: fixtures.hr.employee._id,
      leaveType: 'Casual Leave',
      fromDate: '2026-07-01',
      toDate: '2026-07-01',
      daysCount: 1,
      reason: 'IDOR attempt',
    },
  })).status, 403);
});

test('employee cannot alter or impersonate attendance ownership', async () => {
  const client = (await login('employee')).client;
  for (const [path, body] of [
    ['/attendance/login', { employee: fixtures.hr.employee._id, user: fixtures.hr.user._id }],
    ['/attendance/logout', { employee: fixtures.hr.employee._id, user: fixtures.hr.user._id }],
  ]) assert.equal((await client.request(path, { method: 'POST', body })).status, 403, path);
  assert.ok([403, 404].includes((await client.request(`/attendance/read/${fixtures.hr.employee._id}`)).status));
});

test('rejects traversal and private storage access without leaking files', async () => {
  const results = await Promise.all([
    fetch(`${baseUrl.replace('/api', '')}/public/%2e%2e/%2e%2e/package.json`),
    fetch(`${baseUrl.replace('/api', '')}/public/uploads/../package.json`),
    fetch(`${baseUrl.replace('/api', '')}/download/document/../../package.json`, { headers: { authorization: `Bearer ${adminToken}` } }),
  ]);
  for (const response of results) assert.ok([400, 404, 401, 403].includes(response.status));
});

test('does not expose password, token or OTP fields in admin responses', async () => {
  const freshAdminToken = (await login('admin')).token;
  const response = await fetch(`${baseUrl}/admin/list`, { headers: { authorization: `Bearer ${freshAdminToken}` } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(walkForSecrets(body), []);
});

test('HR can administer HR resources but cannot use ADMIN-only office administration', async () => {
  const client = (await login('hr')).client;
  assert.equal((await client.request('/employee/list')).status, 200);
  assert.equal((await client.request('/salary/list')).status, 200);
  assert.equal((await client.request('/office/list')).status, 403);
  assert.equal((await client.request('/setting/list')).status, 403);
});

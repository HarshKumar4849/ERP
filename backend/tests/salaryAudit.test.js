const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const qa = require('./qa-env');
const { seedFixtures, cleanupFixtures } = require('./fixtures');

let fixtures;
let server;
let baseUrl;
let adminToken;
let hrToken;
let employeeToken;

let testSalaryId;
let createdAuditLogId;

async function login(email) {
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: qa.PASSWORD }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, body?.message);
  return body.result.token;
}

test.before(async () => {
  fixtures = await seedFixtures();
  const app = require('../src/app');
  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api`;

  adminToken = await login(fixtures.admin.user.email);
  hrToken = await login(fixtures.hr.user.email);
  employeeToken = await login(fixtures.employee.user.email);

  const Salary = mongoose.model('Salary');
  const SalaryAudit = mongoose.model('SalaryAudit');

  // Create a sample salary record for audit testing
  const sal = await Salary.create({
    employee: fixtures.employee.employee._id,
    month: 'November',
    year: 2026,
    basic: 60000,
    hra: 24000,
    allowances: 12000,
    totalEarnings: 96000,
    totalDeductions: 4000,
    netSalary: 92000,
    status: 'Draft',
    workingDays: 30,
    paidDays: 30,
    createdBy: fixtures.admin.user._id,
  });
  testSalaryId = sal._id.toString();

  // Seed sample audit logs
  const log1 = await SalaryAudit.create({
    salary: sal._id,
    employee: fixtures.employee.employee._id,
    employeeName: `${fixtures.employee.employee.name} ${fixtures.employee.employee.surname}`,
    periodLabel: 'November 2026',
    action: 'CREATED',
    performedBy: fixtures.admin.user._id,
    performedByName: 'QA Admin',
    performedByRole: 'ADMIN',
    details: 'Created salary record for November 2026 with Net Salary 92,000',
    newValues: { status: 'Draft', netSalary: 92000 },
    timestamp: new Date(Date.now() - 60000),
  });
  createdAuditLogId = log1._id;

  const log2 = await SalaryAudit.create({
    salary: sal._id,
    employee: fixtures.employee.employee._id,
    employeeName: `${fixtures.employee.employee.name} ${fixtures.employee.employee.surname}`,
    periodLabel: 'November 2026',
    action: 'STATUS_CHANGE',
    performedBy: fixtures.hr.user._id,
    performedByName: 'QA HR',
    performedByRole: 'HR',
    details: 'Status changed from Draft to Paid',
    previousValues: { status: 'Draft' },
    newValues: { status: 'Paid' },
    timestamp: new Date(),
  });
});

test.after(async () => {
  const Salary = mongoose.model('Salary');
  const SalaryAudit = mongoose.model('SalaryAudit');
  if (testSalaryId) {
    await Salary.deleteMany({ _id: testSalaryId });
    await SalaryAudit.deleteMany({ salary: testSalaryId });
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  await cleanupFixtures(fixtures);
});

// =========================================================================
// 1. GLOBAL AUDIT TRAIL ENDPOINTS
// =========================================================================
test('1. Global Audit Trail: GET /salary/audit returns HTTP 200 array for ADMIN', async () => {
  const res = await fetch(`${baseUrl}/salary/audit`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert(Array.isArray(data.result), 'Expected result to be an array');
  assert(data.result.length >= 2, 'Should contain at least the 2 seeded audit entries');
  assert(data.pagination, 'Should include pagination metadata');
  assert.equal(data.pagination.page, 1);
});

test('2. Global Audit Trail: GET /salary/audit/list (frontend request format) returns HTTP 200 array', async () => {
  const res = await fetch(`${baseUrl}/salary/audit/list`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert(Array.isArray(data.result), 'Expected result to be an array');
  assert(data.result.length >= 2);
  // Ensure "list" was NOT treated as a salary ObjectId
  const hasCastError = data.result.some((log) => log === null);
  assert.equal(hasCastError, false, 'No entries should fail casting');
});

test('3. Global Audit Trail: HR user can also view global audit trail', async () => {
  const res = await fetch(`${baseUrl}/salary/audit`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert(Array.isArray(data.result));
});

test('4. Global Audit Trail: Gracefully returns empty array when filter matches zero records', async () => {
  const nonExistentEmpId = new mongoose.Types.ObjectId();
  const res = await fetch(`${baseUrl}/salary/audit?employee=${nonExistentEmpId}`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.deepEqual(data.result, []);
  assert.equal(data.pagination.count, 0);
});

// =========================================================================
// 2. INDIVIDUAL SALARY AUDIT TRAIL ENDPOINTS
// =========================================================================
test('5. Individual Audit: GET /salary/audit/:id with valid ObjectId returns records for that salary', async () => {
  const res = await fetch(`${baseUrl}/salary/audit/${testSalaryId}`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert(Array.isArray(data.result));
  assert.equal(data.result.length, 2);
  for (const log of data.result) {
    const salId = typeof log.salary === 'object' ? log.salary?._id : log.salary;
    assert.equal(salId.toString(), testSalaryId);
  }
});

test('6. Individual Audit: GET /salary/audit/:id/list with valid ObjectId returns records for that salary', async () => {
  const res = await fetch(`${baseUrl}/salary/audit/${testSalaryId}/list`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert(Array.isArray(data.result));
  assert.equal(data.result.length, 2);
});

test('7. Validation: GET /salary/audit/:id with invalid ObjectId returns HTTP 400 Bad Request', async () => {
  const invalidIds = ['invalid-id', '123', 'abc', 'not-an-objectid'];
  for (const inv of invalidIds) {
    const res = await fetch(`${baseUrl}/salary/audit/${inv}`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 400, `Expected 400 Bad Request for invalid id "${inv}", got ${res.status}`);
    const data = await res.json();
    assert.equal(data.success, false);
    assert(data.message.includes('Invalid salary record ID'));
  }
});

// =========================================================================
// 3. SECURITY & RBAC ENFORCEMENT
// =========================================================================
test('8. RBAC: Employee role is denied access (HTTP 403) to Global Salary Audit Trail', async () => {
  const res = await fetch(`${baseUrl}/salary/audit`, {
    headers: { authorization: `Bearer ${employeeToken}` },
  });
  assert.equal(res.status, 403, 'Employees must not view global salary audit history');
  const data = await res.json();
  assert.equal(data.success, false);
});

test('9. RBAC: Employee role is denied access (HTTP 403) to Individual Salary Audit Trail', async () => {
  const res = await fetch(`${baseUrl}/salary/audit/${testSalaryId}`, {
    headers: { authorization: `Bearer ${employeeToken}` },
  });
  assert.equal(res.status, 403, 'Employees must not view individual salary audit history');
  const data = await res.json();
  assert.equal(data.success, false);
});

// =========================================================================
// 4. SORTING & PAGINATION
// =========================================================================
test('10. Sorting & Pagination: Audit records are sorted newest first and limit is respected', async () => {
  const res = await fetch(`${baseUrl}/salary/audit?items=1&page=1`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.result.length, 1);
  assert.equal(data.pagination.page, 1);
  assert(data.pagination.count >= 2);
  // Verify newest first: the first item should be STATUS_CHANGE (created more recently)
  assert.equal(data.result[0].action, 'STATUS_CHANGE');
});


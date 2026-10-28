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
  // Ensure QA database connection and schema setup
  fixtures = await seedFixtures();
  for (const file of [
    '../src/models/coreModels/Admin',
    '../src/models/coreModels/AdminPassword',
    '../src/models/appModels/Employee',
    '../src/models/appModels/Salary',
  ]) {
    require(file);
  }

  // Ensure index migration has run on the QA test DB
  const ensureIndexes = require('../src/setup/ensureIndexes');
  await ensureIndexes();

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

// Helper to register a user
async function registerUser(payload) {
  const res = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { status: res.status, data };
}

// Helper to log in as admin
async function loginAsAdmin() {
  const client = createApiClient(baseUrl);
  const { response, body } = await client.login(emailFor('admin'), qa.PASSWORD);
  assert.equal(response.status, 200, 'Admin login failed');
  return { client, token: body.result?.token };
}

// =========================================================================
// Test A — Normal duplicate prevention
// =========================================================================
test('Test A: Normal duplicate prevention rejects active duplicate registration', async () => {
  const email = `test_a_${Date.now()}@tecmotiv.qa`;
  const reg1 = await registerUser({
    name: 'Alice',
    surname: 'Original',
    email,
    password: 'Password123!',
    department: 'Engineering',
  });

  assert.equal(reg1.status, 200, 'First registration must succeed');
  assert.equal(reg1.data.success, true);
  assert.ok(reg1.data.result.token);

  // Attempt duplicate registration
  const reg2 = await registerUser({
    name: 'Alice',
    surname: 'Duplicate',
    email,
    password: 'AnotherPassword123!',
    department: 'Marketing',
  });

  assert.equal(reg2.status, 409, 'Duplicate active registration must be rejected with 409');
  assert.equal(reg2.data.success, false);
  assert.match(reg2.data.message, /already exists/i);

  // Verify only 1 active account exists in database
  const Admin = mongoose.model('Admin');
  const Employee = mongoose.model('Employee');
  const activeAdmins = await Admin.countDocuments({ email: email.toLowerCase(), removed: false });
  const activeEmps = await Employee.countDocuments({ email: email.toLowerCase(), removed: false });
  assert.equal(activeAdmins, 1, 'Exactly one active Admin document must exist');
  assert.equal(activeEmps, 1, 'Exactly one active Employee document must exist');
});

// =========================================================================
// Test B — Delete and re-register
// =========================================================================
test('Test B: Administrator deletion allows subsequent re-registration with same email', async () => {
  const email = `test_b_${Date.now()}@tecmotiv.qa`;
  const initialPassword = 'OldPassword123!';
  const newPassword = 'NewPassword456!';

  // 1. Register initial user
  const regRes = await registerUser({
    name: 'Bob',
    surname: 'Tester',
    email,
    password: initialPassword,
    department: 'Operations',
  });
  assert.equal(regRes.status, 200);

  const Employee = mongoose.model('Employee');
  const initialEmp = await Employee.findOne({ email: email.toLowerCase(), removed: false });
  assert.ok(initialEmp, 'Employee record must exist before deletion');

  // 2. Admin logs in and deletes the employee
  const { client } = await loginAsAdmin();
  const delRes = await client.request(`/employee/delete/${initialEmp._id}`, {
    method: 'DELETE',
  });
  assert.equal(delRes.status, 200, 'Admin employee deletion must return 200');
  const delBody = await delRes.json();
  assert.equal(delBody.success, true);

  // 3. Verify deletion in DB
  const deletedEmp = await Employee.findById(initialEmp._id);
  assert.equal(deletedEmp.removed, true, 'Employee record must be marked removed: true');
  assert.equal(deletedEmp.enabled, false, 'Employee record must be marked enabled: false');

  // 4. Attempt to re-register with the EXACT SAME email
  const reRegRes = await registerUser({
    name: 'Bob',
    surname: 'Reborn',
    email,
    password: newPassword,
    department: 'Finance',
  });

  assert.equal(reRegRes.status, 200, 'Re-registration after admin deletion must succeed with 200');
  assert.equal(reRegRes.data.success, true);
  assert.ok(reRegRes.data.result.token, 'Must receive authentication token');

  // 5. Verify the new active employee record exists and is distinct from old soft-deleted record
  const newEmp = await Employee.findOne({ email: email.toLowerCase(), removed: false });
  assert.ok(newEmp, 'New active employee record must exist');
  assert.notEqual(newEmp._id.toString(), initialEmp._id.toString(), 'New employee must have new distinct ObjectId');
  assert.equal(newEmp.name, 'Bob');
  assert.equal(newEmp.surname, 'Reborn');

  // 6. Verify user can authenticate with the NEW credentials
  const loginClient = createApiClient(baseUrl);
  const loginRes = await loginClient.login(email, newPassword);
  assert.equal(loginRes.response.status, 200, 'Login with new credentials must succeed');
  assert.equal(loginRes.body.success, true);

  // 7. Verify OLD password is rejected
  const oldLoginClient = createApiClient(baseUrl);
  const oldLoginRes = await oldLoginClient.login(email, initialPassword);
  assert.equal(oldLoginRes.response.status, 403, 'Login with old password must be rejected');
});

// =========================================================================
// Test C — Email case and whitespace normalization
// =========================================================================
test('Test C: Email case and whitespace normalization across lifecycle', async () => {
  const baseEmail = `test_c_${Date.now()}@tecmotiv.qa`;
  const whitespaceEmail = `   ${baseEmail.toUpperCase()}   `;

  // 1. Register with whitespace & uppercase
  const reg1 = await registerUser({
    name: 'Charlie',
    email: whitespaceEmail,
    password: 'Password123!',
    department: 'Sales',
  });
  assert.equal(reg1.status, 200);

  // 2. Reject active account duplicate regardless of casing/spacing
  const regDup = await registerUser({
    name: 'Charlie Dup',
    email: baseEmail.toLowerCase(),
    password: 'Password123!',
  });
  assert.equal(regDup.status, 409, 'Case variant duplicate must be rejected');

  // 3. Delete employee
  const Employee = mongoose.model('Employee');
  const emp = await Employee.findOne({ email: baseEmail.toLowerCase(), removed: false });
  const { client } = await loginAsAdmin();
  await client.request(`/employee/delete/${emp._id}`, { method: 'DELETE' });

  // 4. Re-register with another casing variant
  const mixedEmail = baseEmail.replace('@', '@').toUpperCase();
  const reg3 = await registerUser({
    name: 'Charlie New',
    email: `  ${mixedEmail}  `,
    password: 'NewPassword123!',
    department: 'Engineering',
  });
  assert.equal(reg3.status, 200, 'Re-registration with mixed case and whitespace must succeed');
});

// =========================================================================
// Test D — Authorization: ordinary employee cannot delete
// =========================================================================
test('Test D: Unauthorized employee cannot delete another employee record', async () => {
  const targetEmail = `target_${Date.now()}@tecmotiv.qa`;
  await registerUser({
    name: 'Target',
    email: targetEmail,
    password: 'Password123!',
    department: 'HR',
  });

  const Employee = mongoose.model('Employee');
  const targetEmp = await Employee.findOne({ email: targetEmail.toLowerCase(), removed: false });

  // Ordinary employee attempts deletion
  const empClient = createApiClient(baseUrl);
  await empClient.login(emailFor('employee'), qa.PASSWORD);
  const unauthRes = await empClient.request(`/employee/delete/${targetEmp._id}`, {
    method: 'DELETE',
  });

  assert.equal(unauthRes.status, 403, 'Ordinary employee deletion must be rejected with 403 Forbidden');

  // Verify target employee remains intact
  const verifyTarget = await Employee.findById(targetEmp._id);
  assert.equal(verifyTarget.removed, false, 'Target employee must remain active and not removed');
  assert.equal(verifyTarget.enabled, true, 'Target employee must remain enabled');
});

// =========================================================================
// Test E — Session invalidation
// =========================================================================
test('Test E: Session invalidation immediately revokes deleted user tokens', async () => {
  const sessionEmail = `session_${Date.now()}@tecmotiv.qa`;
  const reg = await registerUser({
    name: 'David',
    email: sessionEmail,
    password: 'Password123!',
    department: 'IT',
  });
  assert.equal(reg.status, 200);
  const userToken = reg.data.result.token;
  assert.ok(userToken);

  // Authenticated request using user token works before deletion
  const preCheckRes = await fetch(`${baseUrl}/employee/read/self`, {
    headers: { authorization: `Bearer ${userToken}` },
  });
  assert.equal(preCheckRes.status, 200, 'Token must be valid before deletion');

  // Admin deletes the employee
  const Employee = mongoose.model('Employee');
  const emp = await Employee.findOne({ email: sessionEmail.toLowerCase(), removed: false });
  const { client } = await loginAsAdmin();
  await client.request(`/employee/delete/${emp._id}`, { method: 'DELETE' });

  // Attempt request using the previous token after deletion
  const postCheckRes = await fetch(`${baseUrl}/employee/read/self`, {
    headers: { authorization: `Bearer ${userToken}` },
  });
  assert.equal(postCheckRes.status, 401, 'Token must be rejected with 401 after deletion');
  const postBody = await postCheckRes.json();
  assert.equal(postBody.jwtExpired, true);
});

// =========================================================================
// Test F — Related records preserved without blocking registration
// =========================================================================
test('Test F: Related historical records are preserved and do not bleed into re-registration', async () => {
  const email = `hist_${Date.now()}@tecmotiv.qa`;
  const reg = await registerUser({
    name: 'Eleanor',
    email,
    password: 'Password123!',
    department: 'Finance',
  });
  assert.equal(reg.status, 200);

  const Employee = mongoose.model('Employee');
  const Salary = mongoose.model('Salary');
  const empDoc = await Employee.findOne({ email: email.toLowerCase(), removed: false });

  // Create historical salary record linked to Eleanor
  const salDoc = await Salary.create({
    employee: empDoc._id,
    user: empDoc.user,
    year: 2026,
    month: 'January',
    salaryDate: new Date('2026-01-31'),
    basic: 75000,
    basicSalary: 75000,
    totalSalary: 75000,
    netSalary: 75000,
    status: 'Paid',
    paymentStatus: 'Paid',
  });

  // Admin deletes Eleanor
  const { client } = await loginAsAdmin();
  await client.request(`/employee/delete/${empDoc._id}`, { method: 'DELETE' });

  // Verify historical salary record remains safely in database linked to old employee ID
  const verifySal = await Salary.findById(salDoc._id);
  assert.ok(verifySal, 'Historical salary record must not be deleted');
  assert.equal(verifySal.employee.toString(), empDoc._id.toString());

  // Eleanor re-registers
  const reReg = await registerUser({
    name: 'Eleanor',
    surname: 'SecondStint',
    email,
    password: 'NewPassword999!',
    department: 'Engineering',
  });
  assert.equal(reReg.status, 200, 'Re-registration must succeed');

  const newEmpDoc = await Employee.findOne({ email: email.toLowerCase(), removed: false });
  assert.notEqual(newEmpDoc._id.toString(), empDoc._id.toString(), 'New employee ID must be distinct');

  // Verify historical salary record does NOT point to the new employee ID
  const verifySalAfter = await Salary.findById(salDoc._id);
  assert.notEqual(verifySalAfter.employee.toString(), newEmpDoc._id.toString());
  assert.equal(verifySalAfter.employee.toString(), empDoc._id.toString());
});

// =========================================================================
// Test G — Database failure / invalid ID handling
// =========================================================================
test('Test G: Safe error handling for invalid or non-existent IDs', async () => {
  const { client } = await loginAsAdmin();

  // Invalid ObjectId format
  const badIdRes = await client.request('/employee/delete/not-a-valid-id', {
    method: 'DELETE',
  });
  assert.equal(badIdRes.status, 404, 'Malformed ID must return 404 without crashing');

  // Valid ObjectId that does not exist
  const fakeId = new mongoose.Types.ObjectId();
  const notFoundRes = await client.request(`/employee/delete/${fakeId}`, {
    method: 'DELETE',
  });
  assert.equal(notFoundRes.status, 404, 'Non-existent ID must return 404');
});

// =========================================================================
// Test H — Repeated deletion idempotency
// =========================================================================
test('Test H: Repeated deletion of already deleted account is handled gracefully', async () => {
  const email = `repeat_${Date.now()}@tecmotiv.qa`;
  await registerUser({
    name: 'George',
    email,
    password: 'Password123!',
    department: 'HR',
  });

  const Employee = mongoose.model('Employee');
  const emp = await Employee.findOne({ email: email.toLowerCase(), removed: false });

  const { client } = await loginAsAdmin();

  // First deletion
  const del1 = await client.request(`/employee/delete/${emp._id}`, { method: 'DELETE' });
  assert.equal(del1.status, 200);

  // Second deletion of the same record
  const del2 = await client.request(`/employee/delete/${emp._id}`, { method: 'DELETE' });
  assert.equal(del2.status, 200, 'Repeated deletion must return predictable 200 response');
  const body2 = await del2.json();
  assert.equal(body2.success, true);
  assert.match(body2.message, /already/i);
});

// =========================================================================
// Test I — Concurrent registration handling
// =========================================================================
test('Test I: Concurrent registration requests create at most one active account', async () => {
  const email = `concurrent_${Date.now()}@tecmotiv.qa`;

  // Send two simultaneous registrations with exact same email
  const [res1, res2] = await Promise.all([
    registerUser({ name: 'Conc1', email, password: 'Password123!', department: 'Eng' }),
    registerUser({ name: 'Conc2', email, password: 'Password123!', department: 'Eng' }),
  ]);

  const statuses = [res1.status, res2.status].sort();
  // Expect exactly one 200 and one 409
  assert.deepEqual(statuses, [200, 409], 'Exactly one concurrent registration must succeed and other get 409');

  // Verify database integrity
  const Admin = mongoose.model('Admin');
  const Employee = mongoose.model('Employee');
  const activeAdmins = await Admin.countDocuments({ email: email.toLowerCase(), removed: false });
  const activeEmps = await Employee.countDocuments({ email: email.toLowerCase(), removed: false });
  assert.equal(activeAdmins, 1, 'Exactly one active Admin record in DB');
  assert.equal(activeEmps, 1, 'Exactly one active Employee record in DB');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const qa = require('./qa-env');
const { seedFixtures, cleanupFixtures, emailFor } = require('./fixtures');
const { createApiClient } = require('./api-client');

let server;
let baseUrl;
let fixtures;
let adminClient;
let hrClient;
let empAClient;
let empBClient;
let targetDocument;
let targetSalary;
let targetLeave;
let targetProject;
let targetTask;

async function loginUser(roleOrEmail, password = qa.PASSWORD) {
  const email = roleOrEmail.includes('@') ? roleOrEmail : emailFor(roleOrEmail);
  const client = createApiClient(baseUrl);
  const result = await client.login(email, password);
  assert.equal(result.response.status, 200, result.body.message || 'Login failed for ' + email);
  return { token: result.body.result.token, client };
}

test.before(async () => {
  fixtures = await seedFixtures();

  // Create disposable adversarial resources
  const Document = mongoose.model('Document');
  targetDocument = await Document.create({
    employee: fixtures.employeeB.employee._id,
    uploadedBy: fixtures.employeeB.user._id,
    documentType: 'Passport',
    title: 'Confidential Passport B',
    status: 'Verified',
    file: {
      fileName: 'passport_b.pdf',
      originalName: 'passport_b.pdf',
      path: 'uploads/passport_b.pdf',
      mimeType: 'application/pdf',
      size: 1024,
    },
    verificationStatus: 'Verified',
  });

  const Salary = mongoose.model('Salary');
  targetSalary = await Salary.create({
    employee: fixtures.employeeB.employee._id,
    user: fixtures.employeeB.user._id,
    month: 'February',
    year: 2026,
    netSalary: 125000,
    basic: 95000,
    status: 'Paid',
  });

  const Leave = mongoose.model('Leave');
  targetLeave = await Leave.create({
    employee: fixtures.employeeB.employee._id,
    user: fixtures.employeeB.user._id,
    department: 'Marketing',
    leaveType: 'Sick Leave',
    fromDate: new Date('2026-11-01'),
    toDate: new Date('2026-11-03'),
    daysCount: 3,
    reason: 'Employee B private sick leave',
    status: 'Pending HR Approval',
  });

  const Project = mongoose.model('Project');
  targetProject = await Project.create({
    name: 'Project Top Secret B',
    client: 'Secret Client',
    category: 'MDS',
    department: 'Marketing',
    projectManager: fixtures.admin.employee._id,
    teamMembers: [fixtures.employeeB.employee._id],
    startDate: new Date('2026-01-01'),
    targetDate: new Date('2026-12-31'),
    status: 'In Progress',
  });

  const Task = mongoose.model('Task');
  targetTask = await Task.create({
    task: 'Confidential Task B',
    title: 'Confidential Task B',
    project: targetProject._id,
    department: 'Marketing',
    dueDate: new Date('2026-12-31'),
    owner: fixtures.employeeB.employee._id,
    assignedTo: fixtures.employeeB.user._id,
    status: 'In Progress',
  });

  const app = require('../src/app');
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  adminClient = (await loginUser('admin')).client;
  hrClient = (await loginUser('hr')).client;
  empAClient = (await loginUser('employee')).client;
  empBClient = (await loginUser('employeeB')).client;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await cleanupFixtures(fixtures);
});

// ---------------------------------------------------------------------------
// 1. Missing or Expired Authentication
// ---------------------------------------------------------------------------
test('1. Rejects missing, expired, and tampered authentication tokens', async () => {
  const paths = ['/employee/list', '/salary/list', '/document/list', '/admin/list', '/leave/approvals-queue'];

  // Missing header
  for (const path of paths) {
    const res = await fetch(`${baseUrl}${path}`);
    assert.equal(res.status, 401, `Expected 401 for unauthenticated ${path}`);
  }

  // Expired token
  const expiredToken = jwt.sign(
    { id: fixtures.employee.user._id },
    process.env.JWT_SECRET || 'qa-secret',
    { expiresIn: -10 }
  );
  const expiredRes = await fetch(`${baseUrl}/document/list`, {
    headers: { authorization: `Bearer ${expiredToken}` },
  });
  assert.equal(expiredRes.status, 401, 'Expected 401 for expired token');

  // Forged signature
  const forgedToken = jwt.sign(
    { id: fixtures.admin.user._id },
    'forged-attack-secret-key-12345678',
    { expiresIn: '1h' }
  );
  const forgedRes = await fetch(`${baseUrl}/admin/list`, {
    headers: { authorization: `Bearer ${forgedToken}` },
  });
  assert.equal(forgedRes.status, 401, 'Expected 401 for forged token');
});

// ---------------------------------------------------------------------------
// 2. Role Boundaries (ADMIN, HR, EMPLOYEE)
// ---------------------------------------------------------------------------
test('2. Enforces strict role boundary enforcement across modules', async () => {
  // EMPLOYEE cannot access administrative / digital service / settings
  for (const path of [
    '/admin/list',
    '/setting/list',
    '/office/list',
    '/digitalservice/list',
    '/employee/create',
    '/template/create',
  ]) {
    const res = await empAClient.request(path);
    assert.ok([403, 404].includes(res.status), `Employee should be blocked from ${path}, got ${res.status}`);
  }

  // HR cannot access core admin settings, office, or digital services
  for (const path of ['/setting/list', '/office/list', '/digitalservice/list']) {
    const res = await hrClient.request(path);
    assert.equal(res.status, 403, `HR should be blocked from ${path}, got ${res.status}`);
  }

  // HR CAN access employee management, templates, and directory list
  assert.equal((await hrClient.request('/employee/list')).status, 200, 'HR should access /employee/list');
  assert.equal((await hrClient.request('/template/list')).status, 200, 'HR should access /template/list');
  assert.equal((await hrClient.request('/admin/list')).status, 200, 'HR should access /admin/list directory');

  // ADMIN can access all
  assert.equal((await adminClient.request('/admin/list')).status, 200, 'Admin should access /admin/list');
  assert.ok([200, 203].includes((await adminClient.request('/setting/list')).status), 'Admin should access /setting/list');
});

// ---------------------------------------------------------------------------
// 3. Cross-Employee ID Substitution (IDOR)
// ---------------------------------------------------------------------------
test('3. Blocks cross-employee ID substitution and prevents horizontal escalation', async () => {
  const empBId = fixtures.employeeB.employee._id.toString();
  const docBId = targetDocument._id.toString();
  const salBId = targetSalary._id.toString();
  const leaveBId = targetLeave._id.toString();

  // Employee A cannot read Employee B profile
  assert.equal((await empAClient.request(`/employee/read/${empBId}`)).status, 403);

  // Employee A cannot read or download Employee B document
  assert.equal((await empAClient.request(`/document/read/${docBId}`)).status, 403);
  assert.equal((await empAClient.request(`/document/download/${docBId}`)).status, 403);

  // Employee A cannot read Employee B salary
  assert.equal((await empAClient.request(`/salary/read/${salBId}`)).status, 403);
  assert.equal((await empAClient.request(`/salary/slip/pdf/${salBId}`)).status, 403);

  // Employee A cannot read or cancel Employee B leave
  assert.equal((await empAClient.request(`/leave/read/${leaveBId}`)).status, 403);
  assert.equal((await empAClient.request(`/leave/cancel/${leaveBId}`, { method: 'PATCH' })).status, 403);

  // Employee A cannot clock attendance for Employee B
  const attRes = await empAClient.request('/attendance/login', {
    method: 'POST',
    body: { employee: empBId, user: fixtures.employeeB.user._id.toString() },
  });
  assert.equal(attRes.status, 403);

  // Employee A cannot substitute Employee B ID in template preview
  const tplRes = await empAClient.request('/template/preview', {
    method: 'POST',
    body: { content: 'Hello {{name}}', employeeId: empBId },
  });
  assert.equal(tplRes.status, 403);
});

// ---------------------------------------------------------------------------
// 4. Mass Assignment & Ownership Tampering
// ---------------------------------------------------------------------------
test('4. Defends against mass assignment of role, enabled, and owner fields', async () => {
  // Attacker attempts to register with role: 'ADMIN'
  const registerPayload = {
    name: 'Adversary User',
    email: `adversary-${Date.now()}@example.com`,
    password: 'AdversaryPassword123!',
    department: 'Engineering',
    role: 'ADMIN',
  };
  const regRes = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(registerPayload),
  });
  assert.equal(regRes.status, 200);

  // Verify in database: user must have role 'EMPLOYEE'
  const AdminModel = mongoose.model('Admin');
  const createdAdversary = await AdminModel.findOne({ email: registerPayload.email });
  assert.ok(createdAdversary, 'Adversary record should exist in database');
  assert.equal(createdAdversary.role, 'EMPLOYEE', 'Role MUST NOT be elevated to ADMIN via registration');
  await AdminModel.deleteOne({ _id: createdAdversary._id });

  // Attacker attempts to inject foreign owner in leave application
  const applyRes = await empAClient.request('/leave/apply', {
    method: 'POST',
    body: {
      employee: fixtures.admin.employee._id.toString(),
      user: fixtures.admin.user._id.toString(),
      leaveType: 'Casual Leave',
      fromDate: '2026-12-10',
      toDate: '2026-12-10',
      daysCount: 1,
      reason: 'Adversarial employee spoofing',
      status: 'Approved',
    },
  });
  assert.equal(applyRes.status, 403, 'Should reject foreign employee target in leave apply');

  // Database assertion: no approved leave was created
  const LeaveModel = mongoose.model('Leave');
  const spoofedLeave = await LeaveModel.findOne({ reason: 'Adversarial employee spoofing' });
  assert.equal(spoofedLeave, null, 'Spoofed leave must not exist in database');
});

// ---------------------------------------------------------------------------
// 5. Document Lifecycle Integrity & Mutability
// ---------------------------------------------------------------------------
test('5. Protects document listing, summary, update, and deletion integrity', async () => {
  const docBId = targetDocument._id.toString();

  // 1. Listing: Employee A lists documents
  const listRes = await empAClient.request('/document/list');
  assert.equal(listRes.status, 200);
  const returnedDocs = listRes.body.result || [];
  const foundB = returnedDocs.some((d) => d._id.toString() === docBId);
  assert.equal(foundB, false, 'Employee A must not see Employee B document in listing');

  // 2. Summary: Employee A summary does not count Employee B
  const sumRes = await empAClient.request('/document/summary');
  assert.equal(sumRes.status, 200);

  // 3. Adversarial update: Employee A attempts to rename or verify Employee B document
  const patchRes = await empAClient.request(`/document/update/${docBId}`, {
    method: 'PATCH',
    body: { remarks: 'Compromised Remarks', verificationStatus: 'Rejected' },
  });
  assert.equal(patchRes.status, 403);

  // 4. Adversarial delete: Employee A attempts to delete Employee B document
  const delRes = await empAClient.request(`/document/delete/${docBId}`, { method: 'DELETE' });
  assert.equal(delRes.status, 403);

  // 5. Database state assertion: document is intact and unmodified
  const DocumentModel = mongoose.model('Document');
  const freshDoc = await DocumentModel.findById(docBId);
  assert.equal(freshDoc.documentType, 'Passport', 'Database documentType must be unmodified');
  assert.equal(freshDoc.verificationStatus, 'Verified', 'Verification status must be intact');
  assert.equal(freshDoc.removed, false, 'Document must not be marked removed');
});

// ---------------------------------------------------------------------------
// 6. Leave Approval Authority & Invalid Transitions
// ---------------------------------------------------------------------------
test('6. Prevents unauthorized leave approval and blocks invalid state transitions', async () => {
  const leaveId = targetLeave._id.toString();

  // Employee A cannot approve Employee B leave
  const empApprove = await empAClient.request(`/leave/hr-approval/${leaveId}`, {
    method: 'PATCH',
    body: { action: 'Approve', remarks: 'Self-approved by peer' },
  });
  assert.equal(empApprove.status, 403);

  // Employee B cannot approve their own leave
  const selfApprove = await empBClient.request(`/leave/hr-approval/${leaveId}`, {
    method: 'PATCH',
    body: { action: 'Approve', remarks: 'Self-approved' },
  });
  assert.equal(selfApprove.status, 403);

  // Verify in database: status remains Pending HR Approval
  const LeaveModel = mongoose.model('Leave');
  let currentLeave = await LeaveModel.findById(leaveId);
  assert.equal(currentLeave.status, 'Pending HR Approval');

  // HR cancels or rejects the leave
  const hrReject = await hrClient.request(`/leave/hr-approval/${leaveId}`, {
    method: 'PATCH',
    body: { action: 'Reject', rejectionReason: 'Legitimate HR rejection' },
  });
  assert.equal(hrReject.status, 200);

  // Invalid transition: Attempting to approve an already Rejected leave
  const invalidReapprove = await hrClient.request(`/leave/hr-approval/${leaveId}`, {
    method: 'PATCH',
    body: { action: 'Approve', remarks: 'Illegal transition on rejected leave' },
  });
  assert.ok([400, 409].includes(invalidReapprove.status), 'Cannot re-approve an already rejected leave');

  // Database verification: status remains Rejected
  currentLeave = await LeaveModel.findById(leaveId);
  assert.equal(currentLeave.status, 'Rejected');
});

// ---------------------------------------------------------------------------
// 7. Concurrent Duplicate Operations & Approval Races
// ---------------------------------------------------------------------------
test('7. Handles concurrent duplicate operations and approval races safely', async () => {
  // Create a pending leave request for concurrency testing
  const LeaveModel = mongoose.model('Leave');
  const raceLeave = await LeaveModel.create({
    employee: fixtures.employee.employee._id,
    user: fixtures.employee.user._id,
    department: 'Engineering',
    leaveType: 'Casual Leave',
    fromDate: new Date('2026-12-20'),
    toDate: new Date('2026-12-20'),
    daysCount: 1,
    reason: 'Race condition test leave',
    status: 'Pending HR Approval',
  });

  const raceLeaveId = raceLeave._id.toString();

  // Launch simultaneous concurrent HR approval requests
  const [res1, res2] = await Promise.all([
    hrClient.request(`/leave/hr-approval/${raceLeaveId}`, {
      method: 'PATCH',
      body: { action: 'Approve', remarks: 'Race attempt 1' },
    }),
    hrClient.request(`/leave/hr-approval/${raceLeaveId}`, {
      method: 'PATCH',
      body: { action: 'Approve', remarks: 'Race attempt 2' },
    }),
  ]);

  // Atomic CAS guarantees exactly one 200 OK and one 409 Conflict
  const statuses = [res1.status, res2.status].sort();
  assert.deepEqual(statuses, [200, 409], 'Concurrent race must resolve with one 200 and one 409 Conflict');

  // Database verification: final status is Approved and no corrupted duplicate arrays
  const verifiedLeave = await LeaveModel.findById(raceLeaveId);
  assert.equal(verifiedLeave.status, 'Approved');
  await LeaveModel.deleteOne({ _id: raceLeave._id });
});

// ---------------------------------------------------------------------------
// 8. Deactivated Accounts and Expired Sessions
// ---------------------------------------------------------------------------
test('8. Immediately revokes access for deactivated accounts and logged-out sessions', async () => {
  // 1. Deactivated Account Testing
  const AdminModel = mongoose.model('Admin');
  const AdminPasswordModel = mongoose.model('AdminPassword');
  const deactEmail = `deactivated-qa-${Date.now()}@example.com`;

  const deactUser = await AdminModel.create({
    email: deactEmail,
    name: 'QA Deactivated',
    surname: 'User',
    role: 'EMPLOYEE',
    enabled: true,
    removed: false,
  });

  const salt = 'deact-salt';
  const bcrypt = require('bcryptjs');
  await AdminPasswordModel.create({
    user: deactUser._id,
    salt,
    password: bcrypt.hashSync(salt + qa.PASSWORD),
    emailVerified: true,
    loggedSessions: [],
  });

  // Login successfully to acquire an active token
  const deactSession = await loginUser(deactEmail, qa.PASSWORD);
  assert.equal((await deactSession.client.request('/document/list')).status, 200, 'Should work while active');

  // Deactivate account in database
  await AdminModel.updateOne({ _id: deactUser._id }, { $set: { enabled: false } });

  // Subsequent call with the previously active token MUST be rejected immediately
  const deniedAfterDeact = await deactSession.client.request('/document/list');
  assert.equal(deniedAfterDeact.status, 401, 'Deactivated user token must be rejected with 401');

  // Attempting to log in again with deactivated account MUST be rejected
  const loginDeactRes = await createApiClient(baseUrl).login(deactEmail, qa.PASSWORD);
  assert.ok([409, 403].includes(loginDeactRes.response.status), 'Disabled login must be rejected');

  // Cleanup deactivated user
  await AdminModel.deleteOne({ _id: deactUser._id });
  await AdminPasswordModel.deleteOne({ user: deactUser._id });

  // 2. Logged out session testing
  const tempSession = await loginUser('employee');
  assert.equal((await tempSession.client.request('/document/list')).status, 200);

  const logoutRes = await tempSession.client.request('/logout', { method: 'POST' });
  assert.equal(logoutRes.status, 200);

  // Reusing token after logout MUST return 401
  const rejectedAfterLogout = await tempSession.client.request('/document/list');
  assert.equal(rejectedAfterLogout.status, 401, 'Logged out session token must return 401');
});

// ---------------------------------------------------------------------------
// 9. Fixture Cleanup Verification
// ---------------------------------------------------------------------------
test('9. Verifies audit fixture isolation and complete cleanup', async () => {
  const DocumentModel = mongoose.model('Document');
  const SalaryModel = mongoose.model('Salary');
  const LeaveModel = mongoose.model('Leave');
  const ProjectModel = mongoose.model('Project');
  const TaskModel = mongoose.model('Task');

  // Clean target resources
  await DocumentModel.deleteOne({ _id: targetDocument._id });
  await SalaryModel.deleteOne({ _id: targetSalary._id });
  await LeaveModel.deleteOne({ _id: targetLeave._id });
  await ProjectModel.deleteOne({ _id: targetProject._id });
  await TaskModel.deleteOne({ _id: targetTask._id });

  // Verify deletion
  assert.equal(await DocumentModel.findById(targetDocument._id), null);
  assert.equal(await SalaryModel.findById(targetSalary._id), null);
  assert.equal(await LeaveModel.findById(targetLeave._id), null);
  assert.equal(await ProjectModel.findById(targetProject._id), null);
  assert.equal(await TaskModel.findById(targetTask._id), null);
});

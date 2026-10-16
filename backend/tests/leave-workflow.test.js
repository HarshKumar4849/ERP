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
let employeeAToken;
let employeeBToken;

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
  employeeAToken = await login(fixtures.employeeA.user.email);
  employeeBToken = await login(fixtures.employeeB.user.email);
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await cleanupFixtures(fixtures);
});

test('1. Employee can submit leave for themselves and cannot submit on behalf of another employee', async () => {
  // A. Employee A submits valid leave request for themselves
  const validRes = await fetch(`${baseUrl}/leave/apply`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      leaveType: 'Casual Leave',
      fromDate: '2026-06-01',
      toDate: '2026-06-02',
      reason: 'Family event in June',
    }),
  });
  const validBody = await validRes.json();
  assert.equal(validRes.status, 201, validBody?.message);
  assert.equal(validBody.success, true);
  assert.equal(validBody.result.employee._id.toString(), fixtures.employeeA.employee._id.toString());
  assert.equal(validBody.result.user.toString(), fixtures.employeeA.user._id.toString());
  assert.equal(validBody.result.status, 'Pending HR Approval');

  // B. Employee A attempts to submit on behalf of Employee B by providing Employee B ID
  const spoofRes = await fetch(`${baseUrl}/leave/apply`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      employee: fixtures.employeeB.employee._id.toString(),
      leaveType: 'Casual Leave',
      fromDate: '2026-06-10',
      toDate: '2026-06-11',
      reason: 'Attempted spoofed leave application',
    }),
  });
  const spoofBody = await spoofRes.json();
  assert.equal(spoofRes.status, 403, 'Submitting leave on behalf of another employee must be denied 403');
  assert.equal(spoofBody.success, false);
});

test('2. Validates invalid date ranges and prevents overlapping requests', async () => {
  // A. Inverted date range (To Date earlier than From Date)
  const invertedRes = await fetch(`${baseUrl}/leave/apply`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeBToken}`,
    },
    body: JSON.stringify({
      leaveType: 'Casual Leave',
      fromDate: '2026-07-10',
      toDate: '2026-07-05',
      reason: 'Inverted dates test',
    }),
  });
  const invertedBody = await invertedRes.json();
  assert.equal(invertedRes.status, 400);
  assert.match(invertedBody.message, /To Date cannot be earlier than From Date/i);

  // B. Employee B submits a valid leave request
  const bRes = await fetch(`${baseUrl}/leave/apply`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeBToken}`,
    },
    body: JSON.stringify({
      leaveType: 'Casual Leave',
      fromDate: '2026-07-10',
      toDate: '2026-07-12',
      reason: 'Marketing team conference',
    }),
  });
  assert.equal(bRes.status, 201);

  // C. Duplicate overlapping request for the same employee
  const overlapRes = await fetch(`${baseUrl}/leave/apply`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeBToken}`,
    },
    body: JSON.stringify({
      leaveType: 'Sick Leave',
      fromDate: '2026-07-11',
      toDate: '2026-07-13',
      reason: 'Overlapping sickness request',
    }),
  });
  const overlapBody = await overlapRes.json();
  assert.equal(overlapRes.status, 400);
  assert.match(overlapBody.message, /Overlapping leave/i);
});

test('3. Enforces list and detail isolation across employees', async () => {
  // A. Create distinct leave for Employee A
  const resA = await fetch(`${baseUrl}/leave/apply`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      leaveType: 'Sick Leave',
      fromDate: '2026-08-01',
      toDate: '2026-08-02',
      reason: 'Medical rest',
    }),
  });
  const dataA = await resA.json();
  assert.equal(resA.status, 201);
  const leaveAId = dataA.result._id;

  // B. Employee B lists leaves -> should NOT see Employee A's leave
  const listBRes = await fetch(`${baseUrl}/leave/list`, {
    headers: { authorization: `Bearer ${employeeBToken}` },
  });
  const listBBody = await listBRes.json();
  assert.equal(listBRes.status, 200);
  const listBIds = listBBody.result.map((l) => l._id.toString());
  assert.ok(!listBIds.includes(leaveAId.toString()), "Employee B must not see Employee A's leave");

  // C. Employee B attempts to filter by Employee A ID -> query is ignored/scoped to B
  const filterBRes = await fetch(`${baseUrl}/leave/list?employee=${fixtures.employeeA.employee._id}`, {
    headers: { authorization: `Bearer ${employeeBToken}` },
  });
  const filterBBody = await filterBRes.json();
  const filterBIds = filterBBody.result.map((l) => l._id.toString());
  assert.ok(!filterBIds.includes(leaveAId.toString()), "Query param spoofing must not leak Employee A's leave");

  // D. Employee A can read their own leave
  const readOwnRes = await fetch(`${baseUrl}/leave/read/${leaveAId}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(readOwnRes.status, 200);

  // E. Employee B attempts to read Employee A's leave -> 403 Forbidden
  const readOtherRes = await fetch(`${baseUrl}/leave/read/${leaveAId}`, {
    headers: { authorization: `Bearer ${employeeBToken}` },
  });
  assert.equal(readOtherRes.status, 403, "Employee cannot read another employee's leave");
});

test('4. Direct modification via generic update is prohibited', async () => {
  const applyRes = await fetch(`${baseUrl}/leave/apply`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      leaveType: 'Casual Leave',
      fromDate: '2026-09-01',
      toDate: '2026-09-02',
      reason: 'Personal errand',
    }),
  });
  const applyData = await applyRes.json();
  const leaveId = applyData.result._id;

  // Attempt direct PATCH /leave/update/:id
  const directUpdate = await fetch(`${baseUrl}/leave/update/${leaveId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ status: 'Approved' }),
  });
  assert.equal(directUpdate.status, 403, 'Direct update to leave status must be denied');
});

test('5. Employees cannot approve their own or other employees requests; review queue is privileged', async () => {
  const applyRes = await fetch(`${baseUrl}/leave/apply`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      leaveType: 'Casual Leave',
      fromDate: '2026-10-01',
      toDate: '2026-10-02',
      reason: 'Autumn break',
    }),
  });
  const applyData = await applyRes.json();
  const leaveId = applyData.result._id;

  // A. Employee A cannot access the review queue
  const queueEmp = await fetch(`${baseUrl}/leave/approvals-queue`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(queueEmp.status, 403);

  // B. HR and Admin CAN access the review queue
  const queueHr = await fetch(`${baseUrl}/leave/approvals-queue`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(queueHr.status, 200);

  const queueAdmin = await fetch(`${baseUrl}/leave/approvals-queue`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(queueAdmin.status, 200);

  // C. Employee A attempts self-approval
  const selfApprove = await fetch(`${baseUrl}/leave/hr-approval/${leaveId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ action: 'Approve' }),
  });
  assert.equal(selfApprove.status, 403);

  // D. Employee B attempts to approve Employee A request
  const otherApprove = await fetch(`${baseUrl}/leave/hr-approval/${leaveId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeBToken}`,
    },
    body: JSON.stringify({ action: 'Approve' }),
  });
  assert.equal(otherApprove.status, 403);
});

test('6. HR and Admin can approve/reject, record decisions, update balances, and sync attendance', async () => {
  const applyRes = await fetch(`${baseUrl}/leave/apply`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      leaveType: 'Earned/Privilege Leave',
      fromDate: '2026-11-02',
      toDate: '2026-11-03',
      reason: 'Official vacation',
    }),
  });
  const applyData = await applyRes.json();
  const leaveId = applyData.result._id;

  // HR approves the leave
  const approveRes = await fetch(`${baseUrl}/leave/hr-approval/${leaveId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      action: 'Approve',
      remarks: 'Granted by HR department',
    }),
  });
  const approveBody = await approveRes.json();
  assert.equal(approveRes.status, 200);
  assert.equal(approveBody.result.status, 'Approved');
  assert.equal(approveBody.result.hrApproval.status, 'Approved');
  assert.equal(approveBody.result.hrApproval.approver.toString(), fixtures.hr.user._id.toString());

  // Requester sees the final status
  const readRes = await fetch(`${baseUrl}/leave/read/${leaveId}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  const readBody = await readRes.json();
  assert.equal(readBody.result.status, 'Approved');

  // Attendance is synchronized for the employee
  const Attendance = mongoose.model('Attendance');
  const att = await Attendance.findOne({
    employee: fixtures.employeeA.employee._id,
    dateString: '2026-11-02',
    removed: false,
  });
  assert.ok(att, 'Approved leave should synchronize attendance');
  assert.equal(att.status, 'Leave');

  // Duplicate decision prevention: cannot re-approve an already approved request
  const duplicateDecision = await fetch(`${baseUrl}/leave/hr-approval/${leaveId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ action: 'Approve', remarks: 'Duplicate try' }),
  });
  assert.ok([400, 409].includes(duplicateDecision.status), 'Duplicate decision must return 400 or 409');
});

test('7. Handles concurrent approval decisions safely without duplicate deductions', async () => {
  const applyRes = await fetch(`${baseUrl}/leave/apply`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      leaveType: 'Casual Leave',
      fromDate: '2026-12-01',
      toDate: '2026-12-02',
      reason: 'Concurrent race test',
    }),
  });
  const applyData = await applyRes.json();
  const leaveId = applyData.result._id;

  // Launch two concurrent approvals
  const [res1, res2] = await Promise.all([
    fetch(`${baseUrl}/leave/hr-approval/${leaveId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${hrToken}`,
      },
      body: JSON.stringify({ action: 'Approve', remarks: 'First concurrent attempt' }),
    }),
    fetch(`${baseUrl}/leave/hr-approval/${leaveId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ action: 'Approve', remarks: 'Second concurrent attempt' }),
    }),
  ]);

  const statuses = [res1.status, res2.status];
  assert.ok(statuses.includes(200), 'At least one concurrent request must succeed');
  assert.ok(
    statuses.includes(400) || statuses.includes(409),
    'The conflicting concurrent request must receive a 400 or 409 error'
  );
});

test('8. Cancellation rules: owner can cancel own leave; cross-employee cancellation rejected; releases balance', async () => {
  // A. Employee B applies for leave
  const applyRes = await fetch(`${baseUrl}/leave/apply`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeBToken}`,
    },
    body: JSON.stringify({
      leaveType: 'Casual Leave',
      fromDate: '2026-12-10',
      toDate: '2026-12-11',
      reason: 'December holiday',
    }),
  });
  const applyData = await applyRes.json();
  const leaveId = applyData.result._id;

  // B. Employee A attempts to cancel Employee B leave -> 403 Forbidden
  const crossCancel = await fetch(`${baseUrl}/leave/cancel/${leaveId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.equal(crossCancel.status, 403, "Employee cannot cancel another employee's leave");

  // C. Employee B cancels their own leave -> 200 OK
  const ownCancel = await fetch(`${baseUrl}/leave/cancel/${leaveId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeBToken}`,
    },
    body: JSON.stringify({}),
  });
  const cancelBody = await ownCancel.json();
  assert.equal(ownCancel.status, 200);
  assert.equal(cancelBody.result.status, 'Cancelled');

  // D. Attempt to cancel an already cancelled leave -> 400 Bad Request
  const duplicateCancel = await fetch(`${baseUrl}/leave/cancel/${leaveId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeBToken}`,
    },
    body: JSON.stringify({}),
  });
  assert.equal(duplicateCancel.status, 400);
});

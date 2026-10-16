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

// =========================================================================
// 1. PROJECT LIFECYCLE & RBAC PERMISSIONS
// =========================================================================
let projectAlphaId;
let projectBetaId;

test('1. Project Lifecycle: HR & Admin can create projects, employees denied', async () => {
  const empAId = fixtures.employeeA.employee._id.toString();
  const empBId = fixtures.employeeB.employee._id.toString();

  // A. Ordinary employee cannot create a project
  const empCreateProjRes = await fetch(`${baseUrl}/project/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      name: 'Unauthorized Project',
      client: 'Internal',
      category: 'B2B',
      department: 'Engineering',
      projectManager: empAId,
      targetDate: '2026-12-31',
    }),
  });
  assert.equal(empCreateProjRes.status, 403, 'Employees must not be allowed to create projects');

  // B. HR creates Project Alpha (Engineering - Member: Employee A)
  const hrCreateAlphaRes = await fetch(`${baseUrl}/project/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      name: 'Project Alpha Engineering',
      client: 'TecMotiv Core',
      category: 'MDS',
      department: 'Engineering',
      projectManager: empAId,
      teamMembers: [empAId],
      targetDate: '2026-12-31',
      budget: 500000,
      description: 'Alpha confidential engineering initiative',
    }),
  });
  assert.equal(hrCreateAlphaRes.status, 201);
  const hrCreateAlphaBody = await hrCreateAlphaRes.json();
  assert.equal(hrCreateAlphaBody.success, true);
  projectAlphaId = hrCreateAlphaBody.result._id;
  assert.ok(projectAlphaId);

  // C. HR creates Project Beta (Marketing - Member: Employee B)
  const hrCreateBetaRes = await fetch(`${baseUrl}/project/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      name: 'Project Beta Marketing',
      client: 'TecMotiv Growth',
      category: 'B2B',
      department: 'Marketing',
      projectManager: empBId,
      teamMembers: [empBId],
      targetDate: '2026-12-31',
      budget: 300000,
      description: 'Beta confidential marketing initiative',
    }),
  });
  assert.equal(hrCreateBetaRes.status, 201);
  const hrCreateBetaBody = await hrCreateBetaRes.json();
  assert.equal(hrCreateBetaBody.success, true);
  projectBetaId = hrCreateBetaBody.result._id;
  assert.ok(projectBetaId);
});

// =========================================================================
// 2. PROJECT SCOPING, MEMBERSHIP & INACCESSIBLE PROJECT DETAILS
// =========================================================================
test('2. Project Scoping: Employees see only authorized projects; cross-project access denied', async () => {
  // A. Employee A lists projects - must ONLY see Project Alpha, NOT Project Beta
  const empAListProjRes = await fetch(`${baseUrl}/project/list`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empAListProjRes.status, 200);
  const empAListProjBody = await empAListProjRes.json();
  assert.equal(empAListProjBody.success, true);
  const empAProjectIds = empAListProjBody.result.map((p) => p._id.toString());
  assert.ok(empAProjectIds.includes(projectAlphaId), 'Employee A must see Project Alpha');
  assert.ok(!empAProjectIds.includes(projectBetaId), 'Employee A must NOT see Project Beta');

  // B. Employee B lists projects - must ONLY see Project Beta, NOT Project Alpha
  const empBListProjRes = await fetch(`${baseUrl}/project/list`, {
    headers: { authorization: `Bearer ${employeeBToken}` },
  });
  assert.equal(empBListProjRes.status, 200);
  const empBListProjBody = await empBListProjRes.json();
  assert.equal(empBListProjBody.success, true);
  const empBProjectIds = empBListProjBody.result.map((p) => p._id.toString());
  assert.ok(empBProjectIds.includes(projectBetaId), 'Employee B must see Project Beta');
  assert.ok(!empBProjectIds.includes(projectAlphaId), 'Employee B must NOT see Project Alpha');

  // C. Employee A can read authorized Project Alpha workspace
  const empAReadAlphaRes = await fetch(`${baseUrl}/project/read/${projectAlphaId}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empAReadAlphaRes.status, 200);
  const empAReadAlphaBody = await empAReadAlphaRes.json();
  assert.equal(empAReadAlphaBody.success, true);
  assert.equal(empAReadAlphaBody.result._id.toString(), projectAlphaId);

  // D. Employee A CANNOT read inaccessible Project Beta workspace
  const empAReadBetaRes = await fetch(`${baseUrl}/project/read/${projectBetaId}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empAReadBetaRes.status, 403, 'Employee A must not view inaccessible Project Beta');

  // E. Employee A CANNOT add deliverables to Project Beta
  const empAAddDelivBetaRes = await fetch(`${baseUrl}/project/deliverable/${projectBetaId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      title: 'Infiltrated deliverable',
    }),
  });
  assert.equal(empAAddDelivBetaRes.status, 403, 'Employee A must not add deliverables to Project Beta');

  // F. Employee A CANNOT schedule meetings for Project Beta
  const empAAddMeetBetaRes = await fetch(`${baseUrl}/project/meeting/${projectBetaId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      title: 'Secret meeting',
      date: '2026-11-01',
    }),
  });
  assert.equal(empAAddMeetBetaRes.status, 403, 'Employee A must not schedule meetings for Project Beta');

  // G. Employee A CANNOT link documents to Project Beta
  const empAAddDocBetaRes = await fetch(`${baseUrl}/project/document/${projectBetaId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      title: 'Foreign document',
      fileUrl: 'http://example.com/doc.pdf',
    }),
  });
  assert.equal(empAAddDocBetaRes.status, 403, 'Employee A must not link documents to Project Beta');

  // H. Employee A CANNOT delete Project Beta or Project Alpha
  const empADelProjRes = await fetch(`${baseUrl}/project/delete/${projectBetaId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empADelProjRes.status, 403, 'Employees must not delete projects');
});

// =========================================================================
// 3. TASK LIFECYCLE & ASSIGNMENT CONTROLS
// =========================================================================
let taskAlphaId;
let taskBetaId;

test('3. Task Creation & Assignment: Role checks and project association integrity', async () => {
  const empAId = fixtures.employeeA.employee._id.toString();
  const empBId = fixtures.employeeB.employee._id.toString();

  // A. Employee A creates Task Alpha within Project Alpha for themselves
  const empACreateTaskRes = await fetch(`${baseUrl}/task/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      task: 'Build Authentication Module',
      description: 'Implement JWT session handling',
      owner: empAId,
      department: 'Engineering',
      project: projectAlphaId,
      dueDate: '2026-11-15',
      priority: 'High',
    }),
  });
  assert.equal(empACreateTaskRes.status, 201);
  const empACreateTaskBody = await empACreateTaskRes.json();
  assert.equal(empACreateTaskBody.success, true);
  taskAlphaId = empACreateTaskBody.result._id;
  assert.ok(taskAlphaId);

  // B. Employee A CANNOT create a task linked to inaccessible Project Beta
  const empACreateBetaTaskRes = await fetch(`${baseUrl}/task/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      task: 'Unauthorized Marketing Task',
      project: projectBetaId,
      dueDate: '2026-11-15',
    }),
  });
  assert.equal(empACreateBetaTaskRes.status, 403, 'Employee A must not create tasks in Project Beta');

  // C. HR creates Task Beta within Project Beta for Employee B
  const hrCreateBetaTaskRes = await fetch(`${baseUrl}/task/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      task: 'Design Marketing Campaign',
      description: 'Q4 Brand Strategy & Outbound plan',
      owner: empBId,
      department: 'Marketing',
      project: projectBetaId,
      dueDate: '2026-11-20',
      priority: 'Critical',
      subtasks: [{ title: 'Draft visual creatives' }],
    }),
  });
  assert.equal(hrCreateBetaTaskRes.status, 201);
  const hrCreateBetaTaskBody = await hrCreateBetaTaskRes.json();
  assert.equal(hrCreateBetaTaskBody.success, true);
  taskBetaId = hrCreateBetaTaskBody.result._id;
  assert.ok(taskBetaId);

  // D. Employee A CANNOT delete any task
  const empADelTaskRes = await fetch(`${baseUrl}/task/delete/${taskAlphaId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empADelTaskRes.status, 403, 'Ordinary employee cannot delete tasks');
});

// =========================================================================
// 4. TASK CONFIDENTIALITY, COMMENTS & COLLABORATION ISOLATION
// =========================================================================
test('4. Task Isolation: Comments, subtasks, attachments & details restricted to authorized members', async () => {
  // A. Employee A can read their own Task Alpha
  const empAReadAlphaTaskRes = await fetch(`${baseUrl}/task/read/${taskAlphaId}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empAReadAlphaTaskRes.status, 200);
  const empAReadAlphaTaskBody = await empAReadAlphaTaskRes.json();
  assert.equal(empAReadAlphaTaskBody.success, true);
  assert.equal(empAReadAlphaTaskBody.result._id.toString(), taskAlphaId);

  // B. Employee A CANNOT read Employee B's Task Beta (inaccessible project & not assigned)
  const empAReadBetaTaskRes = await fetch(`${baseUrl}/task/read/${taskBetaId}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empAReadBetaTaskRes.status, 403, "Employee A must not read Employee B's task");

  // C. Employee A CANNOT post comments to Task Beta
  const empACommentBetaRes = await fetch(`${baseUrl}/task/${taskBetaId}/comment`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ comment: 'Infiltrated comment on Marketing task' }),
  });
  assert.equal(empACommentBetaRes.status, 403, "Employee A must not comment on Employee B's task");

  // D. Employee A CANNOT add subtasks to Task Beta
  const empASubtaskBetaRes = await fetch(`${baseUrl}/task/${taskBetaId}/subtask`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ title: 'Tampered subtask' }),
  });
  assert.equal(empASubtaskBetaRes.status, 403, "Employee A must not add subtasks to Employee B's task");

  // E. Employee A CANNOT add attachments to Task Beta
  const empAAttachBetaRes = await fetch(`${baseUrl}/task/${taskBetaId}/attachment`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ name: 'Malicious File', file: 'http://example.com/exploit.pdf' }),
  });
  assert.equal(empAAttachBetaRes.status, 403, "Employee A must not attach files to Employee B's task");

  // F. Employee A CANNOT update or change status on Task Beta
  const empAStatusBetaRes = await fetch(`${baseUrl}/task/status/${taskBetaId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ status: 'Completed' }),
  });
  assert.equal(empAStatusBetaRes.status, 403, "Employee A must not change status of Employee B's task");
});

// =========================================================================
// 5. STATUS TRANSITIONS, COMPLETION & VALIDATION
// =========================================================================
test('5. Task Status & Validation: Safe status transitions, invalid status handling, and completion timestamp', async () => {
  // A. Employee A adds a subtask to own Task Alpha
  const addSubtaskRes = await fetch(`${baseUrl}/task/${taskAlphaId}/subtask`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ title: 'Unit test authentication router' }),
  });
  assert.equal(addSubtaskRes.status, 200);

  // B. Employee A comments on own Task Alpha
  const addCommentRes = await fetch(`${baseUrl}/task/${taskAlphaId}/comment`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ comment: 'Sprint progress: JWT validation completed' }),
  });
  assert.equal(addCommentRes.status, 200);

  // C. Invalid status transitions are rejected with 400 Bad Request
  const invalidStatusRes = await fetch(`${baseUrl}/task/status/${taskAlphaId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ status: 'BogusStatus' }),
  });
  assert.equal(invalidStatusRes.status, 400, 'Invalid task status must be rejected');

  // D. Employee A transitions Task Alpha to 'In Progress'
  const inProgressRes = await fetch(`${baseUrl}/task/status/${taskAlphaId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ status: 'In Progress' }),
  });
  assert.equal(inProgressRes.status, 200);
  const inProgressBody = await inProgressRes.json();
  assert.equal(inProgressBody.result.status, 'In Progress');

  // E. Employee A marks Task Alpha as 'Completed'
  const completeRes = await fetch(`${baseUrl}/task/status/${taskAlphaId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ status: 'Completed' }),
  });
  assert.equal(completeRes.status, 200);
  const completeBody = await completeRes.json();
  assert.equal(completeBody.result.status, 'Completed');
  assert.ok(completeBody.result.completedAt, 'completedAt timestamp must be set on completion');
});

// =========================================================================
// 6. TASK SCOPING & DASHBOARD ISOLATION
// =========================================================================
test('6. Task Listing & Dashboard: Scoped views prevent cross-department data discovery', async () => {
  // A. Employee A lists tasks via /task/list
  const empAListTasksRes = await fetch(`${baseUrl}/task/list`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empAListTasksRes.status, 200);
  const empAListTasksBody = await empAListTasksRes.json();
  assert.equal(empAListTasksBody.success, true);
  const empATaskIds = empAListTasksBody.result.map((t) => t._id.toString());
  assert.ok(empATaskIds.includes(taskAlphaId), 'Employee A must see Task Alpha');
  assert.ok(!empATaskIds.includes(taskBetaId), 'Employee A must NOT see Task Beta in task list');

  // B. Employee A fetches Task Dashboard
  const empADashRes = await fetch(`${baseUrl}/task/dashboard`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empADashRes.status, 200);
  const empADashBody = await empADashRes.json();
  assert.equal(empADashBody.success, true);
  // Metrics must only reflect Employee A's tasks
  const dashTaskIds = empADashBody.result.recentTasks.map((t) => t._id.toString());
  assert.ok(!dashTaskIds.includes(taskBetaId), 'Dashboard must not include tasks from inaccessible projects');
});

// =========================================================================
// 7. EMPLOYEE DIRECTORY & PRIVACY / DATA MINIMIZATION
// =========================================================================
test('7. Directory Privacy: No sensitive financial/personal data exposed via employee listings', async () => {
  // A. HR lists employees
  const hrListEmpRes = await fetch(`${baseUrl}/employee/list?page=1&items=10`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(hrListEmpRes.status, 200);
  const hrListEmpBody = await hrListEmpRes.json();
  assert.equal(hrListEmpBody.success, true);

  // Invariant: bankDetails (accountNumber, routingOrIfsc) must NOT be leaked in directory list
  hrListEmpBody.result.forEach((emp) => {
    assert.equal(emp.bankDetails, undefined, 'bankDetails must be excluded from employee list responses');
  });

  // B. HR searches employees
  const hrSearchEmpRes = await fetch(`${baseUrl}/employee/search?q=QA`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(hrSearchEmpRes.status, 200);
  const hrSearchEmpBody = await hrSearchEmpRes.json();
  assert.equal(hrSearchEmpBody.success, true);
  hrSearchEmpBody.result.forEach((emp) => {
    assert.equal(emp.bankDetails, undefined, 'bankDetails must be excluded from employee search responses');
  });

  // C. Admin clean up: Admin deletes created tasks and projects
  const adminDelTaskAlphaRes = await fetch(`${baseUrl}/task/delete/${taskAlphaId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminDelTaskAlphaRes.status, 200);

  const adminDelTaskBetaRes = await fetch(`${baseUrl}/task/delete/${taskBetaId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminDelTaskBetaRes.status, 200);

  const adminDelProjAlphaRes = await fetch(`${baseUrl}/project/delete/${projectAlphaId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminDelProjAlphaRes.status, 200);

  const adminDelProjBetaRes = await fetch(`${baseUrl}/project/delete/${projectBetaId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminDelProjBetaRes.status, 200);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { seedFixtures, cleanupFixtures } = require('./fixtures');
const qa = require('./qa-env');

process.env.QA_GITHUB_MOCK = 'true';

let clients;
let createdFixtures;
let testProject;
let unrelatedProject;
let server;
let baseUrl;

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

function makeClient(token) {
  return {
    async get(path) {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json().catch(() => null);
      return { status: res.status, body };
    },
    async post(path, data = {}) {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => null);
      return { status: res.status, body };
    },
  };
}

test.before(async () => {
  createdFixtures = await seedFixtures();

  const app = require('../src/app');
  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api`;

  const [adminToken, hrToken, empAToken, empBToken, salesToken] = await Promise.all([
    login(createdFixtures.admin.user.email),
    login(createdFixtures.hr.user.email),
    login(createdFixtures.employee.user.email), // Engineering (PM)
    login(createdFixtures.employeeB.user.email), // Marketing (Team Member)
    login(createdFixtures.employeeSales.user.email), // Sales (Unrelated)
  ]);

  clients = {
    admin: makeClient(adminToken),
    hr: makeClient(hrToken),
    employeeA: makeClient(empAToken),
    employeeB: makeClient(empBToken),
    employeeSales: makeClient(salesToken),
    unauth: makeClient(null),
  };

  // Create test project with Employee A as PM and Employee B as team member
  const Project = mongoose.model('Project');
  testProject = await Project.create({
    name: `QA GitHub Project ${qa.RUN_ID}`,
    category: 'MDS',
    department: 'Engineering',
    projectManager: createdFixtures.employee.employee._id,
    teamMembers: [createdFixtures.employeeB.employee._id],
    startDate: new Date(),
    targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'In Progress',
    createdBy: createdFixtures.admin.user._id,
  });

  // Create unrelated project with Employee Sales
  unrelatedProject = await Project.create({
    name: `QA Sales Private Project ${qa.RUN_ID}`,
    category: 'B2B',
    department: 'Sales',
    projectManager: createdFixtures.employeeSales.employee._id,
    teamMembers: [],
    startDate: new Date(),
    targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'In Progress',
    createdBy: createdFixtures.admin.user._id,
  });
});

test.after(async () => {
  if (server) {
    server.close();
  }
  if (testProject?._id) {
    await mongoose.model('Project').deleteMany({
      _id: { $in: [testProject._id, unrelatedProject?._id].filter(Boolean) },
    });
  }
  await cleanupFixtures(createdFixtures);
});

test('1. Repository linking input validation rejects malformed URLs and identifiers', async () => {
  const invalidInputs = [
    '',
    '   ',
    'https://notgithub.com/foo/bar',
    'justareponame',
    'ftp://github.com/a/b',
    'http://github.com/invalid/path/extra',
  ];

  for (const input of invalidInputs) {
    const res = await clients.admin.post(`/github/project/${testProject._id}/link`, {
      repositoryUrl: input,
    });
    assert.strictEqual(
      res.status,
      400,
      `Expected 400 for input: "${input}", got ${res.status}`
    );
    assert.strictEqual(res.body.success, false);
  }
});

test('2. Unauthorized users (unrelated employee, team member, HR) are denied repository linking', async () => {
  // Non-member employee
  const resUnrelated = await clients.employeeSales.post(`/github/project/${testProject._id}/link`, {
    repositoryUrl: 'https://github.com/Tecmotiv-Solutions/core-engine',
  });
  assert.strictEqual(resUnrelated.status, 403);
  assert.strictEqual(resUnrelated.body.success, false);

  // Team member who is NOT PM
  const resMember = await clients.employeeB.post(`/github/project/${testProject._id}/link`, {
    repositoryUrl: 'https://github.com/Tecmotiv-Solutions/core-engine',
  });
  assert.strictEqual(resMember.status, 403);
  assert.strictEqual(resMember.body.success, false);

  // HR is not PM or Admin
  const resHr = await clients.hr.post(`/github/project/${testProject._id}/link`, {
    repositoryUrl: 'https://github.com/Tecmotiv-Solutions/core-engine',
  });
  assert.strictEqual(resHr.status, 403);
  assert.strictEqual(resHr.body.success, false);
});

test('3. Authorized Project Manager (EMPLOYEE) can link GitHub repository and DB state persists', async () => {
  const repoUrl = 'https://github.com/Tecmotiv-Solutions/erp-core';
  const res = await clients.employeeA.post(`/github/project/${testProject._id}/link`, {
    repositoryUrl: repoUrl,
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.result.enabled, true);
  assert.strictEqual(res.body.result.fullName, 'Tecmotiv-Solutions/erp-core');
  assert.strictEqual(res.body.result.repoOwner, 'Tecmotiv-Solutions');
  assert.strictEqual(res.body.result.repoName, 'erp-core');
  assert.strictEqual(res.body.result.defaultBranch, 'main');
  assert.ok(res.body.result.repoId);

  // Verify no secrets/tokens in response
  const bodyStr = JSON.stringify(res.body);
  assert.strictEqual(bodyStr.includes('token'), false);
  assert.strictEqual(bodyStr.includes('secret'), false);

  // Verify MongoDB database state directly
  const Project = mongoose.model('Project');
  const dbDoc = await Project.findById(testProject._id).lean();
  assert.strictEqual(dbDoc.github.enabled, true);
  assert.strictEqual(dbDoc.github.fullName, 'Tecmotiv-Solutions/erp-core');
  assert.strictEqual(dbDoc.github.repoOwner, 'Tecmotiv-Solutions');
  assert.strictEqual(dbDoc.github.repoName, 'erp-core');
  assert.strictEqual(dbDoc.github.linkedBy.toString(), createdFixtures.employee.user._id.toString());
});

test('4. Repository overview is visible to authorized team members and denied to unrelated employees', async () => {
  // Team member Employee B can view overview
  const resMember = await clients.employeeB.get(`/github/project/${testProject._id}/overview`);
  assert.strictEqual(resMember.status, 200);
  assert.strictEqual(resMember.body.success, true);
  assert.strictEqual(resMember.body.result.enabled, true);
  assert.strictEqual(resMember.body.result.fullName, 'Tecmotiv-Solutions/erp-core');
  assert.strictEqual(resMember.body.result.canManage, false); // Team member cannot link/unlink

  // PM Employee A can view overview
  const resPM = await clients.employeeA.get(`/github/project/${testProject._id}/overview`);
  assert.strictEqual(resPM.status, 200);
  assert.strictEqual(resPM.body.result.canManage, true); // PM can manage

  // Unrelated Employee Sales is strictly denied
  const resUnrelated = await clients.employeeSales.get(`/github/project/${testProject._id}/overview`);
  assert.strictEqual(resUnrelated.status, 403);
  assert.strictEqual(resUnrelated.body.success, false);

  // Unauthenticated client is denied with 401
  const resUnauth = await clients.unauth.get(`/github/project/${testProject._id}/overview`);
  assert.strictEqual(resUnauth.status, 401);
});

test('5. Admin can update/re-link repository and unlink repository', async () => {
  // Re-link repository with shorthand "Tecmotiv-Solutions/frontend-portal"
  const resRelink = await clients.admin.post(`/github/project/${testProject._id}/link`, {
    repository: 'Tecmotiv-Solutions/frontend-portal',
  });
  assert.strictEqual(resRelink.status, 200);
  assert.strictEqual(resRelink.body.result.fullName, 'Tecmotiv-Solutions/frontend-portal');

  // Verify non-PM team member cannot unlink
  const resUnlinkForbidden = await clients.employeeB.post(`/github/project/${testProject._id}/unlink`);
  assert.strictEqual(resUnlinkForbidden.status, 403);

  // Admin unlinks repository
  const resUnlink = await clients.admin.post(`/github/project/${testProject._id}/unlink`);
  assert.strictEqual(resUnlink.status, 200);
  assert.strictEqual(resUnlink.body.result.enabled, false);

  // Verify DB state
  const Project = mongoose.model('Project');
  const dbDoc = await Project.findById(testProject._id).lean();
  assert.strictEqual(dbDoc.github.enabled, false);
});

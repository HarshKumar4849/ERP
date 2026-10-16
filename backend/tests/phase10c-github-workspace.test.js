const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { seedFixtures, cleanupFixtures } = require('./fixtures');
const qa = require('./qa-env');

process.env.QA_GITHUB_MOCK = 'true';

let clients;
let createdFixtures;
let testProject;
let unlinkedProject;
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
    login(createdFixtures.employeeSales.user.email), // Sales (Non-member)
  ]);

  clients = {
    admin: makeClient(adminToken),
    hr: makeClient(hrToken),
    employeeA: makeClient(empAToken),
    employeeB: makeClient(empBToken),
    employeeSales: makeClient(salesToken),
    unauth: makeClient(null),
  };

  const Project = mongoose.model('Project');
  // Linked test project
  testProject = await Project.create({
    name: `QA GitHub Workspace Project ${qa.RUN_ID}`,
    category: 'MDS',
    department: 'Engineering',
    projectManager: createdFixtures.employee.employee._id,
    teamMembers: [createdFixtures.employeeB.employee._id],
    startDate: new Date(),
    targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'In Progress',
    createdBy: createdFixtures.admin.user._id,
    github: {
      enabled: true,
      repoId: 99901,
      repoOwner: 'Tecmotiv-Solutions',
      repoName: 'erp-core',
      fullName: 'Tecmotiv-Solutions/erp-core',
      repoUrl: 'https://github.com/Tecmotiv-Solutions/erp-core',
      defaultBranch: 'main',
      lastSyncAt: new Date(),
      syncStatus: 'idle',
      linkedBy: createdFixtures.employee.user._id,
      linkedAt: new Date(),
    },
  });

  // Unlinked test project
  unlinkedProject = await Project.create({
    name: `QA Unlinked Project ${qa.RUN_ID}`,
    category: 'B2B',
    department: 'Engineering',
    projectManager: createdFixtures.employee.employee._id,
    teamMembers: [createdFixtures.employeeB.employee._id],
    startDate: new Date(),
    targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'In Progress',
    createdBy: createdFixtures.admin.user._id,
    github: { enabled: false },
  });
});

test.after(async () => {
  if (server) {
    server.close();
  }
  if (testProject?._id) {
    await mongoose.model('Project').deleteMany({
      _id: { $in: [testProject._id, unlinkedProject?._id].filter(Boolean) },
    });
  }
  await cleanupFixtures(createdFixtures);
});

test('1. Unlinked project returns safe empty array for commits, pulls, issues, branches without error', async () => {
  const [commitsRes, pullsRes, issuesRes, branchesRes] = await Promise.all([
    clients.employeeA.get(`/github/project/${unlinkedProject._id}/commits`),
    clients.employeeA.get(`/github/project/${unlinkedProject._id}/pulls`),
    clients.employeeA.get(`/github/project/${unlinkedProject._id}/issues`),
    clients.employeeA.get(`/github/project/${unlinkedProject._id}/branches`),
  ]);

  assert.strictEqual(commitsRes.status, 200);
  assert.deepStrictEqual(commitsRes.body.result, []);

  assert.strictEqual(pullsRes.status, 200);
  assert.deepStrictEqual(pullsRes.body.result, []);

  assert.strictEqual(issuesRes.status, 200);
  assert.deepStrictEqual(issuesRes.body.result, []);

  assert.strictEqual(branchesRes.status, 200);
  assert.deepStrictEqual(branchesRes.body.result, []);
});

test('2. Authorized members (PM and team member) can view branches, commits, pulls, and issues', async () => {
  // PM (Employee A) fetches branches
  const branchesRes = await clients.employeeA.get(`/github/project/${testProject._id}/branches`);
  assert.strictEqual(branchesRes.status, 200);
  assert.strictEqual(branchesRes.body.success, true);
  assert.ok(Array.isArray(branchesRes.body.result));
  assert.ok(branchesRes.body.result.some((b) => b.name === 'main'));

  // Team member (Employee B) fetches commits with pagination & branch
  const commitsRes = await clients.employeeB.get(
    `/github/project/${testProject._id}/commits?branch=main&page=1&limit=10`
  );
  assert.strictEqual(commitsRes.status, 200);
  assert.strictEqual(commitsRes.body.success, true);
  assert.ok(Array.isArray(commitsRes.body.result));
  assert.ok(commitsRes.body.result.length > 0);
  assert.ok(commitsRes.body.result[0].sha);
  assert.ok(commitsRes.body.result[0].shortSha);
  assert.ok(commitsRes.body.result[0].author);

  // Team member fetches pull requests
  const pullsRes = await clients.employeeB.get(`/github/project/${testProject._id}/pulls?state=all`);
  assert.strictEqual(pullsRes.status, 200);
  assert.strictEqual(pullsRes.body.success, true);
  assert.ok(Array.isArray(pullsRes.body.result));
  assert.ok(pullsRes.body.result.length > 0);
  assert.ok(pullsRes.body.result[0].number);
  assert.ok(pullsRes.body.result[0].title);

  // PM fetches issues
  const issuesRes = await clients.employeeA.get(`/github/project/${testProject._id}/issues?state=open`);
  assert.strictEqual(issuesRes.status, 200);
  assert.strictEqual(issuesRes.body.success, true);
  assert.ok(Array.isArray(issuesRes.body.result));
  assert.ok(issuesRes.body.result.length > 0);
  assert.ok(issuesRes.body.result[0].title);
  assert.ok(Array.isArray(issuesRes.body.result[0].labels));
});

test('3. Non-member employee is strictly denied (403) from all repository workspace endpoints', async () => {
  const endpoints = ['commits', 'pulls', 'issues', 'branches', 'overview'];

  for (const ep of endpoints) {
    const res = await clients.employeeSales.get(`/github/project/${testProject._id}/${ep}`);
    assert.strictEqual(res.status, 403, `Expected 403 for endpoint: ${ep}, got ${res.status}`);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /Access denied/i);
  }
});

test('4. Unauthenticated client is strictly denied (401)', async () => {
  const endpoints = ['commits', 'pulls', 'issues', 'branches', 'overview'];

  for (const ep of endpoints) {
    const res = await clients.unauth.get(`/github/project/${testProject._id}/${ep}`);
    assert.strictEqual(res.status, 401, `Expected 401 for endpoint: ${ep}, got ${res.status}`);
  }
});

test('5. Non-existent or invalid project ID returns appropriate 400/404 errors', async () => {
  const fakeId = new mongoose.Types.ObjectId();
  const resNotFound = await clients.admin.get(`/github/project/${fakeId}/commits`);
  assert.strictEqual(resNotFound.status, 404);
  assert.strictEqual(resNotFound.body.success, false);

  const resInvalid = await clients.admin.get('/github/project/invalid-hex-id/commits');
  assert.strictEqual(resInvalid.status, 400);
  assert.strictEqual(resInvalid.body.success, false);
});

test('6. Returned payloads contain zero tokens, secrets, or internal authentication headers', async () => {
  const [commitsRes, pullsRes, issuesRes, branchesRes] = await Promise.all([
    clients.employeeA.get(`/github/project/${testProject._id}/commits`),
    clients.employeeA.get(`/github/project/${testProject._id}/pulls`),
    clients.employeeA.get(`/github/project/${testProject._id}/issues`),
    clients.employeeA.get(`/github/project/${testProject._id}/branches`),
  ]);

  const combinedPayload = JSON.stringify({
    commits: commitsRes.body,
    pulls: pullsRes.body,
    issues: issuesRes.body,
    branches: branchesRes.body,
  }).toLowerCase();

  assert.strictEqual(combinedPayload.includes('ghp_'), false);
  assert.strictEqual(combinedPayload.includes('github_pat_'), false);
  assert.strictEqual(combinedPayload.includes('bearer ghp'), false);
  assert.strictEqual(combinedPayload.includes('webhook_secret'), false);
});

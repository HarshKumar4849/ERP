const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { seedFixtures, cleanupFixtures } = require('./fixtures');
const qa = require('./qa-env');

const TEST_WEBHOOK_SECRET = 'tecmotiv-qa-webhook-secret-99482';
process.env.GITHUB_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
process.env.QA_GITHUB_MOCK = 'true';

let clients;
let createdFixtures;
let testProject;
let testTask;
let unrelatedTask;
let server;
let baseUrl;

function computeSignature(payload, secret = TEST_WEBHOOK_SECRET) {
  const jsonStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const hex = crypto.createHmac('sha256', secret).update(Buffer.from(jsonStr, 'utf8')).digest('hex');
  return `sha256=${hex}`;
}

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

async function sendWebhook({ deliveryId, event, payload }) {
  const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signature = computeSignature(payload);

  const res = await fetch(`${baseUrl}/github/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-github-delivery': deliveryId,
      'x-github-event': event,
      'x-hub-signature-256': signature,
    },
    body: rawBody,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
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
  testProject = await Project.create({
    name: `QA Task Mapping Project ${qa.RUN_ID}`,
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
      repoId: 887711,
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

  const Task = mongoose.model('Task');
  testTask = await Task.create({
    task: `TASK-${qa.RUN_ID}: Implement OAuth2 PKCE Flow`,
    title: `TASK-${qa.RUN_ID}: Implement OAuth2 PKCE Flow`,
    description: 'Ensure PKCE verification with code challenge',
    owner: createdFixtures.employee.employee._id,
    assignedTo: createdFixtures.employee.user._id,
    department: 'Engineering',
    project: testProject._id,
    projectName: testProject.name,
    priority: 'High',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'In Progress',
    createdBy: createdFixtures.admin.user._id,
    githubLinks: {
      branches: [],
      commits: [],
      pullRequests: [],
    },
  });

  unrelatedTask = await Task.create({
    task: `Sales Private Task ${qa.RUN_ID}`,
    title: `Sales Private Task ${qa.RUN_ID}`,
    description: 'Confidential client sales quota',
    owner: createdFixtures.employeeSales.employee._id,
    assignedTo: createdFixtures.employeeSales.user._id,
    department: 'Sales',
    priority: 'Medium',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    status: 'Not Started',
    createdBy: createdFixtures.employeeSales.user._id,
  });
});

test.after(async () => {
  if (server) {
    server.close();
  }
  if (testProject?._id) {
    await mongoose.model('Project').deleteMany({ _id: testProject._id });
  }
  if (testTask?._id) {
    await mongoose.model('Task').deleteMany({
      _id: { $in: [testTask._id, unrelatedTask?._id].filter(Boolean) },
    });
  }
  await cleanupFixtures(createdFixtures);
});

test('1. Automated commit linking: Webhook push with task identifier links commit to Task', async () => {
  const deliveryId = `deliv-task-push-${qa.RUN_ID}-01`;
  const commitSha = '4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b';

  const payload = {
    ref: 'refs/heads/main',
    repository: { id: 887711, full_name: 'Tecmotiv-Solutions/erp-core' },
    commits: [
      {
        id: commitSha,
        message: `feat(auth): complete PKCE flow [TASK:${testTask._id}]`,
        author: { name: 'Lead Dev' },
        url: `https://github.com/Tecmotiv-Solutions/erp-core/commit/${commitSha}`,
      },
    ],
  };

  const res = await sendWebhook({
    deliveryId,
    event: 'push',
    payload,
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.result.affectedTasks.includes(testTask._id.toString()));

  // Verify MongoDB Task directly
  const Task = mongoose.model('Task');
  const dbTask = await Task.findById(testTask._id).lean();
  assert.ok(dbTask.githubLinks.commits.length >= 1);
  const linkedCommit = dbTask.githubLinks.commits.find((c) => c.sha === commitSha);
  assert.ok(linkedCommit);
  assert.strictEqual(linkedCommit.shortSha, '4a5b6c7');
  assert.match(linkedCommit.message, /complete PKCE flow/);
});

test('2. Automated commit deduplication: Re-pushing with same commit does not duplicate in Task', async () => {
  const deliveryId = `deliv-task-push-dup-${qa.RUN_ID}-02`;
  const commitSha = '4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b';

  const payload = {
    ref: 'refs/heads/main',
    repository: { id: 887711, full_name: 'Tecmotiv-Solutions/erp-core' },
    commits: [
      {
        id: commitSha,
        message: `feat(auth): complete PKCE flow [TASK:${testTask._id}]`,
        author: { name: 'Lead Dev' },
        url: `https://github.com/Tecmotiv-Solutions/erp-core/commit/${commitSha}`,
      },
    ],
  };

  const res = await sendWebhook({
    deliveryId,
    event: 'push',
    payload,
  });

  assert.strictEqual(res.status, 200);

  const Task = mongoose.model('Task');
  const dbTask = await Task.findById(testTask._id).lean();
  const matchingCommits = dbTask.githubLinks.commits.filter((c) => c.sha === commitSha);
  assert.strictEqual(matchingCommits.length, 1);
});

test('3. Automated PR linking: Webhook pull request with task tag links PR to Task', async () => {
  const deliveryId = `deliv-task-pr-${qa.RUN_ID}-03`;
  const prNumber = 63;

  const payload = {
    action: 'opened',
    pull_request: {
      number: prNumber,
      title: `feat: OAuth2 PKCE review [TASK-${qa.RUN_ID}]`,
      state: 'open',
      html_url: `https://github.com/Tecmotiv-Solutions/erp-core/pull/${prNumber}`,
      merged: false,
      head: { ref: 'feature/pkce-auth' },
      base: { ref: 'main' },
    },
    repository: { id: 887711, full_name: 'Tecmotiv-Solutions/erp-core' },
  };

  const res = await sendWebhook({
    deliveryId,
    event: 'pull_request',
    payload,
  });

  assert.strictEqual(res.status, 200);
  assert.ok(res.body.result.affectedTasks.includes(testTask._id.toString()));

  const Task = mongoose.model('Task');
  const dbTask = await Task.findById(testTask._id).lean();
  const linkedPR = dbTask.githubLinks.pullRequests.find((p) => p.number === prNumber);
  assert.ok(linkedPR);
  assert.strictEqual(linkedPR.state, 'open');
  assert.strictEqual(linkedPR.isMerged, false);
});

test('4. Manual linking & retrieval: Engineers can manually link branches, commits, and PRs', async () => {
  // Task Owner links branch manually
  const resLinkBranch = await clients.employeeA.post(`/task/${testTask._id}/github/link`, {
    type: 'branch',
    item: { name: 'feature/vault-security', url: 'https://github.com/Tecmotiv-Solutions/erp-core/tree/feature/vault-security' },
  });
  assert.strictEqual(resLinkBranch.status, 200);
  assert.strictEqual(resLinkBranch.body.success, true);
  assert.ok(resLinkBranch.body.result.branches.some((b) => b.name === 'feature/vault-security'));

  // Task Assignee links commit manually
  const resLinkCommit = await clients.employeeA.post(`/task/${testTask._id}/github/link`, {
    type: 'commit',
    item: {
      sha: '11223344556677889900aabbccddeeff00112233',
      shortSha: '1122334',
      message: 'manual hotfix: session revocation',
    },
  });
  assert.strictEqual(resLinkCommit.status, 200);
  assert.ok(resLinkCommit.body.result.commits.some((c) => c.sha === '11223344556677889900aabbccddeeff00112233'));

  // Query GET /api/task/:id/github
  const resGetLinks = await clients.employeeA.get(`/task/${testTask._id}/github`);
  assert.strictEqual(resGetLinks.status, 200);
  assert.ok(resGetLinks.body.result.branches.length >= 1);
  assert.ok(resGetLinks.body.result.commits.length >= 2);
  assert.ok(resGetLinks.body.result.pullRequests.length >= 1);
});

test('5. Manual unlinking: Removing linked branch, commit, or PR updates task state', async () => {
  // Unlink branch
  const resUnlinkBranch = await clients.employeeA.post(`/task/${testTask._id}/github/unlink`, {
    type: 'branch',
    identifier: 'feature/vault-security',
  });
  assert.strictEqual(resUnlinkBranch.status, 200);
  assert.strictEqual(
    resUnlinkBranch.body.result.branches.some((b) => b.name === 'feature/vault-security'),
    false
  );

  // Unlink commit
  const resUnlinkCommit = await clients.employeeA.post(`/task/${testTask._id}/github/unlink`, {
    type: 'commit',
    identifier: '11223344556677889900aabbccddeeff00112233',
  });
  assert.strictEqual(resUnlinkCommit.status, 200);
  assert.strictEqual(
    resUnlinkCommit.body.result.commits.some((c) => c.sha === '11223344556677889900aabbccddeeff00112233'),
    false
  );
});

test('6. Access control: Non-member employee is denied access (403) and unauth is rejected (401)', async () => {
  // Non-member employee (Sales) denied reading task links
  const resGetForbidden = await clients.employeeSales.get(`/task/${testTask._id}/github`);
  assert.strictEqual(resGetForbidden.status, 403);
  assert.strictEqual(resGetForbidden.body.success, false);

  // Non-member employee (Sales) denied linking
  const resLinkForbidden = await clients.employeeSales.post(`/task/${testTask._id}/github/link`, {
    type: 'branch',
    item: { name: 'sales-unauthorized-branch' },
  });
  assert.strictEqual(resLinkForbidden.status, 403);

  // Unauthenticated client denied
  const resUnauth = await clients.unauth.get(`/task/${testTask._id}/github`);
  assert.strictEqual(resUnauth.status, 401);
});

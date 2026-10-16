const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { seedFixtures, cleanupFixtures } = require('./fixtures');
const qa = require('./qa-env');

const TEST_WEBHOOK_SECRET = 'tecmotiv-qa-webhook-secret-99482';
process.env.GITHUB_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
process.env.GITHUB_TOKEN = 'ghp_secretTokenThatMustNeverLeakToClient12345';
process.env.QA_GITHUB_MOCK = 'true';

let clients;
let createdFixtures;
let testProject;
let testTask;
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
      return { status: res.status, body, headers: res.headers };
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
      return { status: res.status, body, headers: res.headers };
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
    login(createdFixtures.employee.user.email), // PM
    login(createdFixtures.employeeB.user.email), // Team Member
    login(createdFixtures.employeeSales.user.email), // Non-member
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
    name: `QA Security Project ${qa.RUN_ID}`,
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
      repoId: 776655,
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
    task: `TASK-${qa.RUN_ID}: Hardened Task for Security Audit`,
    title: `TASK-${qa.RUN_ID}: Hardened Task for Security Audit`,
    description: 'Security testing task',
    owner: createdFixtures.employee.employee._id,
    assignedTo: createdFixtures.employee.user._id,
    department: 'Engineering',
    project: testProject._id,
    projectName: testProject.name,
    priority: 'Critical',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'In Progress',
    createdBy: createdFixtures.admin.user._id,
    githubLinks: {
      branches: [],
      commits: [],
      pullRequests: [],
    },
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
    await mongoose.model('Task').deleteMany({ _id: testTask._id });
  }
  await cleanupFixtures(createdFixtures);
});

test('1. Secret leak scan: All responses from GitHub endpoints are completely free of tokens and secrets', async () => {
  const endpoints = [
    `/github/project/${testProject._id}/overview`,
    `/github/project/${testProject._id}/commits`,
    `/github/project/${testProject._id}/pulls`,
    `/github/project/${testProject._id}/issues`,
    `/github/project/${testProject._id}/branches`,
    `/github/project/${testProject._id}/activity`,
    `/task/${testTask._id}/github`,
  ];

  for (const ep of endpoints) {
    const res = await clients.employeeA.get(ep);
    assert.strictEqual(res.status, 200, `Expected 200 for endpoint: ${ep}`);

    const payload = JSON.stringify(res.body);

    assert.strictEqual(payload.includes('ghp_'), false, `Token found in ${ep}`);
    assert.strictEqual(payload.includes('github_pat_'), false, `PAT found in ${ep}`);
    assert.strictEqual(payload.includes(process.env.GITHUB_TOKEN), false, `GITHUB_TOKEN found in ${ep}`);
    assert.strictEqual(payload.includes(TEST_WEBHOOK_SECRET), false, `WEBHOOK_SECRET found in ${ep}`);
    assert.strictEqual(payload.includes('Bearer '), false, `Bearer auth header found in ${ep}`);
  }
});

test('2. Stored XSS defense: Injected HTML/script payloads in webhook commits and PRs are sanitized', async () => {
  const deliveryId = `deliv-xss-attack-${qa.RUN_ID}`;
  const commitSha = '9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e';
  const maliciousXssMsg = `<script>alert('xss-1')</script><img src=x onerror=alert('xss-2')> feat: injection test [TASK:${testTask._id}]`;

  const payload = {
    ref: 'refs/heads/main',
    repository: { id: 776655, full_name: 'Tecmotiv-Solutions/erp-core' },
    commits: [
      {
        id: commitSha,
        message: maliciousXssMsg,
        author: { name: '<b onmouseover=alert(1)>Hacker</b>' },
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

  // Verify MongoDB Task commit message is sanitized and has escaped brackets
  const Task = mongoose.model('Task');
  const dbTask = await Task.findById(testTask._id).lean();
  const linked = dbTask.githubLinks.commits.find((c) => c.sha === commitSha);
  assert.ok(linked);
  assert.strictEqual(linked.message.includes('<script>'), false);
  assert.strictEqual(linked.message.includes('<img'), false);
  assert.ok(linked.message.includes('&lt;script&gt;') || !linked.message.includes('<'));

  // Verify GithubActivity record is also sanitized
  const GithubActivity = mongoose.models.GithubActivity || mongoose.model('GithubActivity');
  const activityDoc = await GithubActivity.findOne({ deliveryId }).lean();
  assert.ok(activityDoc);
  assert.strictEqual(activityDoc.summary.includes('<script>'), false);
});

test('3. Input validation: Malformed commit SHAs, PR numbers, and branch names are rejected (400)', async () => {
  // Invalid commit SHA formats
  const invalidShas = [
    'not-a-hex',
    '12345', // too short (<7 chars)
    'g'.repeat(40), // invalid hex
    '4a5b; DROP TABLE tasks;--',
    '<script>alert(1)</script>',
  ];

  for (const sha of invalidShas) {
    const res = await clients.employeeA.post(`/task/${testTask._id}/github/link`, {
      type: 'commit',
      item: { sha },
    });
    assert.strictEqual(res.status, 400, `Expected 400 for sha "${sha}", got ${res.status}`);
    assert.strictEqual(res.body.success, false);
  }

  // Invalid PR numbers
  const invalidPrs = [-1, 0, 'abc', 'NaN'];
  for (const pr of invalidPrs) {
    const res = await clients.employeeA.post(`/task/${testTask._id}/github/link`, {
      type: 'pullRequest',
      item: { number: pr },
    });
    assert.strictEqual(res.status, 400, `Expected 400 for pr "${pr}", got ${res.status}`);
  }

  // Invalid branch names
  const invalidBranches = [
    '<script>alert(1)</script>',
    'branch with spaces',
    'branch;rm -rf /',
  ];
  for (const branch of invalidBranches) {
    const res = await clients.employeeA.post(`/task/${testTask._id}/github/link`, {
      type: 'branch',
      item: { name: branch },
    });
    assert.strictEqual(res.status, 400, `Expected 400 for branch "${branch}", got ${res.status}`);
  }
});

test('4. Rate limiter headers: Proxy endpoints include active rate-limiting headers', async () => {
  const res = await clients.employeeA.get(`/github/project/${testProject._id}/overview`);
  assert.strictEqual(res.status, 200);

  // express-rate-limit standard headers
  const limitHeader = res.headers.get('ratelimit-limit');
  const remainingHeader = res.headers.get('ratelimit-remaining');

  assert.ok(limitHeader, 'ratelimit-limit header should be present');
  assert.ok(remainingHeader !== null, 'ratelimit-remaining header should be present');
});

test('5. Non-member and unauthenticated access remains strictly prohibited (403/401)', async () => {
  // Non-member employee cannot query activity or overview
  const resOverviewForbidden = await clients.employeeSales.get(`/github/project/${testProject._id}/overview`);
  assert.strictEqual(resOverviewForbidden.status, 403);

  const resActivityForbidden = await clients.employeeSales.get(`/github/project/${testProject._id}/activity`);
  assert.strictEqual(resActivityForbidden.status, 403);

  // Unauthenticated requests denied with 401
  const resUnauth = await clients.unauth.get(`/github/project/${testProject._id}/overview`);
  assert.strictEqual(resUnauth.status, 401);
});

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
let unauthorizedProject;
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
    async delete(path) {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'DELETE',
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json().catch(() => null);
      return { status: res.status, body, headers: res.headers };
    },
  };
}

test.before(async () => {
  const app = require('../src/app');
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/api`;
      resolve();
    });
  });

  createdFixtures = await seedFixtures();
  const [adminToken, pmToken, employeeToken] = await Promise.all([
    login(createdFixtures.admin.user.email),
    login(createdFixtures.employee.user.email),
    login(createdFixtures.employeeB.user.email),
  ]);

  clients = {
    admin: makeClient(adminToken),
    pm: makeClient(pmToken),
    employee: makeClient(employeeToken),
    anonymous: makeClient(null),
  };

  const Project = mongoose.model('Project');
  const Task = mongoose.model('Task');

  // Create authorized project with PM and Employee
  testProject = await Project.create({
    name: 'TecMotiv Concurrency & Stress Hub',
    category: 'MDS',
    department: 'Engineering',
    projectManager: createdFixtures.employee.employee._id,
    teamMembers: [createdFixtures.employee.employee._id, createdFixtures.employeeB.employee._id],
    startDate: new Date(),
    targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'In Progress',
    createdBy: createdFixtures.admin.user._id,
    github: {
      enabled: true,
      repoId: 987654321,
      repoOwner: 'Tecmotiv-Solutions',
      repoName: 'core-stress-engine',
      fullName: 'Tecmotiv-Solutions/core-stress-engine',
      repoUrl: 'https://github.com/Tecmotiv-Solutions/core-stress-engine',
      defaultBranch: 'main',
      isLinked: true,
      linkedBy: createdFixtures.employee.user._id,
      linkedAt: new Date(),
      syncStatus: 'idle',
    },
  });

  // Create separate private project where employeeB is NOT a member
  unauthorizedProject = await Project.create({
    name: 'TecMotiv Admin Vault Only',
    category: 'MDS',
    department: 'Engineering',
    projectManager: createdFixtures.employee.employee._id,
    teamMembers: [createdFixtures.employee.employee._id],
    startDate: new Date(),
    targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'In Progress',
    createdBy: createdFixtures.admin.user._id,
    github: {
      enabled: true,
      repoId: 112233445,
      repoOwner: 'Tecmotiv-Solutions',
      repoName: 'admin-vault',
      fullName: 'Tecmotiv-Solutions/admin-vault',
      repoUrl: 'https://github.com/Tecmotiv-Solutions/admin-vault',
      defaultBranch: 'main',
      isLinked: true,
      linkedBy: createdFixtures.employee.user._id,
      linkedAt: new Date(),
      syncStatus: 'idle',
    },
  });

  testTask = await Task.create({
    project: testProject._id,
    task: '[TASK-CONCURRENCY-101] Stress Test Async Queues',
    title: '[TASK-CONCURRENCY-101] Stress Test Async Queues',
    department: 'Engineering',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'In Progress',
    assignedTo: createdFixtures.employeeB.user._id,
    githubLinks: {
      branches: [],
      commits: [],
      pullRequests: [],
    },
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await cleanupFixtures(createdFixtures);
});

test('1. High-concurrency duplicate webhook delivery creates exactly 1 audit record and handles all requests gracefully', async () => {
  const deliveryId = `stress-delivery-${crypto.randomUUID()}`;
  const payload = {
    action: 'opened',
    repository: {
      id: testProject.github.repositoryId,
      full_name: testProject.github.fullName,
      name: testProject.github.repo,
      owner: { login: testProject.github.owner },
    },
    sender: {
      login: 'tecmotiv-concurrency-bot',
      avatar_url: 'https://github.com/tecmotiv-concurrency-bot.png',
    },
    pull_request: {
      number: 991,
      title: 'feat: add lock-free concurrent ring buffer',
      state: 'open',
      html_url: `https://github.com/${testProject.github.fullName}/pull/991`,
    },
  };

  const payloadString = JSON.stringify(payload);
  const signature = computeSignature(payloadString);

  // Send 10 simultaneous webhook requests with identical delivery ID
  const CONCURRENCY_COUNT = 10;
  const requests = Array.from({ length: CONCURRENCY_COUNT }).map(() =>
    fetch(`${baseUrl}/github/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-github-delivery': deliveryId,
        'x-github-event': 'pull_request',
        'x-hub-signature-256': signature,
      },
      body: payloadString,
    })
  );

  const responses = await Promise.all(requests);

  // Assert all responses are 200 OK
  for (const res of responses) {
    assert.equal(res.status, 200, `Expected 200 from concurrent webhook, got ${res.status}`);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.result.status === 'processed' || json.result.status === 'duplicate');
  }

  // Verify database state: exactly ONE GithubActivity record must exist for this deliveryId
  const GithubActivity = mongoose.model('GithubActivity');
  const activities = await GithubActivity.find({ deliveryId });
  assert.equal(activities.length, 1, `Expected exactly 1 GithubActivity record, found ${activities.length}`);
});

test('2. High-concurrency manual artifact linking to a Task prevents duplicate links and race corruption', async () => {
  const commitSha = 'deadbeef1234567890abcdef1234567890abcdef';
  const CONCURRENCY_COUNT = 8;

  // Send 8 simultaneous link requests for the exact same commit
  const commitLinkRequests = Array.from({ length: CONCURRENCY_COUNT }).map(() =>
    clients.pm.post(`/task/${testTask._id}/github/link`, {
      type: 'commit',
      sha: commitSha,
      shortSha: 'deadbee',
      message: 'perf: optimize critical path latency',
      author: 'TecMotiv Lead',
      url: `https://github.com/${testProject.github.fullName}/commit/${commitSha}`,
    })
  );

  const commitResponses = await Promise.all(commitLinkRequests);
  for (const res of commitResponses) {
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  }

  // Verify task commits array contains exactly ONE entry for this SHA
  const Task = mongoose.model('Task');
  let refreshedTask = await Task.findById(testTask._id);
  const matchingCommits = refreshedTask.githubLinks.commits.filter((c) => c.sha === commitSha);
  assert.equal(matchingCommits.length, 1, `Expected exactly 1 commit link, found ${matchingCommits.length}`);

  // Send 8 simultaneous link requests for the exact same PR
  const prNumber = 777;
  const prLinkRequests = Array.from({ length: CONCURRENCY_COUNT }).map(() =>
    clients.pm.post(`/task/${testTask._id}/github/link`, {
      type: 'pullRequest',
      number: prNumber,
      title: 'PR #777: High speed event loop',
      state: 'open',
      url: `https://github.com/${testProject.github.fullName}/pull/${prNumber}`,
    })
  );

  const prResponses = await Promise.all(prLinkRequests);
  for (const res of prResponses) {
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  }

  refreshedTask = await Task.findById(testTask._id);
  const matchingPRs = refreshedTask.githubLinks.pullRequests.filter((p) => p.number === prNumber);
  assert.equal(matchingPRs.length, 1, `Expected exactly 1 PR link, found ${matchingPRs.length}`);
});

test('3. Graceful degradation and error handling on GitHub API non-existent resources', async () => {
  // Test linking a repository that does not exist on GitHub
  const nonExistentRes = await clients.admin.post(`/github/project/${testProject._id}/link`, {
    repository: 'nonexistent/notfound',
  });

  assert.equal(nonExistentRes.status, 404);
  assert.equal(nonExistentRes.body.success, false);
  assert.ok(nonExistentRes.body.message.includes('not found'));
});

test('4. Cross-project boundary enforcement under concurrent load prevents unauthorized data access', async () => {
  // Employee2 is not in unauthorizedProject. Send 8 simultaneous reads to unauthorized project activity & sync
  const CONCURRENCY_COUNT = 8;
  const unauthorizedRequests = Array.from({ length: CONCURRENCY_COUNT }).map(() =>
    clients.employee.get(`/github/project/${unauthorizedProject._id}/activity`)
  );

  const responses = await Promise.all(unauthorizedRequests);
  for (const res of responses) {
    assert.equal(res.status, 403, `Expected 403 for unauthorized project access, got ${res.status}`);
    assert.equal(res.body.success, false);
  }
});

test('5. End-to-end task workflow integration: automated link extraction, reconciliation, and unlink', async () => {
  // Create an explicit task
  const Task = mongoose.model('Task');
  const e2eTask = await Task.create({
    project: testProject._id,
    task: '[TASK-E2E-88] Realtime Distributed Caching',
    title: '[TASK-E2E-88] Realtime Distributed Caching',
    department: 'Engineering',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'In Progress',
    assignedTo: createdFixtures.employeeB.user._id,
    githubLinks: { branches: [], commits: [], pullRequests: [] },
  });

  // Send a webhook push event that explicitly references [TASK-E2E-88]
  const pushDeliveryId = `push-e2e-${crypto.randomUUID()}`;
  const commitSha = 'abc111222333444555666777888999000aaabbbc';
  const pushPayload = {
    ref: 'refs/heads/main',
    repository: {
      id: testProject.github.repositoryId,
      full_name: testProject.github.fullName,
      name: testProject.github.repo,
      owner: { login: testProject.github.owner },
    },
    sender: { login: 'tecmotiv-worker' },
    commits: [
      {
        id: commitSha,
        message: 'feat: [TASK-E2E-88] wire up redis sentinel cluster',
        author: { name: 'E2E Worker' },
        url: `https://github.com/${testProject.github.fullName}/commit/${commitSha}`,
      },
    ],
  };

  const pushPayloadStr = JSON.stringify(pushPayload);
  const pushSig = computeSignature(pushPayloadStr);

  const webhookRes = await fetch(`${baseUrl}/github/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-github-delivery': pushDeliveryId,
      'x-github-event': 'push',
      'x-hub-signature-256': pushSig,
    },
    body: pushPayloadStr,
  });

  assert.equal(webhookRes.status, 200);
  const webhookBody = await webhookRes.json();
  assert.equal(webhookBody.success, true);
  assert.ok(webhookBody.result.affectedTasks.includes(e2eTask._id.toString()));

  // Verify task now has the commit
  let taskCheck = await Task.findById(e2eTask._id);
  assert.equal(taskCheck.githubLinks.commits.length, 1);
  assert.equal(taskCheck.githubLinks.commits[0].sha, commitSha);

  // Trigger manual reconciliation sync by PM
  const syncRes = await clients.pm.post(`/github/project/${testProject._id}/sync`);
  assert.equal(syncRes.status, 200);
  assert.equal(syncRes.body.success, true);

  // Verify unlinking an item works cleanly
  const unlinkRes = await clients.pm.post(`/task/${e2eTask._id}/github/unlink`, {
    type: 'commit',
    identifier: commitSha,
  });
  assert.equal(unlinkRes.status, 200);
  assert.equal(unlinkRes.body.success, true);

  taskCheck = await Task.findById(e2eTask._id);
  assert.equal(taskCheck.githubLinks.commits.length, 0);
});

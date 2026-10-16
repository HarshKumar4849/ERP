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
let unlinkedProject;
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

async function sendWebhook({ deliveryId, event, payload, signature, customHeaders = {} }) {
  const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const headers = {
    'content-type': 'application/json',
    'x-github-delivery': deliveryId,
    'x-github-event': event,
    ...(signature !== undefined ? { 'x-hub-signature-256': signature } : {}),
    ...customHeaders,
  };

  const res = await fetch(`${baseUrl}/github/webhook`, {
    method: 'POST',
    headers,
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
    name: `QA Live Sync Project ${qa.RUN_ID}`,
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
      repoId: 1044992,
      repoOwner: 'Tecmotiv-Solutions',
      repoName: 'erp-core',
      fullName: 'Tecmotiv-Solutions/erp-core',
      repoUrl: 'https://github.com/Tecmotiv-Solutions/erp-core',
      defaultBranch: 'main',
      lastSyncAt: new Date(Date.now() - 3600000), // 1 hour ago
      syncStatus: 'idle',
      linkedBy: createdFixtures.employee.user._id,
      linkedAt: new Date(),
    },
  });

  unlinkedProject = await Project.create({
    name: `QA Unlinked Project ${qa.RUN_ID}`,
    category: 'B2B',
    department: 'Engineering',
    projectManager: createdFixtures.employee.employee._id,
    teamMembers: [],
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
    const GithubActivity = mongoose.models.GithubActivity || mongoose.model('GithubActivity');
    await GithubActivity.deleteMany({ project: testProject._id });
  }
  await cleanupFixtures(createdFixtures);
});

test('1. Missing or malformed signature and missing delivery header are rejected with 400/401', async () => {
  const payload = { ping: 'hello' };

  // Missing delivery header
  const resNoDelivery = await fetch(`${baseUrl}/github/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.strictEqual(resNoDelivery.status, 400);

  // Missing signature header
  const resNoSig = await sendWebhook({
    deliveryId: 'deliv-missing-sig-1',
    event: 'ping',
    payload,
  });
  assert.strictEqual(resNoSig.status, 401);
  assert.match(resNoSig.body.message, /Missing x-hub-signature-256/i);

  // Malformed signature prefix
  const resBadPrefix = await sendWebhook({
    deliveryId: 'deliv-bad-prefix-1',
    event: 'ping',
    payload,
    signature: 'sha1=9f8a8c2d1b',
  });
  assert.strictEqual(resBadPrefix.status, 401);
  assert.match(resBadPrefix.body.message, /Invalid signature prefix/i);
});

test('2. Forged signature or tampered body is rejected with 401 Unauthorized', async () => {
  const payload = { event: 'forged_attempt' };

  // Forged signature using wrong secret
  const forgedSig = computeSignature(payload, 'wrong-attacker-secret');
  const resForged = await sendWebhook({
    deliveryId: 'deliv-forged-1',
    event: 'push',
    payload,
    signature: forgedSig,
  });
  assert.strictEqual(resForged.status, 401);
  assert.match(resForged.body.message, /Signature mismatch/i);

  // Signature valid for payload A, but payload B is transmitted (body tampering)
  const validSigA = computeSignature({ original: 'body' });
  const resTampered = await sendWebhook({
    deliveryId: 'deliv-tampered-1',
    event: 'push',
    payload: { altered: 'body' },
    signature: validSigA,
  });
  assert.strictEqual(resTampered.status, 401);
  assert.match(resTampered.body.message, /Signature mismatch/i);
});

test('3. Valid push webhook updates project sync status, lastSyncAt, and records activity', async () => {
  const deliveryId = `deliv-push-${qa.RUN_ID}-001`;
  const initialSyncAt = testProject.github.lastSyncAt;

  const pushPayload = {
    ref: 'refs/heads/main',
    after: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
    repository: {
      id: 1044992,
      full_name: 'Tecmotiv-Solutions/erp-core',
      name: 'erp-core',
      owner: { login: 'Tecmotiv-Solutions' },
    },
    sender: {
      login: 'tecmotiv-dev',
      avatar_url: 'https://avatars.githubusercontent.com/u/50052356?v=4',
    },
    commits: [
      {
        id: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
        message: 'feat(webhook): live synchronization verified',
        author: { name: 'Lead Dev' },
        url: 'https://github.com/Tecmotiv-Solutions/erp-core/commit/9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
      },
    ],
  };

  const signature = computeSignature(pushPayload);
  const res = await sendWebhook({
    deliveryId,
    event: 'push',
    payload: pushPayload,
    signature,
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.result.status, 'processed');
  assert.strictEqual(res.body.result.matchedProject.toString(), testProject._id.toString());

  // Verify Project in MongoDB has updated lastSyncAt
  const Project = mongoose.model('Project');
  const updatedDoc = await Project.findById(testProject._id).lean();
  assert.ok(new Date(updatedDoc.github.lastSyncAt) > new Date(initialSyncAt));
  assert.strictEqual(updatedDoc.github.syncStatus, 'idle');

  // Verify GithubActivity record was created
  const GithubActivity = mongoose.models.GithubActivity || mongoose.model('GithubActivity');
  const activityDoc = await GithubActivity.findOne({ deliveryId }).lean();
  assert.ok(activityDoc);
  assert.strictEqual(activityDoc.event, 'push');
  assert.strictEqual(activityDoc.sender.login, 'tecmotiv-dev');
  assert.strictEqual(activityDoc.payloadSummary.commits.length, 1);
});

test('4. Duplicate webhook delivery ID is handled idempotently without error or re-processing', async () => {
  const deliveryId = `deliv-push-${qa.RUN_ID}-001`; // Same deliveryId as test 3
  const pushPayload = {
    ref: 'refs/heads/main',
    repository: { id: 1044992, full_name: 'Tecmotiv-Solutions/erp-core' },
  };

  const signature = computeSignature(pushPayload);
  const res = await sendWebhook({
    deliveryId,
    event: 'push',
    payload: pushPayload,
    signature,
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.result.status, 'duplicate');
  assert.match(res.body.result.message, /already processed/i);
});

test('5. Pull request and issue webhooks update linked project and record activity stream', async () => {
  // Pull Request Webhook
  const prDeliveryId = `deliv-pr-${qa.RUN_ID}-002`;
  const prPayload = {
    action: 'opened',
    pull_request: {
      number: 88,
      title: 'feat: payroll security hardening',
      state: 'open',
      html_url: 'https://github.com/Tecmotiv-Solutions/erp-core/pull/88',
      merged: false,
    },
    repository: { id: 1044992, full_name: 'Tecmotiv-Solutions/erp-core' },
    sender: { login: 'security-analyst' },
  };

  const resPR = await sendWebhook({
    deliveryId: prDeliveryId,
    event: 'pull_request',
    payload: prPayload,
    signature: computeSignature(prPayload),
  });
  assert.strictEqual(resPR.status, 200);
  assert.strictEqual(resPR.body.result.status, 'processed');

  // Issues Webhook
  const issueDeliveryId = `deliv-issue-${qa.RUN_ID}-003`;
  const issuePayload = {
    action: 'opened',
    issue: {
      number: 105,
      title: 'bug: mobile viewport responsive fixes',
      state: 'open',
      html_url: 'https://github.com/Tecmotiv-Solutions/erp-core/issues/105',
    },
    repository: { id: 1044992, full_name: 'Tecmotiv-Solutions/erp-core' },
    sender: { login: 'qa-tester' },
  };

  const resIssue = await sendWebhook({
    deliveryId: issueDeliveryId,
    event: 'issues',
    payload: issuePayload,
    signature: computeSignature(issuePayload),
  });
  assert.strictEqual(resIssue.status, 200);
  assert.strictEqual(resIssue.body.result.status, 'processed');
});

test('6. Activity stream is visible to project members and strictly denied to non-members', async () => {
  // Authorized team member (Employee B) can view activity
  const resMember = await clients.employeeB.get(`/github/project/${testProject._id}/activity`);
  assert.strictEqual(resMember.status, 200);
  assert.strictEqual(resMember.body.success, true);
  assert.ok(Array.isArray(resMember.body.result));
  assert.ok(resMember.body.result.length >= 3); // push, pr, issue

  // Non-member employee (Employee Sales) is denied with 403
  const resForbidden = await clients.employeeSales.get(`/github/project/${testProject._id}/activity`);
  assert.strictEqual(resForbidden.status, 403);
  assert.strictEqual(resForbidden.body.success, false);

  // Unauthenticated client is denied with 401
  const resUnauth = await clients.unauth.get(`/github/project/${testProject._id}/activity`);
  assert.strictEqual(resUnauth.status, 401);
});

test('7. On-demand reconciliation sync is allowed for PM/Admin and denied for non-managers and unlinked projects', async () => {
  // PM (Employee A) triggers reconciliation sync
  const resSyncPM = await clients.employeeA.post(`/github/project/${testProject._id}/sync`);
  assert.strictEqual(resSyncPM.status, 200);
  assert.strictEqual(resSyncPM.body.success, true);
  assert.strictEqual(resSyncPM.body.result.syncStatus, 'idle');
  assert.ok(resSyncPM.body.result.lastSyncAt);

  // Team member who is not PM is denied with 403
  const resSyncForbidden = await clients.employeeB.post(`/github/project/${testProject._id}/sync`);
  assert.strictEqual(resSyncForbidden.status, 403);
  assert.strictEqual(resSyncForbidden.body.success, false);

  // Syncing an unlinked project returns 400
  const resSyncUnlinked = await clients.admin.post(`/github/project/${unlinkedProject._id}/sync`);
  assert.strictEqual(resSyncUnlinked.status, 400);
  assert.strictEqual(resSyncUnlinked.body.success, false);
});

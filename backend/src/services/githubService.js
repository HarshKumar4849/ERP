const https = require('node:https');
const http = require('node:http');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { sanitizeText, redactSecrets } = require('../utils/sanitize');

const GITHUB_API_BASE = process.env.GITHUB_API_BASE_URL || 'https://api.github.com';

function parseRepositoryInput(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Repository URL or identifier is required.');
  }

  let cleaned = input.trim();
  cleaned = cleaned.replace(/\.git\/?$/, '');
  cleaned = cleaned.replace(/\/+$/, '');

  // Extract owner and repo from URL or "owner/repo" shorthand
  const urlPattern = /^(?:https?:\/\/github\.com\/)?([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/i;
  const match = cleaned.match(urlPattern);

  if (!match) {
    throw new Error('Invalid GitHub repository format. Expected "owner/repo" or "https://github.com/owner/repo".');
  }

  const owner = match[1];
  const repo = match[2];

  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
    repoUrl: `https://github.com/${owner}/${repo}`,
  };
}

function makeGitHubRequest(endpointPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpointPath, GITHUB_API_BASE);
    const headers = {
      'User-Agent': 'TecMotiv-ERP',
      Accept: 'application/vnd.github.v3+json',
      ...options.headers,
    };

    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN.trim()}`;
    }

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      url,
      {
        method: options.method || 'GET',
        headers,
        timeout: options.timeout || 8000,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = rawData ? JSON.parse(rawData) : null;
          } catch (e) {
            parsed = rawData;
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: parsed, headers: res.headers });
          } else {
            const err = new Error(
              parsed && parsed.message ? parsed.message : `GitHub API error (HTTP ${res.statusCode})`
            );
            err.statusCode = res.statusCode;
            err.response = parsed;
            reject(err);
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      const err = new Error('GitHub API request timed out');
      err.statusCode = 504;
      reject(err);
    });

    req.on('error', (err) => {
      // Ensure no Authorization header or token is leaked in error
      err.message = err.message.replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]');
      reject(err);
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function verifyAndFetchRepository(owner, repo) {
  // Check for test mock handler
  if (process.env.QA_GITHUB_MOCK === 'true' || process.env.NODE_ENV === 'test') {
    if (owner.toLowerCase() === 'nonexistent' || repo.toLowerCase() === 'notfound') {
      const notFoundErr = new Error('Repository not found on GitHub.');
      notFoundErr.statusCode = 404;
      throw notFoundErr;
    }
    // Return deterministic mock for test isolation
    return {
      repoId: 987654321,
      owner,
      repo,
      fullName: `${owner}/${repo}`,
      repoUrl: `https://github.com/${owner}/${repo}`,
      defaultBranch: 'main',
      description: 'TecMotiv Solutions Repository',
      isPrivate: false,
    };
  }

  try {
    const res = await makeGitHubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    const data = res.data;
    return {
      repoId: data.id,
      owner: data.owner ? data.owner.login : owner,
      repo: data.name || repo,
      fullName: data.full_name || `${owner}/${repo}`,
      repoUrl: data.html_url || `https://github.com/${owner}/${repo}`,
      defaultBranch: data.default_branch || 'main',
      description: data.description || '',
      isPrivate: Boolean(data.private),
    };
  } catch (error) {
    if (error.statusCode === 404) {
      throw new Error(`Repository "${owner}/${repo}" was not found on GitHub or is private.`);
    }
    if (error.statusCode === 401 || error.statusCode === 403) {
      throw new Error('GitHub authentication failed or API rate limit exceeded.');
    }
    throw error;
  }
}

async function fetchCommits(owner, repo, { branch = 'main', page = 1, limit = 15 } = {}) {
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 15, 30));
  const boundedPage = Math.max(1, Number(page) || 1);

  if (process.env.QA_GITHUB_MOCK === 'true' || process.env.NODE_ENV === 'test') {
    return [
      {
        sha: '7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b',
        shortSha: '7a8b9c0',
        message: 'feat(core): initialize TecMotiv ERP micro-services architecture',
        author: {
          name: 'TecMotiv Lead Engineer',
          username: 'tecmotiv-dev',
          date: new Date(Date.now() - 3600000).toISOString(),
          avatar: 'https://avatars.githubusercontent.com/u/50052356?v=4',
        },
        url: `https://github.com/${owner}/${repo}/commit/7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b`,
        branch,
      },
      {
        sha: '8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c',
        shortSha: '8b9c0d1',
        message: 'fix(auth): enforce immediate session revocation for deactivated users',
        author: {
          name: 'TecMotiv Security Engineer',
          username: 'tecmotiv-sec',
          date: new Date(Date.now() - 7200000).toISOString(),
          avatar: 'https://avatars.githubusercontent.com/u/50052356?v=4',
        },
        url: `https://github.com/${owner}/${repo}/commit/8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c`,
        branch,
      },
    ];
  }

  try {
    const query = new URLSearchParams({
      per_page: String(boundedLimit),
      page: String(boundedPage),
    });
    if (branch) query.append('sha', branch);

    const res = await makeGitHubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?${query.toString()}`);
    const items = Array.isArray(res.data) ? res.data : [];

    return items.map((c) => ({
      sha: c.sha,
      shortSha: (c.sha || '').substring(0, 7),
      message: sanitizeText(c.commit?.message || ''),
      author: {
        name: sanitizeText(c.commit?.author?.name || c.author?.login || 'Developer', 100),
        username: sanitizeText(c.author?.login || '', 100),
        date: c.commit?.author?.date || new Date().toISOString(),
        avatar: c.author?.avatar_url || '',
      },
      url: c.html_url || `https://github.com/${owner}/${repo}/commit/${c.sha}`,
      branch,
    }));
  } catch (err) {
    if (err.statusCode === 404) return [];
    throw err;
  }
}

async function fetchPullRequests(owner, repo, { state = 'all', page = 1, limit = 15 } = {}) {
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 15, 30));
  const boundedPage = Math.max(1, Number(page) || 1);

  if (process.env.QA_GITHUB_MOCK === 'true' || process.env.NODE_ENV === 'test') {
    return [
      {
        id: 101,
        number: 42,
        title: 'ERP-TASK-102: Implement secure GitHub Webhooks receiver',
        state: 'open',
        isMerged: false,
        author: {
          username: 'tecmotiv-dev',
          avatar: 'https://avatars.githubusercontent.com/u/50052356?v=4',
        },
        headBranch: 'feature/github-integration',
        baseBranch: 'main',
        createdAt: new Date(Date.now() - 14400000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
        url: `https://github.com/${owner}/${repo}/pull/42`,
      },
      {
        id: 100,
        number: 41,
        title: 'ERP-TASK-098: Document Vault encryption and access scoping',
        state: 'closed',
        isMerged: true,
        author: {
          username: 'tecmotiv-lead',
          avatar: 'https://avatars.githubusercontent.com/u/50052356?v=4',
        },
        headBranch: 'feat/vault-security',
        baseBranch: 'main',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 43200000).toISOString(),
        url: `https://github.com/${owner}/${repo}/pull/41`,
      },
    ];
  }

  try {
    const query = new URLSearchParams({
      state,
      per_page: String(boundedLimit),
      page: String(boundedPage),
    });

    const res = await makeGitHubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?${query.toString()}`);
    const items = Array.isArray(res.data) ? res.data : [];

    return items.map((pr) => ({
      id: pr.id,
      number: pr.number,
      title: sanitizeText(pr.title || '', 300),
      state: pr.state || 'open',
      isMerged: Boolean(pr.merged_at),
      author: {
        username: sanitizeText(pr.user?.login || 'Developer', 100),
        avatar: pr.user?.avatar_url || '',
      },
      headBranch: sanitizeText(pr.head?.ref || '', 100),
      baseBranch: sanitizeText(pr.base?.ref || '', 100),
      createdAt: pr.created_at || new Date().toISOString(),
      updatedAt: pr.updated_at || new Date().toISOString(),
      url: pr.html_url || `https://github.com/${owner}/${repo}/pull/${pr.number}`,
    }));
  } catch (err) {
    if (err.statusCode === 404) return [];
    throw err;
  }
}

async function fetchIssues(owner, repo, { state = 'all', page = 1, limit = 15 } = {}) {
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 15, 30));
  const boundedPage = Math.max(1, Number(page) || 1);

  if (process.env.QA_GITHUB_MOCK === 'true' || process.env.NODE_ENV === 'test') {
    return [
      {
        id: 201,
        number: 14,
        title: 'Optimize attendance punch clock rendering for mobile devices',
        state: 'open',
        author: {
          username: 'qa-tester',
          avatar: 'https://avatars.githubusercontent.com/u/50052356?v=4',
        },
        assignee: 'tecmotiv-dev',
        commentsCount: 3,
        labels: ['bug', 'mobile'],
        createdAt: new Date(Date.now() - 28800000).toISOString(),
        url: `https://github.com/${owner}/${repo}/issues/14`,
      },
    ];
  }

  try {
    const query = new URLSearchParams({
      state,
      per_page: String(boundedLimit),
      page: String(boundedPage),
    });

    const res = await makeGitHubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?${query.toString()}`);
    const items = Array.isArray(res.data) ? res.data : [];

    // Filter out pull requests as GitHub issues endpoint returns both
    const issuesOnly = items.filter((item) => !item.pull_request);

    return issuesOnly.map((issue) => ({
      id: issue.id,
      number: issue.number,
      title: sanitizeText(issue.title || '', 300),
      state: issue.state || 'open',
      author: {
        username: sanitizeText(issue.user?.login || 'Reporter', 100),
        avatar: issue.user?.avatar_url || '',
      },
      assignee: issue.assignee?.login ? sanitizeText(issue.assignee.login, 100) : null,
      commentsCount: issue.comments || 0,
      labels: Array.isArray(issue.labels) ? issue.labels.map((l) => sanitizeText(typeof l === 'string' ? l : l.name, 50)) : [],
      createdAt: issue.created_at || new Date().toISOString(),
      url: issue.html_url || `https://github.com/${owner}/${repo}/issues/${issue.number}`,
    }));
  } catch (err) {
    if (err.statusCode === 404) return [];
    throw err;
  }
}

async function fetchBranches(owner, repo) {
  if (process.env.QA_GITHUB_MOCK === 'true' || process.env.NODE_ENV === 'test') {
    return [
      { name: 'main', isProtected: true },
      { name: 'develop', isProtected: false },
      { name: 'feature/github-integration', isProtected: false },
    ];
  }

  try {
    const res = await makeGitHubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=30`);
    const items = Array.isArray(res.data) ? res.data : [];
    return items.map((b) => ({
      name: sanitizeText(b.name || '', 100),
      isProtected: Boolean(b.protected),
    }));
  } catch (err) {
    if (err.statusCode === 404) return [{ name: 'main', isProtected: false }];
    throw err;
  }
}

// =========================================================================
// 8. WEBHOOK SIGNATURE VERIFICATION (HMAC-SHA256)
// =========================================================================
function verifyWebhookSignature(rawBody, signatureHeader, customSecret) {
  const secret = customSecret || process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return { valid: false, reason: 'Webhook verification error: GITHUB_WEBHOOK_SECRET is not configured.' };
  }

  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { valid: false, reason: 'Missing x-hub-signature-256 header.' };
  }

  if (!signatureHeader.startsWith('sha256=')) {
    return { valid: false, reason: 'Invalid signature prefix. Expected "sha256=".' };
  }

  try {
    const bodyBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody || {}), 'utf8');

    const computedHex = crypto.createHmac('sha256', secret).update(bodyBuffer).digest('hex');
    const expectedSignature = `sha256=${computedHex}`;

    const sigBuffer = Buffer.from(signatureHeader, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length) {
      return { valid: false, reason: 'Signature mismatch.' };
    }

    const isValid = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    return isValid ? { valid: true } : { valid: false, reason: 'Signature mismatch.' };
  } catch (err) {
    return { valid: false, reason: `Signature verification failed: ${err.message}` };
  }
}

// =========================================================================
// 8B. TASK IDENTIFIER PARSING & AUTOMATED TASK LINKING
// =========================================================================
function extractTaskIdentifiers(text) {
  if (!text || typeof text !== 'string') return [];
  const identifiers = new Set();

  // 1. Explicit 24-hex MongoDB ObjectId: [TASK:60d5ec49f1b2c800155b4b12] or TASK-60d5ec...
  const objectIdRegex = /(?:\[|\b)(?:ERP-)?TASK[-:# ]*([a-fA-F0-9]{24})(?:\]|\b)/gi;
  let match;
  while ((match = objectIdRegex.exec(text)) !== null) {
    identifiers.add(match[1]);
  }

  // 2. Bracketed tags: [TASK: 101], [TASK-101], [ERP-TASK-42], [TASK: auth-flow]
  const bracketRegex = /\[(?:ERP-)?TASK[-:# ]*([^\]]+)\]/gi;
  while ((match = bracketRegex.exec(text)) !== null) {
    const val = match[1].trim();
    if (val) identifiers.add(val);
  }

  // 3. Prefix tags: ERP-TASK-42, TASK-102, TASK#99
  const prefixRegex = /\b(?:ERP-)?TASK[-_#](\w+)\b/gi;
  while ((match = prefixRegex.exec(text)) !== null) {
    const val = match[1].trim();
    if (val) identifiers.add(val);
  }

  return Array.from(identifiers);
}

async function linkArtifactToTasks(projectId, identifiers, artifact, type) {
  if (!projectId || !identifiers || identifiers.length === 0) return [];
  const Task = mongoose.models.Task || mongoose.model('Task');
  const linkedTaskIds = [];

  for (const idStr of identifiers) {
    const query = { project: projectId, removed: false };
    const conditions = [];

    if (mongoose.Types.ObjectId.isValid(idStr)) {
      conditions.push({ _id: new mongoose.Types.ObjectId(idStr) });
    }

    const escaped = idStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    conditions.push({ task: { $regex: new RegExp(`(?:^|\\b|#)${escaped}(?:\\b|$)`, 'i') } });
    conditions.push({ title: { $regex: new RegExp(`(?:^|\\b|#)${escaped}(?:\\b|$)`, 'i') } });

    query.$or = conditions;

    const tasks = await Task.find(query);
    for (const t of tasks) {
      if (!t.githubLinks) {
        t.githubLinks = { branches: [], commits: [], pullRequests: [] };
      }

      if (type === 'commit') {
        const alreadyLinked = t.githubLinks.commits.some((c) => c.sha === artifact.sha);
        if (!alreadyLinked) {
          t.githubLinks.commits.push(artifact);
          await t.save();
          linkedTaskIds.push(t._id);
        }
      } else if (type === 'pullRequest') {
        const existingIdx = t.githubLinks.pullRequests.findIndex((p) => p.number === artifact.number);
        if (existingIdx >= 0) {
          t.githubLinks.pullRequests[existingIdx].state = artifact.state;
          t.githubLinks.pullRequests[existingIdx].isMerged = artifact.isMerged;
          t.githubLinks.pullRequests[existingIdx].title = artifact.title;
          await t.save();
          linkedTaskIds.push(t._id);
        } else {
          t.githubLinks.pullRequests.push(artifact);
          await t.save();
          linkedTaskIds.push(t._id);
        }
      }
    }
  }

  return linkedTaskIds;
}

// =========================================================================
// 9. PROCESS WEBHOOK PAYLOAD & IDEMPOTENT DEDUPLICATION
// =========================================================================
async function processWebhookPayload({ deliveryId, event, payload }) {
  if (!deliveryId) {
    throw new Error('Missing x-github-delivery header.');
  }

  const GithubActivity = mongoose.models.GithubActivity || mongoose.model('GithubActivity');
  const Project = mongoose.models.Project || mongoose.model('Project');

  // 1. Deduplication check via deliveryId
  const existing = await GithubActivity.findOne({ deliveryId }).lean();
  if (existing) {
    return {
      status: 'duplicate',
      message: `Event delivery ${deliveryId} already processed.`,
      activityId: existing._id,
      matchedProject: existing.project || null,
    };
  }

  const repo = payload?.repository || {};
  const repoId = repo.id;
  const fullName = repo.full_name || '';
  const action = payload?.action || '';
  const sender = {
    login: payload?.sender?.login || 'unknown',
    avatarUrl: payload?.sender?.avatar_url || '',
  };

  // 2. Find linked Project (by fullName or repoId)
  let project = null;
  if (fullName || repoId) {
    const query = { 'github.enabled': true };
    const orCond = [];
    if (fullName) {
      orCond.push({ 'github.fullName': { $regex: new RegExp(`^${fullName}$`, 'i') } });
    }
    if (repoId) {
      orCond.push({ 'github.repoId': repoId });
    }
    if (orCond.length > 0) {
      query.$or = orCond;
      project = await Project.findOne(query);
    }
  }

  // 3. Extract payload summaries based on event type
  const payloadSummary = {};
  let summary = '';
  const affectedTaskIds = [];

  if (event === 'push') {
    payloadSummary.ref = payload.ref || '';
    payloadSummary.headCommitSha = payload.after || '';
    const rawCommits = Array.isArray(payload.commits) ? payload.commits : [];
    payloadSummary.commitCount = rawCommits.length;
    payloadSummary.commits = rawCommits.slice(0, 10).map((c) => ({
      sha: c.id,
      shortSha: (c.id || '').substring(0, 7),
      message: sanitizeText(c.message || '', 300),
      author: sanitizeText(c.author?.name || c.author?.username || 'Dev', 100),
      url: c.url,
    }));
    summary = sanitizeText(`Push to ${payload.ref || 'branch'}: ${rawCommits.length} commit(s)`, 300);

    // Auto-map commits to Tasks in the linked project
    if (project) {
      for (const c of rawCommits) {
        const ids = extractTaskIdentifiers(c.message);
        if (ids.length > 0) {
          const linked = await linkArtifactToTasks(
            project._id,
            ids,
            {
              sha: c.id,
              shortSha: (c.id || '').substring(0, 7),
              message: sanitizeText(c.message || '', 300),
              author: sanitizeText(c.author?.name || c.author?.username || 'Dev', 100),
              url: c.url || '',
              date: c.timestamp ? new Date(c.timestamp) : new Date(),
            },
            'commit'
          );
          affectedTaskIds.push(...linked);
        }
      }
    }
  } else if (event === 'pull_request') {
    const pr = payload.pull_request || {};
    payloadSummary.pullRequest = {
      number: pr.number,
      title: sanitizeText(pr.title || '', 300),
      state: pr.state || 'open',
      url: pr.html_url || '',
      isMerged: Boolean(pr.merged),
    };
    summary = sanitizeText(`Pull Request #${pr.number} ${action || 'updated'}: "${pr.title || ''}"`, 300);

    // Auto-map PR to Tasks in the linked project
    if (project) {
      const prText = `${pr.title || ''} ${pr.body || ''}`;
      const ids = extractTaskIdentifiers(prText);
      if (ids.length > 0) {
        const linked = await linkArtifactToTasks(
          project._id,
          ids,
          {
            number: pr.number,
            title: sanitizeText(pr.title || '', 300),
            state: pr.state || 'open',
            url: pr.html_url || '',
            isMerged: Boolean(pr.merged),
            headBranch: sanitizeText(pr.head?.ref || '', 100),
            baseBranch: sanitizeText(pr.base?.ref || '', 100),
          },
          'pullRequest'
        );
        affectedTaskIds.push(...linked);
      }
    }
  } else if (event === 'issues') {
    const issue = payload.issue || {};
    payloadSummary.issue = {
      number: issue.number,
      title: sanitizeText(issue.title || '', 300),
      state: issue.state || 'open',
      url: issue.html_url || '',
    };
    summary = sanitizeText(`Issue #${issue.number} ${action || 'updated'}: "${issue.title || ''}"`, 300);
  } else {
    summary = `GitHub event "${event}" received`;
  }

  // 4. Save GithubActivity audit entry
  let activity;
  try {
    activity = await GithubActivity.create({
      deliveryId,
      event,
      action,
      project: project ? project._id : null,
      repository: {
        id: repoId,
        fullName,
        name: repo.name || '',
        owner: repo.owner?.login || '',
      },
      sender,
      summary,
      payloadSummary,
      processed: true,
      processedAt: new Date(),
    });
  } catch (err) {
    if (err.code === 11000) {
      const existingRecord = await GithubActivity.findOne({ deliveryId }).lean();
      return {
        status: 'duplicate',
        message: `Event delivery ${deliveryId} already processed.`,
        activityId: existingRecord ? existingRecord._id : null,
        matchedProject: existingRecord ? existingRecord.project : null,
      };
    }
    throw err;
  }

  // 5. If project is matched, update its sync status and lastSyncAt
  if (project) {
    project.github.lastSyncAt = new Date();
    project.github.syncStatus = 'idle';
    project.github.syncError = '';
    await project.save();
  }

  return {
    status: 'processed',
    deliveryId,
    event,
    summary,
    matchedProject: project ? project._id : null,
    activityId: activity._id,
    affectedTasks: Array.from(new Set(affectedTaskIds.map((id) => id.toString()))),
  };
}

// =========================================================================
// 10. ON-DEMAND PROJECT RECONCILIATION
// =========================================================================
async function reconcileProjectRepository(project) {
  if (!project.github?.enabled || !project.github?.repoOwner || !project.github?.repoName) {
    throw new Error('No GitHub repository is linked to this project.');
  }

  project.github.syncStatus = 'syncing';
  await project.save();

  try {
    const details = await verifyAndFetchRepository(project.github.repoOwner, project.github.repoName);
    project.github.repoId = details.repoId;
    project.github.fullName = details.fullName;
    project.github.defaultBranch = details.defaultBranch || 'main';
    project.github.lastSyncAt = new Date();
    project.github.syncStatus = 'idle';
    project.github.syncError = '';
    await project.save();

    return {
      success: true,
      repoId: project.github.repoId,
      fullName: project.github.fullName,
      defaultBranch: project.github.defaultBranch,
      lastSyncAt: project.github.lastSyncAt,
      syncStatus: project.github.syncStatus,
    };
  } catch (err) {
    project.github.syncStatus = 'error';
    project.github.syncError = err.message || 'Reconciliation failed';
    await project.save();
    throw err;
  }
}

module.exports = {
  parseRepositoryInput,
  makeGitHubRequest,
  verifyAndFetchRepository,
  fetchCommits,
  fetchPullRequests,
  fetchIssues,
  fetchBranches,
  verifyWebhookSignature,
  processWebhookPayload,
  reconcileProjectRepository,
  extractTaskIdentifiers,
  linkArtifactToTasks,
};



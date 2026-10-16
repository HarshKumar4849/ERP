const mongoose = require('mongoose');
const { parseRepositoryInput, verifyAndFetchRepository } = require('../../../services/githubService');

let ROLES, normalizeRole;
try {
  ({ ROLES, normalizeRole } = require('../../../rbac/roles'));
} catch (e) {
  ({ ROLES, normalizeRole } = require('../../../rbac/roles'));
}

// Helper to resolve Employee document from authenticated user
const resolveEmployee = async (user) => {
  if (!user) return null;
  const Employee = mongoose.models.Employee || mongoose.model('Employee');
  let employee = await Employee.findOne({ user: user._id, removed: false });
  if (!employee && user.email) {
    employee = await Employee.findOne({ email: user.email.toLowerCase(), removed: false });
  }
  return employee;
};

// Check project access: ADMIN/HR/Management has global read; EMPLOYEE requires PM or team member
const checkProjectAccess = async (project, user, userRole) => {
  const normRole = normalizeRole ? normalizeRole(userRole || user?.role) : (userRole || user?.role || '').toUpperCase();
  if (normRole === ROLES.ADMIN || normRole === 'MANAGEMENT' || normRole === 'SUPER_ADMIN') {
    return { hasAccess: true, isPM: true, isAdmin: true };
  }
  if (normRole === ROLES.HR) {
    return { hasAccess: true, isPM: false, isHR: true };
  }
  const emp = await resolveEmployee(user);
  if (!emp) return { hasAccess: false, isPM: false };
  const empIdStr = emp._id.toString();
  const pmIdStr = project.projectManager ? (project.projectManager._id || project.projectManager).toString() : '';
  const isPM = pmIdStr === empIdStr;
  const isMember = Array.isArray(project.teamMembers) && project.teamMembers.some((m) => (m._id || m).toString() === empIdStr);
  return { hasAccess: isPM || isMember, isPM };
};

// =========================================================================
// 1. LINK GITHUB REPOSITORY TO PROJECT (ADMIN OR PM ONLY)
// =========================================================================
const linkRepository = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format.' });
    }

    const Project = mongoose.models.Project || mongoose.model('Project');
    const project = await Project.findOne({ _id: projectId, removed: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const { isPM, isAdmin } = await checkProjectAccess(project, req.user, req.user?.role);
    if (!isAdmin && !isPM) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only Administrators or the Project Manager can link a GitHub repository.',
      });
    }

    const repoInput = req.body.repositoryUrl || req.body.repository || req.body.repo;
    if (!repoInput) {
      return res.status(400).json({
        success: false,
        message: 'GitHub repository URL or "owner/repo" is required.',
      });
    }

    let parsed;
    try {
      parsed = parseRepositoryInput(repoInput);
    } catch (parseErr) {
      return res.status(400).json({ success: false, message: parseErr.message });
    }

    let details;
    try {
      details = await verifyAndFetchRepository(parsed.owner, parsed.repo);
    } catch (fetchErr) {
      return res.status(fetchErr.statusCode || 400).json({
        success: false,
        message: fetchErr.message || 'Unable to verify GitHub repository.',
      });
    }

    project.github = {
      enabled: true,
      repoId: details.repoId,
      repoOwner: details.owner,
      repoName: details.repo,
      fullName: details.fullName,
      repoUrl: details.repoUrl,
      defaultBranch: details.defaultBranch || 'main',
      lastSyncAt: new Date(),
      syncStatus: 'idle',
      syncError: '',
      linkedBy: req.user._id,
      linkedAt: new Date(),
    };

    await project.save();

    return res.status(200).json({
      success: true,
      result: {
        enabled: project.github.enabled,
        repoId: project.github.repoId,
        repoOwner: project.github.repoOwner,
        repoName: project.github.repoName,
        fullName: project.github.fullName,
        repoUrl: project.github.repoUrl,
        defaultBranch: project.github.defaultBranch,
        lastSyncAt: project.github.lastSyncAt,
        syncStatus: project.github.syncStatus,
        linkedAt: project.github.linkedAt,
      },
      message: `Repository "${details.fullName}" linked successfully to project "${project.name}".`,
    });
  } catch (error) {
    console.error('GitHub link error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 2. UNLINK GITHUB REPOSITORY (ADMIN OR PM ONLY)
// =========================================================================
const unlinkRepository = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format.' });
    }

    const Project = mongoose.models.Project || mongoose.model('Project');
    const project = await Project.findOne({ _id: projectId, removed: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const { isPM, isAdmin } = await checkProjectAccess(project, req.user, req.user?.role);
    if (!isAdmin && !isPM) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only Administrators or the Project Manager can unlink a GitHub repository.',
      });
    }

    project.github = {
      enabled: false,
      repoId: null,
      repoOwner: '',
      repoName: '',
      fullName: '',
      repoUrl: '',
      defaultBranch: 'main',
      lastSyncAt: null,
      syncStatus: 'idle',
      syncError: '',
      linkedBy: null,
      linkedAt: null,
    };

    await project.save();

    return res.status(200).json({
      success: true,
      result: { enabled: false },
      message: 'GitHub repository unlinked successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 3. GET REPOSITORY OVERVIEW & STATUS (PROJECT MEMBERS ONLY)
// =========================================================================
const getRepositoryOverview = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format.' });
    }

    const Project = mongoose.models.Project || mongoose.model('Project');
    const project = await Project.findOne({ _id: projectId, removed: false });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const { hasAccess, isPM } = await checkProjectAccess(project, req.user, req.user?.role);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view this project repository.',
      });
    }

    const gh = project.github || { enabled: false };

    return res.status(200).json({
      success: true,
      result: {
        enabled: Boolean(gh.enabled),
        repoId: gh.repoId || null,
        repoOwner: gh.repoOwner || '',
        repoName: gh.repoName || '',
        fullName: gh.fullName || '',
        repoUrl: gh.repoUrl || '',
        defaultBranch: gh.defaultBranch || 'main',
        lastSyncAt: gh.lastSyncAt || null,
        syncStatus: gh.syncStatus || 'idle',
        syncError: gh.syncError || '',
        linkedAt: gh.linkedAt || null,
        canManage: Boolean(isPM || req.user?.role === 'ADMIN'),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 4. GET COMMITS (PROJECT MEMBERS ONLY)
// =========================================================================
const getCommits = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format.' });
    }

    const Project = mongoose.models.Project || mongoose.model('Project');
    const project = await Project.findOne({ _id: projectId, removed: false });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const { hasAccess } = await checkProjectAccess(project, req.user, req.user?.role);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view this project repository.',
      });
    }

    if (!project.github?.enabled || !project.github?.repoOwner || !project.github?.repoName) {
      return res.status(200).json({
        success: true,
        result: [],
        message: 'No GitHub repository linked to this project.',
      });
    }

    const { fetchCommits } = require('../../../services/githubService');
    const commits = await fetchCommits(project.github.repoOwner, project.github.repoName, {
      branch: req.query.branch || project.github.defaultBranch || 'main',
      page: req.query.page || 1,
      limit: req.query.limit || 15,
    });

    return res.status(200).json({
      success: true,
      result: commits,
      page: Number(req.query.page) || 1,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 5. GET PULL REQUESTS (PROJECT MEMBERS ONLY)
// =========================================================================
const getPullRequests = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format.' });
    }

    const Project = mongoose.models.Project || mongoose.model('Project');
    const project = await Project.findOne({ _id: projectId, removed: false });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const { hasAccess } = await checkProjectAccess(project, req.user, req.user?.role);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view this project repository.',
      });
    }

    if (!project.github?.enabled || !project.github?.repoOwner || !project.github?.repoName) {
      return res.status(200).json({
        success: true,
        result: [],
        message: 'No GitHub repository linked to this project.',
      });
    }

    const { fetchPullRequests } = require('../../../services/githubService');
    const pulls = await fetchPullRequests(project.github.repoOwner, project.github.repoName, {
      state: req.query.state || 'all',
      page: req.query.page || 1,
      limit: req.query.limit || 15,
    });

    return res.status(200).json({
      success: true,
      result: pulls,
      page: Number(req.query.page) || 1,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 6. GET ISSUES (PROJECT MEMBERS ONLY)
// =========================================================================
const getIssues = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format.' });
    }

    const Project = mongoose.models.Project || mongoose.model('Project');
    const project = await Project.findOne({ _id: projectId, removed: false });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const { hasAccess } = await checkProjectAccess(project, req.user, req.user?.role);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view this project repository.',
      });
    }

    if (!project.github?.enabled || !project.github?.repoOwner || !project.github?.repoName) {
      return res.status(200).json({
        success: true,
        result: [],
        message: 'No GitHub repository linked to this project.',
      });
    }

    const { fetchIssues } = require('../../../services/githubService');
    const issues = await fetchIssues(project.github.repoOwner, project.github.repoName, {
      state: req.query.state || 'all',
      page: req.query.page || 1,
      limit: req.query.limit || 15,
    });

    return res.status(200).json({
      success: true,
      result: issues,
      page: Number(req.query.page) || 1,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 7. GET BRANCHES (PROJECT MEMBERS ONLY)
// =========================================================================
const getBranches = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format.' });
    }

    const Project = mongoose.models.Project || mongoose.model('Project');
    const project = await Project.findOne({ _id: projectId, removed: false });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const { hasAccess } = await checkProjectAccess(project, req.user, req.user?.role);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view this project repository.',
      });
    }

    if (!project.github?.enabled || !project.github?.repoOwner || !project.github?.repoName) {
      return res.status(200).json({
        success: true,
        result: [],
        message: 'No GitHub repository linked to this project.',
      });
    }

    const { fetchBranches } = require('../../../services/githubService');
    const branches = await fetchBranches(project.github.repoOwner, project.github.repoName);

    return res.status(200).json({
      success: true,
      result: branches,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 8. ON-DEMAND RECONCILIATION SYNC (ADMIN OR PM ONLY)
// =========================================================================
const syncRepository = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format.' });
    }

    const Project = mongoose.models.Project || mongoose.model('Project');
    const project = await Project.findOne({ _id: projectId, removed: false });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const { isPM, isAdmin } = await checkProjectAccess(project, req.user, req.user?.role);
    if (!isAdmin && !isPM) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only Administrators or the Project Manager can trigger repository synchronization.',
      });
    }

    if (!project.github?.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Cannot synchronize: No GitHub repository is linked to this project.',
      });
    }

    const { reconcileProjectRepository } = require('../../../services/githubService');
    const syncResult = await reconcileProjectRepository(project);

    return res.status(200).json({
      success: true,
      result: syncResult,
      message: 'GitHub repository synchronized successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 9. GET GITHUB ACTIVITY LOG (PROJECT MEMBERS ONLY)
// =========================================================================
const getActivity = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format.' });
    }

    const Project = mongoose.models.Project || mongoose.model('Project');
    const project = await Project.findOne({ _id: projectId, removed: false });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const { hasAccess } = await checkProjectAccess(project, req.user, req.user?.role);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view activity for this project.',
      });
    }

    const GithubActivity = mongoose.models.GithubActivity || mongoose.model('GithubActivity');
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 50));
    const activities = await GithubActivity.find({ project: projectId })
      .sort({ created: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      result: activities,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 10. GITHUB WEBHOOK RECEIVER (PUBLIC WITH HMAC VERIFICATION)
// =========================================================================
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'] || 'ping';
    const deliveryId = req.headers['x-github-delivery'];

    if (!deliveryId) {
      return res.status(400).json({
        success: false,
        message: 'Missing "x-github-delivery" header.',
      });
    }

    const { verifyWebhookSignature, processWebhookPayload } = require('../../../services/githubService');

    // Verify HMAC-SHA256 signature
    const rawBody = req.rawBody || req.body;
    const verification = verifyWebhookSignature(rawBody, signature);

    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        message: `Unauthorized webhook: ${verification.reason}`,
      });
    }

    // Ping event response
    if (event === 'ping') {
      return res.status(200).json({
        success: true,
        message: 'GitHub ping received successfully.',
        zen: req.body?.zen || 'TecMotiv ERP integration ready.',
      });
    }

    // Process event
    const result = await processWebhookPayload({
      deliveryId,
      event,
      payload: req.body,
    });

    return res.status(200).json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('GitHub webhook processing error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error processing webhook event.',
    });
  }
};

module.exports = {
  linkRepository,
  unlinkRepository,
  getRepositoryOverview,
  getCommits,
  getPullRequests,
  getIssues,
  getBranches,
  syncRepository,
  getActivity,
  handleWebhook,
  checkProjectAccess,
};



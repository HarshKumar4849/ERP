const mongoose = require('mongoose');
let ROLES, normalizeRole;
try {
  ({ ROLES, normalizeRole } = require('../../../rbac/roles'));
} catch (e) {
  ({ ROLES, normalizeRole } = require('../../../rbac/roles'));
}

// Helper to resolve Employee document from authenticated user
const resolveEmployee = async (user) => {
  if (!user) return null;
  const Employee = mongoose.model('Employee');
  let employee = await Employee.findOne({ user: user._id, removed: false });
  if (!employee && user.email) {
    employee = await Employee.findOne({ email: user.email.toLowerCase(), removed: false });
  }
  return employee;
};

// Helper to check if task is overdue
const isTaskOverdue = (task) => {
  if (!task.dueDate) return false;
  if (task.status === 'Completed' || task.status === 'Cancelled') return false;
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return new Date(task.dueDate) < todayEnd;
};

// Helper to check if user has access to task: ADMIN/HR/Management has access; EMPLOYEE requires owner, reviewer, creator, or project member
const checkTaskAccess = async (task, user, userRole) => {
  const normRole = normalizeRole ? normalizeRole(userRole || user?.role) : (userRole || user?.role || '').toUpperCase();
  if (normRole === ROLES.ADMIN || normRole === ROLES.HR || normRole === 'MANAGEMENT' || normRole === 'SUPER_ADMIN') {
    return true;
  }
  const emp = await resolveEmployee(user);
  const empIdStr = emp ? emp._id.toString() : '';
  const userIdStr = user._id.toString();

  const isOwner =
    (task.owner && empIdStr && task.owner.toString() === empIdStr) ||
    (task.assignedTo && task.assignedTo.toString() === userIdStr);
  const isReviewer =
    (task.reviewer && empIdStr && task.reviewer.toString() === empIdStr) ||
    (task.reviewerUser && task.reviewerUser.toString() === userIdStr);
  const isCreator = task.createdBy && task.createdBy.toString() === userIdStr;

  if (isOwner || isReviewer || isCreator) return true;

  if (task.project && empIdStr) {
    const Project = mongoose.model('Project');
    const proj = await Project.findOne({ _id: task.project, removed: false });
    if (proj) {
      const pmIdStr = proj.projectManager ? proj.projectManager.toString() : '';
      const isPM = pmIdStr === empIdStr;
      const isMember = Array.isArray(proj.teamMembers) && proj.teamMembers.some((m) => m.toString() === empIdStr);
      if (isPM || isMember) return true;
    }
  }

  return false;
};

// =========================================================================
// 1. CREATE TASK
// =========================================================================
const create = async (req, res) => {
  const Task = mongoose.model('Task');
  const Employee = mongoose.model('Employee');
  const Project = mongoose.model('Project');
  const user = req.user;
  const userRole = req.userRole;

  const {
    task,
    title,
    description,
    owner,
    assignedTo,
    reviewer,
    department,
    project,
    projectName,
    priority,
    dueDate,
    status,
    subtasks,
  } = req.body;

  const taskTitle = task || title;
  if (!taskTitle || !taskTitle.trim()) {
    return res.status(400).json({ success: false, message: 'Task name/title is required.' });
  }

  if (!dueDate) {
    return res.status(400).json({ success: false, message: 'Due date is required.' });
  }

  const parsedDueDate = new Date(dueDate);
  if (isNaN(parsedDueDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid due date format.' });
  }

  // Determine owner & assignee
  let ownerDoc = null;
  let assignedToUser = assignedTo || null;
  let ownerNameStr = '';

  if (owner) {
    ownerDoc = await Employee.findOne({ _id: owner, removed: false });
    if (ownerDoc) {
      ownerNameStr = `${ownerDoc.name} ${ownerDoc.surname}`.trim();
      if (!assignedToUser && ownerDoc.user) {
        assignedToUser = ownerDoc.user;
      }
    }
  }

  // If no owner passed, default to current user's employee profile
  if (!ownerDoc) {
    ownerDoc = await resolveEmployee(user);
    if (ownerDoc) {
      ownerNameStr = `${ownerDoc.name} ${ownerDoc.surname}`.trim();
      assignedToUser = ownerDoc.user || user._id;
    } else {
      assignedToUser = user._id;
      ownerNameStr = `${user.name} ${user.surname}`.trim() || user.email;
    }
  }

  // Determine reviewer
  let reviewerDoc = null;
  let reviewerUser = null;
  let reviewerNameStr = '';

  if (reviewer) {
    reviewerDoc = await Employee.findOne({ _id: reviewer, removed: false });
    if (reviewerDoc) {
      reviewerNameStr = `${reviewerDoc.name} ${reviewerDoc.surname}`.trim();
      reviewerUser = reviewerDoc.user || null;
    }
  }

  // Determine department
  let deptName = department;
  if (!deptName) {
    if (ownerDoc && ownerDoc.departmentName) {
      deptName = ownerDoc.departmentName;
    } else if (user.department) {
      deptName = user.department;
    } else {
      deptName = 'General';
    }
  }

  // Determine project
  let projectDoc = null;
  let resolvedProjectName = projectName || '';

  if (project) {
    if (mongoose.Types.ObjectId.isValid(project)) {
      projectDoc = await Project.findOne({ _id: project, removed: false });
      if (projectDoc) {
        resolvedProjectName = projectDoc.name;
        // Verify caller is authorized on the project if EMPLOYEE
        const normRole = normalizeRole ? normalizeRole(userRole || user?.role) : (userRole || user?.role || '').toUpperCase();
        if (normRole === ROLES.EMPLOYEE) {
          const emp = await resolveEmployee(user);
          const empIdStr = emp ? emp._id.toString() : '';
          const pmIdStr = projectDoc.projectManager ? projectDoc.projectManager.toString() : '';
          const isMember = Array.isArray(projectDoc.teamMembers) && projectDoc.teamMembers.some((m) => m.toString() === empIdStr);
          if (pmIdStr !== empIdStr && !isMember) {
            return res.status(403).json({
              success: false,
              message: 'Access denied: You are not authorized to create tasks in this project.',
            });
          }
        }
      }
    } else if (typeof project === 'string') {
      resolvedProjectName = project;
    }
  }

  // Build subtasks
  let initialSubtasks = [];
  if (Array.isArray(subtasks)) {
    initialSubtasks = subtasks.map((st) => ({
      title: typeof st === 'string' ? st : st.title || '',
      completed: Boolean(st.completed),
      completedAt: st.completed ? new Date() : undefined,
    })).filter((st) => st.title.trim().length > 0);
  }

  const initialStatus = status || 'Not Started';

  const newTask = await new Task({
    task: taskTitle.trim(),
    title: taskTitle.trim(),
    description: (description || '').trim(),
    owner: ownerDoc ? ownerDoc._id : undefined,
    assignedTo: assignedToUser,
    ownerName: ownerNameStr,
    reviewer: reviewerDoc ? reviewerDoc._id : undefined,
    reviewerUser: reviewerUser,
    reviewerName: reviewerNameStr,
    department: deptName,
    project: projectDoc ? projectDoc._id : undefined,
    projectName: resolvedProjectName,
    priority: priority || 'Medium',
    dueDate: parsedDueDate,
    status: initialStatus,
    subtasks: initialSubtasks,
    comments: [],
    attachments: [],
    completedAt: initialStatus === 'Completed' ? new Date() : undefined,
    createdBy: user._id,
    createdByName: `${user.name || ''} ${user.surname || ''}`.trim() || user.email,
  }).save();

  const populated = await Task.findById(newTask._id)
    .populate('owner', 'employeeId name surname photo departmentName designationName email')
    .populate('reviewer', 'employeeId name surname photo departmentName designationName email')
    .populate('project', 'name code department status')
    .populate('createdBy', 'name surname email role');

  return res.status(201).json({
    success: true,
    result: populated,
    message: 'Task created successfully.',
  });
};

// =========================================================================
// 2. READ SINGLE TASK
// =========================================================================
const read = async (req, res) => {
  const Task = mongoose.model('Task');
  const user = req.user;
  const userRole = req.userRole;

  const task = await Task.findOne({ _id: req.params.id, removed: false })
    .populate('owner', 'employeeId name surname photo departmentName designationName email')
    .populate('reviewer', 'employeeId name surname photo departmentName designationName email')
    .populate('project', 'name code department status')
    .populate('createdBy', 'name surname email role')
    .populate('comments.user', 'name surname email role')
    .populate('comments.employee', 'employeeId name surname photo')
    .populate('attachments.uploadedBy', 'name surname email');

  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found.' });
  }

  const hasAccess = await checkTaskAccess(task, user, userRole);
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: You cannot access tasks assigned to other employees.',
    });
  }

  // Add calculated overdue flag
  const taskObj = task.toObject({ virtuals: true });
  taskObj.isOverdue = isTaskOverdue(task);

  return res.status(200).json({
    success: true,
    result: taskObj,
  });
};

// =========================================================================
// 3. UPDATE TASK
// =========================================================================
const update = async (req, res) => {
  const Task = mongoose.model('Task');
  const Employee = mongoose.model('Employee');
  const Project = mongoose.model('Project');
  const user = req.user;

  const task = await Task.findOne({ _id: req.params.id, removed: false });
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found.' });
  }

  const hasAccess = await checkTaskAccess(task, user, req.userRole);
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: You cannot modify tasks assigned to other employees.',
    });
  }

  const {
    task: taskTitle,
    title,
    description,
    owner,
    assignedTo,
    reviewer,
    department,
    project,
    projectName,
    priority,
    dueDate,
    status,
  } = req.body;

  if (taskTitle || title) {
    task.task = (taskTitle || title).trim();
    task.title = (taskTitle || title).trim();
  }

  if (description !== undefined) {
    task.description = (description || '').trim();
  }

  if (priority && ['Low', 'Medium', 'High', 'Critical'].includes(priority)) {
    task.priority = priority;
  }

  if (dueDate) {
    const parsed = new Date(dueDate);
    if (!isNaN(parsed.getTime())) {
      task.dueDate = parsed;
    }
  }

  if (status !== undefined) {
    if (!['Not Started', 'In Progress', 'Waiting', 'Completed', 'Overdue', 'Cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required: Not Started, In Progress, Waiting, Completed, Overdue, Cancelled',
      });
    }
    const prevStatus = task.status;
    task.status = status;
    if (status === 'Completed' && prevStatus !== 'Completed') {
      task.completedAt = new Date();
    } else if (status !== 'Completed' && prevStatus === 'Completed') {
      task.completedAt = undefined;
    }
  }

  if (department) {
    task.department = department.trim();
  }

  // Update Owner if passed
  if (owner !== undefined) {
    if (owner) {
      const ownerDoc = await Employee.findOne({ _id: owner, removed: false });
      if (ownerDoc) {
        task.owner = ownerDoc._id;
        task.assignedTo = ownerDoc.user || undefined;
        task.ownerName = `${ownerDoc.name} ${ownerDoc.surname}`.trim();
      }
    } else {
      task.owner = undefined;
      task.assignedTo = undefined;
      task.ownerName = '';
    }
  }

  // Update Reviewer if passed
  if (reviewer !== undefined) {
    if (reviewer) {
      const reviewerDoc = await Employee.findOne({ _id: reviewer, removed: false });
      if (reviewerDoc) {
        task.reviewer = reviewerDoc._id;
        task.reviewerUser = reviewerDoc.user || undefined;
        task.reviewerName = `${reviewerDoc.name} ${reviewerDoc.surname}`.trim();
      }
    } else {
      task.reviewer = undefined;
      task.reviewerUser = undefined;
      task.reviewerName = '';
    }
  }

  // Update Project if passed
  if (project !== undefined) {
    if (project && mongoose.Types.ObjectId.isValid(project)) {
      const projDoc = await Project.findOne({ _id: project, removed: false });
      if (projDoc) {
        task.project = projDoc._id;
        task.projectName = projDoc.name;
      }
    } else if (typeof project === 'string') {
      task.projectName = project;
      task.project = undefined;
    } else {
      task.project = undefined;
      task.projectName = '';
    }
  } else if (projectName !== undefined) {
    task.projectName = projectName;
  }

  task.updated = Date.now();
  await task.save();

  const populated = await Task.findById(task._id)
    .populate('owner', 'employeeId name surname photo departmentName designationName email')
    .populate('reviewer', 'employeeId name surname photo departmentName designationName email')
    .populate('project', 'name code department status')
    .populate('createdBy', 'name surname email role');

  const taskObj = populated.toObject({ virtuals: true });
  taskObj.isOverdue = isTaskOverdue(populated);

  return res.status(200).json({
    success: true,
    result: taskObj,
    message: 'Task updated successfully.',
  });
};

// =========================================================================
// 4. QUICK STATUS CHANGE
// =========================================================================
const changeStatus = async (req, res) => {
  const Task = mongoose.model('Task');
  const { status } = req.body;

  if (!status || !['Not Started', 'In Progress', 'Waiting', 'Completed', 'Overdue', 'Cancelled'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Valid status is required: Not Started, In Progress, Waiting, Completed, Overdue, Cancelled',
    });
  }

  const task = await Task.findOne({ _id: req.params.id, removed: false });
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found.' });
  }

  const hasAccess = await checkTaskAccess(task, req.user, req.userRole);
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: You cannot change status of tasks assigned to other employees.',
    });
  }

  const prevStatus = task.status;
  task.status = status;
  if (status === 'Completed' && prevStatus !== 'Completed') {
    task.completedAt = new Date();
  } else if (status !== 'Completed') {
    task.completedAt = undefined;
  }

  task.updated = Date.now();
  await task.save();

  const populated = await Task.findById(task._id)
    .populate('owner', 'employeeId name surname photo departmentName designationName email')
    .populate('reviewer', 'employeeId name surname photo departmentName designationName email')
    .populate('project', 'name code department status');

  const taskObj = populated.toObject({ virtuals: true });
  taskObj.isOverdue = isTaskOverdue(populated);

  return res.status(200).json({
    success: true,
    result: taskObj,
    message: `Task status updated to ${status}.`,
  });
};

// =========================================================================
// 5. DELETE (SOFT DELETE)
// =========================================================================
const deleteTask = async (req, res) => {
  const normRole = normalizeRole ? normalizeRole(req.userRole || req.user?.role) : (req.userRole || req.user?.role || '').toUpperCase();
  if (normRole === ROLES.EMPLOYEE) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Employees cannot delete tasks.',
    });
  }

  const Task = mongoose.model('Task');
  const task = await Task.findOne({ _id: req.params.id, removed: false });

  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found.' });
  }

  task.removed = true;
  task.updated = Date.now();
  await task.save();

  return res.status(200).json({
    success: true,
    result: task,
    message: 'Task removed successfully.',
  });
};

// =========================================================================
// 6. SUBTASKS OPERATIONS
// =========================================================================
const addSubtask = async (req, res) => {
  const Task = mongoose.model('Task');
  const { title, dueDate } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Subtask title is required.' });
  }

  const task = await Task.findOne({ _id: req.params.id, removed: false });
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found.' });
  }

  const hasAccess = await checkTaskAccess(task, req.user, req.userRole);
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: You cannot modify subtasks on this task.',
    });
  }

  task.subtasks.push({
    title: title.trim(),
    completed: false,
    dueDate: dueDate ? new Date(dueDate) : undefined,
  });

  task.updated = Date.now();
  await task.save();

  return res.status(200).json({
    success: true,
    result: task.subtasks,
    message: 'Subtask added successfully.',
  });
};

const updateSubtask = async (req, res) => {
  const Task = mongoose.model('Task');
  const { id, subtaskId } = req.params;
  const { completed, title } = req.body;

  const task = await Task.findOne({ _id: id, removed: false });
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found.' });
  }

  const hasAccess = await checkTaskAccess(task, req.user, req.userRole);
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: You cannot modify subtasks on this task.',
    });
  }

  const subtask = task.subtasks.id(subtaskId);
  if (!subtask) {
    return res.status(404).json({ success: false, message: 'Subtask not found.' });
  }

  if (completed !== undefined) {
    subtask.completed = Boolean(completed);
    subtask.completedAt = completed ? new Date() : undefined;
  }

  if (title && title.trim()) {
    subtask.title = title.trim();
  }

  task.updated = Date.now();
  await task.save();

  return res.status(200).json({
    success: true,
    result: task.subtasks,
    message: 'Subtask updated successfully.',
  });
};

const deleteSubtask = async (req, res) => {
  const Task = mongoose.model('Task');
  const { id, subtaskId } = req.params;

  const task = await Task.findOne({ _id: id, removed: false });
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found.' });
  }

  const hasAccess = await checkTaskAccess(task, req.user, req.userRole);
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: You cannot delete subtasks on this task.',
    });
  }

  task.subtasks.pull({ _id: subtaskId });
  task.updated = Date.now();
  await task.save();

  return res.status(200).json({
    success: true,
    result: task.subtasks,
    message: 'Subtask removed successfully.',
  });
};

// =========================================================================
// 7. COMMENTS OPERATIONS
// =========================================================================
const addComment = async (req, res) => {
  const Task = mongoose.model('Task');
  const user = req.user;
  const { comment } = req.body;

  if (!comment || !comment.trim()) {
    return res.status(400).json({ success: false, message: 'Comment text is required.' });
  }

  const task = await Task.findOne({ _id: req.params.id, removed: false });
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found.' });
  }

  const hasAccess = await checkTaskAccess(task, req.user, req.userRole);
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: You cannot comment on a task you do not have access to.',
    });
  }

  const employee = await resolveEmployee(user);

  const commentItem = {
    user: user._id,
    employee: employee ? employee._id : undefined,
    authorName: `${user.name || ''} ${user.surname || ''}`.trim() || user.email,
    authorRole: req.userRole || user.role || 'EMPLOYEE',
    comment: comment.trim(),
    createdAt: new Date(),
  };

  task.comments.push(commentItem);
  task.updated = Date.now();
  await task.save();

  return res.status(200).json({
    success: true,
    result: task.comments,
    message: 'Comment added successfully.',
  });
};

// =========================================================================
// 8. ATTACHMENTS OPERATIONS
// =========================================================================
const addAttachment = async (req, res) => {
  const Task = mongoose.model('Task');
  const user = req.user;

  const task = await Task.findOne({ _id: req.params.id, removed: false });
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found.' });
  }

  const hasAccess = await checkTaskAccess(task, req.user, req.userRole);
  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: You cannot add attachments to a task you do not have access to.',
    });
  }

  let fileInfo = req.upload || null;
  if (!fileInfo && req.file) {
    fileInfo = {
      fileName: req.file.filename,
      filePath: req.file.path.replace(/\\/g, '/'),
      fieldExt: req.file.mimetype,
      fileType: req.file.mimetype,
    };
  }

  if (!fileInfo && !req.body.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded or attached.' });
  }

  const fileName = req.body.name || fileInfo?.fileName || req.file?.originalname || 'Attachment';
  const filePath = req.body.file || fileInfo?.filePath || req.file?.path;
  const fileSize = req.file?.size || 0;
  const fileType = req.file?.mimetype || 'document';

  task.attachments.push({
    name: fileName,
    file: filePath,
    size: fileSize,
    fileType: fileType,
    uploadedBy: user._id,
    uploadedByName: `${user.name || ''} ${user.surname || ''}`.trim() || user.email,
    uploadedAt: new Date(),
  });

  task.updated = Date.now();
  await task.save();

  return res.status(200).json({
    success: true,
    result: task.attachments,
    message: 'Attachment added successfully.',
  });
};

// =========================================================================
// 9. LIST WITH SEARCH, FILTERING, SCOPING, AND OVERDUE DETECTION
// =========================================================================
const list = async (req, res) => {
  const Task = mongoose.model('Task');
  const user = req.user;
  const userRole = req.userRole;

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.items, 10) || parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = { removed: false };

  // Resolve user employee profile
  const userEmp = await resolveEmployee(user);
  const empId = userEmp?._id;
  const userId = user._id;

  // 1. Role-based scoping / query scoping
  const scope = req.query.scope; // 'my', 'team', 'all'

  if (userRole === ROLES.EMPLOYEE || scope === 'my') {
    // Employee strictly sees own tasks: owner, reviewer, or createdBy
    const conditions = [{ assignedTo: userId }, { createdBy: userId }, { reviewerUser: userId }];
    if (empId) {
      conditions.push({ owner: empId }, { reviewer: empId });
    }
    filter.$or = conditions;
  } else if (userRole === ROLES.DEPARTMENT_HEAD) {
    if (scope === 'my') {
      const conditions = [{ assignedTo: userId }, { createdBy: userId }, { reviewerUser: userId }];
      if (empId) conditions.push({ owner: empId }, { reviewer: empId });
      filter.$or = conditions;
    } else {
      // Department head sees their department's tasks, or where they are owner/reviewer
      const dept = user.department || '';
      filter.$or = [
        { department: new RegExp(`^${dept}$`, 'i') },
        { assignedTo: userId },
        { createdBy: userId },
        { reviewerUser: userId },
      ];
    }
  } else {
    // Management, HR, Admin can view all, or filter by 'my' / 'team'
    if (scope === 'my') {
      const conditions = [{ assignedTo: userId }, { createdBy: userId }, { reviewerUser: userId }];
      if (empId) conditions.push({ owner: empId }, { reviewer: empId });
      filter.$or = conditions;
    } else if (scope === 'team' && user.department) {
      filter.department = new RegExp(`^${user.department}$`, 'i');
    }
  }

  // 2. Department filter
  if (req.query.department) {
    filter.department = new RegExp(req.query.department, 'i');
  }

  // 3. Project filter
  if (req.query.project) {
    if (mongoose.Types.ObjectId.isValid(req.query.project)) {
      filter.project = req.query.project;
    } else {
      filter.projectName = new RegExp(req.query.project, 'i');
    }
  }

  // 4. Status filter
  if (req.query.status) {
    if (req.query.status === 'Overdue') {
      const now = new Date();
      filter.dueDate = { $lt: now };
      filter.status = { $nin: ['Completed', 'Cancelled'] };
    } else {
      filter.status = req.query.status;
    }
  }

  // 5. Priority filter
  if (req.query.priority) {
    filter.priority = req.query.priority;
  }

  // 6. Owner filter
  if (req.query.owner) {
    if (mongoose.Types.ObjectId.isValid(req.query.owner)) {
      filter.owner = req.query.owner;
    } else {
      filter.ownerName = new RegExp(req.query.owner, 'i');
    }
  }

  // 7. Reviewer filter
  if (req.query.reviewer) {
    if (mongoose.Types.ObjectId.isValid(req.query.reviewer)) {
      filter.reviewer = req.query.reviewer;
    } else {
      filter.reviewerName = new RegExp(req.query.reviewer, 'i');
    }
  }

  // 8. Overdue flag filter
  if (req.query.overdue === 'true') {
    filter.dueDate = { $lt: new Date() };
    filter.status = { $nin: ['Completed', 'Cancelled'] };
  }

  // 9. Today's tasks filter
  if (req.query.today === 'true') {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    filter.dueDate = { $gte: startOfDay, $lte: endOfDay };
  }

  // 10. Search query `q`
  if (req.query.q) {
    const qReg = new RegExp(req.query.q, 'i');
    const searchConditions = [
      { task: qReg },
      { description: qReg },
      { department: qReg },
      { projectName: qReg },
      { ownerName: qReg },
      { reviewerName: qReg },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  // 11. Sorting
  const sortBy = req.query.sortBy || 'dueDate';
  const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
  const sortObj = {};
  sortObj[sortBy] = sortOrder;

  const [records, count] = await Promise.all([
    Task.find(filter)
      .populate('owner', 'employeeId name surname photo departmentName designationName email')
      .populate('reviewer', 'employeeId name surname photo departmentName designationName email')
      .populate('project', 'name code department status')
      .populate('createdBy', 'name surname email role')
      .sort(sortObj)
      .skip(skip)
      .limit(limit),
    Task.countDocuments(filter),
  ]);

  // Enhance each task with dynamic overdue calculation
  const enhancedRecords = records.map((t) => {
    const obj = t.toObject({ virtuals: true });
    obj.isOverdue = isTaskOverdue(t);
    return obj;
  });

  const pages = Math.ceil(count / limit);

  return res.status(200).json({
    success: true,
    result: enhancedRecords,
    pagination: {
      page,
      pages,
      count,
    },
    message: 'Tasks retrieved successfully.',
  });
};

// =========================================================================
// 10. TASK DASHBOARD
// =========================================================================
const dashboard = async (req, res) => {
  const Task = mongoose.model('Task');
  const user = req.user;
  const userRole = req.userRole;

  const userEmp = await resolveEmployee(user);
  const empId = userEmp?._id;
  const userId = user._id;

  const baseFilter = { removed: false };

  // Scope enforcement for dashboard
  if (userRole === ROLES.EMPLOYEE) {
    const conditions = [{ assignedTo: userId }, { createdBy: userId }, { reviewerUser: userId }];
    if (empId) conditions.push({ owner: empId }, { reviewer: empId });
    baseFilter.$or = conditions;
  } else if (userRole === ROLES.DEPARTMENT_HEAD) {
    const dept = user.department || '';
    baseFilter.$or = [
      { department: new RegExp(`^${dept}$`, 'i') },
      { assignedTo: userId },
      { createdBy: userId },
      { reviewerUser: userId },
    ];
  }

  const allScopedTasks = await Task.find(baseFilter)
    .populate('owner', 'employeeId name surname photo departmentName designationName email')
    .populate('reviewer', 'employeeId name surname photo departmentName designationName email')
    .populate('project', 'name code department status')
    .sort({ dueDate: 1 });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  let todayCount = 0;
  let pendingCount = 0;
  let overdueCount = 0;
  let completedCount = 0;

  const todayTasks = [];
  const overdueTasks = [];
  const priorityCounts = { Low: 0, Medium: 0, High: 0, Critical: 0 };
  const statusCounts = {
    'Not Started': 0,
    'In Progress': 0,
    Waiting: 0,
    Completed: 0,
    Overdue: 0,
    Cancelled: 0,
  };
  const departmentCounts = {};

  allScopedTasks.forEach((t) => {
    const dueTime = new Date(t.dueDate).getTime();
    const isDueToday = dueTime >= startOfToday.getTime() && dueTime <= endOfToday.getTime();
    const isOverdue = t.status !== 'Completed' && t.status !== 'Cancelled' && dueTime < startOfToday.getTime();

    // Priority counts
    if (priorityCounts[t.priority] !== undefined) {
      priorityCounts[t.priority] += 1;
    }

    // Status counts
    if (statusCounts[t.status] !== undefined) {
      statusCounts[t.status] += 1;
    }

    // Department counts
    if (t.department) {
      departmentCounts[t.department] = (departmentCounts[t.department] || 0) + 1;
    }

    // Today's tasks
    if (isDueToday && t.status !== 'Completed' && t.status !== 'Cancelled') {
      todayCount += 1;
      todayTasks.push(t);
    }

    // Pending tasks
    if (['Not Started', 'In Progress', 'Waiting'].includes(t.status)) {
      pendingCount += 1;
    }

    // Overdue tasks
    if (isOverdue || t.status === 'Overdue') {
      overdueCount += 1;
      overdueTasks.push(t);
    }

    // Completed
    if (t.status === 'Completed') {
      completedCount += 1;
    }
  });

  return res.status(200).json({
    success: true,
    result: {
      metrics: {
        total: allScopedTasks.length,
        today: todayCount,
        pending: pendingCount,
        overdue: overdueCount,
        completed: completedCount,
      },
      priorityBreakdown: priorityCounts,
      statusBreakdown: statusCounts,
      departmentBreakdown: departmentCounts,
      todayTasks: todayTasks.slice(0, 10),
      overdueTasks: overdueTasks.slice(0, 10),
      recentTasks: allScopedTasks.slice(0, 8),
    },
  });
};

// =========================================================================
// 11. MY TASKS SHORTCUT
// =========================================================================
const myTasks = async (req, res) => {
  req.query.scope = 'my';
  return list(req, res);
};

// =========================================================================
// 12. TEAM TASKS SHORTCUT
// =========================================================================
const teamTasks = async (req, res) => {
  req.query.scope = 'team';
  return list(req, res);
};

// =========================================================================
// 13. SUMMARY (ERP MODULE SUMMARY)
// =========================================================================
const summary = async (req, res) => {
  const Task = mongoose.model('Task');
  const total = await Task.countDocuments({ removed: false });
  const completed = await Task.countDocuments({ removed: false, status: 'Completed' });
  const inProgress = await Task.countDocuments({ removed: false, status: 'In Progress' });
  const overdue = await Task.countDocuments({
    removed: false,
    status: { $nin: ['Completed', 'Cancelled'] },
    dueDate: { $lt: new Date() },
  });

  return res.status(200).json({
    success: true,
    result: {
      total,
      completed,
      inProgress,
      overdue,
    },
  });
};

// =========================================================================
// GITHUB ARTIFACT TASK LINKING & RETRIEVAL
// =========================================================================
const getGithubLinks = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid task ID format.' });
    }

    const Task = mongoose.model('Task');
    const task = await Task.findOne({ _id: id, removed: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const hasAccess = await checkTaskAccess(task, req.user, req.user?.role);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied: You are not authorized to view this task.' });
    }

    return res.status(200).json({
      success: true,
      result: task.githubLinks || { branches: [], commits: [], pullRequests: [] },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const linkGithub = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid task ID format.' });
    }

    const Task = mongoose.model('Task');
    let task = await Task.findOne({ _id: id, removed: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const hasAccess = await checkTaskAccess(task, req.user, req.user?.role);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied: You are not authorized to modify this task.' });
    }

    const type = req.body.type;
    const item = req.body.item || req.body;
    if (!type || !item) {
      return res.status(400).json({ success: false, message: 'Type and item data are required.' });
    }

    if (!task.githubLinks) {
      task.githubLinks = { branches: [], commits: [], pullRequests: [] };
    }

    if (type === 'commit') {
      if (!item.sha || !/^[a-fA-F0-9]{7,40}$/.test(item.sha)) {
        return res.status(400).json({ success: false, message: 'Invalid commit SHA format. Must be a 7 to 40 character hexadecimal hash.' });
      }
      const commitObj = {
        sha: item.sha,
        shortSha: item.shortSha || item.sha.substring(0, 7),
        message: typeof item.message === 'string' ? item.message.trim().substring(0, 300) : '',
        author: typeof item.author === 'string' ? item.author.trim().substring(0, 100) : req.user.name || '',
        url: item.url || '',
        date: item.date ? new Date(item.date) : new Date(),
        linkedAt: new Date(),
        linkedBy: req.user._id,
      };

      const updated = await Task.findOneAndUpdate(
        { _id: id, 'githubLinks.commits.sha': { $ne: item.sha } },
        { $push: { 'githubLinks.commits': commitObj } },
        { new: true }
      );
      task = updated || (await Task.findById(id));
    } else if (type === 'pullRequest') {
      const prNum = parseInt(item.number, 10);
      if (isNaN(prNum) || prNum <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid pull request number. Must be a positive integer.' });
      }
      const prObj = {
        number: prNum,
        title: typeof item.title === 'string' ? item.title.trim().substring(0, 300) : '',
        state: item.state || 'open',
        url: item.url || '',
        isMerged: Boolean(item.isMerged),
        headBranch: typeof item.headBranch === 'string' ? item.headBranch.trim().substring(0, 100) : '',
        baseBranch: typeof item.baseBranch === 'string' ? item.baseBranch.trim().substring(0, 100) : '',
        linkedAt: new Date(),
        linkedBy: req.user._id,
      };

      const updatedExisting = await Task.findOneAndUpdate(
        { _id: id, 'githubLinks.pullRequests.number': prNum },
        {
          $set: {
            'githubLinks.pullRequests.$.state': prObj.state,
            'githubLinks.pullRequests.$.title': prObj.title,
            'githubLinks.pullRequests.$.isMerged': prObj.isMerged,
          },
        },
        { new: true }
      );

      if (updatedExisting) {
        task = updatedExisting;
      } else {
        const pushed = await Task.findOneAndUpdate(
          { _id: id, 'githubLinks.pullRequests.number': { $ne: prNum } },
          { $push: { 'githubLinks.pullRequests': prObj } },
          { new: true }
        );
        task = pushed || (await Task.findById(id));
      }
    } else if (type === 'branch') {
      if (!item.name || !/^[a-zA-Z0-9._\-/]+$/.test(item.name)) {
        return res.status(400).json({ success: false, message: 'Invalid branch name format.' });
      }
      const branchObj = {
        name: item.name.trim().substring(0, 100),
        url: item.url || '',
        linkedAt: new Date(),
        linkedBy: req.user._id,
      };

      const updated = await Task.findOneAndUpdate(
        { _id: id, 'githubLinks.branches.name': { $ne: branchObj.name } },
        { $push: { 'githubLinks.branches': branchObj } },
        { new: true }
      );
      task = updated || (await Task.findById(id));
    } else {
      return res.status(400).json({ success: false, message: 'Invalid type: must be commit, pullRequest, or branch.' });
    }

    return res.status(200).json({
      success: true,
      result: task.githubLinks,
      message: `GitHub ${type} linked to task successfully.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const unlinkGithub = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid task ID format.' });
    }

    const Task = mongoose.model('Task');
    const task = await Task.findOne({ _id: id, removed: false });
    if (!task) return res.status(404).json({ success: false, message: 'Task not found.' });

    const hasAccess = await checkTaskAccess(task, req.user, req.user?.role);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied: You are not authorized to modify this task.' });
    }

    const { type, identifier } = req.body;
    if (!type || identifier === undefined) {
      return res.status(400).json({ success: false, message: 'Type and identifier are required.' });
    }

    if (!task.githubLinks) {
      return res.status(200).json({ success: true, result: { branches: [], commits: [], pullRequests: [] } });
    }

    if (type === 'commit') {
      task.githubLinks.commits = task.githubLinks.commits.filter((c) => c.sha !== identifier);
    } else if (type === 'pullRequest') {
      task.githubLinks.pullRequests = task.githubLinks.pullRequests.filter((p) => p.number !== Number(identifier));
    } else if (type === 'branch') {
      task.githubLinks.branches = task.githubLinks.branches.filter((b) => b.name !== identifier);
    } else {
      return res.status(400).json({ success: false, message: 'Invalid type: must be commit, pullRequest, or branch.' });
    }

    await task.save();

    return res.status(200).json({
      success: true,
      result: task.githubLinks,
      message: `GitHub ${type} unlinked from task.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  create,
  read,
  update,
  delete: deleteTask,
  changeStatus,
  addSubtask,
  updateSubtask,
  deleteSubtask,
  addComment,
  addAttachment,
  list,
  listAll: list,
  filter: list,
  search: list,
  dashboard,
  myTasks,
  teamTasks,
  summary,
  getGithubLinks,
  linkGithub,
  unlinkGithub,
};

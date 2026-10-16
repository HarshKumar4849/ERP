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
  const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');
  let employee = await Employee.findOne({ user: user._id, removed: false });
  if (!employee && user.email) {
    employee = await Employee.findOne({ email: user.email.toLowerCase(), removed: false });
  }
  return employee;
};

// Helper to verify project access: ADMIN/HR/Management has global access; EMPLOYEE requires PM or team member
const checkProjectAccess = async (project, user, userRole) => {
  const normRole = normalizeRole ? normalizeRole(userRole || user?.role) : (userRole || user?.role || '').toUpperCase();
  if (normRole === ROLES.ADMIN || normRole === ROLES.HR || normRole === 'MANAGEMENT' || normRole === 'SUPER_ADMIN') {
    return { hasAccess: true, isPM: true };
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
// 1. LIST PROJECTS (WITH ROLE-BASED SCOPING & DASHBOARD STATS)
// =========================================================================
const list = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();

    const Project = mongoose.models.Project || require('../../../models/appModels/Project');
    const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');

    let filter = { removed: false };

    // 1. Employee Scoping: ONLY authorized projects (PM or Team Member)
    if (role === 'EMPLOYEE') {
      const emp = await resolveEmployee(user);
      if (!emp) {
        return res.status(200).json({
          success: true,
          result: [],
          summary: { total: 0, active: 0, completed: 0, overdue: 0, totalBudget: 0 },
          message: 'No employee record linked to user account.',
        });
      }
      filter.$or = [{ projectManager: emp._id }, { teamMembers: emp._id }];
    } else if (role === 'DEPARTMENT_HEAD' || role === 'DEPT_HEAD') {
      // 2. Department Head Scoping: Projects in Department OR where PM / Member
      const emp = await resolveEmployee(user);
      const empId = emp ? emp._id : null;
      const orConditions = [];

      if (user.department) {
        orConditions.push({ department: new RegExp(`^${user.department.trim()}$`, 'i') });
      }
      if (empId) {
        orConditions.push({ projectManager: empId });
        orConditions.push({ teamMembers: empId });
      }
      if (orConditions.length > 0) {
        filter.$or = orConditions;
      }
    }

    // Additional User Filters
    if (req.query.category && req.query.category !== 'ALL') {
      filter.category = req.query.category;
    }
    if (req.query.status && req.query.status !== 'ALL') {
      filter.status = req.query.status;
    }
    if (req.query.department && req.query.department !== 'ALL' && role !== 'DEPARTMENT_HEAD') {
      filter.department = req.query.department;
    }
    if (req.query.q) {
      const qReg = new RegExp(req.query.q, 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [{ name: qReg }, { client: qReg }, { code: qReg }, { notes: qReg }],
      });
    }

    const items = await Project.find(filter)
      .populate('projectManager', 'name surname employeeId designationName departmentName email photo')
      .populate('teamMembers', 'name surname employeeId designationName departmentName email')
      .sort({ created: -1 })
      .lean();

    // Calculate Dashboard Summary
    let totalBudget = 0;
    let activeCount = 0;
    let completedCount = 0;
    let overdueCount = 0;
    const categoryCounts = { MDS: 0, B2B: 0, B2G: 0, Consulting: 0, Events: 0 };

    const now = new Date();
    items.forEach((p) => {
      totalBudget += Number(p.budget || 0);
      if (p.status === 'Completed') completedCount++;
      else if (p.status === 'In Progress' || p.status === 'active') activeCount++;
      else if (p.status === 'Overdue' || (p.targetDate && new Date(p.targetDate) < now && p.status !== 'Completed')) {
        overdueCount++;
      }

      if (categoryCounts[p.category] !== undefined) {
        categoryCounts[p.category]++;
      }
    });

    return res.status(200).json({
      success: true,
      result: items,
      summary: {
        total: items.length,
        active: activeCount,
        completed: completedCount,
        overdue: overdueCount,
        totalBudget,
        categoryCounts,
      },
      message: 'Projects retrieved successfully.',
    });
  } catch (error) {
    console.error('Project list error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 2. READ PROJECT WORKSPACE (LIVE CONNECTIONS WITH TASKS, CALENDAR, DOCS)
// =========================================================================
const read = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();

    const Project = mongoose.models.Project || require('../../../models/appModels/Project');
    const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');
    const Task = mongoose.models.Task || require('../../../models/appModels/Task');
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');
    const Document = mongoose.models.Document || require('../../../models/appModels/Document');

    const project = await Project.findOne({ _id: req.params.id, removed: false })
      .populate('projectManager', 'name surname employeeId designationName departmentName email photo')
      .populate('teamMembers', 'name surname employeeId designationName departmentName email photo')
      .lean();

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // Scoping Check for Employee
    const { hasAccess } = await checkProjectAccess(project, user, role);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view this project.',
      });
    }

    // Live Cross-Collection Connections (No Data Duplication)
    const [liveTasks, liveEvents, liveDocuments] = await Promise.all([
      Task.find({ project: project._id, removed: false })
        .populate('owner', 'name surname employeeId')
        .sort({ dueDate: 1 })
        .lean(),
      Event.find({ project: project._id, removed: false })
        .sort({ startDate: 1 })
        .lean(),
      Document.find({ project: project._id, removed: false })
        .sort({ created: -1 })
        .lean(),
    ]);

    // Calculate Task Metrics
    const taskStats = {
      total: liveTasks.length,
      completed: liveTasks.filter((t) => t.status === 'Completed').length,
      inProgress: liveTasks.filter((t) => t.status === 'In Progress').length,
      pending: liveTasks.filter((t) => t.status === 'Not Started' || t.status === 'Waiting').length,
      overdue: liveTasks.filter((t) => t.status === 'Overdue').length,
    };

    // Calculate Deliverables Metrics
    const delivs = project.deliverables || [];
    const delivStats = {
      total: delivs.length,
      completed: delivs.filter((d) => d.status === 'Completed').length,
      pending: delivs.filter((d) => d.status !== 'Completed').length,
    };

    // Calculate overall dynamic progress
    let liveProgress = project.progress || 0;
    if (taskStats.total > 0) {
      liveProgress = Math.round((taskStats.completed / taskStats.total) * 100);
    } else if (delivStats.total > 0) {
      liveProgress = Math.round((delivStats.completed / delivStats.total) * 100);
    }

    return res.status(200).json({
      success: true,
      result: {
        ...project,
        liveTasks,
        liveEvents,
        liveDocuments,
        taskStats,
        delivStats,
        liveProgress,
      },
      message: 'Project workspace loaded successfully.',
    });
  } catch (error) {
    console.error('Project read error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 3. CREATE PROJECT
// =========================================================================
const create = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();

    if (role === 'EMPLOYEE') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Employees cannot create projects.',
      });
    }

    const Project = mongoose.models.Project || require('../../../models/appModels/Project');
    const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');

    const {
      name,
      client,
      category,
      department,
      projectManager: pmId,
      teamMembers,
      startDate,
      targetDate,
      budget,
      status,
      notes,
      description,
      deliverables,
    } = req.body;

    if (!name || !client || !category || !department || !pmId || !targetDate) {
      return res.status(400).json({
        success: false,
        message: 'Project Name, Client, Category, Department, Project Manager, and Target Date are required.',
      });
    }

    const pm = await Employee.findOne({ _id: pmId, removed: false });
    if (!pm) {
      return res.status(404).json({ success: false, message: 'Selected Project Manager not found.' });
    }

    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const code = `TM-${category.toUpperCase()}-${year}-${randomSuffix}`;

    const newProject = new Project({
      name: name.trim(),
      code,
      client: client.trim(),
      category,
      department: department.trim(),
      projectManager: pm._id,
      projectManagerName: `${pm.name} ${pm.surname || ''}`.trim(),
      teamMembers: Array.isArray(teamMembers) ? teamMembers : [],
      startDate: startDate ? new Date(startDate) : new Date(),
      targetDate: new Date(targetDate),
      budget: Number(budget || 0),
      status: status || 'In Progress',
      notes: notes || '',
      description: description || '',
      deliverables: Array.isArray(deliverables) ? deliverables : [],
      createdBy: user._id,
    });

    await newProject.save();

    return res.status(201).json({
      success: true,
      result: newProject,
      message: 'Project created successfully.',
    });
  } catch (error) {
    console.error('Project create error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 4. UPDATE PROJECT
// =========================================================================
const update = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();

    const Project = mongoose.models.Project || require('../../../models/appModels/Project');
    const project = await Project.findOne({ _id: req.params.id, removed: false });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // Role & authorization check
    const { hasAccess, isPM } = await checkProjectAccess(project, user, role);
    if (!hasAccess || (role === 'EMPLOYEE' && !isPM)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only Project Managers or Leadership can update project metadata.',
      });
    }

    const updates = req.body;
    const allowedFields = [
      'name', 'client', 'category', 'department', 'projectManager', 'teamMembers',
      'startDate', 'targetDate', 'budget', 'status', 'progress', 'notes', 'description', 'deliverables'
    ];

    allowedFields.forEach((f) => {
      if (updates[f] !== undefined) {
        project[f] = updates[f];
      }
    });

    await project.save();

    return res.status(200).json({
      success: true,
      result: project,
      message: 'Project updated successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 5. ADD DELIVERABLE
// =========================================================================
const addDeliverable = async (req, res) => {
  try {
    const Project = mongoose.models.Project || require('../../../models/appModels/Project');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid project id.' });
    }
    const project = await Project.findOne({ _id: req.params.id, removed: false });

    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const { hasAccess } = await checkProjectAccess(project, req.user, req.user?.role);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to add deliverables to this project.',
      });
    }

    const { title, description, dueDate, status } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Deliverable title is required.' });

    project.deliverables.push({
      title: title.trim(),
      description: description || '',
      dueDate: dueDate ? new Date(dueDate) : null,
      status: status || 'Pending',
    });

    await project.save();

    return res.status(200).json({
      success: true,
      result: project.deliverables,
      message: 'Deliverable added.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 6. ADD MEETING & SYNC TO CALENDAR
// =========================================================================
const addMeeting = async (req, res) => {
  try {
    const user = req.user;
    const Project = mongoose.models.Project || require('../../../models/appModels/Project');
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');

    const project = await Project.findOne({ _id: req.params.id, removed: false });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const { hasAccess } = await checkProjectAccess(project, req.user, req.user?.role);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to schedule meetings for this project.',
      });
    }

    const { title, date, meetingLink, agenda } = req.body;
    if (!title || !date) {
      return res.status(400).json({ success: false, message: 'Meeting title and date are required.' });
    }

    const meetingDate = new Date(date);

    // Sync to Calendar (Event.js)
    const newEvent = new Event({
      title: `[${project.name}] ${title}`,
      description: agenda || `Project meeting for ${project.name}`,
      eventType: 'Meeting',
      startDate: meetingDate,
      endDate: new Date(meetingDate.getTime() + 60 * 60 * 1000), // 1 hour duration
      location: meetingLink ? 'Virtual Video Conference' : 'Conference Room B',
      isVirtual: Boolean(meetingLink),
      meetingLink: meetingLink || '',
      project: project._id,
      department: project.department,
      organizer: user._id,
      organizerName: `${user.name || ''} ${user.surname || ''}`.trim() || 'Project Lead',
      attendees: project.teamMembers,
    });
    await newEvent.save();

    // Embed in project meetings list
    project.meetings.push({
      title: title.trim(),
      date: meetingDate,
      meetingLink: meetingLink || '',
      agenda: agenda || '',
      calendarEvent: newEvent._id,
    });

    await project.save();

    return res.status(201).json({
      success: true,
      result: project.meetings,
      calendarEvent: newEvent,
      message: 'Meeting scheduled and synced to Company Calendar.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 7. ADD DOCUMENT LINK
// =========================================================================
const addDocument = async (req, res) => {
  try {
    const Project = mongoose.models.Project || require('../../../models/appModels/Project');
    const project = await Project.findOne({ _id: req.params.id, removed: false });
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });

    const { hasAccess } = await checkProjectAccess(project, req.user, req.user?.role);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to attach documents to this project.',
      });
    }

    const { title, fileUrl, fileType, fileName } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Document title is required.' });

    project.documents.push({
      title: title.trim(),
      fileName: fileName || title,
      fileUrl: fileUrl || '',
      fileType: fileType || 'PDF',
      uploadedAt: new Date(),
    });

    await project.save();

    return res.status(200).json({
      success: true,
      result: project.documents,
      message: 'Document linked to project repository.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 8. DELETE PROJECT
// =========================================================================
const deleteItem = async (req, res) => {
  try {
    const user = req.user;
    const normRole = normalizeRole ? normalizeRole(user.role) : (user.role || '').toUpperCase();

    if (normRole !== ROLES.ADMIN && !['ADMIN', 'MANAGEMENT', 'SUPER_ADMIN'].includes(normRole)) {
      return res.status(403).json({ success: false, message: 'Access denied: Only administrators can delete projects.' });
    }

    const Project = mongoose.models.Project || require('../../../models/appModels/Project');
    await Project.findByIdAndUpdate(req.params.id, { removed: true });

    return res.status(200).json({ success: true, message: 'Project removed.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  list,
  read,
  create,
  update,
  delete: deleteItem,
  addDeliverable,
  addMeeting,
  addDocument,
};

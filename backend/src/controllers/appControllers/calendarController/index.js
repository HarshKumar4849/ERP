const mongoose = require('mongoose');
let ROLES;
try {
  ROLES = require('../../../rbac/roles').ROLES;
} catch (e) {
  ROLES = require('../../../rbac/roles').ROLES;
}

// Helper to resolve Employee document
const resolveEmployee = async (user) => {
  if (!user) return null;
  const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');
  let employee = await Employee.findOne({ user: user._id, removed: false });
  if (!employee && user.email) {
    employee = await Employee.findOne({ email: user.email.toLowerCase(), removed: false });
  }
  return employee;
};

// =========================================================================
// 1. UNIFIED CALENDAR EVENTS FEED (MY CALENDAR & COMPANY CALENDAR)
// =========================================================================
const events = async (req, res) => {
  try {
    const user = req.user;
    const userRole = req.userRole;

    const Event = mongoose.models.Event || require('../../../models/appModels/Event');
    const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');
    const Leave = mongoose.models.Leave || require('../../../models/appModels/Leave');
    const Task = mongoose.models.Task || require('../../../models/appModels/Task');
    const Project = mongoose.models.Project || require('../../../models/appModels/Project');
    const Attendance = mongoose.models.Attendance || require('../../../models/appModels/Attendance');

    const userEmp = await resolveEmployee(user);
    const userId = user._id;
    const empId = userEmp?._id;
    const userDept = user.department || userEmp?.departmentName || '';

    const scope = req.query.scope || (userRole === ROLES.EMPLOYEE ? 'my' : 'company');
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month, 10) : null; // 1 - 12

    let startDate, endDate;
    if (month) {
      startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    } else {
      startDate = new Date(year, 0, 1, 0, 0, 0, 0);
      endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    }

    const unifiedEvents = [];

    // 1. EVENTS, MEETINGS, ACTIVITIES, CLIENT VISITS FROM EVENT MODEL
    const eventQuery = {
      removed: false,
      startDate: { $lte: endDate },
      $or: [{ endDate: { $gte: startDate } }, { startDate: { $gte: startDate } }],
    };

    if (scope === 'my' && userRole === ROLES.EMPLOYEE) {
      eventQuery.$or = [
        { organizer: userId },
        { department: 'All' },
        { department: new RegExp(`^${userDept}$`, 'i') },
        ...(empId ? [{ attendees: empId }] : []),
      ];
    } else if (req.query.department) {
      eventQuery.department = new RegExp(req.query.department, 'i');
    }

    const dbEvents = await Event.find(eventQuery).lean();
    dbEvents.forEach((ev) => {
      unifiedEvents.push({
        id: `ev-${ev._id}`,
        dbId: ev._id,
        title: ev.title || ev.eventName,
        description: ev.description,
        eventType: ev.eventType || 'Company Event',
        startDate: ev.startDate || ev.date,
        endDate: ev.endDate || ev.startDate || ev.date,
        time: ev.time || ev.startTime || '10:00 AM',
        startTime: ev.startTime || ev.time || '10:00 AM',
        endTime: ev.endTime || '12:00 PM',
        location: ev.venue || ev.location || 'TecMotiv Corporate Auditorium',
        venue: ev.venue || ev.location || 'TecMotiv Corporate Auditorium',
        isVirtual: ev.isVirtual,
        meetingLink: ev.meetingLink,
        department: ev.department,
        organizerName: ev.organizerName,
        poster: ev.poster,
        photos: ev.photos || [],
        videos: ev.videos || [],
        eventReport: ev.eventReport,
        participants: ev.participants || [],
        status: ev.status || 'Scheduled',
        invitation: ev.invitation,
        reminderDaysBefore: ev.reminderDaysBefore || 7,
        source: 'Event',
      });
    });

    // 2. DYNAMICALLY CALCULATE BIRTHDAYS THIS YEAR
    const empFilter = { removed: false, status: { $ne: 'Terminated' } };
    if (req.query.department) {
      empFilter.departmentName = new RegExp(req.query.department, 'i');
    }

    const employees = await Employee.find(empFilter)
      .select('employeeId name surname birthDate joiningDate departmentName designationName photo')
      .lean();

    employees.forEach((emp) => {
      if (emp.birthDate) {
        const bOriginal = new Date(emp.birthDate);
        const bMonth = bOriginal.getMonth();
        const bDay = bOriginal.getDate();

        // Calculate birthday in the requested year
        const bThisYear = new Date(year, bMonth, bDay, 0, 0, 0, 0);

        if (bThisYear >= startDate && bThisYear <= endDate) {
          unifiedEvents.push({
            id: `bday-${emp._id}-${year}`,
            title: `🎂 Birthday: ${emp.name} ${emp.surname}`,
            eventType: 'Birthday',
            startDate: bThisYear,
            endDate: bThisYear,
            department: emp.departmentName,
            employeeName: `${emp.name} ${emp.surname}`,
            employeeId: emp._id,
            photo: emp.photo,
            allDay: true,
            source: 'Birthday',
          });
        }
      }

      // 3. DYNAMICALLY CALCULATE WORK ANNIVERSARIES
      if (emp.joiningDate) {
        const jOriginal = new Date(emp.joiningDate);
        const jYear = jOriginal.getFullYear();
        const jMonth = jOriginal.getMonth();
        const jDay = jOriginal.getDate();

        const yearsCompleted = year - jYear;
        if (yearsCompleted > 0) {
          const annivThisYear = new Date(year, jMonth, jDay, 0, 0, 0, 0);
          if (annivThisYear >= startDate && annivThisYear <= endDate) {
            unifiedEvents.push({
              id: `anniv-${emp._id}-${year}`,
              title: `🏆 ${yearsCompleted} Year Work Anniversary: ${emp.name} ${emp.surname}`,
              eventType: 'Anniversary',
              startDate: annivThisYear,
              endDate: annivThisYear,
              department: emp.departmentName,
              employeeName: `${emp.name} ${emp.surname}`,
              employeeId: emp._id,
              yearsCompleted,
              allDay: true,
              source: 'Anniversary',
            });
          }
        }
      }
    });

    // 4. APPROVED LEAVES (DO NOT BREAK EXISTING LEAVE CALENDAR)
    const leaveFilter = {
      removed: false,
      status: { $in: ['Approved', 'approved'] },
      fromDate: { $lte: endDate },
      toDate: { $gte: startDate },
    };

    if (scope === 'my' && userRole === ROLES.EMPLOYEE) {
      if (empId) leaveFilter.employee = empId;
      else leaveFilter.user = userId;
    } else if (req.query.department) {
      leaveFilter.department = new RegExp(req.query.department, 'i');
    }

    const approvedLeaves = await Leave.find(leaveFilter)
      .populate('employee', 'name surname departmentName')
      .lean();

    approvedLeaves.forEach((lv) => {
      const empName = lv.employee
        ? `${lv.employee.name} ${lv.employee.surname}`
        : lv.department || 'Employee';
      unifiedEvents.push({
        id: `leave-${lv._id}`,
        title: `☕ Leave: ${empName} (${lv.leaveType})`,
        eventType: 'Leave',
        startDate: lv.fromDate,
        endDate: lv.toDate,
        department: lv.department,
        leaveType: lv.leaveType,
        daysCount: lv.daysCount,
        allDay: true,
        source: 'Leave',
      });
    });

    // 5. TASK DEADLINES
    const taskFilter = {
      removed: false,
      status: { $nin: ['Completed', 'Cancelled'] },
      dueDate: { $gte: startDate, $lte: endDate },
    };

    if (scope === 'my') {
      const conditions = [{ assignedTo: userId }, { createdBy: userId }, { reviewerUser: userId }];
      if (empId) conditions.push({ owner: empId }, { reviewer: empId });
      taskFilter.$or = conditions;
    } else if (req.query.department) {
      taskFilter.department = new RegExp(req.query.department, 'i');
    }

    const tasks = await Task.find(taskFilter).select('task title priority dueDate department projectName').lean();
    tasks.forEach((t) => {
      unifiedEvents.push({
        id: `task-${t._id}`,
        title: `📌 Deadline: ${t.task || t.title}`,
        eventType: 'Deadline',
        startDate: t.dueDate,
        endDate: t.dueDate,
        department: t.department,
        priority: t.priority,
        projectName: t.projectName,
        source: 'Task',
      });
    });

    // 6. PROJECT MILESTONES
    const projectFilter = {
      removed: false,
      status: 'active',
      endDate: { $gte: startDate, $lte: endDate },
    };
    if (req.query.department) {
      projectFilter.department = new RegExp(req.query.department, 'i');
    }

    const projects = await Project.find(projectFilter).lean();
    projects.forEach((p) => {
      unifiedEvents.push({
        id: `proj-${p._id}`,
        title: `🚀 Project Milestone: ${p.name}`,
        eventType: 'Project Milestone',
        startDate: p.endDate || p.startDate,
        endDate: p.endDate || p.startDate,
        department: p.department,
        code: p.code,
        source: 'Project',
      });
    });

    // 7. CLIENT VISITS FROM ATTENDANCE
    const visitFilter = {
      removed: false,
      workMode: 'Client Visit',
      date: { $gte: startDate, $lte: endDate },
    };
    if (scope === 'my' && empId) {
      visitFilter.employee = empId;
    }

    const clientVisits = await Attendance.find(visitFilter)
      .populate('employee', 'name surname departmentName')
      .lean();

    clientVisits.forEach((cv) => {
      const eName = cv.employee ? `${cv.employee.name} ${cv.employee.surname}` : 'Consultant';
      unifiedEvents.push({
        id: `visit-${cv._id}`,
        title: `🚗 Client Visit: ${eName}`,
        eventType: 'Client Visit',
        startDate: cv.date,
        endDate: cv.date,
        department: cv.department,
        remarks: cv.remarks,
        source: 'Attendance',
      });
    });

    // Sort by start date
    unifiedEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    return res.status(200).json({
      success: true,
      result: unifiedEvents,
      scope,
      year,
      month,
      count: unifiedEvents.length,
    });
  } catch (error) {
    console.error('Calendar events error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 2. CELEBRATIONS MANAGEMENT (BIRTHDAYS & WORK ANNIVERSARIES)
// =========================================================================
const celebrations = async (req, res) => {
  try {
    const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');
    const Celebration = mongoose.models.Celebration || require('../../../models/appModels/Celebration');

    const now = new Date();
    const currentYear = now.getFullYear();

    const employees = await Employee.find({ removed: false, status: { $ne: 'Terminated' } })
      .select('employeeId name surname birthDate joiningDate departmentName designationName photo email')
      .lean();

    const upcomingBirthdays = [];
    const upcomingAnniversaries = [];

    employees.forEach((emp) => {
      // 1. Calculate next birthday
      if (emp.birthDate) {
        const b = new Date(emp.birthDate);
        let nextBday = new Date(currentYear, b.getMonth(), b.getDate(), 0, 0, 0, 0);

        // If already passed this year, check next year
        if (nextBday < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
          nextBday = new Date(currentYear + 1, b.getMonth(), b.getDate(), 0, 0, 0, 0);
        }

        const diffMs = nextBday.getTime() - now.getTime();
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (daysLeft >= 0 && daysLeft <= 90) {
          // Trigger reminder 7 days before
          const reminderTriggerDate = new Date(nextBday);
          reminderTriggerDate.setDate(reminderTriggerDate.getDate() - 7);

          upcomingBirthdays.push({
            employeeId: emp._id,
            name: `${emp.name} ${emp.surname}`,
            photo: emp.photo,
            department: emp.departmentName,
            designation: emp.designationName,
            type: 'Birthday',
            occasionDate: nextBday,
            daysLeft,
            isToday: daysLeft === 0,
            reminderScheduled: true,
            reminderDaysBefore: 7,
            reminderTriggerDate,
            reminderActive: daysLeft <= 7,
          });
        }
      }

      // 2. Calculate next anniversary
      if (emp.joiningDate) {
        const j = new Date(emp.joiningDate);
        let nextAnniv = new Date(currentYear, j.getMonth(), j.getDate(), 0, 0, 0, 0);

        if (nextAnniv < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
          nextAnniv = new Date(currentYear + 1, j.getMonth(), j.getDate(), 0, 0, 0, 0);
        }

        const yearsCompleted = nextAnniv.getFullYear() - j.getFullYear();

        if (yearsCompleted > 0) {
          const diffMs = nextAnniv.getTime() - now.getTime();
          const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          if (daysLeft >= 0 && daysLeft <= 90) {
            const reminderTriggerDate = new Date(nextAnniv);
            reminderTriggerDate.setDate(reminderTriggerDate.getDate() - 7);

            upcomingAnniversaries.push({
              employeeId: emp._id,
              name: `${emp.name} ${emp.surname}`,
              photo: emp.photo,
              department: emp.departmentName,
              designation: emp.designationName,
              type: 'Work Anniversary',
              occasionDate: nextAnniv,
              yearsCompleted,
              daysLeft,
              isToday: daysLeft === 0,
              reminderScheduled: true,
              reminderDaysBefore: 7,
              reminderTriggerDate,
              reminderActive: daysLeft <= 7,
            });
          }
        }
      }
    });

    upcomingBirthdays.sort((a, b) => a.daysLeft - b.daysLeft);
    upcomingAnniversaries.sort((a, b) => a.daysLeft - b.daysLeft);

    // Fetch persistent celebration records with wishes
    const savedCelebrations = await Celebration.find({ removed: false })
      .populate('employee', 'name surname photo departmentName')
      .sort({ occasionDate: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      result: {
        upcomingBirthdays,
        upcomingAnniversaries,
        savedCelebrations,
        defaultReminderDays: 7,
      },
    });
  } catch (error) {
    console.error('Celebrations error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 3. CREATE / POST A WISH ON A CELEBRATION
// =========================================================================
const addWish = async (req, res) => {
  try {
    const Celebration = mongoose.models.Celebration || require('../../../models/appModels/Celebration');
    const user = req.user;
    const { id } = req.params;
    const { message: wishText, employeeId, type, title, occasionDate, yearsCompleted, employeeName } = req.body;

    if (!wishText || !wishText.trim()) {
      return res.status(400).json({ success: false, message: 'Message/wish text is required.' });
    }

    let celebrationDoc = null;
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      celebrationDoc = await Celebration.findOne({ _id: id, removed: false });
    }

    // If celebration record doesn't exist yet, create a persistent celebration record
    if (!celebrationDoc && employeeId) {
      celebrationDoc = await new Celebration({
        type: type || 'Birthday',
        employee: employeeId,
        employeeName: employeeName || 'Colleague',
        title: title || `${employeeName}'s ${type || 'Celebration'}`,
        occasionDate: occasionDate ? new Date(occasionDate) : new Date(),
        yearsCompleted: yearsCompleted || 0,
        reminderScheduled: true,
        reminderDaysBefore: 7,
      }).save();
    }

    if (!celebrationDoc) {
      return res.status(404).json({ success: false, message: 'Celebration record not found.' });
    }

    celebrationDoc.wishes.push({
      user: user._id,
      authorName: `${user.name || ''} ${user.surname || ''}`.trim() || user.email,
      authorRole: req.userRole || user.role || 'EMPLOYEE',
      message: wishText.trim(),
      createdAt: new Date(),
    });

    await celebrationDoc.save();

    return res.status(200).json({
      success: true,
      result: celebrationDoc,
      message: 'Celebration wish posted successfully!',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 4. CREATE CALENDAR EVENT
// =========================================================================
const createEvent = async (req, res) => {
  try {
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');
    const user = req.user;

    const {
      title,
      description,
      eventType,
      startDate,
      endDate,
      location,
      department,
      isVirtual,
      meetingLink,
      reminderDaysBefore,
      attendees,
    } = req.body;

    if (!title || !startDate) {
      return res.status(400).json({ success: false, message: 'Title and Start Date are required.' });
    }

    const newEvent = await new Event({
      title: title.trim(),
      description: (description || '').trim(),
      eventType: eventType || 'Event',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : new Date(startDate),
      location: location || 'Headquarters',
      department: department || 'All',
      isVirtual: Boolean(isVirtual),
      meetingLink: meetingLink || '',
      reminderDaysBefore: reminderDaysBefore !== undefined ? reminderDaysBefore : 7,
      reminderScheduled: true,
      organizer: user._id,
      organizerName: `${user.name || ''} ${user.surname || ''}`.trim() || user.email,
      attendees: Array.isArray(attendees) ? attendees : [],
    }).save();

    return res.status(201).json({
      success: true,
      result: newEvent,
      message: 'Calendar event created successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 5. UPDATE EVENT
// =========================================================================
const updateEvent = async (req, res) => {
  try {
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid event id.' });
    }
    const event = await Event.findOne({ _id: req.params.id, removed: false });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const fields = [
      'title',
      'description',
      'eventType',
      'startDate',
      'endDate',
      'location',
      'department',
      'isVirtual',
      'meetingLink',
      'reminderDaysBefore',
      'status',
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        event[f] = req.body[f];
      }
    });

    event.updated = Date.now();
    await event.save();

    return res.status(200).json({
      success: true,
      result: event,
      message: 'Event updated successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 6. DELETE EVENT
// =========================================================================
const deleteEvent = async (req, res) => {
  try {
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');
    const event = await Event.findOne({ _id: req.params.id, removed: false });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    event.removed = true;
    event.updated = Date.now();
    await event.save();

    return res.status(200).json({
      success: true,
      message: 'Event removed successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  events,
  celebrations,
  addWish,
  createEvent,
  updateEvent,
  deleteEvent,
};

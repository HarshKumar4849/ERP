const mongoose = require('mongoose');
let ROLES;
try {
  ROLES = require('../../../rbac/roles').ROLES;
} catch (e) {
  ROLES = require('../../../rbac/roles').ROLES;
}

// Helper to resolve Employee document from user
const resolveEmployee = async (user) => {
  if (!user) return null;
  const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');
  let employee = await Employee.findOne({ user: user._id, removed: false });
  if (!employee && user.email) {
    employee = await Employee.findOne({ email: user.email.toLowerCase(), removed: false });
  }
  return employee;
};

// Formats YYYY-MM-DD
const getDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// =========================================================================
// TECMOTIV MANAGEMENT DASHBOARD OVERVIEW ENDPOINT
// =========================================================================
const overview = async (req, res) => {
  try {
    const user = req.user;
    const userRole = req.userRole;

    const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');
    const Attendance = mongoose.models.Attendance || require('../../../models/appModels/Attendance');
    const Leave = mongoose.models.Leave || require('../../../models/appModels/Leave');
    const Task = mongoose.models.Task || require('../../../models/appModels/Task');
    const Project = mongoose.models.Project || require('../../../models/appModels/Project');
    const Policy = mongoose.models.Policy || require('../../../models/appModels/Policy');
    const Announcement = mongoose.models.Announcement || require('../../../models/appModels/Announcement');
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');

    const userEmp = await resolveEmployee(user);
    const userId = user._id;
    const empId = userEmp?._id;
    const userDept = user.department || userEmp?.departmentName || '';

    // Date references
    const now = new Date();
    const todayStr = getDateString(now);

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const in14Days = new Date(now);
    in14Days.setDate(in14Days.getDate() + 14);
    in14Days.setHours(23, 59, 59, 999);

    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);
    in30Days.setHours(23, 59, 59, 999);

    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();

    // =========================================================================
    // 1. SCOPING FILTERS
    // =========================================================================
    const empFilter = { removed: false, status: { $ne: 'Terminated' } };
    const taskFilter = { removed: false };
    const deptScope = {};

    if (userRole === ROLES.DEPARTMENT_HEAD) {
      if (userDept) {
        empFilter.departmentName = new RegExp(`^${userDept}$`, 'i');
        deptScope.department = new RegExp(`^${userDept}$`, 'i');
        taskFilter.$or = [
          { department: new RegExp(`^${userDept}$`, 'i') },
          { assignedTo: userId },
          { createdBy: userId },
          { reviewerUser: userId },
        ];
      }
    } else if (userRole === ROLES.EMPLOYEE) {
      const conditions = [{ assignedTo: userId }, { createdBy: userId }, { reviewerUser: userId }];
      if (empId) conditions.push({ owner: empId }, { reviewer: empId });
      taskFilter.$or = conditions;
    }

    // =========================================================================
    // 2. EMPLOYEES & WORKFORCE METRICS
    // =========================================================================
    const allEmployees = await Employee.find(empFilter)
      .select('employeeId name surname photo email departmentName designationName birthDate joiningDate status')
      .lean();

    const totalEmployees = allEmployees.length;

    // New Joiners (joined in last 60 days)
    const newJoiners = allEmployees
      .filter((e) => e.joiningDate && new Date(e.joiningDate) >= sixtyDaysAgo)
      .sort((a, b) => new Date(b.joiningDate) - new Date(a.joiningDate));

    // Birthdays this month
    const birthdaysThisMonth = allEmployees
      .filter((e) => {
        if (!e.birthDate) return false;
        const bMonth = new Date(e.birthDate).getMonth();
        return bMonth === currentMonth;
      })
      .map((e) => {
        const bDate = new Date(e.birthDate);
        return {
          ...e,
          birthdayDay: bDate.getDate(),
          isToday: bDate.getDate() === now.getDate(),
        };
      })
      .sort((a, b) => a.birthdayDay - b.birthdayDay);

    // Work Anniversaries this month
    const workAnniversaries = allEmployees
      .filter((e) => {
        if (!e.joiningDate) return false;
        const jDate = new Date(e.joiningDate);
        return jDate.getMonth() === currentMonth && jDate.getFullYear() < currentYear;
      })
      .map((e) => {
        const jDate = new Date(e.joiningDate);
        return {
          ...e,
          yearsCompleted: currentYear - jDate.getFullYear(),
          anniversaryDay: jDate.getDate(),
          isToday: jDate.getDate() === now.getDate(),
        };
      })
      .sort((a, b) => a.anniversaryDay - b.anniversaryDay);

    // =========================================================================
    // 3. TODAY'S ATTENDANCE & LEAVE
    // =========================================================================
    const attendanceFilter = { dateString: todayStr, removed: false };
    if (userRole === ROLES.DEPARTMENT_HEAD && userDept) {
      attendanceFilter.department = new RegExp(`^${userDept}$`, 'i');
    }

    const todayAttendanceRecords = await Attendance.find(attendanceFilter)
      .populate('employee', 'employeeId name surname photo departmentName designationName')
      .lean();

    const presentEmployees = todayAttendanceRecords.filter(
      (a) => a.status === 'Present' || a.status === 'Half Day' || (a.workMode && a.workMode !== 'Leave')
    );

    const attendanceOnLeave = todayAttendanceRecords.filter(
      (a) => a.status === 'Leave' || a.workMode === 'Leave'
    );

    // Active approved leaves today
    const leaveFilter = {
      removed: false,
      status: { $in: ['Approved', 'approved'] },
      fromDate: { $lte: endOfToday },
      toDate: { $gte: startOfToday },
    };
    if (userRole === ROLES.DEPARTMENT_HEAD && userDept) {
      leaveFilter.department = new RegExp(`^${userDept}$`, 'i');
    }

    const todayApprovedLeaves = await Leave.find(leaveFilter)
      .populate('employee', 'employeeId name surname photo departmentName designationName')
      .lean();

    // Deduplicate on leave
    const onLeaveEmployeeIds = new Set([
      ...attendanceOnLeave.map((a) => (a.employee?._id || a.employee)?.toString()),
      ...todayApprovedLeaves.map((l) => (l.employee?._id || l.employee)?.toString()),
    ]);

    const presentTodayCount = presentEmployees.length;
    const onLeaveCount = onLeaveEmployeeIds.size;
    const absentCount = Math.max(0, totalEmployees - (presentTodayCount + onLeaveCount));

    // =========================================================================
    // 4. TASKS BREAKDOWN (COMPANY & USER SCOPED)
    // =========================================================================
    const allScopedTasks = await Task.find(taskFilter)
      .populate('owner', 'employeeId name surname photo departmentName')
      .populate('project', 'name code')
      .sort({ dueDate: 1 })
      .lean();

    let openTasksCount = 0;
    let overdueTasksCount = 0;
    let myTodayTasks = [];
    let myPendingTasks = [];
    let myOverdueTasks = [];
    let myCompletedTasks = [];

    allScopedTasks.forEach((t) => {
      const dueTime = new Date(t.dueDate).getTime();
      const isPastDue =
        t.status !== 'Completed' && t.status !== 'Cancelled' && dueTime < startOfToday.getTime();

      if (['Not Started', 'In Progress', 'Waiting'].includes(t.status)) {
        openTasksCount++;
      }
      if (isPastDue || t.status === 'Overdue') {
        overdueTasksCount++;
      }

      // Check if task belongs to current user
      const isUserTask =
        (t.assignedTo && t.assignedTo.toString() === userId.toString()) ||
        (t.owner && empId && t.owner._id.toString() === empId.toString()) ||
        (t.reviewerUser && t.reviewerUser.toString() === userId.toString()) ||
        (t.createdBy && t.createdBy.toString() === userId.toString());

      if (isUserTask) {
        if (dueTime >= startOfToday.getTime() && dueTime <= endOfToday.getTime() && t.status !== 'Completed') {
          myTodayTasks.push(t);
        }
        if (['Not Started', 'In Progress', 'Waiting'].includes(t.status)) {
          myPendingTasks.push(t);
        }
        if (isPastDue || t.status === 'Overdue') {
          myOverdueTasks.push(t);
        }
        if (t.status === 'Completed') {
          myCompletedTasks.push(t);
        }
      }
    });

    // =========================================================================
    // 5. EVENTS, MEETINGS & MILESTONES
    // =========================================================================
    const eventFilter = {
      removed: false,
      startDate: { $gte: startOfToday, $lte: in30Days },
    };

    const upcomingEventsList = await Event.find(eventFilter)
      .sort({ startDate: 1 })
      .limit(10)
      .lean();

    const todayMeetings = upcomingEventsList.filter((e) => {
      const eTime = new Date(e.startDate).getTime();
      return (
        e.eventType === 'Meeting' &&
        eTime >= startOfToday.getTime() &&
        eTime <= endOfToday.getTime()
      );
    });

    const todayEvents = upcomingEventsList.filter((e) => {
      const eTime = new Date(e.startDate).getTime();
      return (
        e.eventType !== 'Meeting' &&
        eTime >= startOfToday.getTime() &&
        eTime <= endOfToday.getTime()
      );
    });

    // Upcoming project milestones
    const activeProjects = await Project.find({ removed: false, status: 'active' })
      .select('name code department startDate endDate status')
      .lean();

    // Upcoming approved leaves in next 14 days
    const upcomingLeaves = await Leave.find({
      removed: false,
      status: { $in: ['Approved', 'approved'] },
      fromDate: { $gt: endOfToday, $lte: in14Days },
    })
      .populate('employee', 'employeeId name surname photo departmentName')
      .sort({ fromDate: 1 })
      .limit(6)
      .lean();

    // =========================================================================
    // 6. COMPANY UPDATES (ANNOUNCEMENTS, POLICIES, NOTICES)
    // =========================================================================
    const announcements = await Announcement.find({ removed: false })
      .sort({ pinned: -1, date: -1 })
      .limit(8)
      .lean();

    const policies = await Policy.find({ removed: false })
      .select('title category version effectiveDate isMandatory file')
      .sort({ effectiveDate: -1 })
      .limit(6)
      .lean();

    const newsList = announcements.filter((a) => a.category === 'News');
    const importantNotices = announcements.filter(
      (a) => a.category === 'Important Notice' || a.priority === 'Urgent' || a.pinned
    );

    // =========================================================================
    // 7. ASSEMBLE COMPLETE DASHBOARD PAYLOAD
    // =========================================================================
    const dashboardData = {
      userRole,
      department: userDept,
      kpis: {
        totalEmployees,
        presentToday: presentTodayCount,
        onLeave: onLeaveCount,
        absent: absentCount,
        newJoiners: newJoiners.length,
        birthdaysThisMonth: birthdaysThisMonth.length,
        workAnniversaries: workAnniversaries.length,
        openTasks: openTasksCount,
        overdueTasks: overdueTasksCount,
        upcomingEvents: upcomingEventsList.length,
      },
      todayOverview: userRole === ROLES.EMPLOYEE
        ? {
            attendance: {
              myCheckIn: presentEmployees.find(
                (a) =>
                  (empId && (a.employee?._id || a.employee)?.toString() === empId.toString()) ||
                  (a.user && a.user.toString() === userId.toString())
              ) || null,
            },
            leave: [],
            newJoiners: [],
            birthdays: birthdaysThisMonth.filter((b) => b.isToday || b.birthdayDay >= now.getDate()).slice(0, 6),
            anniversaries: workAnniversaries.filter((a) => a.isToday || a.anniversaryDay >= now.getDate()).slice(0, 6),
            importantMeetings: todayMeetings,
            companyEvents: todayEvents,
          }
        : {
            attendance: {
              present: presentTodayCount,
              onLeave: onLeaveCount,
              absent: absentCount,
              recentCheckIns: presentEmployees.slice(0, 8),
            },
            leave: todayApprovedLeaves.slice(0, 8),
            newJoiners: newJoiners.slice(0, 6),
            birthdays: birthdaysThisMonth.filter((b) => b.isToday || b.birthdayDay >= now.getDate()).slice(0, 6),
            anniversaries: workAnniversaries.filter((a) => a.isToday || a.anniversaryDay >= now.getDate()).slice(0, 6),
            importantMeetings: todayMeetings,
            companyEvents: todayEvents,
          },
      myTasks: {
        todayTasks: myTodayTasks.slice(0, 6),
        pending: myPendingTasks.slice(0, 6),
        overdue: myOverdueTasks.slice(0, 6),
        completed: myCompletedTasks.slice(0, 6),
        counts: {
          today: myTodayTasks.length,
          pending: myPendingTasks.length,
          overdue: myOverdueTasks.length,
          completed: myCompletedTasks.length,
        },
      },
      companyUpdates: {
        announcements: announcements.filter((a) => a.category === 'Announcement').slice(0, 5),
        policies: policies,
        news: newsList.slice(0, 5),
        importantNotices: importantNotices.slice(0, 5),
      },
      upcoming: {
        meetings: upcomingEventsList.filter((e) => e.eventType === 'Meeting').slice(0, 6),
        events: upcomingEventsList.filter((e) => e.eventType !== 'Meeting').slice(0, 6),
        birthdays: birthdaysThisMonth.slice(0, 6),
        anniversaries: workAnniversaries.slice(0, 6),
        leave: userRole === ROLES.EMPLOYEE ? [] : upcomingLeaves,
        projectMilestones: activeProjects.slice(0, 6),
      },
    };

    if (userRole === ROLES.EMPLOYEE) {
      dashboardData.kpis = {
        openTasks: myPendingTasks.length,
        overdueTasks: myOverdueTasks.length,
        completedTasks: myCompletedTasks.length,
        todayTasks: myTodayTasks.length,
        upcomingEvents: upcomingEventsList.length,
        birthdaysThisMonth: birthdaysThisMonth.length,
      };
    }

    return res.status(200).json({
      success: true,
      result: dashboardData,
      message: 'Management dashboard overview retrieved successfully.',
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal error retrieving management dashboard.',
    });
  }
};

module.exports = {
  overview,
  read: overview,
  summary: overview,
};

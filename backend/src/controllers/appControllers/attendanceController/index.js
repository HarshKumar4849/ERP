const mongoose = require('mongoose');
const { ROLES } = require('../../../rbac/roles');

// Helper to normalize date to YYYY-MM-DD and start of day
const getDayBounds = (d = new Date()) => {
  const date = new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;

  const startOfDay = new Date(year, date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(year, date.getMonth(), date.getDate(), 23, 59, 59, 999);

  return { dateString, startOfDay, endOfDay };
};

// Helper to resolve Employee from authenticated user
const resolveEmployee = async (user) => {
  if (!user) return null;
  const Employee = mongoose.model('Employee');
  let employee = await Employee.findOne({ user: user._id, removed: false });
  if (!employee && user.email) {
    employee = await Employee.findOne({ email: user.email.toLowerCase(), removed: false });
  }
  if (!employee) {
    // If Admin account (e.g. admin@admin.com) doesn't have an employee record yet, automatically create one so attendance is fully functional
    employee = await Employee.findOne({ employeeId: 'ADM-000', removed: false });
    if (!employee) {
      employee = await new Employee({
        employeeId: 'ADM-000',
        name: user.name || 'System',
        surname: user.surname || 'Administrator',
        email: user.email || 'admin@admin.com',
        user: user._id,
        departmentName: user.department || 'Administration',
        designationName: user.role || 'MANAGEMENT',
        status: 'Active',
      }).save();
    }
  }
  return employee;
};

// =========================================================================
// 1. CLOCK IN / LOGIN
// =========================================================================
const login = async (req, res) => {
  const Attendance = mongoose.model('Attendance');
  const user = req.user;
  const userRole = req.userRole;

  // Resolve target employee
  let targetEmployee = null;
  if (userRole === ROLES.EMPLOYEE) {
    targetEmployee = await resolveEmployee(user);
    if (!targetEmployee) {
      return res.status(404).json({
        success: false,
        result: null,
        message: 'No associated employee profile found for your account.',
      });
    }
    if (req.body.employee && req.body.employee.toString() !== targetEmployee._id.toString()) {
      return res.status(403).json({
        success: false,
        result: null,
        message: 'Access denied: Employees cannot clock in for other employees.',
      });
    }
  } else {
    // HR/Management can clock in on behalf or for themselves
    if (req.body.employee) {
      const Employee = mongoose.model('Employee');
      targetEmployee = await Employee.findOne({ _id: req.body.employee, removed: false });
    } else {
      targetEmployee = await resolveEmployee(user);
    }
    if (!targetEmployee) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'Target employee is required.',
      });
    }
  }

  // Parse & validate login timestamp
  let loginTime = new Date();
  if (req.body.timestamp || req.body.loginTime) {
    const parsed = new Date(req.body.timestamp || req.body.loginTime);
    if (isNaN(parsed.getTime())) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'Invalid timestamp: Malformed date format.',
      });
    }
    loginTime = parsed;
  }

  // Validate future timestamp (allow 60s tolerance for clock drift)
  const now = new Date();
  if (loginTime.getTime() > now.getTime() + 60 * 1000) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Invalid timestamp: Login timestamp cannot be set in the future.',
    });
  }

  const { dateString, startOfDay } = getDayBounds(loginTime);

  // Check for duplicate login on the same date
  const existingRecord = await Attendance.findOne({
    employee: targetEmployee._id,
    dateString,
    removed: false,
  });

  if (existingRecord && existingRecord.loginTime) {
    const formattedTime = new Date(existingRecord.loginTime).toLocaleTimeString();
    return res.status(400).json({
      success: false,
      result: null,
      message: `Duplicate login: Employee has already logged in for today (${dateString}) at ${formattedTime}.`,
    });
  }

  // Validate Work Mode
  const allowedModes = ['Office', 'Work From Home', 'Client Visit', 'Event'];
  if (!req.body.workMode) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Work mode is required.',
    });
  }
  let workMode = req.body.workMode || 'Office';
  if (!allowedModes.includes(workMode)) {
    return res.status(400).json({
      success: false,
      result: null,
      message: `Invalid work mode. Allowed values: ${allowedModes.join(', ')}.`,
    });
  }

  // Determine initial status (Late Login if after 10:00 AM local time)
  let status = req.body.status || 'Present';
  const loginHour = loginTime.getHours();
  const loginMinute = loginTime.getMinutes();
  if (status === 'Present' && (loginHour > 10 || (loginHour === 10 && loginMinute > 0))) {
    status = 'Late Login';
  }

  let attendanceRecord;
  if (existingRecord) {
    existingRecord.loginTime = loginTime;
    existingRecord.clockIn = loginTime;
    existingRecord.workMode = workMode;
    existingRecord.status = status;
    existingRecord.remarks = req.body.remarks || existingRecord.remarks || '';
    existingRecord.ipAddress = req.ip || '';
    try {
      attendanceRecord = await existingRecord.save();
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ success: false, result: null, message: 'Attendance check-in already exists for today.' });
      }
      throw error;
    }
  } else {
    try {
      attendanceRecord = await new Attendance({
        employee: targetEmployee._id,
        user: targetEmployee.user || user._id,
        department: targetEmployee.departmentName || user.department || '',
        date: startOfDay,
        dateString,
        loginTime,
        clockIn: loginTime,
        workMode,
        status,
        remarks: req.body.remarks || '',
        ipAddress: req.ip || '',
      }).save();
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ success: false, result: null, message: 'Attendance check-in already exists for today.' });
      }
      throw error;
    }
  }

  const populated = await Attendance.findById(attendanceRecord._id).populate(
    'employee',
    'employeeId name surname photo departmentName designationName email'
  );

  return res.status(200).json({
    success: true,
    result: populated,
    message: `Clock-in successful as ${workMode} at ${loginTime.toLocaleTimeString()}.`,
  });
};

// =========================================================================
// 2. CLOCK OUT / LOGOUT
// =========================================================================
const logout = async (req, res) => {
  const Attendance = mongoose.model('Attendance');
  const user = req.user;
  const userRole = req.userRole;

  // Resolve target employee
  let targetEmployee = null;
  if (userRole === ROLES.EMPLOYEE) {
    targetEmployee = await resolveEmployee(user);
    if (!targetEmployee) {
      return res.status(404).json({
        success: false,
        result: null,
        message: 'No associated employee profile found for your account.',
      });
    }
    if (req.body.employee && req.body.employee.toString() !== targetEmployee._id.toString()) {
      return res.status(403).json({
        success: false,
        result: null,
        message: 'Access denied: Employees cannot clock out for other employees.',
      });
    }
  } else {
    if (req.body.employee) {
      const Employee = mongoose.model('Employee');
      targetEmployee = await Employee.findOne({ _id: req.body.employee, removed: false });
    } else {
      targetEmployee = await resolveEmployee(user);
    }
    if (!targetEmployee) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'Target employee is required.',
      });
    }
  }

  // Parse logout timestamp
  let logoutTime = new Date();
  if (req.body.timestamp || req.body.logoutTime) {
    const parsed = new Date(req.body.timestamp || req.body.logoutTime);
    if (isNaN(parsed.getTime())) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'Invalid timestamp: Malformed date format.',
      });
    }
    logoutTime = parsed;
  }

  // Validate future timestamp (allow 60s tolerance)
  const now = new Date();
  if (logoutTime.getTime() > now.getTime() + 60 * 1000) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Invalid timestamp: Logout timestamp cannot be set in the future.',
    });
  }

  const { dateString } = getDayBounds(logoutTime);

  // Find today's attendance record
  const record = await Attendance.findOne({
    employee: targetEmployee._id,
    dateString,
    removed: false,
  });

  // Handle logout without login
  if (!record || !record.loginTime) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Logout without login: No active check-in record found for today. Please log in first.',
    });
  }

  // Handle already logged-out records
  if (record.logoutTime) {
    const formattedOut = new Date(record.logoutTime).toLocaleTimeString();
    return res.status(400).json({
      success: false,
      result: null,
      message: `Already logged out: You have already checked out today at ${formattedOut}.`,
    });
  }

  // Validate logout time is strictly after login time
  const loginTimestamp = new Date(record.loginTime).getTime();
  if (logoutTime.getTime() <= loginTimestamp) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Invalid timestamps: Logout time must be strictly after login time.',
    });
  }

  // Compute total working hours (rounded to 2 decimal places)
  const diffMs = logoutTime.getTime() - loginTimestamp;
  const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

  // Determine final status based on duration and explicit declaration
  let status = record.status;
  const isHalfDayDeclaration = Boolean(req.body.isHalfDayDeclaration);
  const earlyExitReason = req.body.earlyExitReason ? String(req.body.earlyExitReason).trim() : '';

  if (isHalfDayDeclaration || totalHours < 4) {
    status = 'Half Day';
  } else if (totalHours < 7.5 && status !== 'Late Login') {
    status = 'Early Logout';
  } else if (totalHours >= 7.5 && status !== 'Late Login') {
    status = 'Present';
  }

  record.logoutTime = logoutTime;
  record.clockOut = logoutTime;
  record.totalHours = totalHours;
  record.status = status;
  record.isHalfDayDeclaration = isHalfDayDeclaration;
  if (earlyExitReason) {
    record.earlyExitReason = earlyExitReason;
  }

  let finalRemarks = req.body.remarks ? String(req.body.remarks).trim() : '';
  if (earlyExitReason) {
    finalRemarks = finalRemarks ? `[${earlyExitReason}] ${finalRemarks}` : `[${earlyExitReason}]`;
  }
  if (finalRemarks) {
    record.remarks = record.remarks
      ? `${record.remarks} | Out: ${finalRemarks}`
      : finalRemarks;
  }

  await record.save();

  // Dispatch real-time in-app notification to Admin & HR for early departure / half day
  if (isHalfDayDeclaration || totalHours < 7.5) {
    try {
      const Admin = mongoose.model('Admin');
      const adminUsers = await Admin.find({
        role: { $in: ['ADMIN', 'HR', 'MANAGEMENT', 'owner'] },
        removed: false,
        enabled: true,
      }).select('_id');
      const adminIds = adminUsers.map((a) => a._id);

      if (adminIds.length > 0) {
        const empName = `${targetEmployee.name || ''} ${targetEmployee.surname || ''}`.trim() || targetEmployee.employeeId || 'Employee';
        const tag = isHalfDayDeclaration ? 'Declared Half Day' : (status === 'Half Day' ? 'Half Day (<4h)' : 'Early Departure (<7.5h)');
        const reasonSnippet = earlyExitReason ? ` • Reason: ${earlyExitReason}` : '';
        const noteSnippet = req.body.remarks ? ` • Note: "${req.body.remarks.trim()}"` : '';

        const Notification = mongoose.models.Notification || mongoose.model('Notification');
        const notifDocs = adminIds.map((rId) => ({
          recipient: rId,
          type: 'SYSTEM_ANNOUNCEMENT',
          title: `Attendance Alert: ${empName} (${tag})`,
          message: `${empName} clocked out at ${logoutTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} after ${totalHours} hrs.${reasonSnippet}${noteSnippet}`,
          link: '/attendance',
          data: {
            attendanceId: record._id,
            employeeId: targetEmployee._id,
            totalHours,
            status,
            earlyExitReason,
          },
        }));
        await Notification.insertMany(notifDocs);
      }
    } catch (notifErr) {
      console.error('Failed to dispatch early departure notification:', notifErr.message);
    }
  }

  const populated = await Attendance.findById(record._id).populate(
    'employee',
    'employeeId name surname photo departmentName designationName email'
  );

  return res.status(200).json({
    success: true,
    result: populated,
    message: `Clock-out successful at ${logoutTime.toLocaleTimeString()}. Total working hours: ${totalHours} hrs.`,
  });
};

// =========================================================================
// 3. TODAY'S STATUS
// =========================================================================
const today = async (req, res) => {
  const Attendance = mongoose.model('Attendance');
  const user = req.user;
  const targetEmployee = await resolveEmployee(user);

  const { dateString, startOfDay, endOfDay } = getDayBounds(new Date());

  let todayRecord = null;
  if (targetEmployee) {
    todayRecord = await Attendance.findOne({
      employee: targetEmployee._id,
      dateString,
      removed: false,
    }).populate('employee', 'employeeId name surname photo departmentName designationName');
  }

  // Calculate live hours if currently logged in but not logged out
  let liveHours = 0;
  if (todayRecord && todayRecord.loginTime && !todayRecord.logoutTime) {
    const diffMs = Date.now() - new Date(todayRecord.loginTime).getTime();
    liveHours = Math.max(0, Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100);
  } else if (todayRecord && todayRecord.totalHours) {
    liveHours = todayRecord.totalHours;
  }

  // Organization-wide summary for today (visible to HR/Management/DeptHead)
  let orgSummary = null;
  if ([ROLES.MANAGEMENT, ROLES.HR, ROLES.DEPARTMENT_HEAD, ROLES.ADMIN].includes(req.userRole)) {
    const filter = { dateString, removed: false };
    if (req.userRole === ROLES.DEPARTMENT_HEAD && req.user.department) {
      filter.department = req.user.department;
    }

    const todayAll = await Attendance.find(filter);
    const presentCount = todayAll.filter((r) => ['Present', 'Late Login', 'Early Logout'].includes(r.status)).length;
    const wfhCount = todayAll.filter((r) => r.workMode === 'Work From Home').length;
    const officeCount = todayAll.filter((r) => r.workMode === 'Office').length;
    const clientCount = todayAll.filter((r) => r.workMode === 'Client Visit').length;
    const halfDayCount = todayAll.filter((r) => r.status === 'Half Day').length;
    const leaveCount = todayAll.filter((r) => r.status === 'Leave').length;
    const lateCount = todayAll.filter((r) => r.status === 'Late Login').length;

    orgSummary = {
      totalLogged: todayAll.length,
      presentCount,
      wfhCount,
      officeCount,
      clientCount,
      halfDayCount,
      leaveCount,
      lateCount,
    };
  }

  return res.status(200).json({
    success: true,
    result: {
      serverTime: new Date(),
      dateString,
      employee: targetEmployee
        ? {
            _id: targetEmployee._id,
            employeeId: targetEmployee.employeeId,
            fullName: `${targetEmployee.name} ${targetEmployee.surname}`.trim(),
            department: targetEmployee.departmentName,
            designation: targetEmployee.designationName,
            photo: targetEmployee.photo,
          }
        : null,
      record: todayRecord,
      hasLoggedIn: !!(todayRecord && todayRecord.loginTime),
      hasLoggedOut: !!(todayRecord && todayRecord.logoutTime),
      liveHours,
      orgSummary,
    },
  });
};

// =========================================================================
// 4. MONTHLY CALCULATIONS & CALENDAR VIEW
// =========================================================================
const monthly = async (req, res) => {
  const Attendance = mongoose.model('Attendance');
  const user = req.user;
  const userRole = req.userRole;

  const now = new Date();
  const year = parseInt(req.query.year, 10) || now.getFullYear();
  const month = parseInt(req.query.month, 10) || now.getMonth() + 1; // 1-12

  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  // Calculate default working days (Monday-Friday in that month)
  let workingDays = 0;
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }

  // Build query based on role
  const query = {
    date: { $gte: startOfMonth, $lte: endOfMonth },
    removed: false,
  };

  if (userRole === ROLES.EMPLOYEE) {
    const employee = await resolveEmployee(user);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }
    query.employee = employee._id;
  } else if (userRole === ROLES.DEPARTMENT_HEAD) {
    if (user.department) query.department = user.department;
    if (req.query.employee) query.employee = req.query.employee;
  } else {
    // HR / Management
    if (req.query.employee) query.employee = req.query.employee;
    if (req.query.department) query.department = req.query.department;
  }

  const records = await Attendance.find(query)
    .populate('employee', 'employeeId name surname photo departmentName designationName')
    .sort({ date: 1, loginTime: 1 });

  // Compute monthly calculations as specified:
  // - Working Days
  // - Present
  // - Absent
  // - Leave
  // - WFH
  // - Half Day
  // - Late Login
  // - Early Logout
  // - Total Working Hours
  let presentCount = 0;
  let absentCount = 0;
  let leaveCount = 0;
  let wfhCount = 0;
  let halfDayCount = 0;
  let lateLoginCount = 0;
  let earlyLogoutCount = 0;
  let totalWorkingHours = 0;

  records.forEach((r) => {
    const s = r.status || 'Present';
    if (['Present', 'Late Login', 'Early Logout'].includes(s)) {
      presentCount++;
    }
    if (s === 'Absent') absentCount++;
    if (s === 'Leave') leaveCount++;
    if (s === 'Half Day') halfDayCount++;
    if (s === 'Late Login') lateLoginCount++;
    if (s === 'Early Logout') earlyLogoutCount++;

    if (r.workMode === 'Work From Home') wfhCount++;

    if (r.totalHours) {
      totalWorkingHours += r.totalHours;
    }
  });

  totalWorkingHours = Math.round(totalWorkingHours * 100) / 100;
  const effectivePresentDays = presentCount + halfDayCount * 0.5;
  const avgWorkingHours =
    effectivePresentDays > 0
      ? Math.round((totalWorkingHours / effectivePresentDays) * 100) / 100
      : 0;

  return res.status(200).json({
    success: true,
    result: {
      year,
      month,
      metrics: {
        workingDays,
        present: presentCount,
        absent: absentCount,
        leave: leaveCount,
        wfh: wfhCount,
        halfDay: halfDayCount,
        lateLogin: lateLoginCount,
        earlyLogout: earlyLogoutCount,
        totalWorkingHours,
        avgWorkingHours,
      },
      records,
    },
  });
};

// =========================================================================
// 5. ATTENDANCE REPORTS (ORGANIZATION / TEAM SUMMARY)
// =========================================================================
const report = async (req, res) => {
  const Attendance = mongoose.model('Attendance');
  const Employee = mongoose.model('Employee');
  const user = req.user;
  const userRole = req.userRole;

  const now = new Date();
  const startDate = req.query.startDate
    ? new Date(req.query.startDate)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = req.query.endDate
    ? new Date(req.query.endDate)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Fetch employees matching department / role scope
  const empFilter = { removed: false };
  if (userRole === ROLES.EMPLOYEE) {
    const emp = await resolveEmployee(user);
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    empFilter._id = emp._id;
  } else if (userRole === ROLES.DEPARTMENT_HEAD) {
    if (user.department) empFilter.departmentName = user.department;
    if (req.query.employee) empFilter._id = req.query.employee;
  } else {
    if (req.query.department) empFilter.departmentName = req.query.department;
    if (req.query.employee) empFilter._id = req.query.employee;
  }

  const employees = await Employee.find(empFilter).select(
    'employeeId name surname departmentName designationName photo email'
  );

  const empIds = employees.map((e) => e._id);

  const attRecords = await Attendance.find({
    employee: { $in: empIds },
    date: { $gte: startDate, $lte: endDate },
    removed: false,
  });

  // Calculate stats per employee
  const reportRows = employees.map((emp) => {
    const empRecords = attRecords.filter((r) => r.employee.toString() === emp._id.toString());
    let present = 0;
    let absent = 0;
    let leave = 0;
    let wfh = 0;
    let halfDay = 0;
    let late = 0;
    let earlyLogout = 0;
    let totalHours = 0;

    empRecords.forEach((r) => {
      const s = r.status || 'Present';
      if (['Present', 'Late Login', 'Early Logout'].includes(s)) present++;
      if (s === 'Absent') absent++;
      if (s === 'Leave') leave++;
      if (s === 'Half Day') halfDay++;
      if (s === 'Late Login') late++;
      if (s === 'Early Logout') earlyLogout++;
      if (r.workMode === 'Work From Home') wfh++;
      if (r.totalHours) totalHours += r.totalHours;
    });

    totalHours = Math.round(totalHours * 100) / 100;
    const effectiveDays = present + halfDay * 0.5;
    const avgHours =
      effectiveDays > 0 ? Math.round((totalHours / effectiveDays) * 100) / 100 : 0;

    return {
      employeeId: emp.employeeId,
      _id: emp._id,
      fullName: `${emp.name} ${emp.surname}`.trim(),
      department: emp.departmentName || '—',
      designation: emp.designationName || '—',
      photo: emp.photo,
      email: emp.email,
      totalLogged: empRecords.length,
      present,
      absent,
      leave,
      wfh,
      halfDay,
      late,
      earlyLogout,
      totalHours,
      avgHours,
    };
  });

  return res.status(200).json({
    success: true,
    result: {
      startDate,
      endDate,
      totalEmployees: reportRows.length,
      reportRows,
    },
  });
};

// =========================================================================
// 6. LIST / SEARCH / FILTER
// =========================================================================
const list = async (req, res) => {
  const Attendance = mongoose.model('Attendance');
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.items, 10) || parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = { removed: false };

  if (req.userRole === ROLES.EMPLOYEE) {
    const emp = await resolveEmployee(req.user);
    if (emp) {
      filter.employee = emp._id;
    }
  } else if (req.query.employee) {
    filter.employee = req.query.employee;
  }
  if (req.query.department) {
    filter.department = new RegExp(req.query.department, 'i');
  }
  if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.workMode) {
    filter.workMode = req.query.workMode;
  }
  if (req.query.date) {
    const { startOfDay, endOfDay } = getDayBounds(new Date(req.query.date));
    filter.date = { $gte: startOfDay, $lte: endOfDay };
  } else if (req.query.startDate && req.query.endDate) {
    filter.date = {
      $gte: new Date(req.query.startDate),
      $lte: new Date(new Date(req.query.endDate).setHours(23, 59, 59, 999)),
    };
  }

  if (req.query.q) {
    filter.$or = [
      { remarks: new RegExp(req.query.q, 'i') },
      { department: new RegExp(req.query.q, 'i') },
      { status: new RegExp(req.query.q, 'i') },
      { workMode: new RegExp(req.query.q, 'i') },
    ];
  }

  const [records, count] = await Promise.all([
    Attendance.find(filter)
      .populate('employee', 'employeeId name surname photo departmentName designationName email')
      .populate('user', 'name surname email role')
      .sort({ date: -1, loginTime: -1 })
      .skip(skip)
      .limit(limit),
    Attendance.countDocuments(filter),
  ]);

  const pages = Math.ceil(count / limit);

  return res.status(200).json({
    success: true,
    result: records,
    pagination: {
      page,
      pages,
      count,
    },
    message: 'Attendance records fetched successfully',
  });
};

// =========================================================================
// 7. READ SINGLE RECORD
// =========================================================================
const read = async (req, res) => {
  const Attendance = mongoose.model('Attendance');
  const record = await Attendance.findOne({ _id: req.params.id, removed: false })
    .populate('employee', 'employeeId name surname photo departmentName designationName email')
    .populate('user', 'name surname email role');

  if (!record) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'Attendance record not found',
    });
  }

  if (req.userRole === ROLES.EMPLOYEE) {
    const emp = await resolveEmployee(req.user);
    const empIdStr = emp ? emp._id.toString() : '';
    const userIdStr = req.user._id.toString();
    const recEmpStr = record.employee ? (record.employee._id ? record.employee._id.toString() : record.employee.toString()) : '';
    const recUserStr = record.user ? (record.user._id ? record.user._id.toString() : record.user.toString()) : '';
    if (recEmpStr !== empIdStr && recUserStr !== userIdStr) {
      return res.status(403).json({
        success: false,
        result: null,
        message: "Access denied: You cannot access another employee's attendance records.",
      });
    }
  }

  return res.status(200).json({
    success: true,
    result: record,
    message: 'Attendance record retrieved successfully',
  });
};

// =========================================================================
// 8. CREATE / MANUAL REGULARIZATION (HR / MANAGEMENT)
// =========================================================================
const create = async (req, res) => {
  if (req.userRole === ROLES.EMPLOYEE) {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Access denied: Employees cannot manually create attendance records.',
    });
  }

  const Attendance = mongoose.model('Attendance');
  const Employee = mongoose.model('Employee');

  const { employee: employeeId, date, loginTime, logoutTime, workMode, status, remarks } = req.body;

  if (!employeeId) {
    return res.status(400).json({ success: false, message: 'Employee ID is required.' });
  }

  const empRecord = await Employee.findOne({ _id: employeeId, removed: false });
  if (!empRecord) {
    return res.status(404).json({ success: false, message: 'Employee does not exist.' });
  }

  const attendanceDate = date ? new Date(date) : new Date();
  if (isNaN(attendanceDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid attendance date.' });
  }

  const { dateString, startOfDay } = getDayBounds(attendanceDate);

  // Validate duplicate
  const existing = await Attendance.findOne({
    employee: employeeId,
    dateString,
    removed: false,
  });
  if (existing) {
    return res.status(400).json({
      success: false,
      message: `An attendance record already exists for ${empRecord.name} on ${dateString}. Use update instead.`,
    });
  }

  let parsedLogin = loginTime ? new Date(loginTime) : null;
  let parsedLogout = logoutTime ? new Date(logoutTime) : null;

  if (parsedLogin && parsedLogout && parsedLogout.getTime() <= parsedLogin.getTime()) {
    return res.status(400).json({
      success: false,
      message: 'Invalid timestamps: Logout time must be strictly after login time.',
    });
  }

  // Future timestamp validation
  const now = new Date();
  if (
    (parsedLogin && parsedLogin.getTime() > now.getTime() + 60 * 1000) ||
    (parsedLogout && parsedLogout.getTime() > now.getTime() + 60 * 1000)
  ) {
    if (!['Leave', 'Holiday'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timestamp: Attendance timestamps cannot be set in the future.',
      });
    }
  }

  let totalHours = 0;
  if (parsedLogin && parsedLogout) {
    const diffMs = parsedLogout.getTime() - parsedLogin.getTime();
    totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  }

  const newDoc = await new Attendance({
    employee: empRecord._id,
    user: empRecord.user || req.user._id,
    department: empRecord.departmentName || '',
    date: startOfDay,
    dateString,
    loginTime: parsedLogin,
    logoutTime: parsedLogout,
    clockIn: parsedLogin,
    clockOut: parsedLogout,
    totalHours: req.body.totalHours !== undefined ? req.body.totalHours : totalHours,
    workMode: workMode || 'Office',
    status: status || 'Present',
    remarks: remarks || '',
  }).save();

  const populated = await Attendance.findById(newDoc._id).populate(
    'employee',
    'employeeId name surname photo departmentName designationName email'
  );

  return res.status(201).json({
    success: true,
    result: populated,
    message: 'Attendance record created successfully.',
  });
};

// =========================================================================
// 9. UPDATE RECORD (REGULARIZATION / HR EDIT)
// =========================================================================
const update = async (req, res) => {
  if (req.userRole === ROLES.EMPLOYEE) {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Access denied: Employees cannot manually update attendance records.',
    });
  }

  const Attendance = mongoose.model('Attendance');
  const record = await Attendance.findOne({ _id: req.params.id, removed: false });

  if (!record) {
    return res.status(404).json({ success: false, message: 'Attendance record not found.' });
  }

  const { loginTime, logoutTime, workMode, status, remarks, totalHours } = req.body;

  let parsedLogin = loginTime ? new Date(loginTime) : record.loginTime;
  let parsedLogout = logoutTime ? new Date(logoutTime) : record.logoutTime;

  if (parsedLogin && parsedLogout && parsedLogout.getTime() <= parsedLogin.getTime()) {
    return res.status(400).json({
      success: false,
      message: 'Invalid timestamps: Logout time must be strictly after login time.',
    });
  }

  // Future check
  const now = new Date();
  if (
    (parsedLogin && parsedLogin.getTime() > now.getTime() + 60 * 1000) ||
    (parsedLogout && parsedLogout.getTime() > now.getTime() + 60 * 1000)
  ) {
    if (!['Leave', 'Holiday'].includes(status || record.status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timestamp: Attendance timestamps cannot be set in the future.',
      });
    }
  }

  if (loginTime !== undefined) {
    record.loginTime = parsedLogin;
    record.clockIn = parsedLogin;
  }
  if (logoutTime !== undefined) {
    record.logoutTime = parsedLogout;
    record.clockOut = parsedLogout;
  }
  if (workMode !== undefined) record.workMode = workMode;
  if (status !== undefined) record.status = status;
  if (remarks !== undefined) record.remarks = remarks;

  if (totalHours !== undefined) {
    record.totalHours = totalHours;
  } else if (record.loginTime && record.logoutTime) {
    const diffMs = record.logoutTime.getTime() - record.loginTime.getTime();
    record.totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  }

  await record.save();

  const populated = await Attendance.findById(record._id).populate(
    'employee',
    'employeeId name surname photo departmentName designationName email'
  );

  return res.status(200).json({
    success: true,
    result: populated,
    message: 'Attendance record updated successfully.',
  });
};

// =========================================================================
// 10. DELETE RECORD
// =========================================================================
const deleteRecord = async (req, res) => {
  if (req.userRole === ROLES.EMPLOYEE) {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Access denied: Employees cannot delete attendance records.',
    });
  }

  const Attendance = mongoose.model('Attendance');
  const record = await Attendance.findOne({ _id: req.params.id, removed: false });

  if (!record) {
    return res.status(404).json({ success: false, message: 'Attendance record not found.' });
  }

  record.removed = true;
  await record.save();

  return res.status(200).json({
    success: true,
    result: null,
    message: 'Attendance record deleted successfully.',
  });
};

// =========================================================================
// 11. KPI SUMMARY (TODAY)
// =========================================================================
const summary = async (req, res) => {
  const Attendance = mongoose.model('Attendance');
  const user = req.user;
  const userRole = req.userRole;

  const { dateString } = getDayBounds(new Date());
  const filter = { dateString, removed: false };

  if (userRole === ROLES.EMPLOYEE) {
    const emp = await resolveEmployee(user);
    if (emp) filter.employee = emp._id;
  } else if (userRole === ROLES.DEPARTMENT_HEAD) {
    if (user.department) filter.department = user.department;
  }

  const records = await Attendance.find(filter);

  const total = records.length;
  const present = records.filter((r) => ['Present', 'Late Login', 'Early Logout'].includes(r.status)).length;
  const late = records.filter((r) => r.status === 'Late Login').length;
  const earlyLogout = records.filter((r) => r.status === 'Early Logout').length;
  const halfDay = records.filter((r) => r.status === 'Half Day').length;
  const wfh = records.filter((r) => r.workMode === 'Work From Home').length;
  const office = records.filter((r) => r.workMode === 'Office').length;
  const clientVisit = records.filter((r) => r.workMode === 'Client Visit').length;

  return res.status(200).json({
    success: true,
    result: {
      dateString,
      total,
      present,
      late,
      earlyLogout,
      halfDay,
      wfh,
      office,
      clientVisit,
    },
  });
};

module.exports = {
  login,
  logout,
  today,
  monthly,
  report,
  list,
  read,
  create,
  update,
  delete: deleteRecord,
  summary,
};

const mongoose = require('mongoose');
const { ROLES } = require('../../../rbac/roles');

// Helper to resolve Employee from authenticated user
const resolveEmployee = async (user) => {
  if (!user) return null;
  const Employee = mongoose.model('Employee');
  let employee = await Employee.findOne({ user: user._id, removed: false });
  if (!employee && user.email) {
    employee = await Employee.findOne({ email: user.email.toLowerCase(), removed: false });
  }
  return employee;
};

// Helper to get or initialize LeaveBalance for an employee
const getOrInitBalance = async (employeeId, userId, year = new Date().getFullYear()) => {
  const LeaveBalance = mongoose.model('LeaveBalance');
  let balanceDoc = await LeaveBalance.findOne({ employee: employeeId, year, removed: false });
  if (!balanceDoc) {
    balanceDoc = await new LeaveBalance({
      employee: employeeId,
      user: userId,
      year,
    }).save();
  }
  return balanceDoc;
};

// Helper to calculate business / calendar days between two dates
const calculateDaysCount = (from, to, leaveType) => {
  if (leaveType === 'Half Day') return 0.5;

  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  const diffMs = end.getTime() - start.getTime();
  const rawDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, rawDays);
};

// =========================================================================
// 1. APPLY LEAVE
// =========================================================================
const apply = async (req, res) => {
  const Leave = mongoose.model('Leave');
  const Employee = mongoose.model('Employee');
  const user = req.user;
  const userRole = req.userRole;

  // Resolve target employee
  let targetEmployee = null;
  if (userRole === ROLES.EMPLOYEE) {
    targetEmployee = await resolveEmployee(user);
    if (!targetEmployee) {
      return res.status(404).json({ success: false, message: 'No associated employee profile found.' });
    }
    if (req.body.employee && req.body.employee.toString() !== targetEmployee._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Employees cannot apply for leave on behalf of other employees.',
      });
    }
  } else {
    // HR/Management can apply on behalf
    if (req.body.employee) {
      targetEmployee = await Employee.findOne({ _id: req.body.employee, removed: false });
    } else {
      targetEmployee = await resolveEmployee(user);
    }
    if (!targetEmployee) {
      return res.status(400).json({ success: false, message: 'Target employee is required.' });
    }
  }

  const { leaveType, fromDate, toDate, reason, supportingDocument } = req.body;

  if (!leaveType) {
    return res.status(400).json({ success: false, message: 'Leave type is required.' });
  }
  if (!fromDate || !toDate) {
    return res.status(400).json({ success: false, message: 'From Date and To Date are required.' });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ success: false, message: 'Reason for leave is required.' });
  }

  const parsedFrom = new Date(fromDate);
  const parsedTo = new Date(toDate);

  if (isNaN(parsedFrom.getTime()) || isNaN(parsedTo.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid date format provided.' });
  }

  parsedFrom.setHours(0, 0, 0, 0);
  parsedTo.setHours(23, 59, 59, 999);

  if (parsedTo.getTime() < parsedFrom.getTime()) {
    return res.status(400).json({
      success: false,
      message: 'Invalid dates: To Date cannot be earlier than From Date.',
    });
  }

  // 1. PREVENT OVERLAPPING LEAVE
  const overlapping = await Leave.findOne({
    employee: targetEmployee._id,
    removed: false,
    status: { $in: ['Pending Manager Approval', 'Pending HR Approval', 'Approved', 'pending', 'approved'] },
    fromDate: { $lte: parsedTo },
    toDate: { $gte: parsedFrom },
  });

  if (overlapping) {
    const fromStr = new Date(overlapping.fromDate).toISOString().split('T')[0];
    const toStr = new Date(overlapping.toDate).toISOString().split('T')[0];
    return res.status(400).json({
      success: false,
      message: `Overlapping leave: An active or pending leave request already exists from ${fromStr} to ${toStr} (${overlapping.leaveType} - ${overlapping.status}).`,
    });
  }

  // Calculate days
  const daysCount =
    typeof req.body.daysCount === 'number' && req.body.daysCount > 0
      ? req.body.daysCount
      : calculateDaysCount(parsedFrom, parsedTo, leaveType);

  // 2. PREVENT NEGATIVE BALANCE WHERE NOT ALLOWED
  const leaveYear = parsedFrom.getFullYear();
  const balanceDoc = await getOrInitBalance(targetEmployee._id, targetEmployee.user || user._id, leaveYear);
  const typeBalance = balanceDoc.balances[leaveType] || { allocated: 0, used: 0, pending: 0 };
  const availableRemaining = typeBalance.allocated - (typeBalance.used + typeBalance.pending);

  if (leaveType !== 'Unpaid Leave' && daysCount > availableRemaining) {
    return res.status(400).json({
      success: false,
      message: `Insufficient leave balance: You have ${availableRemaining} days remaining for ${leaveType}, but requested ${daysCount} days.`,
    });
  }

  // Determine Reporting Manager & Initial Workflow Status
  let reportingManager = targetEmployee.reportingManager || null;
  let reportingManagerUser = null;

  if (reportingManager) {
    const mgrEmp = await Employee.findById(reportingManager);
    if (mgrEmp && mgrEmp.user) {
      reportingManagerUser = mgrEmp.user;
    }
  }

  let initialStatus = 'Pending HR Approval';

  const newLeave = await new Leave({
    employee: targetEmployee._id,
    user: targetEmployee.user || user._id,
    department: targetEmployee.departmentName || user.department || '',
    leaveType,
    fromDate: parsedFrom,
    toDate: parsedTo,
    daysCount,
    reason: reason.trim(),
    supportingDocument: supportingDocument || null,
    reportingManager,
    reportingManagerUser,
    status: initialStatus,
    managerApproval: {
      status: initialStatus === 'Pending HR Approval' ? 'Skipped' : 'Pending',
      remarks: initialStatus === 'Pending HR Approval' ? 'Direct HR route (Self/Director)' : '',
    },
    hrApproval: {
      status: 'Pending',
    },
    approvalHistory: [
      {
        step: 'MANAGER',
        status: 'Approved',
        remarks: 'Applied by employee',
        timestamp: new Date(),
      },
    ],
  }).save();

  // Hold pending quota in LeaveBalance
  typeBalance.pending += daysCount;
  balanceDoc.markModified('balances');
  await balanceDoc.save();

  const populated = await Leave.findById(newLeave._id)
    .populate('employee', 'employeeId name surname photo departmentName designationName email')
    .populate('reportingManager', 'employeeId name surname photo departmentName designationName email');

  return res.status(201).json({
    success: true,
    result: populated,
    message: `Leave application submitted successfully. Status: ${initialStatus}.`,
  });
};

// =========================================================================
// 2. CANCEL LEAVE
// =========================================================================
const cancel = async (req, res) => {
  const Leave = mongoose.model('Leave');
  const Attendance = mongoose.model('Attendance');
  const user = req.user;
  const userRole = req.userRole;

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid leave request ID.' });
  }

  const leave = await Leave.findOne({ _id: req.params.id, removed: false });
  if (!leave) {
    return res.status(404).json({ success: false, message: 'Leave request not found.' });
  }

  // Only owner employee, HR, or Management can cancel
  const employee = await resolveEmployee(user);
  const isOwner =
    (leave.user && leave.user.toString() === user._id.toString()) ||
    (employee && leave.employee.toString() === employee._id.toString());

  if (!isOwner && ![ROLES.HR, ROLES.ADMIN].includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: You can only cancel your own leave requests.',
    });
  }

  if (['Cancelled', 'Rejected'].includes(leave.status)) {
    return res.status(400).json({
      success: false,
      message: `Leave request is already ${leave.status.toLowerCase()}.`,
    });
  }

  const previousStatus = leave.status;

  // Atomic transition to prevent concurrent double-cancellation
  const updatedLeave = await Leave.findOneAndUpdate(
    {
      _id: req.params.id,
      status: { $nin: ['Cancelled', 'Rejected'] },
      removed: false,
    },
    {
      $set: { status: 'Cancelled' },
    },
    { new: true }
  );

  if (!updatedLeave) {
    const fresh = await Leave.findById(req.params.id);
    return res.status(400).json({
      success: false,
      message: `Leave request is already ${fresh ? fresh.status.toLowerCase() : 'cancelled'}.`,
    });
  }

  // Release LeaveBalance
  const leaveYear = new Date(leave.fromDate).getFullYear();
  const balanceDoc = await getOrInitBalance(leave.employee, leave.user, leaveYear);
  const typeBalance = balanceDoc.balances[leave.leaveType];

  if (typeBalance) {
    if (['Pending Manager Approval', 'Pending HR Approval', 'pending'].includes(previousStatus)) {
      typeBalance.pending = Math.max(0, typeBalance.pending - leave.daysCount);
    } else if (['Approved', 'approved'].includes(previousStatus)) {
      typeBalance.used = Math.max(0, typeBalance.used - leave.daysCount);

      // Revert/remove any auto-created Attendance records for this approved leave
      const start = new Date(leave.fromDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(leave.toDate);
      end.setHours(23, 59, 59, 999);

      await Attendance.deleteMany({
        employee: leave.employee,
        date: { $gte: start, $lte: end },
        status: 'Leave',
        loginTime: { $exists: false }, // Only delete auto-created records where employee never clocked in
      });
    }
    balanceDoc.markModified('balances');
    await balanceDoc.save();
  }

  return res.status(200).json({
    success: true,
    result: updatedLeave,
    message: 'Leave request has been successfully cancelled.',
  });
};

// =========================================================================
// 3. MANAGER APPROVAL / REJECTION
// =========================================================================
const managerApproval = async (req, res) => {
  const Leave = mongoose.model('Leave');
  const user = req.user;
  const userRole = req.userRole;

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid leave request ID.' });
  }

  // Verify Admin or HR rights
  const isAuthorized = [ROLES.HR, ROLES.ADMIN].includes(userRole);
  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized: Only HR and Admin can approve or reject leave requests.',
    });
  }

  const leave = await Leave.findOne({ _id: req.params.id, removed: false });
  if (!leave) {
    return res.status(404).json({ success: false, message: 'Leave request not found.' });
  }

  // PREVENT EMPLOYEE APPROVING OWN LEAVE
  const userEmp = await resolveEmployee(user);
  const isOwner =
    (leave.user && leave.user.toString() === user._id.toString()) ||
    (userEmp && leave.employee.toString() === userEmp._id.toString());

  if (isOwner) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized: You cannot approve or review your own leave request.',
    });
  }

  if (leave.status !== 'Pending Manager Approval' && leave.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: `Invalid action: Leave is currently ${leave.status}, not awaiting manager approval.`,
    });
  }

  const { action, remarks, rejectionReason } = req.body;
  const isApprove = action === 'Approve' || action === 'approved';

  if (!isApprove && !rejectionReason && !remarks) {
    return res.status(400).json({
      success: false,
      message: 'Rejection reason is required when rejecting a leave request.',
    });
  }

  const approverName = `${user.name || ''} ${user.surname || ''}`.trim() || user.email;
  const newStatus = isApprove ? 'Pending HR Approval' : 'Rejected';

  const updatedLeave = await Leave.findOneAndUpdate(
    {
      _id: req.params.id,
      status: { $in: ['Pending Manager Approval', 'pending'] },
      removed: false,
    },
    {
      $set: {
        status: newStatus,
        rejectionReason: !isApprove ? (rejectionReason || remarks) : '',
        managerApproval: {
          status: isApprove ? 'Approved' : 'Rejected',
          approver: user._id,
          approverName,
          remarks: !isApprove ? (rejectionReason || remarks) : (remarks || 'Approved by Manager'),
          timestamp: new Date(),
        },
      },
      $push: {
        approvalHistory: {
          step: 'MANAGER',
          approver: user._id,
          approverName,
          status: isApprove ? 'Approved' : 'Rejected',
          remarks: !isApprove ? (rejectionReason || remarks) : (remarks || 'Approved by Manager'),
          timestamp: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!updatedLeave) {
    const fresh = await Leave.findById(req.params.id);
    return res.status(409).json({
      success: false,
      message: `Conflict: Leave is currently ${fresh ? fresh.status : 'unknown'}, not awaiting manager approval. Another decision may have been recorded.`,
    });
  }

  if (!isApprove) {
    // Release pending balance quota
    const leaveYear = new Date(leave.fromDate).getFullYear();
    const balanceDoc = await getOrInitBalance(leave.employee, leave.user, leaveYear);
    const typeBalance = balanceDoc.balances[leave.leaveType];
    if (typeBalance) {
      typeBalance.pending = Math.max(0, typeBalance.pending - leave.daysCount);
      balanceDoc.markModified('balances');
      await balanceDoc.save();
    }
  }

  const populated = await Leave.findById(updatedLeave._id)
    .populate('employee', 'employeeId name surname photo departmentName designationName email')
    .populate('reportingManager', 'employeeId name surname photo departmentName designationName email');

  return res.status(200).json({
    success: true,
    result: populated,
    message: isApprove
      ? 'Manager approval granted. Leave advanced to Pending HR Approval.'
      : 'Leave rejected by manager.',
  });
};

// =========================================================================
// 4. HR APPROVAL / REJECTION (FINAL WORKFLOW STAGE & ATTENDANCE INTEGRATION)
// =========================================================================
const hrApproval = async (req, res) => {
  const Leave = mongoose.model('Leave');
  const Attendance = mongoose.model('Attendance');
  const user = req.user;
  const userRole = req.userRole;

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid leave request ID.' });
  }

  if (![ROLES.HR, ROLES.ADMIN].includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized: Only HR or Admin can perform leave approvals.',
    });
  }

  const leave = await Leave.findOne({ _id: req.params.id, removed: false });
  if (!leave) {
    return res.status(404).json({ success: false, message: 'Leave request not found.' });
  }

  // PREVENT EMPLOYEE APPROVING OWN LEAVE (EVEN IF HR)
  const userEmp = await resolveEmployee(user);
  const isOwner =
    (leave.user && leave.user.toString() === user._id.toString()) ||
    (userEmp && leave.employee.toString() === userEmp._id.toString());

  if (isOwner) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized: You cannot approve your own leave request.',
    });
  }

  if (leave.status !== 'Pending HR Approval') {
    return res.status(400).json({
      success: false,
      message: `Invalid action: Leave is currently ${leave.status}, not awaiting HR approval.`,
    });
  }

  const { action, remarks, rejectionReason } = req.body;
  const isApprove = action === 'Approve' || action === 'approved';

  if (!isApprove && !rejectionReason && !remarks) {
    return res.status(400).json({
      success: false,
      message: 'Rejection reason is required when rejecting a leave request.',
    });
  }

  const approverName = `${user.name || ''} ${user.surname || ''}`.trim() || user.email;
  const newStatus = isApprove ? 'Approved' : 'Rejected';

  // ATOMIC CAS to prevent concurrent approval races
  const updatedLeave = await Leave.findOneAndUpdate(
    {
      _id: req.params.id,
      status: 'Pending HR Approval',
      removed: false,
    },
    {
      $set: {
        status: newStatus,
        rejectionReason: !isApprove ? (rejectionReason || remarks) : '',
        hrApproval: {
          status: isApprove ? 'Approved' : 'Rejected',
          approver: user._id,
          approverName,
          remarks: !isApprove ? (rejectionReason || remarks) : (remarks || 'Final Approval by Reviewer'),
          timestamp: new Date(),
        },
      },
      $push: {
        approvalHistory: {
          step: 'HR',
          approver: user._id,
          approverName,
          status: isApprove ? 'Approved' : 'Rejected',
          remarks: !isApprove ? (rejectionReason || remarks) : (remarks || 'Final Approval by Reviewer'),
          timestamp: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!updatedLeave) {
    const fresh = await Leave.findById(req.params.id);
    return res.status(409).json({
      success: false,
      message: `Conflict: Leave is currently ${fresh ? fresh.status : 'unknown'}, not awaiting HR approval. Another decision may have been recorded.`,
    });
  }

  if (isApprove) {
    // Update LeaveBalance: convert pending to used
    const leaveYear = new Date(leave.fromDate).getFullYear();
    const balanceDoc = await getOrInitBalance(leave.employee, leave.user, leaveYear);
    const typeBalance = balanceDoc.balances[leave.leaveType];
    if (typeBalance) {
      typeBalance.pending = Math.max(0, typeBalance.pending - leave.daysCount);
      typeBalance.used += leave.daysCount;
      balanceDoc.markModified('balances');
      await balanceDoc.save();
    }

    // =========================================================================
    // INTEGRATE APPROVED LEAVE WITH ATTENDANCE (DO NOT BREAK EXISTING ATTENDANCE)
    // =========================================================================
    const cur = new Date(leave.fromDate);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(leave.toDate);
    end.setHours(0, 0, 0, 0);

    while (cur.getTime() <= end.getTime()) {
      const year = cur.getFullYear();
      const month = String(cur.getMonth() + 1).padStart(2, '0');
      const day = String(cur.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;
      const dayOfWeek = cur.getDay(); // 0 Sun, 6 Sat

      // Skip weekends for standard multi-day leaves unless WFH or Comp Off
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (!isWeekend || ['Work From Home', 'Compensatory Off'].includes(leave.leaveType)) {
        let attRecord = await Attendance.findOne({
          employee: leave.employee,
          dateString,
          removed: false,
        });

        if (!attRecord) {
          // Auto-create attendance record for approved leave
          await new Attendance({
            employee: leave.employee,
            user: leave.user,
            department: leave.department,
            date: new Date(cur),
            dateString,
            workMode: leave.leaveType === 'Work From Home' ? 'Work From Home' : 'Leave',
            status: leave.leaveType === 'Work From Home' ? 'Present' : leave.leaveType === 'Half Day' ? 'Half Day' : 'Leave',
            remarks: `Approved Leave: ${leave.leaveType} (${leave.reason})`,
          }).save();
        } else if (!attRecord.loginTime) {
          // If placeholder existed without clockin, update status to Leave
          attRecord.workMode = leave.leaveType === 'Work From Home' ? 'Work From Home' : 'Leave';
          attRecord.status = leave.leaveType === 'Work From Home' ? 'Present' : leave.leaveType === 'Half Day' ? 'Half Day' : 'Leave';
          attRecord.remarks = `Approved Leave: ${leave.leaveType} (${leave.reason})`;
          await attRecord.save();
        }
      }

      cur.setDate(cur.getDate() + 1);
    }
  } else {
    // REJECTED
    // Release pending balance quota
    const leaveYear = new Date(leave.fromDate).getFullYear();
    const balanceDoc = await getOrInitBalance(leave.employee, leave.user, leaveYear);
    const typeBalance = balanceDoc.balances[leave.leaveType];
    if (typeBalance) {
      typeBalance.pending = Math.max(0, typeBalance.pending - leave.daysCount);
      balanceDoc.markModified('balances');
      await balanceDoc.save();
    }
  }

  const populated = await Leave.findById(updatedLeave._id)
    .populate('employee', 'employeeId name surname photo departmentName designationName email')
    .populate('reportingManager', 'employeeId name surname photo departmentName designationName email');

  return res.status(200).json({
    success: true,
    result: populated,
    message: isApprove
      ? 'Leave approved by HR. Attendance records successfully synchronized.'
      : 'Leave rejected by HR.',
  });
};

// =========================================================================
// 5. LEAVE BALANCE SUMMARY
// =========================================================================
const balance = async (req, res) => {
  const Employee = mongoose.model('Employee');
  const user = req.user;
  const userRole = req.userRole;

  let targetEmployee = null;
  if (userRole === ROLES.EMPLOYEE) {
    targetEmployee = await resolveEmployee(user);
    if (!targetEmployee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found.' });
    }
  } else {
    if (req.query.employee) {
      targetEmployee = await Employee.findById(req.query.employee);
    } else {
      targetEmployee = await resolveEmployee(user);
    }
    if (!targetEmployee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }
  }

  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const balanceDoc = await getOrInitBalance(targetEmployee._id, targetEmployee.user || user._id, year);

  // Compute remaining for each leave type
  const computedBalances = {};
  for (const [type, data] of Object.entries(balanceDoc.balances)) {
    const allocated = data.allocated || 0;
    const used = data.used || 0;
    const pending = data.pending || 0;
    const remaining = type === 'Unpaid Leave' ? 'Unlimited' : Math.max(0, allocated - (used + pending));

    computedBalances[type] = {
      allocated,
      used,
      pending,
      remaining,
    };
  }

  return res.status(200).json({
    success: true,
    result: {
      employee: {
        _id: targetEmployee._id,
        employeeId: targetEmployee.employeeId,
        fullName: `${targetEmployee.name} ${targetEmployee.surname}`.trim(),
        department: targetEmployee.departmentName,
      },
      year,
      balances: computedBalances,
    },
  });
};

// =========================================================================
// 6. LEAVE CALENDAR (ANNUAL / MONTHLY WITH DEPARTMENT FILTERING)
// =========================================================================
const calendar = async (req, res) => {
  const Leave = mongoose.model('Leave');
  const user = req.user;
  const userRole = req.userRole;

  const now = new Date();
  const year = parseInt(req.query.year, 10) || now.getFullYear();
  const month = req.query.month ? parseInt(req.query.month, 10) : null;

  let startDate, endDate;
  if (month) {
    startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    endDate = new Date(year, month, 0, 23, 59, 59, 999);
  } else {
    startDate = new Date(year, 0, 1, 0, 0, 0, 0);
    endDate = new Date(year, 11, 31, 23, 59, 59, 999);
  }

  const filter = {
    removed: false,
    status: { $in: ['Approved', 'Pending Manager Approval', 'Pending HR Approval', 'approved', 'pending'] },
    fromDate: { $lte: endDate },
    toDate: { $gte: startDate },
  };

  if (userRole === ROLES.EMPLOYEE) {
    const emp = await resolveEmployee(user);
    if (emp) filter.employee = emp._id;
  } else {
    if (req.query.department) filter.department = req.query.department;
  }

  const leaves = await Leave.find(filter)
    .populate('employee', 'employeeId name surname photo departmentName designationName email')
    .sort({ fromDate: 1 });

  return res.status(200).json({
    success: true,
    result: leaves,
    message: 'Leave calendar events retrieved successfully.',
  });
};

// =========================================================================
// 7. APPROVALS QUEUE (PENDING FOR MANAGERS / HR)
// =========================================================================
const approvalsQueue = async (req, res) => {
  const Leave = mongoose.model('Leave');
  const user = req.user;
  const userRole = req.userRole;

  const userEmp = await resolveEmployee(user);

  if (![ROLES.HR, ROLES.ADMIN].includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Only HR and Admin can view the leave approvals queue.',
    });
  }

  const query = {
    removed: false,
    status: { $in: ['Pending Manager Approval', 'Pending HR Approval', 'pending'] },
  };

  const pendingLeaves = await Leave.find(query)
    .populate('employee', 'employeeId name surname photo departmentName designationName email')
    .populate('reportingManager', 'employeeId name surname photo departmentName designationName email')
    .sort({ created: -1 });

  return res.status(200).json({
    success: true,
    result: pendingLeaves,
  });
};

// =========================================================================
// 8. LIST (WITH MULTI-FILTERING)
// =========================================================================
const list = async (req, res) => {
  const Leave = mongoose.model('Leave');
  const user = req.user;
  const userRole = req.userRole;

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.items, 10) || parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = { removed: false };

  if (userRole === ROLES.EMPLOYEE) {
    const userEmp = await resolveEmployee(user);
    if (!userEmp) {
      return res.status(200).json({
        success: true,
        result: [],
        pagination: { page, pages: 0, count: 0 },
        message: 'No associated employee profile found.',
      });
    }
    filter.employee = userEmp._id;
  } else {
    if (req.query.employee) filter.employee = req.query.employee;
  }

  if (req.query.department) filter.department = new RegExp(req.query.department, 'i');
  if (req.query.status) filter.status = req.query.status;
  if (req.query.leaveType) filter.leaveType = req.query.leaveType;
  if (req.query.startDate && req.query.endDate) {
    filter.fromDate = { $lte: new Date(req.query.endDate) };
    filter.toDate = { $gte: new Date(req.query.startDate) };
  }

  if (req.query.q) {
    filter.$or = [
      { reason: new RegExp(req.query.q, 'i') },
      { leaveType: new RegExp(req.query.q, 'i') },
      { department: new RegExp(req.query.q, 'i') },
    ];
  }

  const [records, count] = await Promise.all([
    Leave.find(filter)
      .populate('employee', 'employeeId name surname photo departmentName designationName email')
      .populate('reportingManager', 'employeeId name surname photo departmentName designationName email')
      .populate('user', 'name surname email role')
      .sort({ created: -1 })
      .skip(skip)
      .limit(limit),
    Leave.countDocuments(filter),
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
    message: 'Leave records fetched successfully.',
  });
};

// =========================================================================
// 9. READ SINGLE RECORD
// =========================================================================
const read = async (req, res) => {
  const Leave = mongoose.model('Leave');
  const user = req.user;
  const userRole = req.userRole;

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid leave record ID.' });
  }

  const record = await Leave.findOne({ _id: req.params.id, removed: false })
    .populate('employee', 'employeeId name surname photo departmentName designationName email')
    .populate('reportingManager', 'employeeId name surname photo departmentName designationName email')
    .populate('user', 'name surname email role');

  if (!record) {
    return res.status(404).json({ success: false, message: 'Leave record not found.' });
  }

  if (userRole === ROLES.EMPLOYEE) {
    const userEmp = await resolveEmployee(user);
    const isOwner =
      (record.user && record.user._id && record.user._id.toString() === user._id.toString()) ||
      (userEmp && record.employee && record.employee._id && record.employee._id.toString() === userEmp._id.toString());

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You cannot access another employee's confidential leave records.",
      });
    }
  }

  return res.status(200).json({ success: true, result: record });
};

// =========================================================================
// 10. DIRECT UPDATE RESTRICTION
// =========================================================================
const update = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Direct modification of leave requests is prohibited. Use approval or cancellation endpoints.',
  });
};

// =========================================================================
// 11. DELETE / SOFT DELETE
// =========================================================================
const deleteRecord = async (req, res) => {
  const Leave = mongoose.model('Leave');
  const userRole = req.userRole;

  if (userRole !== ROLES.ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Only administrators can delete leave records.',
    });
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid leave record ID.' });
  }

  const record = await Leave.findOne({ _id: req.params.id, removed: false });

  if (!record) {
    return res.status(404).json({ success: false, message: 'Leave record not found.' });
  }

  record.removed = true;
  await record.save();

  return res.status(200).json({ success: true, message: 'Leave record soft-deleted.' });
};

// =========================================================================
// 12. SUMMARY
// =========================================================================
const summary = async (req, res) => {
  const Leave = mongoose.model('Leave');
  const user = req.user;
  const userRole = req.userRole;

  const filter = { removed: false };
  if (userRole === ROLES.EMPLOYEE) {
    const emp = await resolveEmployee(user);
    if (emp) filter.employee = emp._id;
  } else if (req.query.department) {
    filter.department = req.query.department;
  }

  const all = await Leave.find(filter);

  const total = all.length;
  const pending = all.filter((l) => ['Pending Manager Approval', 'Pending HR Approval', 'pending'].includes(l.status)).length;
  const approved = all.filter((l) => ['Approved', 'approved'].includes(l.status)).length;
  const rejected = all.filter((l) => ['Rejected', 'rejected'].includes(l.status)).length;

  return res.status(200).json({
    success: true,
    result: {
      total,
      pending,
      approved,
      rejected,
    },
  });
};

module.exports = {
  apply,
  cancel,
  managerApproval,
  hrApproval,
  balance,
  calendar,
  approvalsQueue,
  list,
  read,
  update,
  create: apply,
  delete: deleteRecord,
  summary,
};

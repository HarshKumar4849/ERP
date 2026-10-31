const mongoose = require('mongoose');

// Indian Standard Time (IST) for TecMotiv HQ in Pune, India
const TIMEZONE = process.env.APP_TIMEZONE || process.env.PAYROLL_TIMEZONE || 'Asia/Kolkata';

/**
 * Returns date information normalized to company timezone
 * @param {Date|string|number} targetDate 
 * @param {string} tz 
 */
function getCompanyDateInfo(targetDate = new Date(), tz = TIMEZONE) {
  const d = new Date(targetDate);
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  // Format YYYY-MM-DD in company timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateString = formatter.format(validDate); // "YYYY-MM-DD"

  const [yearStr, monthStr, dayStr] = dateString.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12
  const day = parseInt(dayStr, 10);

  // Weekday in company timezone
  const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  });
  const weekday = weekdayFormatter.format(validDate); // 'Sun', 'Mon', 'Tue', ...
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';

  // Precise UTC boundaries for target date in IST (UTC+05:30)
  // 00:00:00 IST = 18:30:00 UTC previous day
  // 23:59:59.999 IST = 18:29:59.999 UTC current day
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const localMidnightUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const localEndUtc = Date.UTC(year, month - 1, day, 23, 59, 59, 999);

  const startOfDay = new Date(localMidnightUtc - istOffsetMs);
  const endOfDay = new Date(localEndUtc - istOffsetMs);

  // Broad query bounds to safely cover any UTC-normalized date storage
  const queryStart = new Date(Math.min(startOfDay.getTime(), localMidnightUtc));
  const queryEnd = new Date(Math.max(endOfDay.getTime(), localEndUtc));

  return {
    dateString,
    year,
    month,
    day,
    weekday,
    isWeekend,
    startOfDay,
    endOfDay,
    queryStart,
    queryEnd,
  };
}

/**
 * Determine single employee availability status from matched records
 */
function determineSingleEmployeeAvailability({
  attendanceRecord,
  approvedLeaves = [],
  holidayEvent,
  dateInfo,
}) {
  const { dateString, isWeekend } = dateInfo || getCompanyDateInfo();

  // 1. Verify valid attendance for today
  const hasAttendance = Boolean(
    attendanceRecord &&
    !attendanceRecord.removed &&
    (attendanceRecord.loginTime ||
     attendanceRecord.clockIn ||
     ['Present', 'Late Login', 'Early Logout', 'present', 'late', 'wfh'].includes(attendanceRecord.status)) &&
    !['Absent', 'absent'].includes(attendanceRecord.status)
  );

  // 2. Filter approved leaves covering today
  const validApprovedLeaves = (approvedLeaves || []).filter(
    (l) => !l.removed && ['Approved', 'approved'].includes(l.status)
  );

  const fullDayLeave = validApprovedLeaves.find(
    (l) => l.leaveType !== 'Half Day' && (l.daysCount === undefined || l.daysCount >= 1)
  );

  const halfDayLeave = validApprovedLeaves.find(
    (l) => l.leaveType === 'Half Day' || l.daysCount === 0.5
  );

  const isHalfDayAttendance = Boolean(
    attendanceRecord &&
    (attendanceRecord.status === 'Half Day' || attendanceRecord.isHalfDayDeclaration)
  );

  // ==========================================
  // CASE 1: CONFLICT - ATTENDANCE + FULL DAY LEAVE
  // ==========================================
  if (hasAttendance && fullDayLeave) {
    return {
      status: 'present',
      dotColor: 'green',
      conflict: true,
      label: 'Checked In (On Leave Record)',
      date: dateString,
      loginTime: attendanceRecord.loginTime || attendanceRecord.clockIn || null,
      logoutTime: attendanceRecord.logoutTime || attendanceRecord.clockOut || null,
      workMode: attendanceRecord.workMode || 'Office',
    };
  }

  // ==========================================
  // CASE 2: APPROVED FULL DAY LEAVE
  // ==========================================
  if (fullDayLeave) {
    return {
      status: 'on_leave',
      dotColor: 'red',
      conflict: false,
      label: 'On Leave',
      date: dateString,
      loginTime: null,
      logoutTime: null,
      workMode: null,
    };
  }

  // ==========================================
  // CASE 3: HALF DAY / PARTIAL DAY
  // ==========================================
  if (halfDayLeave || isHalfDayAttendance) {
    if (hasAttendance) {
      return {
        status: 'partial_day',
        dotColor: 'amber',
        conflict: false,
        label: 'Half Day (Checked In)',
        date: dateString,
        loginTime: attendanceRecord.loginTime || attendanceRecord.clockIn || null,
        logoutTime: attendanceRecord.logoutTime || attendanceRecord.clockOut || null,
        workMode: attendanceRecord.workMode || 'Office',
      };
    } else {
      return {
        status: 'partial_day',
        dotColor: 'amber',
        conflict: false,
        label: 'Half Day Leave',
        date: dateString,
        loginTime: null,
        logoutTime: null,
        workMode: null,
      };
    }
  }

  // ==========================================
  // CASE 4: NORMAL PRESENT (CHECKED IN OR OUT)
  // ==========================================
  if (hasAttendance) {
    const isCheckedOut = Boolean(attendanceRecord.logoutTime || attendanceRecord.clockOut);
    const isWfh = attendanceRecord.workMode === 'Work From Home' || attendanceRecord.status === 'wfh';
    let label = 'Present';
    if (isWfh) {
      label = isCheckedOut ? 'Present (WFH - Checked Out)' : 'Present (WFH)';
    } else if (isCheckedOut) {
      label = 'Checked Out';
    }

    return {
      status: 'present',
      dotColor: 'green',
      conflict: false,
      label,
      date: dateString,
      loginTime: attendanceRecord.loginTime || attendanceRecord.clockIn || null,
      logoutTime: attendanceRecord.logoutTime || attendanceRecord.clockOut || null,
      workMode: attendanceRecord.workMode || 'Office',
    };
  }

  // ==========================================
  // CASE 5: NO ATTENDANCE & NO APPROVED LEAVE
  // ==========================================
  if (holidayEvent) {
    const holidayTitle = holidayEvent.title || holidayEvent.eventName || 'Holiday';
    return {
      status: 'holiday',
      dotColor: 'grey',
      conflict: false,
      label: `Holiday (${holidayTitle})`,
      date: dateString,
      loginTime: null,
      logoutTime: null,
      workMode: null,
    };
  }

  if (isWeekend) {
    return {
      status: 'weekend',
      dotColor: 'grey',
      conflict: false,
      label: 'Weekend',
      date: dateString,
      loginTime: null,
      logoutTime: null,
      workMode: null,
    };
  }

  return {
    status: 'not_checked_in',
    dotColor: 'grey',
    conflict: false,
    label: 'Not Checked In',
    date: dateString,
    loginTime: null,
    logoutTime: null,
    workMode: null,
  };
}

/**
 * Bulk compute availability for an array of employee IDs (O(1) lookups, 2 bulk DB queries)
 * @param {Array<string|ObjectId>} employeeIds 
 * @param {Date|string|number} targetDate 
 */
async function computeEmployeesAvailability(employeeIds = [], targetDate = new Date()) {
  try {
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return {};
    }

    const Attendance = mongoose.models.Attendance || require('../../../models/appModels/Attendance');
    const Leave = mongoose.models.Leave || require('../../../models/appModels/Leave');
    const Event = mongoose.models.Event || require('../../../models/appModels/Event');

    const dateInfo = getCompanyDateInfo(targetDate);
    const { dateString, queryStart, queryEnd, startOfDay, endOfDay } = dateInfo;

    // Filter valid ObjectId formats
    const validEmpIds = employeeIds
      .map((id) => (id ? id.toString() : ''))
      .filter((idStr) => mongoose.Types.ObjectId.isValid(idStr))
      .map((idStr) => new mongoose.Types.ObjectId(idStr));

    if (validEmpIds.length === 0) {
      return {};
    }

    // Execute 3 concurrent bulk queries with individual error isolation
    const [attendances, approvedLeaves, holidayEvents] = await Promise.all([
      // 1. Attendance records for dateString
      Attendance.find({
        employee: { $in: validEmpIds },
        dateString,
        removed: false,
      })
        .select('employee dateString loginTime logoutTime clockIn clockOut status workMode isHalfDayDeclaration')
        .lean()
        .exec()
        .catch((err) => {
          console.warn('Availability attendance query notice:', err.message);
          return [];
        }),

      // 2. Approved leave records covering today
      Leave.find({
        employee: { $in: validEmpIds },
        removed: false,
        status: { $in: ['Approved', 'approved'] },
        fromDate: { $lte: queryEnd },
        toDate: { $gte: queryStart },
      })
        .select('employee leaveType daysCount fromDate toDate status')
        .lean()
        .exec()
        .catch((err) => {
          console.warn('Availability leave query notice:', err.message);
          return [];
        }),

      // 3. Company Holiday/Festival for today
      Event.find({
        removed: false,
        eventType: { $in: ['Holiday', 'Festival'] },
        $or: [
          { startDate: { $lte: queryEnd }, endDate: { $gte: queryStart } },
          { date: { $gte: queryStart, $lte: queryEnd } },
        ],
      })
        .select('title eventName eventType startDate endDate date')
        .lean()
        .exec()
        .catch((err) => {
          console.warn('Availability holiday query notice:', err.message);
          return [];
        }),
    ]);

    // Map attendances by employeeId string
    const attendanceMap = new Map();
    for (const att of (attendances || [])) {
      if (att && att.employee) {
        attendanceMap.set(att.employee.toString(), att);
      }
    }

    // Map approved leaves by employeeId string (an employee may have multiple records)
    const leaveMap = new Map();
    for (const lv of (approvedLeaves || [])) {
      if (lv && lv.employee) {
        const empKey = lv.employee.toString();
        if (!leaveMap.has(empKey)) {
          leaveMap.set(empKey, []);
        }
        // Ensure date overlap with today in local time
        const lvFrom = new Date(lv.fromDate);
        const lvTo = new Date(lv.toDate);
        if (lvFrom <= endOfDay && lvTo >= startOfDay) {
          leaveMap.get(empKey).push(lv);
        }
      }
    }

    const holidayEvent = holidayEvents && holidayEvents.length > 0 ? holidayEvents[0] : null;

    // Build result dictionary
    const availabilityMap = {};
    for (const empId of validEmpIds) {
      const idStr = empId.toString();
      const attendanceRecord = attendanceMap.get(idStr) || null;
      const empLeaves = leaveMap.get(idStr) || [];

      availabilityMap[idStr] = determineSingleEmployeeAvailability({
        attendanceRecord,
        approvedLeaves: empLeaves,
        holidayEvent,
        dateInfo,
      });
    }

    return availabilityMap;
  } catch (err) {
    console.error('Fatal error in computeEmployeesAvailability:', err);
    return {};
  }
}

module.exports = {
  TIMEZONE,
  getCompanyDateInfo,
  determineSingleEmployeeAvailability,
  computeEmployeesAvailability,
};

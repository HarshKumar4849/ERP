const mongoose = require('mongoose');
const payrollService = require('./payrollService');

let schedulerTimer = null;

// Company approved payroll timezone (Default: Indian Standard Time Asia/Kolkata for TecMotiv)
const TIMEZONE = process.env.PAYROLL_TIMEZONE || 'Asia/Kolkata';

// Extract timezone-aware date parts (year, month, day, weekday, hour)
function getTimezoneDateParts(tz = TIMEZONE) {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return {
      year: Number(get('year')),
      month: Number(get('month')), // 1 - 12
      day: Number(get('day')),
      weekday: get('weekday'), // 'Sun', 'Mon', 'Tue', ...
      hour: Number(get('hour')),
      minute: Number(get('minute')),
      timezone: tz,
    };
  } catch (err) {
    console.warn(`[Payroll Scheduler] Invalid timezone '${tz}', defaulting to UTC.`);
    return {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
      day: now.getUTCDate(),
      weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getUTCDay()],
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
      timezone: 'UTC',
    };
  }
}

// Determine if today is the scheduled monthly payroll processing day in company timezone
function isScheduledPayrollDay() {
  const targetDay = Number(process.env.PAYROLL_SCHEDULE_DAY || 1);
  const tzParts = getTimezoneDateParts();
  return tzParts.day === targetDay;
}

// Compute the target processing period (prior calendar cycle if run on 1st)
function getTargetPeriod() {
  const tzParts = getTimezoneDateParts();
  let targetYear = tzParts.year;
  let targetMonthNum = tzParts.month - 1;

  if (targetMonthNum < 1) {
    targetMonthNum = 12;
    targetYear -= 1;
  }

  const targetMonthName = payrollService.normalizeMonth(targetMonthNum);
  return { year: targetYear, month: targetMonthName, timezone: tzParts.timezone };
}

// Check database audit trail to ensure process restarts never trigger duplicate automated runs
async function hasPeriodBeenProcessed(year, month) {
  try {
    const SalaryAudit = mongoose.models.SalaryAudit || require('../models/appModels/SalaryAudit');
    const existingCount = await SalaryAudit.countDocuments({
      action: { $in: ['BATCH_GENERATED', 'BATCH_RECALCULATED'] },
      periodLabel: `${month} ${year}`,
    });
    return existingCount > 0;
  } catch (err) {
    console.error('[Payroll Scheduler] DB audit lookup failed:', err.message);
    return false;
  }
}

// Authoritative automated run execution
async function triggerAutomatedRun({ force = false } = {}) {
  try {
    const { year, month, timezone } = getTargetPeriod();
    const tzParts = getTimezoneDateParts();
    const workingDays = payrollService.getDaysInMonth(year, month);

    // Safeguard 1: Database persistence check against server process restarts
    if (!force) {
      const alreadyProcessed = await hasPeriodBeenProcessed(year, month);
      if (alreadyProcessed) {
        console.log(
          `[Payroll Scheduler] Period ${month} ${year} already has verified batch audit records in DB. Skipping duplicate run.`
        );
        return { skipped: true, reason: 'Already processed in DB audit log' };
      }
    }

    // Safeguard 2: Weekend awareness
    const isWeekend = tzParts.weekday === 'Sat' || tzParts.weekday === 'Sun';
    if (isWeekend) {
      console.log(
        `[Payroll Scheduler] Scheduled date falls on a weekend (${tzParts.weekday}). Generating DRAFT calculation; final financial disbursement released on next business day.`
      );
    }

    console.log(
      `[Payroll Scheduler] Executing automated monthly payroll for ${month} ${year} in timezone ${timezone}...`
    );

    // Safeguard 3: Separation of calculation vs. disbursement release
    // Automated runs generate DRAFT salary slips. Final 'Paid' release is reserved for authorized HR/Finance approval.
    const summary = await payrollService.processMonthlyBatch({
      year,
      month,
      workingDays,
      createdByUser: null, // Traceable as "System Automation"
      forceRecalculate: false, // Strict idempotency: never overwrite already finalized slips
      markPaid: false, // Draft calculation
      paymentMode: 'Bank Transfer',
      ipAddress: `127.0.0.1 (Scheduler-${timezone})`,
    });

    console.log(
      `[Payroll Scheduler] Batch complete: ${summary.createdCount} created, ${summary.updatedCount} updated, ${summary.skippedCount} skipped for ${summary.period}.`
    );
    return summary;
  } catch (err) {
    console.error('[Payroll Scheduler] Execution failed:', err);
    return null;
  }
}

// Background scheduling timer
let lastRunDateStr = null;

function initScheduler() {
  if (process.env.DISABLE_PAYROLL_SCHEDULER === 'true') {
    console.log('[Payroll Scheduler] Background scheduler disabled by environment configuration.');
    return;
  }

  const tzParts = getTimezoneDateParts();
  console.log(
    `[Payroll Scheduler] Initialized background monthly payroll scheduler. Active timezone: ${tzParts.timezone}, Scheduled Day: ${process.env.PAYROLL_SCHEDULE_DAY || 1}.`
  );

  // Interval check (every 4 hours)
  const INTERVAL_MS = 4 * 60 * 60 * 1000;

  async function checkAndExecute() {
    try {
      const currentParts = getTimezoneDateParts();
      const todayDateStr = `${currentParts.year}-${String(currentParts.month).padStart(2, '0')}-${String(currentParts.day).padStart(2, '0')}`;

      if (isScheduledPayrollDay() && lastRunDateStr !== todayDateStr) {
        lastRunDateStr = todayDateStr;
        await triggerAutomatedRun();
      }
    } catch (e) {
      console.error('[Payroll Scheduler] Periodic check error:', e);
    }
  }

  // Initial delayed check after server starts (30 seconds)
  setTimeout(checkAndExecute, 30000);

  schedulerTimer = setInterval(checkAndExecute, INTERVAL_MS);
  if (schedulerTimer.unref) schedulerTimer.unref();
}

function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

module.exports = {
  initScheduler,
  triggerAutomatedRun,
  stopScheduler,
  getTargetPeriod,
  getTimezoneDateParts,
  isScheduledPayrollDay,
  hasPeriodBeenProcessed,
  TIMEZONE,
};

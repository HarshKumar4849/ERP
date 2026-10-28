const mongoose = require('mongoose');
const payrollService = require('./payrollService');

let schedulerTimer = null;

// Determine if today is the scheduled monthly payroll processing day
// Default: 1st day of the month (e.g., 1st of November processes October)
function isScheduledPayrollDay() {
  const targetDay = Number(process.env.PAYROLL_SCHEDULE_DAY || 1);
  const today = new Date();
  return today.getDate() === targetDay;
}

// Compute the target processing period (previous month if run on the 1st)
function getTargetPeriod() {
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const targetYear = targetDate.getFullYear();
  const targetMonth = payrollService.normalizeMonth(targetDate.getMonth() + 1);
  return { year: targetYear, month: targetMonth };
}

async function triggerAutomatedRun() {
  try {
    const { year, month } = getTargetPeriod();
    const workingDays = payrollService.getDaysInMonth(year, month);

    console.log(`[Payroll Scheduler] Starting automated monthly batch for ${month} ${year}...`);

    const summary = await payrollService.processMonthlyBatch({
      year,
      month,
      workingDays,
      createdByUser: null, // Logged as System Automation
      forceRecalculate: false, // Strict idempotency: never overwrite already processed
      markPaid: false, // Automated slips start as Draft until verified by HR
      paymentMode: 'Bank Transfer',
      ipAddress: '127.0.0.1 (Scheduler)',
    });

    console.log(
      `[Payroll Scheduler] Completed: ${summary.createdCount} created, ${summary.skippedCount} skipped, ${summary.errorCount} errors for ${summary.period}.`
    );
    return summary;
  } catch (err) {
    console.error('[Payroll Scheduler] Execution failed:', err);
    return null;
  }
}

// Check every 6 hours if today is the scheduled day and whether it already ran today
let lastRunDate = null;

function initScheduler() {
  // If scheduler is disabled via env var
  if (process.env.DISABLE_PAYROLL_SCHEDULER === 'true') {
    console.log('[Payroll Scheduler] Background scheduler disabled by configuration.');
    return;
  }

  console.log('[Payroll Scheduler] Initialized background monthly payroll scheduler.');

  // Interval check (every 4 hours = 4 * 60 * 60 * 1000 ms)
  const INTERVAL_MS = 4 * 60 * 60 * 1000;

  async function checkAndExecute() {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (isScheduledPayrollDay() && lastRunDate !== todayStr) {
        lastRunDate = todayStr;
        await triggerAutomatedRun();
      }
    } catch (e) {
      console.error('[Payroll Scheduler] Periodic check error:', e);
    }
  }

  // Initial delayed check after server boots up (30 seconds)
  setTimeout(checkAndExecute, 30000);

  // Set periodic interval
  schedulerTimer = setInterval(checkAndExecute, INTERVAL_MS);
  if (schedulerTimer.unref) schedulerTimer.unref(); // Do not block process exit
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
  isScheduledPayrollDay,
};


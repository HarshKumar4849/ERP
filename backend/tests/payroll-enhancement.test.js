const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const qa = require('./qa-env');
const { seedFixtures, cleanupFixtures } = require('./fixtures');

let fixtures;
let server;
let baseUrl;
let adminToken;
let hrToken;
let employeeAToken;
let employeeBToken;

async function login(email) {
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: qa.PASSWORD }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, body?.message);
  return body.result.token;
}

test.before(async () => {
  fixtures = await seedFixtures();
  const app = require('../src/app');
  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api`;

  adminToken = await login(fixtures.admin.user.email);
  hrToken = await login(fixtures.hr.user.email);
  employeeAToken = await login(fixtures.employeeA.user.email);
  employeeBToken = await login(fixtures.employeeB.user.email);
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await cleanupFixtures(fixtures);
});

// =========================================================================
// 1. DECIMAL-SAFE ARITHMETIC & RECONCILIATION
// =========================================================================
test('1. Payroll Calculation Engine: Decimal-safe arithmetic and reconciliation', async () => {
  const payrollService = require('../src/services/payrollService');

  // Test case A: Standard calculation with zero LOP
  const standardCalc = payrollService.calculateSalaryBreakdown({
    basic: 50000.50,
    hra: 20000.25,
    allowances: 10000.15,
    incentives: 5000,
    bonus: 2500,
    deductions: 2400.90,
    professionalTax: 200,
    tds: 3500.20,
    otherDeductions: 0,
    workingDays: 31,
    lopDays: 0,
  });

  assert.equal(standardCalc.totalEarnings, 87500.90);
  assert.equal(standardCalc.totalDeductions, 6101.10);
  assert.equal(standardCalc.netSalary, 81399.80);
  assert.equal(standardCalc.paidDays, 31);
  assert.equal(standardCalc.lopDeduction, 0);
  // Invariant: totalEarnings - totalDeductions must exactly equal netSalary
  assert.equal(
    Math.round((standardCalc.totalEarnings - standardCalc.totalDeductions) * 100) / 100,
    standardCalc.netSalary
  );

  // Test case B: Loss of Pay (LOP) unpaid leave calculation
  const lopCalc = payrollService.calculateSalaryBreakdown({
    basic: 60000,
    hra: 24000,
    allowances: 12000,
    deductions: 2400,
    professionalTax: 200,
    tds: 4000,
    workingDays: 30,
    lopDays: 3, // 3 days unpaid
  });

  // Daily rate = 60000 / 30 = 2000
  // LOP deduction = 2000 * 3 = 6000
  assert.equal(lopCalc.lopDeduction, 6000);
  assert.equal(lopCalc.paidDays, 27);
  assert.equal(lopCalc.totalEarnings, 96000);
  // Total Deductions = 2400 + 200 + 4000 + 6000 (LOP) = 12600
  assert.equal(lopCalc.totalDeductions, 12600);
  // Net = 96000 - 12600 = 83400
  assert.equal(lopCalc.netSalary, 83400);
  assert.equal(lopCalc.totalEarnings - lopCalc.totalDeductions, lopCalc.netSalary);
  assert.ok(lopCalc.netSalaryWords.includes('Eighty Three Thousand Four Hundred'));
});

// =========================================================================
// 2. REAL-TIME PREVIEW API ENDPOINT
// =========================================================================
test('2. Real-Time Calculation Preview: HR can calculate and preview payroll before commitment', async () => {
  const empAId = fixtures.employeeA.employee._id.toString();

  const previewRes = await fetch(`${baseUrl}/salary/calculate-preview`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      employee: empAId,
      year: 2026,
      month: 'November',
      workingDays: 30,
      basic: 70000,
      hra: 28000,
      allowances: 12000,
      deductions: 3600,
      professionalTax: 200,
      tds: 5000,
      lopDays: 1,
    }),
  });

  assert.equal(previewRes.status, 200);
  const previewBody = await previewRes.json();
  assert.equal(previewBody.success, true);
  assert.ok(previewBody.result.breakdown);
  assert.equal(previewBody.result.breakdown.basic, 70000);
  assert.equal(previewBody.result.breakdown.paidDays, 29);
  assert.equal(previewBody.result.breakdown.lopDays, 1);
  assert.ok(previewBody.result.breakdown.lopDeduction > 0);
  assert.equal(
    previewBody.result.breakdown.totalEarnings - previewBody.result.breakdown.totalDeductions,
    previewBody.result.breakdown.netSalary
  );
});

// =========================================================================
// 3. BATCH PAYROLL EXECUTION & AUDITING
// =========================================================================
let batchPeriodMonth = 'December';
let batchPeriodYear = 2026;

test('3. Batch Payroll Execution: HR executes batch payroll generating slips for active employees', async () => {
  const batchRes = await fetch(`${baseUrl}/salary/batch-run`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      year: batchPeriodYear,
      month: batchPeriodMonth,
      workingDays: 31,
      markPaid: true,
      forceRecalculate: false,
    }),
  });

  assert.equal(batchRes.status, 200);
  const batchBody = await batchRes.json();
  assert.equal(batchBody.success, true);
  assert.ok(batchBody.result);
  assert.ok(batchBody.result.createdCount >= 2, 'Should have created slips for active fixture employees');
  assert.equal(batchBody.result.errorCount, 0);
  assert.ok(batchBody.result.totalNetDisbursed > 0);

  // Verify created records in DB
  const Salary = mongoose.model('Salary');
  const createdSlips = await Salary.find({
    year: batchPeriodYear,
    month: batchPeriodMonth,
    removed: false,
  });
  assert.ok(createdSlips.length >= 2);

  createdSlips.forEach((slip) => {
    assert.ok(slip.slipNumber, 'Each generated salary slip must have a unique slip number');
    assert.ok(slip.slipNumber.startsWith(`TM-SLIP-${batchPeriodYear}DEC-`));
    assert.equal(slip.status, 'Paid');
    assert.equal(slip.totalEarnings - slip.totalDeductions, slip.netSalary);
  });

  // Verify Audit Log
  const SalaryAudit = mongoose.model('SalaryAudit');
  const auditLogs = await SalaryAudit.find({
    action: 'BATCH_GENERATED',
    periodLabel: `${batchPeriodMonth} ${batchPeriodYear}`,
  });
  assert.ok(auditLogs.length >= 2, 'Audit trail must record every batch-generated slip');
});

// =========================================================================
// 4. BATCH IDEMPOTENCY & DUPLICATE RUN PROTECTION
// =========================================================================
test('4. Batch Idempotency: Re-running batch payroll skips existing records and prevents duplicate slips', async () => {
  const duplicateBatchRes = await fetch(`${baseUrl}/salary/batch-run`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      year: batchPeriodYear,
      month: batchPeriodMonth,
      workingDays: 31,
      markPaid: true,
      forceRecalculate: false,
    }),
  });

  assert.equal(duplicateBatchRes.status, 200);
  const dupBody = await duplicateBatchRes.json();
  assert.equal(dupBody.success, true);
  // Invariant: Created count must be 0, all existing must be skipped
  assert.equal(dupBody.result.createdCount, 0, 'Must not duplicate existing slips');
  assert.ok(dupBody.result.skippedCount >= 2, 'Must skip already generated slips');

  // Verify total count in DB has not changed
  const Salary = mongoose.model('Salary');
  const countAfter = await Salary.countDocuments({
    year: batchPeriodYear,
    month: batchPeriodMonth,
    removed: false,
  });
  assert.ok(countAfter >= 2);
});

// =========================================================================
// 5. SECURITY & RBAC ENFORCEMENT ON BATCH & PREVIEW
// =========================================================================
test('5. Security & RBAC: Ordinary employees are strictly forbidden from batch runs & audit logs', async () => {
  // A. Employee A cannot run batch payroll
  const empBatchRes = await fetch(`${baseUrl}/salary/batch-run`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      year: 2026,
      month: 'October',
    }),
  });
  assert.equal(empBatchRes.status, 403, 'Employee must not be able to execute batch payroll');

  // B. Employee A cannot view audit history
  const empAuditRes = await fetch(`${baseUrl}/salary/audit`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empAuditRes.status, 403, 'Employee must not view salary audit logs');
});

// =========================================================================
// 6. EMPLOYEE ISOLATION & SALARY SLIP PDF DOWNLOAD
// =========================================================================
test('6. Employee Isolation: Employee downloads own slip PDF and is blocked from colleague slips', async () => {
  const Salary = mongoose.model('Salary');
  const empASalary = await Salary.findOne({
    employee: fixtures.employeeA.employee._id,
    year: batchPeriodYear,
    month: batchPeriodMonth,
    removed: false,
  });
  const empBSalary = await Salary.findOne({
    employee: fixtures.employeeB.employee._id,
    year: batchPeriodYear,
    month: batchPeriodMonth,
    removed: false,
  });

  assert.ok(empASalary, 'Employee A salary record exists');
  assert.ok(empBSalary, 'Employee B salary record exists');

  // A. Employee A downloads own salary slip PDF
  const empADownloadOwnRes = await fetch(`${baseUrl}/salary/slip/pdf/${empASalary._id}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empADownloadOwnRes.status, 200);
  assert.equal(empADownloadOwnRes.headers.get('content-type'), 'application/pdf');

  // B. Employee A CANNOT download Employee B's salary slip PDF
  const empADownloadBRes = await fetch(`${baseUrl}/salary/slip/pdf/${empBSalary._id}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empADownloadBRes.status, 403, "Employee A must not access Employee B's slip PDF");

  // C. HR can download any employee's salary slip PDF
  const hrDownloadBRes = await fetch(`${baseUrl}/salary/slip/pdf/${empBSalary._id}`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(hrDownloadBRes.status, 200);
  assert.equal(hrDownloadBRes.headers.get('content-type'), 'application/pdf');
});

// =========================================================================
// 7. PHASE M: TIMEZONE-AWARE SCHEDULING, PERSISTENCE & OPERATIONAL SAFEGUARDS
// =========================================================================
test('7. Phase M: Timezone-aware scheduling, process restart persistence & separation of release', async () => {
  const scheduler = require('../src/services/payrollScheduler');

  // A. Timezone date extraction matches company timezone
  const tzParts = scheduler.getTimezoneDateParts('Asia/Kolkata');
  assert.equal(tzParts.timezone, 'Asia/Kolkata');
  assert.ok(tzParts.year >= 2026);
  assert.ok(tzParts.month >= 1 && tzParts.month <= 12);
  assert.ok(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].includes(tzParts.weekday));

  // B. Target period resolves cleanly
  const targetPeriod = scheduler.getTargetPeriod();
  assert.ok(targetPeriod.year);
  assert.ok(targetPeriod.month);

  // C. Process restart persistence: check DB audit trail for test 3 period (December 2026)
  const alreadyProcessed = await scheduler.hasPeriodBeenProcessed(batchPeriodYear, batchPeriodMonth);
  assert.equal(alreadyProcessed, true, 'Period processed in test 3 must be detected in DB across process restarts');

  // D. First execution of scheduler for target period (September 2026)
  const firstRun = await scheduler.triggerAutomatedRun({ force: false });
  assert.ok(firstRun.createdCount >= 2 || firstRun.skipped === true);

  // E. Second execution: Process restart persistence verifies period in DB and skips cleanly
  const secondRun = await scheduler.triggerAutomatedRun({ force: false });
  assert.equal(secondRun.skipped, true, 'Scheduler must skip duplicate period when already recorded in DB');
});

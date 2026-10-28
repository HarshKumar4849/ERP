const mongoose = require('mongoose');
const currency = require('currency.js');

// Month mapping helpers
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function normalizeMonth(month) {
  if (typeof month === 'number') {
    if (month >= 1 && month <= 12) return MONTH_NAMES[month - 1];
    if (month >= 0 && month <= 11) return MONTH_NAMES[month];
  }
  if (typeof month === 'string') {
    const trimmed = month.trim();
    const asNum = parseInt(trimmed, 10);
    if (!isNaN(asNum) && asNum >= 1 && asNum <= 12) {
      return MONTH_NAMES[asNum - 1];
    }
    const found = MONTH_NAMES.find((m) => m.toLowerCase().startsWith(trimmed.toLowerCase()));
    if (found) return found;
  }
  return 'October'; // safe default
}

function getMonthIndex(monthName) {
  const norm = normalizeMonth(monthName);
  return MONTH_NAMES.indexOf(norm);
}

function getDaysInMonth(year, month) {
  const y = Number(year) || new Date().getFullYear();
  const mIndex = getMonthIndex(month);
  return new Date(y, mIndex + 1, 0).getDate();
}

function getMonthDateRange(year, month) {
  const y = Number(year) || new Date().getFullYear();
  const mIndex = getMonthIndex(month);
  const startDate = new Date(Date.UTC(y, mIndex, 1, 0, 0, 0, 0));
  const days = new Date(y, mIndex + 1, 0).getDate();
  const endDate = new Date(Date.UTC(y, mIndex, days, 23, 59, 59, 999));
  return { startDate, endDate, daysInMonth: days };
}

// Convert amount to Indian currency words
function numberToWords(num) {
  const value = Math.round(Number(num || 0));
  if (value <= 0) return 'Rupees Zero Only';

  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ',
    'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ',
    'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = ('000000000' + value).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return 'Rupees ' + value + ' Only';

  let str = '';
  str += n[1] != 0 ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += n[2] != 0 ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += n[3] != 0 ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += n[4] != 0 ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += n[5] != 0 ? ((str !== '' ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]])) : '';

  return ('Rupees ' + str.trim() + ' Only').replace(/\s+/g, ' ');
}

// Generate unique slip number with period and collision-resistant suffix
function generateSlipNumber(year, month) {
  const normMonth = normalizeMonth(month);
  const monthCode = normMonth.slice(0, 3).toUpperCase();
  const suffix = Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
  return `TM-SLIP-${year}${monthCode}-${suffix}`;
}

// =========================================================================
// 1. LEAVE AND LOSS OF PAY (LOP) INTEGRATION
// =========================================================================
async function getApprovedLeaveData({ employeeId, year, month }) {
  const normMonth = normalizeMonth(month);
  const { startDate, endDate } = getMonthDateRange(year, normMonth);

  const Leave = mongoose.models.Leave || require('../models/appModels/Leave');
  const LeaveBalance = mongoose.models.LeaveBalance || require('../models/appModels/LeaveBalance');

  // Query only officially approved leaves within date window
  const approvedLeaves = await Leave.find({
    employee: employeeId,
    removed: false,
    status: { $in: ['Approved', 'approved'] },
    fromDate: { $lte: endDate },
    toDate: { $gte: startDate },
  }).lean();

  let lopDays = 0;
  let approvedPaidDays = 0;
  const leaveDetails = [];

  for (const leave of approvedLeaves) {
    const lStart = new Date(leave.fromDate);
    const lEnd = new Date(leave.toDate);

    // Compute overlap with target calendar month
    const overlapStart = Math.max(lStart.getTime(), startDate.getTime());
    const overlapEnd = Math.min(lEnd.getTime(), endDate.getTime());

    let overlapDays = 0;
    if (overlapStart <= overlapEnd) {
      const msPerDay = 24 * 60 * 60 * 1000;
      const rawDays = Math.round((overlapEnd - overlapStart) / msPerDay) + 1;
      const totalLeaveDays = leave.daysCount || leave.numberOfDays || 1;
      // Clamp overlap to leave's own recorded duration
      overlapDays = Math.min(rawDays, totalLeaveDays);
    }

    const isUnpaid =
      leave.leaveType === 'Unpaid Leave' ||
      leave.leaveType === 'unpaid' ||
      leave.leaveType === 'Loss of Pay' ||
      leave.leaveType === 'LOP';

    if (isUnpaid) {
      lopDays += overlapDays;
    } else {
      approvedPaidDays += overlapDays;
    }

    leaveDetails.push({
      leaveId: leave._id,
      leaveType: leave.leaveType,
      fromDate: leave.fromDate,
      toDate: leave.toDate,
      overlapDays,
      isUnpaid,
    });
  }

  // Retrieve leave balance snapshot for employee for that calendar year
  let leaveBalanceSnapshot = null;
  try {
    const balanceDoc = await LeaveBalance.findOne({
      employee: employeeId,
      year: Number(year),
      removed: false,
    }).lean();
    if (balanceDoc && balanceDoc.balances) {
      leaveBalanceSnapshot = balanceDoc.balances;
    }
  } catch (err) {
    console.warn(`Leave balance fetch failed for employee ${employeeId}:`, err.message);
  }

  return {
    lopDays: Math.round(lopDays * 10) / 10,
    approvedPaidDays: Math.round(approvedPaidDays * 10) / 10,
    leaveDetails,
    leaveBalanceSnapshot,
  };
}

// =========================================================================
// 2. DECIMAL-SAFE SALARY BREAKDOWN ARITHMETIC
// =========================================================================
function calculateSalaryBreakdown({
  basic = 0,
  hra = 0,
  allowances = 0,
  incentives = 0,
  bonus = 0,
  deductions = 0,
  professionalTax = 0,
  tds = 0,
  otherDeductions = 0,
  workingDays = 30,
  lopDays = 0,
  customLopDeduction = null,
}) {
  const wDays = Number(workingDays) > 0 ? Number(workingDays) : 30;
  const lDays = Number(lopDays) >= 0 ? Number(lopDays) : 0;
  const pDays = Math.max(0, wDays - lDays);

  // Decimal safe arithmetic using currency.js
  const bVal = currency(basic || 0).value;
  const hVal = currency(hra || 0).value;
  const alVal = currency(allowances || 0).value;
  const incVal = currency(incentives || 0).value;
  const bnVal = currency(bonus || 0).value;

  const totalEarnings = currency(bVal)
    .add(hVal)
    .add(alVal)
    .add(incVal)
    .add(bnVal).value;

  // Loss of Pay Deduction: Daily Rate = Basic / workingDays
  let lopDeduction = 0;
  if (customLopDeduction !== null && customLopDeduction !== undefined) {
    lopDeduction = currency(customLopDeduction).value;
  } else if (lDays > 0 && wDays > 0) {
    const dailyRate = currency(bVal).divide(wDays).value;
    lopDeduction = currency(dailyRate).multiply(lDays).value;
  }

  const dVal = currency(deductions || 0).value;
  const ptVal = currency(professionalTax || 0).value;
  const tVal = currency(tds || 0).value;
  const odVal = currency(otherDeductions || 0).value;

  const totalDeductions = currency(dVal)
    .add(ptVal)
    .add(tVal)
    .add(odVal)
    .add(lopDeduction).value;

  const netSalary = Math.max(0, currency(totalEarnings).subtract(totalDeductions).value);
  const netSalaryWords = numberToWords(netSalary);

  return {
    workingDays: wDays,
    paidDays: pDays,
    lopDays: lDays,
    basic: bVal,
    basicSalary: bVal,
    hra: hVal,
    allowances: alVal,
    incentives: incVal,
    bonus: bnVal,
    totalEarnings,
    deductions: dVal,
    professionalTax: ptVal,
    tds: tVal,
    otherDeductions: odVal,
    lopDeduction,
    totalDeductions,
    netSalary,
    netSalaryWords,
    currency: 'INR',
  };
}

// =========================================================================
// 3. EMPLOYEE SALARY RESOLVER & CALCULATION ENGINE
// =========================================================================
async function calculateEmployeeSalary({
  employeeId,
  year,
  month,
  workingDays,
  manualOverrides = {},
  applyLopFromLeaves = true,
}) {
  const normMonth = normalizeMonth(month);
  const y = Number(year) || new Date().getFullYear();
  const wDays = workingDays !== undefined ? Number(workingDays) : getDaysInMonth(y, normMonth);

  const Employee = mongoose.models.Employee || require('../models/appModels/Employee');
  const Salary = mongoose.models.Salary || require('../models/appModels/Salary');

  const emp = await Employee.findOne({ _id: employeeId, removed: false });
  if (!emp) {
    throw new Error(`Employee with ID ${employeeId} not found.`);
  }

  // Resolve base profile:
  // 1. Employee.salaryStructure if configured with basic > 0
  // 2. Most recent finalized Salary record for this employee
  // 3. Safe fallback defaults
  let baseProfile = {
    basic: 45000,
    hra: 18000,
    allowances: 8000,
    incentives: 0,
    bonus: 0,
    deductions: 2400,
    professionalTax: 200,
    tds: 2500,
    otherDeductions: 0,
  };

  if (emp.salaryStructure && Number(emp.salaryStructure.basic) > 0) {
    baseProfile = {
      basic: Number(emp.salaryStructure.basic || 0),
      hra: Number(emp.salaryStructure.hra || 0),
      allowances: Number(emp.salaryStructure.allowances || 0),
      incentives: Number(emp.salaryStructure.incentives || 0),
      bonus: Number(emp.salaryStructure.bonus || 0),
      deductions: Number(emp.salaryStructure.deductions || 0),
      professionalTax: Number(emp.salaryStructure.professionalTax || 200),
      tds: Number(emp.salaryStructure.tds || 0),
      otherDeductions: Number(emp.salaryStructure.otherDeductions || 0),
    };
  } else {
    // Look up most recent historical salary
    const latestSalary = await Salary.findOne({ employee: emp._id, removed: false })
      .sort({ year: -1, created: -1 })
      .lean();

    if (latestSalary) {
      baseProfile = {
        basic: Number(latestSalary.basic || latestSalary.basicSalary || 0),
        hra: Number(latestSalary.hra || 0),
        allowances: Number(latestSalary.allowances || 0),
        incentives: Number(latestSalary.incentives || 0),
        bonus: 0, // bonus does not automatically repeat
        deductions: Number(latestSalary.deductions || 0),
        professionalTax: Number(latestSalary.professionalTax || 200),
        tds: Number(latestSalary.tds || 0),
        otherDeductions: 0, // transient deductions do not repeat
      };
    }
  }

  // Merge manual overrides
  const effectiveComponents = {
    basic: manualOverrides.basic !== undefined ? manualOverrides.basic : baseProfile.basic,
    hra: manualOverrides.hra !== undefined ? manualOverrides.hra : baseProfile.hra,
    allowances: manualOverrides.allowances !== undefined ? manualOverrides.allowances : baseProfile.allowances,
    incentives: manualOverrides.incentives !== undefined ? manualOverrides.incentives : baseProfile.incentives,
    bonus: manualOverrides.bonus !== undefined ? manualOverrides.bonus : baseProfile.bonus,
    deductions: manualOverrides.deductions !== undefined ? manualOverrides.deductions : baseProfile.deductions,
    professionalTax: manualOverrides.professionalTax !== undefined ? manualOverrides.professionalTax : baseProfile.professionalTax,
    tds: manualOverrides.tds !== undefined ? manualOverrides.tds : baseProfile.tds,
    otherDeductions: manualOverrides.otherDeductions !== undefined ? manualOverrides.otherDeductions : baseProfile.otherDeductions,
  };

  // Leave and LOP determination
  let lopDays = 0;
  let approvedPaidDays = 0;
  let leaveBalanceSnapshot = null;

  if (applyLopFromLeaves) {
    const leaveData = await getApprovedLeaveData({ employeeId: emp._id, year: y, month: normMonth });
    lopDays = manualOverrides.lopDays !== undefined ? Number(manualOverrides.lopDays) : leaveData.lopDays;
    approvedPaidDays = leaveData.approvedPaidDays;
    leaveBalanceSnapshot = leaveData.leaveBalanceSnapshot;
  } else if (manualOverrides.lopDays !== undefined) {
    lopDays = Number(manualOverrides.lopDays);
  }

  const breakdown = calculateSalaryBreakdown({
    ...effectiveComponents,
    workingDays: wDays,
    lopDays,
    customLopDeduction: manualOverrides.lopDeduction,
  });

  return {
    employee: emp,
    year: y,
    month: normMonth,
    periodLabel: `${normMonth} ${y}`,
    breakdown,
    approvedPaidDays,
    leaveBalanceSnapshot,
  };
}

// =========================================================================
// 4. BATCH PAYROLL EXECUTION (IDEMPOTENT & AUDITED)
// =========================================================================
async function processMonthlyBatch({
  year,
  month,
  workingDays,
  createdByUser,
  forceRecalculate = false,
  markPaid = true,
  paymentMode = 'Bank Transfer',
  ipAddress = '',
}) {
  const normMonth = normalizeMonth(month);
  const y = Number(year) || new Date().getFullYear();
  const wDays = workingDays !== undefined ? Number(workingDays) : getDaysInMonth(y, normMonth);

  const Employee = mongoose.models.Employee || require('../models/appModels/Employee');
  const Salary = mongoose.models.Salary || require('../models/appModels/Salary');
  const SalaryAudit = mongoose.models.SalaryAudit || require('../models/appModels/SalaryAudit');

  const activeEmployees = await Employee.find({
    status: 'Active',
    removed: false,
  }).sort({ employeeId: 1 });

  const summary = {
    period: `${normMonth} ${y}`,
    totalEligibleEmployees: activeEmployees.length,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    totalGrossDisbursed: 0,
    totalNetDisbursed: 0,
    details: [],
    errors: [],
  };

  let userId = createdByUser?._id;
  if (!userId) {
    const Admin = mongoose.models.Admin || require('../models/coreModels/Admin');
    const systemAdmin = await Admin.findOne({ role: 'ADMIN' });
    userId = systemAdmin ? systemAdmin._id : new mongoose.Types.ObjectId();
  }
  const userName = createdByUser ? `${createdByUser.name || ''} ${createdByUser.surname || ''}`.trim() || createdByUser.email : 'System Automation';
  const userRole = createdByUser?.role || 'ADMIN';

  for (const emp of activeEmployees) {
    try {
      // Check existing salary document for this employee and period
      const existing = await Salary.findOne({
        employee: emp._id,
        year: y,
        month: normMonth,
        removed: false,
      });

      if (existing) {
        if (forceRecalculate && existing.status !== 'Paid') {
          // Recalculate draft record
          const computed = await calculateEmployeeSalary({
            employeeId: emp._id,
            year: y,
            month: normMonth,
            workingDays: wDays,
            applyLopFromLeaves: true,
          });

          const previousNet = existing.netSalary;
          Object.assign(existing, computed.breakdown);
          existing.approvedLeaveDays = computed.approvedPaidDays;
          existing.leaveBalanceSnapshot = computed.leaveBalanceSnapshot;
          existing.updatedBy = userId;
          await existing.save();

          await new SalaryAudit({
            salary: existing._id,
            employee: emp._id,
            employeeName: `${emp.name} ${emp.surname || ''}`.trim(),
            periodLabel: `${normMonth} ${y}`,
            action: 'BATCH_RECALCULATED',
            performedBy: userId,
            performedByName: userName,
            performedByRole: userRole,
            details: `Batch recalculated salary for ${normMonth} ${y}. Net changed from ₹${previousNet} to ₹${existing.netSalary}`,
            ipAddress,
          }).save();

          summary.updatedCount++;
          summary.totalGrossDisbursed = currency(summary.totalGrossDisbursed).add(existing.totalEarnings).value;
          summary.totalNetDisbursed = currency(summary.totalNetDisbursed).add(existing.netSalary).value;
          summary.details.push({
            employeeId: emp.employeeId,
            name: `${emp.name} ${emp.surname || ''}`.trim(),
            status: 'UPDATED',
            slipNumber: existing.slipNumber,
            netSalary: existing.netSalary,
          });
        } else {
          // Idempotency: skip already finalized records
          summary.skippedCount++;
          summary.details.push({
            employeeId: emp.employeeId,
            name: `${emp.name} ${emp.surname || ''}`.trim(),
            status: 'SKIPPED',
            reason: `Existing record #${existing.slipNumber} (${existing.status})`,
            slipNumber: existing.slipNumber,
            netSalary: existing.netSalary,
          });
        }
        continue;
      }

      // Compute fresh salary record
      const computed = await calculateEmployeeSalary({
        employeeId: emp._id,
        year: y,
        month: normMonth,
        workingDays: wDays,
        applyLopFromLeaves: true,
      });

      const slipNumber = generateSlipNumber(y, normMonth);
      const newSalary = new Salary({
        employee: emp._id,
        user: emp.user || userId,
        month: normMonth,
        year: y,
        periodLabel: `${normMonth} ${y}`,
        workingDays: computed.breakdown.workingDays,
        paidDays: computed.breakdown.paidDays,
        lopDays: computed.breakdown.lopDays,

        // Earnings
        basic: computed.breakdown.basic,
        basicSalary: computed.breakdown.basicSalary,
        hra: computed.breakdown.hra,
        allowances: computed.breakdown.allowances,
        incentives: computed.breakdown.incentives,
        bonus: computed.breakdown.bonus,
        totalEarnings: computed.breakdown.totalEarnings,

        // Deductions
        deductions: computed.breakdown.deductions,
        professionalTax: computed.breakdown.professionalTax,
        tds: computed.breakdown.tds,
        otherDeductions: computed.breakdown.otherDeductions,
        lopDeduction: computed.breakdown.lopDeduction,
        totalDeductions: computed.breakdown.totalDeductions,

        // Net
        netSalary: computed.breakdown.netSalary,
        netSalaryWords: computed.breakdown.netSalaryWords,
        currency: 'INR',

        // Profile Snapshot
        employeeCode: emp.employeeId || '',
        employeeName: `${emp.name || ''} ${emp.surname || ''}`.trim(),
        designation: emp.designationName || '',
        department: emp.departmentName || '',
        joiningDate: emp.joiningDate,
        panNumber: emp.panNumber || '',
        uanNumber: emp.uanNumber || '',
        bankDetails: {
          bankName: emp.bankDetails?.bankName || '',
          accountNumber: emp.bankDetails?.accountNumber || '',
          ifscCode: emp.bankDetails?.routingOrIfsc || '',
          branch: emp.bankDetails?.branch || '',
        },

        // Leave details
        approvedLeaveDays: computed.approvedPaidDays,
        leaveBalanceSnapshot: computed.leaveBalanceSnapshot,

        // Status & Payment
        status: markPaid ? 'Paid' : 'Draft',
        paymentMode: paymentMode || 'Bank Transfer',
        paymentDate: new Date(),
        transactionReference: `BATCH-${y}${normMonth.slice(0, 3).toUpperCase()}-${emp.employeeId}`,

        // Slip metadata
        slipNumber,
        slipGenerated: true,
        slipGeneratedAt: new Date(),
        createdBy: userId,
        updatedBy: userId,
      });

      await newSalary.save();

      // Audit Log Entry
      await new SalaryAudit({
        salary: newSalary._id,
        employee: emp._id,
        employeeName: `${emp.name} ${emp.surname || ''}`.trim(),
        periodLabel: `${normMonth} ${y}`,
        action: 'BATCH_GENERATED',
        performedBy: userId,
        performedByName: userName,
        performedByRole: userRole,
        details: `Batch processed salary for ${normMonth} ${y} (Slip #${slipNumber}) - Net: ₹${newSalary.netSalary}`,
        newValues: {
          netSalary: newSalary.netSalary,
          totalEarnings: newSalary.totalEarnings,
          totalDeductions: newSalary.totalDeductions,
          lopDays: newSalary.lopDays,
          lopDeduction: newSalary.lopDeduction,
        },
        ipAddress,
      }).save();

      summary.createdCount++;
      summary.totalGrossDisbursed = currency(summary.totalGrossDisbursed).add(newSalary.totalEarnings).value;
      summary.totalNetDisbursed = currency(summary.totalNetDisbursed).add(newSalary.netSalary).value;
      summary.details.push({
        employeeId: emp.employeeId,
        name: `${emp.name} ${emp.surname || ''}`.trim(),
        status: 'CREATED',
        slipNumber,
        netSalary: newSalary.netSalary,
      });
    } catch (err) {
      console.error(`Batch payroll error for employee ${emp.employeeId}:`, err);
      summary.errorCount++;
      summary.errors.push({
        employeeId: emp.employeeId,
        name: `${emp.name} ${emp.surname || ''}`.trim(),
        error: err.message,
      });
    }
  }

  return summary;
}

module.exports = {
  normalizeMonth,
  getMonthIndex,
  getDaysInMonth,
  getMonthDateRange,
  numberToWords,
  generateSlipNumber,
  getApprovedLeaveData,
  calculateSalaryBreakdown,
  calculateEmployeeSalary,
  processMonthlyBatch,
};


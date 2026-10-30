const mongoose = require('mongoose');
const pdf = require('html-pdf');
const payrollService = require('../../../services/payrollService');

let ROLES, normalizeRole;
try {
  ({ ROLES, normalizeRole } = require('../../../rbac/roles'));
} catch (e) {
  ({ ROLES, normalizeRole } = require('../../../rbac/roles'));
}

// Convert amount to Indian currency words
function numberToWords(num) {
  if (!num || isNaN(num)) return 'Rupees Zero Only';
  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ',
    'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ',
    'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = ('000000000' + Math.floor(num)).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return 'Rupees ' + num + ' Only';

  let str = '';
  str += n[1] != 0 ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += n[2] != 0 ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += n[3] != 0 ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += n[4] != 0 ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += n[5] != 0 ? ((str != '' ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]])) : '';

  return ('Rupees ' + str.trim() + ' Only').replace(/\s+/g, ' ');
}

// Format currency
function formatCurrency(amount) {
  const val = Number(amount || 0);
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// =========================================================================
// 1. LIST SALARY RECORDS (WITH STRICT ROLE-BASED SCOPING)
// =========================================================================
const list = async (req, res) => {
  try {
    const user = req.user;
    const role = normalizeRole(user.role);

    const Salary = mongoose.models.Salary || require('../../../models/appModels/Salary');
    const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');

    let filter = { removed: false };

    // Employee role: ONLY own salary information
    if (role === 'EMPLOYEE') {
      let emp = await Employee.findOne({ user: user._id, removed: false });
      if (!emp && user.email) {
        emp = await Employee.findOne({ email: user.email.toLowerCase(), removed: false });
      }
      if (!emp) {
        return res.status(200).json({
          success: true,
          result: [],
          summary: { totalRecords: 0, totalNetSalary: 0 },
          message: 'No employee record associated with this account.',
        });
      }
      filter.employee = emp._id;
    } else {
      // HR / Management / Finance filter options
      if (req.query.employee) {
        filter.employee = req.query.employee;
      }
      if (req.query.year) {
        filter.year = Number(req.query.year);
      }
      if (req.query.month) {
        filter.month = req.query.month;
      }
      if (req.query.status) {
        filter.status = new RegExp(req.query.status, 'i');
      }
      if (req.query.department) {
        filter.department = req.query.department;
      }
    }

    const items = await Salary.find(filter)
      .populate('employee', 'name surname employeeId departmentName designationName email bankDetails')
      .sort({ year: -1, created: -1 })
      .lean();

    // Summary calculations
    let totalPayroll = 0;
    let totalBasic = 0;
    let totalHra = 0;
    let totalAllowances = 0;
    let totalDeductions = 0;
    let paidCount = 0;
    let pendingCount = 0;

    items.forEach((item) => {
      totalPayroll += Number(item.netSalary || 0);
      totalBasic += Number(item.basic || item.basicSalary || 0);
      totalHra += Number(item.hra || 0);
      totalAllowances += Number(item.allowances || 0);
      totalDeductions += Number(item.totalDeductions || item.deductions || 0);
      if (String(item.status).toLowerCase() === 'paid') paidCount++;
      else pendingCount++;
    });

    return res.status(200).json({
      success: true,
      result: items,
      summary: {
        totalRecords: items.length,
        totalPayroll,
        totalBasic,
        totalHra,
        totalAllowances,
        totalDeductions,
        paidCount,
        pendingCount,
      },
      message: 'Salary records retrieved successfully.',
    });
  } catch (error) {
    console.error('Salary list error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 2. READ SINGLE SALARY RECORD (STRICT RBAC OWNERSHIP)
// =========================================================================
const read = async (req, res) => {
  try {
    const user = req.user;
    const role = normalizeRole(user.role);

    const Salary = mongoose.models.Salary || require('../../../models/appModels/Salary');
    const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');

    const item = await Salary.findOne({ _id: req.params.id, removed: false })
      .populate('employee')
      .populate('createdBy', 'name surname email')
      .lean();

    if (!item) {
      return res.status(404).json({ success: false, message: 'Salary record not found.' });
    }

    // Normal employee check: only own record
    if (role === 'EMPLOYEE') {
      let emp = await Employee.findOne({ user: user._id, removed: false });
      if (!emp && user.email) {
        emp = await Employee.findOne({ email: user.email.toLowerCase(), removed: false });
      }
      const empIdStr = emp ? emp._id.toString() : '';
      const recEmpIdStr = item.employee ? (item.employee._id || item.employee).toString() : '';

      if (!empIdStr || empIdStr !== recEmpIdStr) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You cannot view salary details of other employees.',
        });
      }
    }

    return res.status(200).json({ success: true, result: item });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 3. CREATE SALARY RECORD (HR / MANAGEMENT / FINANCE ONLY)
// =========================================================================
const create = async (req, res) => {
  try {
    const user = req.user;
    const role = normalizeRole(user.role);

    const authorizedRoles = [ROLES.ADMIN, ROLES.HR];
    if (!authorizedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only HR and Admin can create salary records.',
      });
    }

    const Salary = mongoose.models.Salary || require('../../../models/appModels/Salary');
    const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');
    const SalaryAudit = mongoose.models.SalaryAudit || require('../../../models/appModels/SalaryAudit');

    const {
      employee: employeeId,
      month,
      year,
      workingDays,
      paidDays,
      lopDays,
      basic,
      hra,
      allowances,
      incentives,
      bonus,
      deductions,
      professionalTax,
      tds,
      otherDeductions,
      paymentMode,
      paymentDate,
      transactionReference,
      status,
      notes,
    } = req.body;

    if (!employeeId || !month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Employee, month, and year are required.',
      });
    }

    const emp = await Employee.findOne({ _id: employeeId, removed: false });
    if (!emp) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    // Check for duplicate salary for same employee & period
    const existing = await Salary.findOne({
      employee: employeeId,
      month: String(month),
      year: Number(year),
      removed: false,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Salary record already exists for ${emp.name} for ${month} ${year}.`,
      });
    }

    // Compute Earnings
    const b = Number(basic || 0);
    const h = Number(hra || 0);
    const al = Number(allowances || 0);
    const inc = Number(incentives || 0);
    const bn = Number(bonus || 0);
    const totalEarnings = b + h + al + inc + bn;

    // Compute Deductions
    const d = Number(deductions || 0);
    const pt = Number(professionalTax || 0);
    const t = Number(tds || 0);
    const od = Number(otherDeductions || 0);
    const totalDeductions = d + pt + t + od;

    const netSalary = Math.max(0, totalEarnings - totalDeductions);
    const netSalaryWords = numberToWords(netSalary);

    // Generate unique slip number (timestamp-based suffix avoids
    // collisions against the unique slipNumber index)
    const slipSuffix = Date.now().toString(36).toUpperCase();
    const slipNumber = `TM-SLIP-${year}${String(month).slice(0, 3).toUpperCase()}-${slipSuffix}`;

    const newSalary = new Salary({
      employee: emp._id,
      user: emp.user || user._id,
      month: String(month),
      year: Number(year),
      periodLabel: `${month} ${year}`,
      workingDays: workingDays !== undefined ? Number(workingDays) : 30,
      paidDays: paidDays !== undefined ? Number(paidDays) : 30,
      lopDays: lopDays !== undefined ? Number(lopDays) : 0,

      // Earnings
      basic: b,
      basicSalary: b,
      hra: h,
      allowances: al,
      incentives: inc,
      bonus: bn,
      totalEarnings,

      // Deductions
      deductions: d,
      professionalTax: pt,
      tds: t,
      otherDeductions: od,
      totalDeductions,

      // Net
      netSalary,
      netSalaryWords,
      currency: 'INR',

      // Profile snapshot
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

      // Payment
      status: status || 'Paid',
      paymentMode: paymentMode || 'Bank Transfer',
      paymentDate: paymentDate || new Date(),
      transactionReference: transactionReference || `UTR-${Date.now()}`,

      slipNumber,
      slipGenerated: true,
      slipGeneratedAt: new Date(),
      notes: notes || '',
      createdBy: user._id,
      updatedBy: user._id,
    });

    await newSalary.save();

    // Audit Log
    await new SalaryAudit({
      salary: newSalary._id,
      employee: emp._id,
      employeeName: `${emp.name} ${emp.surname || ''}`.trim(),
      periodLabel: `${month} ${year}`,
      action: 'CREATED',
      performedBy: user._id,
      performedByName: `${user.name || ''} ${user.surname || ''}`.trim() || user.email,
      performedByRole: role,
      details: `Created salary record for ${month} ${year} with Net Salary ₹${netSalary.toLocaleString()}`,
      newValues: { netSalary, totalEarnings, totalDeductions, status: newSalary.status },
      ipAddress: req.ip || '',
    }).save();

    return res.status(201).json({
      success: true,
      result: newSalary,
      message: 'Salary record created and slip generated successfully.',
    });
  } catch (error) {
    console.error('Salary create error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 4. UPDATE SALARY RECORD & AUDIT CHANGES
// =========================================================================
const update = async (req, res) => {
  try {
    const user = req.user;
    const role = normalizeRole(user.role);

    const authorizedRoles = [ROLES.ADMIN, ROLES.HR];
    if (!authorizedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Employees cannot modify salary records.',
      });
    }

    const Salary = mongoose.models.Salary || require('../../../models/appModels/Salary');
    const SalaryAudit = mongoose.models.SalaryAudit || require('../../../models/appModels/SalaryAudit');

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid salary id.' });
    }

    const salary = await Salary.findOne({ _id: req.params.id, removed: false });
    if (!salary) {
      return res.status(404).json({ success: false, message: 'Salary record not found.' });
    }

    const previousValues = {
      basic: salary.basic,
      hra: salary.hra,
      allowances: salary.allowances,
      incentives: salary.incentives,
      bonus: salary.bonus,
      deductions: salary.deductions,
      professionalTax: salary.professionalTax,
      tds: salary.tds,
      otherDeductions: salary.otherDeductions,
      netSalary: salary.netSalary,
      status: salary.status,
    };

    const updates = req.body;
    const fields = [
      'basic', 'hra', 'allowances', 'incentives', 'bonus',
      'deductions', 'professionalTax', 'tds', 'otherDeductions',
      'status', 'paymentMode', 'paymentDate', 'transactionReference',
      'workingDays', 'paidDays', 'lopDays', 'notes'
    ];

    fields.forEach((f) => {
      if (updates[f] !== undefined) {
        salary[f] = updates[f];
      }
    });

    // Recompute Net Salary
    const b = Number(salary.basic || 0);
    const h = Number(salary.hra || 0);
    const al = Number(salary.allowances || 0);
    const inc = Number(salary.incentives || 0);
    const bn = Number(salary.bonus || 0);
    salary.totalEarnings = b + h + al + inc + bn;
    salary.basicSalary = b;

    const d = Number(salary.deductions || 0);
    const pt = Number(salary.professionalTax || 0);
    const t = Number(salary.tds || 0);
    const od = Number(salary.otherDeductions || 0);
    salary.totalDeductions = d + pt + t + od;

    salary.netSalary = Math.max(0, salary.totalEarnings - salary.totalDeductions);
    salary.netSalaryWords = numberToWords(salary.netSalary);
    salary.updatedBy = user._id;

    await salary.save();

    // Audit Log
    await new SalaryAudit({
      salary: salary._id,
      employee: salary.employee,
      employeeName: salary.employeeName,
      periodLabel: salary.periodLabel,
      action: 'UPDATED',
      performedBy: user._id,
      performedByName: `${user.name || ''} ${user.surname || ''}`.trim() || user.email,
      performedByRole: role,
      details: `Updated salary breakdown. Net Salary adjusted to ₹${salary.netSalary.toLocaleString()}`,
      previousValues,
      newValues: {
        basic: salary.basic,
        netSalary: salary.netSalary,
        status: salary.status,
      },
      ipAddress: req.ip || '',
    }).save();

    return res.status(200).json({
      success: true,
      result: salary,
      message: 'Salary record updated successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 5. GENERATE SALARY SLIP METADATA
// =========================================================================
const generateSlip = async (req, res) => {
  try {
    const user = req.user;
    const role = normalizeRole(user.role);

    const authorizedRoles = [ROLES.ADMIN, ROLES.HR];
    if (!authorizedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only HR and Admin can generate salary slips.',
      });
    }

    const Salary = mongoose.models.Salary || require('../../../models/appModels/Salary');
    const SalaryAudit = mongoose.models.SalaryAudit || require('../../../models/appModels/SalaryAudit');

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid salary id.' });
    }

    const salary = await Salary.findOne({ _id: req.params.id, removed: false });
    if (!salary) {
      return res.status(404).json({ success: false, message: 'Salary record not found.' });
    }

    if (!salary.slipNumber) {
      const slipSuffix = Date.now().toString(36).toUpperCase();
      salary.slipNumber = `TM-SLIP-${salary.year}${String(salary.month).slice(0, 3).toUpperCase()}-${slipSuffix}`;
    }

    salary.slipGenerated = true;
    salary.slipGeneratedAt = new Date();
    await salary.save();

    await new SalaryAudit({
      salary: salary._id,
      employee: salary.employee,
      employeeName: salary.employeeName,
      periodLabel: salary.periodLabel,
      action: 'SLIP_GENERATED',
      performedBy: user._id,
      performedByName: `${user.name || ''} ${user.surname || ''}`.trim() || user.email,
      performedByRole: role,
      details: `Official Salary Slip generated (#${salary.slipNumber})`,
      ipAddress: req.ip || '',
    }).save();

    return res.status(200).json({
      success: true,
      result: salary,
      message: 'Salary slip generated successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 6. GENERATE & DOWNLOAD PDF SALARY SLIP (STRICT RBAC + TECMOTIV TEMPLATE)
// =========================================================================
const downloadSlipPdf = async (req, res) => {
  try {
    const user = req.user;
    const role = normalizeRole(user.role);

    const Salary = mongoose.models.Salary || require('../../../models/appModels/Salary');
    const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');
    const SalaryAudit = mongoose.models.SalaryAudit || require('../../../models/appModels/SalaryAudit');

    const salary = await Salary.findOne({ _id: req.params.id, removed: false })
      .populate('employee')
      .lean();

    if (!salary) {
      return res.status(404).json({ success: false, message: 'Salary record not found.' });
    }

    // Normal employee check: must be their OWN salary slip
    if (role === 'EMPLOYEE') {
      let emp = await Employee.findOne({ user: user._id, removed: false });
      if (!emp && user.email) {
        emp = await Employee.findOne({ email: user.email.toLowerCase(), removed: false });
      }
      const empIdStr = emp ? emp._id.toString() : '';
      const recEmpIdStr = salary.employee ? (salary.employee._id || salary.employee).toString() : '';

      if (!empIdStr || empIdStr !== recEmpIdStr) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only download your own salary slip.',
        });
      }
    }

    // Prepare Payslip Data
    const empName = salary.employeeName || (salary.employee ? `${salary.employee.name || ''} ${salary.employee.surname || ''}`.trim() : 'Employee');
    const empCode = salary.employeeCode || salary.employee?.employeeId || 'EMP-000';
    const dept = salary.department || salary.employee?.departmentName || 'Engineering';
    const desig = salary.designation || salary.employee?.designationName || 'Specialist';
    const location = salary.workLocationName || salary.workLocation || salary.employee?.workLocationName || salary.employee?.workLocation?.name || 'Pune, India';

    let doj = 'N/A';
    const rawDoj = salary.joiningDate || salary.employee?.joiningDate;
    if (rawDoj) {
      const d = new Date(rawDoj);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const y = d.getFullYear();
        doj = `${day}/${m}/${y}`;
      }
    }

    const workingDays = salary.workingDays !== undefined ? salary.workingDays : 30;
    const paidDays = salary.paidDays !== undefined ? salary.paidDays : 30;
    const leaveCount = salary.approvedLeaveDays ?? salary.leaveCount ?? salary.leaveDays ?? 0;
    const leaveDetails = salary.leaveDetails || (salary.lopDays > 0 ? `${salary.lopDays} Days LOP` : (leaveCount > 0 ? `${leaveCount} Days Approved` : 'NIL'));
    const lopDays = salary.lopDays !== undefined ? salary.lopDays : 0;
    const leaveBalance = salary.leaveBalanceSnapshot?.totalBalance ?? salary.leaveBalance ?? 'NIL';

    const basic = salary.basic || salary.basicSalary || 0;
    const hra = salary.hra || 0;
    const specialAllowance = salary.specialAllowance !== undefined ? salary.specialAllowance : (salary.allowances || 0);
    const otherAllowances = salary.otherAllowances !== undefined ? salary.otherAllowances : ((salary.incentives || 0) + (salary.bonus || 0));
    const totalEarnings = salary.totalEarnings !== undefined ? salary.totalEarnings : (basic + hra + specialAllowance + otherAllowances);

    const pt = salary.professionalTax || 0;
    const pf = salary.deductions || salary.pf || 0;
    const tds = salary.tds || 0;
    const lopDed = (salary.lopDeduction || 0) + (salary.otherDeductions || 0);
    const totalDeductions = salary.totalDeductions !== undefined ? salary.totalDeductions : (pt + pf + tds + lopDed);

    const netSalary = salary.netSalary !== undefined ? salary.netSalary : (totalEarnings - totalDeductions);
    const rawWords = salary.netSalaryWords || numberToWords(netSalary);
    const netWords = rawWords.replace(/^Rupees\s+/i, '').replace(/\s+Only$/i, '').trim();

    const monthYearLabel = `[${salary.month} ${salary.year}]`;
    const slipNo = salary.slipNumber || `TM-SLIP-${salary.year}-${salary.month}`;
    const payDate = salary.paymentDate ? new Date(salary.paymentDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
    const paymentMode = salary.paymentMode || 'Bank Transfer';
    const refNo = salary.transactionReference || 'UTR-TM-202610-0981';
    const status = salary.status || 'PAID';

    // Base64 Logo extraction
    const fs = require('fs');
    const path = require('path');
    let logoDataUri = '';
    try {
      const p1 = path.join(__dirname, '../../../../frontend/src/style/images/logo-icon.png');
      if (fs.existsSync(p1)) {
        logoDataUri = `data:image/png;base64,${fs.readFileSync(p1).toString('base64')}`;
      } else {
        const p2 = path.join(__dirname, '../../../public/uploads/setting/company-logo.png');
        if (fs.existsSync(p2)) {
          logoDataUri = `data:image/png;base64,${fs.readFileSync(p2).toString('base64')}`;
        }
      }
    } catch (e) {
      // quiet fallback
    }

    // Build Pure HTML Payslip
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 16px 20px;
          font-size: 11.5px;
          line-height: 1.4;
          background: #ffffff;
        }
        .header-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
        }
        .brand-icon {
          height: 44px;
          width: auto;
          vertical-align: middle;
        }
        .company-name {
          font-size: 24px;
          font-weight: 800;
          color: #1e293b;
          letter-spacing: -0.5px;
          line-height: 1.1;
          margin: 0;
        }
        .company-sub {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          line-height: 1.2;
          margin: 2px 0 0 0;
        }
        .slip-subtitle {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .slip-month {
          font-size: 24px;
          font-weight: 800;
          color: #006884;
          margin: 0;
          line-height: 1.1;
        }
        .address-banner {
          background: #006884;
          padding: 8px 14px;
          border-radius: 2px;
          margin-bottom: 20px;
          color: #ffffff;
        }
        .address-table {
          width: 100%;
          border-collapse: collapse;
        }
        .address-text {
          color: #ffffff;
          font-size: 10px;
          font-weight: 500;
          line-height: 1.35;
          text-align: left;
          vertical-align: middle;
        }
        .cin-text {
          color: #ffffff;
          font-size: 10.5px;
          font-weight: 600;
          text-align: right;
          vertical-align: middle;
          white-space: nowrap;
          padding-left: 12px;
        }
        .section-header {
          color: #006884;
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          border-bottom: 1.5px solid #006884;
          padding-bottom: 6px;
          margin-bottom: 8px;
        }
        .info-table {
          width: 100%;
          border-collapse: collapse;
        }
        .info-table td {
          padding: 5px 2px;
          font-size: 11.5px;
          border-bottom: 1px solid #f1f5f9;
        }
        .info-label {
          color: #64748b;
          font-weight: 500;
          text-align: left;
        }
        .info-val {
          color: #0f172a;
          font-weight: 700;
          text-align: right;
        }
        .table-box {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #e2e8f0;
        }
        .th-teal {
          background: #006884;
          color: #ffffff;
          font-size: 12.5px;
          font-weight: 700;
          padding: 8px 14px;
          text-align: left;
          letter-spacing: 0.3px;
        }
        .table-box td {
          padding: 7px 14px;
          font-size: 11.5px;
          border-bottom: 1px solid #f1f5f9;
        }
        .item-label {
          color: #334155;
          font-weight: 500;
          text-align: left;
        }
        .item-amount {
          color: #0f172a;
          font-weight: 600;
          text-align: right;
          white-space: nowrap;
        }
        .total-row td {
          background: #f1f5f9;
          border-top: 1px solid #e2e8f0;
          border-bottom: none;
          padding: 9px 14px;
        }
        .total-label {
          color: #0f172a;
          font-weight: 700;
          font-size: 12px;
          text-align: left;
        }
        .total-amount {
          color: #0f172a;
          font-weight: 700;
          font-size: 12px;
          text-align: right;
          white-space: nowrap;
        }
        .net-box {
          background: #f0f4f8;
          border-radius: 4px;
          padding: 16px 20px;
          margin-top: 16px;
          margin-bottom: 16px;
        }
        .net-table {
          width: 100%;
          border-collapse: collapse;
        }
        .net-title {
          color: #475569;
          font-size: 12px;
          font-weight: 600;
        }
        .net-words {
          color: #64748b;
          font-size: 11.5px;
          font-weight: 500;
          margin-top: 4px;
        }
        .net-amount {
          color: #0f172a;
          font-size: 26px;
          font-weight: 800;
          text-align: right;
          letter-spacing: -0.5px;
          white-space: nowrap;
        }
        .payment-bar {
          background: #fafafa;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 7px 12px;
          margin-bottom: 12px;
          font-size: 10.5px;
          color: #475569;
        }
        .note {
          text-align: center;
          font-size: 9.5px;
          color: #94a3b8;
          margin-top: 16px;
          padding-top: 6px;
        }
      </style>
    </head>
    <body>
      <!-- Header with Exact Requested Branding -->
      <table class="header-table">
        <tr>
          <td style="vertical-align: middle;">
            <table style="border-collapse: collapse;">
              <tr>
                ${logoDataUri ? `<td style="vertical-align: middle; padding-right: 12px;"><img src="${logoDataUri}" class="brand-icon" alt="Tecmotiv" /></td>` : ''}
                <td style="vertical-align: middle;">
                  <div class="company-name">Tecmotiv</div>
                  <div class="company-sub">Solutions Pvt Ltd</div>
                </td>
              </tr>
            </table>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <div class="slip-subtitle">SALARY SLIP</div>
            <div class="slip-month">${monthYearLabel}</div>
          </td>
        </tr>
      </table>

      <!-- Solid Teal Address & CIN Banner -->
      <div class="address-banner">
        <table class="address-table">
          <tr>
            <td class="address-text">
              <strong>Office Address:</strong> Level-5, Vatika Business Centre Block C, Tech Park One, Loop Rd, Shastrinagar, Yerawada, Pune 411 006, India
            </td>
            <td class="cin-text">
              CIN: U74909PN2023PTC222092
            </td>
          </tr>
        </table>
      </div>

      <!-- 2-Column Section: Employee Details & Attendance / Leave -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <!-- Left Column: EMPLOYEE DETAILS -->
          <td style="width: 48%; vertical-align: top; padding-right: 12px;">
            <div class="section-header">EMPLOYEE DETAILS</div>
            <table class="info-table">
              <tr>
                <td class="info-label" style="width: 44%;">Employee Name</td>
                <td class="info-val" style="width: 56%;">[${empName}]</td>
              </tr>
              <tr>
                <td class="info-label">Employee ID</td>
                <td class="info-val">[${empCode}]</td>
              </tr>
              <tr>
                <td class="info-label">Department</td>
                <td class="info-val">[${dept}]</td>
              </tr>
              <tr>
                <td class="info-label">Designation</td>
                <td class="info-val">[${desig}]</td>
              </tr>
              <tr>
                <td class="info-label">Location</td>
                <td class="info-val">[${location}]</td>
              </tr>
              <tr>
                <td class="info-label">Date of Joining</td>
                <td class="info-val">[${doj}]</td>
              </tr>
            </table>
          </td>

          <!-- Spacer -->
          <td style="width: 4%;">&nbsp;</td>

          <!-- Right Column: ATTENDANCE & LEAVE -->
          <td style="width: 48%; vertical-align: top; padding-left: 12px;">
            <div class="section-header">ATTENDANCE & LEAVE</div>
            <table class="info-table">
              <tr>
                <td class="info-label" style="width: 56%;">Total Working Days</td>
                <td class="info-val" style="width: 44%;">[${String(workingDays).padStart(2, '0')}]</td>
              </tr>
              <tr>
                <td class="info-label">Days Paid</td>
                <td class="info-val">[${String(paidDays).padStart(2, '0')}]</td>
              </tr>
              <tr>
                <td class="info-label">Number of Leaves</td>
                <td class="info-val">[${String(leaveCount).padStart(2, '0')}]</td>
              </tr>
              <tr>
                <td class="info-label">Leave Details (if any)</td>
                <td class="info-val">[${leaveDetails}]</td>
              </tr>
              <tr>
                <td class="info-label">Loss of Pay Days</td>
                <td class="info-val">[${String(lopDays).padStart(2, '0')}]</td>
              </tr>
              <tr>
                <td class="info-label">Leave Balance</td>
                <td class="info-val">[${String(leaveBalance).padStart(2, '0')}]</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Side-by-Side Tables: Earnings & Deductions -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr>
          <!-- Earnings Table -->
          <td style="width: 48%; vertical-align: top; padding-right: 10px;">
            <table class="table-box">
              <thead>
                <tr>
                  <th colspan="2" class="th-teal">Earnings</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="item-label">Basic Salary</td>
                  <td class="item-amount">${formatCurrency(basic)}</td>
                </tr>
                <tr>
                  <td class="item-label">House Rent Allowance</td>
                  <td class="item-amount">${formatCurrency(hra)}</td>
                </tr>
                <tr>
                  <td class="item-label">Special Allowance</td>
                  <td class="item-amount">${formatCurrency(specialAllowance)}</td>
                </tr>
                <tr>
                  <td class="item-label">Other Allowances</td>
                  <td class="item-amount">${formatCurrency(otherAllowances)}</td>
                </tr>
                <tr class="total-row">
                  <td class="total-label">Total Earnings</td>
                  <td class="total-amount">${formatCurrency(totalEarnings)}</td>
                </tr>
              </tbody>
            </table>
          </td>

          <!-- Spacer -->
          <td style="width: 4%;">&nbsp;</td>

          <!-- Deductions Table -->
          <td style="width: 48%; vertical-align: top; padding-left: 10px;">
            <table class="table-box">
              <thead>
                <tr>
                  <th colspan="2" class="th-teal">Deductions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="item-label">Professional Tax</td>
                  <td class="item-amount">${formatCurrency(pt)}</td>
                </tr>
                <tr>
                  <td class="item-label">Provident Fund</td>
                  <td class="item-amount">${formatCurrency(pf)}</td>
                </tr>
                <tr>
                  <td class="item-label">Income Tax (TDS)</td>
                  <td class="item-amount">${formatCurrency(tds)}</td>
                </tr>
                <tr>
                  <td class="item-label">Leave Deduction (LOP)</td>
                  <td class="item-amount" style="${lopDed > 0 ? 'color: #cf1322;' : ''}">${formatCurrency(lopDed)}</td>
                </tr>
                <tr class="total-row">
                  <td class="total-label">Total Deductions</td>
                  <td class="total-amount">${formatCurrency(totalDeductions)}</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </table>

      <!-- Prominent Net Pay Card (Soft Ice-Blue Background) -->
      <div class="net-box">
        <table class="net-table">
          <tr>
            <td style="text-align: left; vertical-align: middle;">
              <div class="net-title">Net Pay (Earnings - Deductions)</div>
              <div class="net-words">In words: [${netWords}] only</div>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <div class="net-amount">${formatCurrency(netSalary)}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Payment & Disbursement Information -->
      <div class="payment-bar">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td><strong>Payment Mode:</strong> ${paymentMode}</td>
            <td><strong>Status:</strong> <span style="color: #0d9488; font-weight: 700;">${status}</span></td>
            <td><strong>Disbursed On:</strong> ${payDate}</td>
            <td><strong>UTR / Ref:</strong> ${refNo}</td>
          </tr>
        </table>
      </div>

      <!-- Computer-Generated Legal Disclaimer -->
      <div class="note">
        This is a computer-generated salary slip from Tecmotiv ERP. No physical signature is required. For inquiries, please contact payroll@tecmotiv.com.
      </div>
    </body>
    </html>
    `;

    // Audit PDF generation
    await new SalaryAudit({
      salary: salary._id,
      employee: salary.employee?._id || salary.employee,
      employeeName: empName,
      periodLabel: salary.periodLabel,
      action: 'SLIP_DOWNLOADED',
      performedBy: user._id,
      performedByName: `${user.name || ''} ${user.surname || ''}`.trim() || user.email,
      performedByRole: role,
      details: `Downloaded PDF salary slip for ${salary.month} ${salary.year}`,
      ipAddress: req.ip || '',
    }).save();

    // Stream PDF with html-pdf
    pdf.create(html, {
      format: 'A4',
      orientation: 'portrait',
      border: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
    }).toStream((err, stream) => {
      if (err) {
        console.error('PDF generation error:', err);
        return res.status(500).json({ success: false, message: 'Failed to generate PDF salary slip.' });
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Tecmotiv-SalarySlip-${slipNo}.pdf"`);
      stream.pipe(res);
    });
  } catch (error) {
    console.error('Slip PDF error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 7. AUDIT TRAIL LOGS
// =========================================================================
const audit = async (req, res) => {
  try {
    const user = req.user;
    const role = normalizeRole(user.role);

    const authorizedRoles = [ROLES.ADMIN, ROLES.HR];
    if (!authorizedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Employees cannot view salary audit history.',
      });
    }

    const SalaryAudit = mongoose.models.SalaryAudit || require('../../../models/appModels/SalaryAudit');

    const filter = {};
    if (req.params.id) {
      filter.salary = req.params.id;
    }

    const logs = await SalaryAudit.find(filter)
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      result: logs,
      message: 'Salary audit logs retrieved successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 8. DELETE SALARY RECORD
// =========================================================================
const deleteItem = async (req, res) => {
  try {
    const user = req.user;
    const role = normalizeRole(user.role);

    const authorizedRoles = [ROLES.ADMIN, ROLES.HR];
    if (!authorizedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to delete salary records.',
      });
    }

    const Salary = mongoose.models.Salary || require('../../../models/appModels/Salary');
    const SalaryAudit = mongoose.models.SalaryAudit || require('../../../models/appModels/SalaryAudit');

    const salary = await Salary.findOne({ _id: req.params.id, removed: false });
    if (!salary) {
      return res.status(404).json({ success: false, message: 'Salary record not found.' });
    }

    salary.removed = true;
    await salary.save();

    await new SalaryAudit({
      salary: salary._id,
      employee: salary.employee,
      employeeName: salary.employeeName,
      periodLabel: salary.periodLabel,
      action: 'DELETED',
      performedBy: user._id,
      performedByName: `${user.name || ''} ${user.surname || ''}`.trim() || user.email,
      performedByRole: role,
      details: `Deleted salary record for ${salary.month} ${salary.year}`,
      ipAddress: req.ip || '',
    }).save();

    return res.status(200).json({
      success: true,
      message: 'Salary record deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// =========================================================================
// 9. BATCH PAYROLL EXECUTION (ADMIN / HR)
// =========================================================================
const batchRun = async (req, res) => {
  try {
    const user = req.user;
    const role = normalizeRole(user.role);

    const authorizedRoles = [ROLES.ADMIN, ROLES.HR];
    if (!authorizedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only HR and Admin can execute batch payroll runs.',
      });
    }

    const { year, month, workingDays, forceRecalculate, markPaid, paymentMode } = req.body;
    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: 'Year and month are required for batch payroll processing.',
      });
    }

    const summary = await payrollService.processMonthlyBatch({
      year,
      month,
      workingDays,
      createdByUser: user,
      forceRecalculate: Boolean(forceRecalculate),
      markPaid: markPaid !== undefined ? Boolean(markPaid) : true,
      paymentMode: paymentMode || 'Bank Transfer',
      ipAddress: req.ip || '',
    });

    return res.status(200).json({
      success: true,
      result: summary,
      message: `Batch payroll completed for ${summary.period}: ${summary.createdCount} created, ${summary.updatedCount} updated, ${summary.skippedCount} skipped.`,
    });
  } catch (error) {
    console.error('Batch run error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 10. REAL-TIME CALCULATION PREVIEW
// =========================================================================
const calculatePreview = async (req, res) => {
  try {
    const {
      employee: employeeId,
      year,
      month,
      workingDays,
      basic,
      hra,
      allowances,
      incentives,
      bonus,
      deductions,
      professionalTax,
      tds,
      otherDeductions,
      lopDays,
    } = req.body;

    let computed;
    if (employeeId) {
      computed = await payrollService.calculateEmployeeSalary({
        employeeId,
        year,
        month,
        workingDays,
        manualOverrides: {
          basic,
          hra,
          allowances,
          incentives,
          bonus,
          deductions,
          professionalTax,
          tds,
          otherDeductions,
          lopDays,
        },
        applyLopFromLeaves: lopDays === undefined,
      });
    } else {
      const breakdown = payrollService.calculateSalaryBreakdown({
        basic,
        hra,
        allowances,
        incentives,
        bonus,
        deductions,
        professionalTax,
        tds,
        otherDeductions,
        workingDays,
        lopDays: lopDays || 0,
      });
      computed = { breakdown };
    }

    return res.status(200).json({
      success: true,
      result: computed,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  batchRun,
  calculatePreview,
  list,
  read,
  create,
  update,
  delete: deleteItem,
  generateSlip,
  downloadSlipPdf,
  audit,
};

const mongoose = require('mongoose');
const pdf = require('html-pdf');

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
    const empName = salary.employeeName || (salary.employee ? `${salary.employee.name} ${salary.employee.surname || ''}`.trim() : 'Employee');
    const empCode = salary.employeeCode || salary.employee?.employeeId || 'TM-EMP-001';
    const dept = salary.department || salary.employee?.departmentName || 'Engineering';
    const desig = salary.designation || salary.employee?.designationName || 'Specialist';
    const doj = salary.joiningDate ? new Date(salary.joiningDate).toLocaleDateString('en-IN') : 'N/A';
    const pan = salary.panNumber || '';
    const uan = salary.uanNumber || '';
    const bankName = salary.bankDetails?.bankName || '';
    const accNo = salary.bankDetails?.accountNumber || '';
    const ifsc = salary.bankDetails?.ifscCode || '';

    const payDate = salary.paymentDate ? new Date(salary.paymentDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
    const slipNo = salary.slipNumber || `TM-SLIP-${salary.year}-${salary.month}`;
    const words = salary.netSalaryWords || numberToWords(salary.netSalary);

    // Build Pure HTML Payslip
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #262626;
          margin: 0;
          padding: 24px;
          font-size: 11.5px;
          line-height: 1.4;
          background: #ffffff;
        }
        .header {
          border-bottom: 2px solid #002244;
          padding-bottom: 14px;
          margin-bottom: 16px;
        }
        .company-name {
          font-size: 20px;
          font-weight: 800;
          color: #002244;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 4px 0;
        }
        .company-sub {
          font-size: 10px;
          color: #595959;
          margin: 0;
        }
        .title-badge {
          background: #002244;
          color: #ffffff;
          padding: 6px 12px;
          font-weight: 700;
          font-size: 13px;
          text-align: center;
          margin-bottom: 16px;
          letter-spacing: 1px;
        }
        .info-grid {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        .info-grid td {
          padding: 4px 6px;
          vertical-align: top;
          width: 25%;
        }
        .info-label {
          color: #8c8c8c;
          font-size: 10px;
          text-transform: uppercase;
        }
        .info-val {
          font-weight: 600;
          color: #000000;
        }
        .salary-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        .salary-table th {
          background: #f0f5fa;
          color: #002244;
          font-weight: 700;
          padding: 8px;
          text-align: left;
          border-top: 1px solid #d9d9d9;
          border-bottom: 1px solid #d9d9d9;
          font-size: 11px;
        }
        .salary-table td {
          padding: 6px 8px;
          border-bottom: 1px solid #f0f0f0;
        }
        .amount-col {
          text-align: right;
          font-weight: 500;
        }
        .total-row td {
          font-weight: 700;
          background: #fafafa;
          border-top: 1.5px solid #002244;
          border-bottom: 1.5px solid #002244;
          color: #002244;
        }
        .net-box {
          border: 2px solid #002244;
          background: #f8fbff;
          padding: 12px 16px;
          margin-bottom: 16px;
        }
        .net-amount {
          font-size: 18px;
          font-weight: 800;
          color: #002244;
        }
        .net-words {
          font-size: 11px;
          color: #595959;
          font-style: italic;
          margin-top: 2px;
        }
        .payment-info {
          width: 100%;
          border-collapse: collapse;
          background: #fafafa;
          border: 1px solid #e8e8e8;
          margin-bottom: 24px;
        }
        .payment-info td {
          padding: 6px 10px;
          font-size: 10.5px;
        }
        .signatures {
          width: 100%;
          margin-top: 36px;
        }
        .signatures td {
          text-align: center;
          width: 50%;
          padding: 0 20px;
        }
        .sig-line {
          border-top: 1px dashed #8c8c8c;
          padding-top: 6px;
          font-size: 10px;
          color: #595959;
        }
        .footer-note {
          text-align: center;
          font-size: 9px;
          color: #8c8c8c;
          margin-top: 24px;
          border-top: 1px solid #f0f0f0;
          padding-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <table style="width: 100%;">
          <tr>
            <td>
              <h1 class="company-name">TECMOTIV SOLUTIONS PVT. LTD.</h1>
              <p class="company-sub">
                CIN: U72900KA2024PTC123456 • Corporate IT Park, Sector 4, Silicon Boulevard, Bangalore - 560100<br/>
                Email: payroll@tecmotiv.com • Website: www.tecmotiv.com
              </p>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <span style="font-size: 11px; font-weight: 700; color: #002244;">SLIP #: ${slipNo}</span><br/>
              <span style="font-size: 10px; color: #8c8c8c;">Date: ${payDate}</span>
            </td>
          </tr>
        </table>
      </div>

      <div class="title-badge">
        PAYSLIP FOR THE MONTH OF ${String(salary.month).toUpperCase()} ${salary.year}
      </div>

      <!-- Employee Details & Attendance Grid -->
      <table class="info-grid">
        <tr>
          <td>
            <div class="info-label">Employee Code</div>
            <div class="info-val">${empCode}</div>
          </td>
          <td>
            <div class="info-label">Employee Name</div>
            <div class="info-val">${empName}</div>
          </td>
          <td>
            <div class="info-label">Designation</div>
            <div class="info-val">${desig}</div>
          </td>
          <td>
            <div class="info-label">Department</div>
            <div class="info-val">${dept}</div>
          </td>
        </tr>
        <tr>
          <td>
            <div class="info-label">Date of Joining</div>
            <div class="info-val">${doj}</div>
          </td>
          <td>
            <div class="info-label">PAN Number</div>
            <div class="info-val">${pan}</div>
          </td>
          <td>
            <div class="info-label">UAN Number</div>
            <div class="info-val">${uan}</div>
          </td>
          <td>
            <div class="info-label">Bank Name</div>
            <div class="info-val">${bankName}</div>
          </td>
        </tr>
        <tr>
          <td>
            <div class="info-label">Bank Account No.</div>
            <div class="info-val">${accNo}</div>
          </td>
          <td>
            <div class="info-label">IFSC Code</div>
            <div class="info-val">${ifsc}</div>
          </td>
          <td>
            <div class="info-label">Working Days</div>
            <div class="info-val">${salary.workingDays || 30} Days</div>
          </td>
          <td>
            <div class="info-label">Paid / LOP Days</div>
            <div class="info-val">${salary.paidDays || 30} / ${salary.lopDays || 0} Days</div>
          </td>
        </tr>
      </table>

      <!-- Earnings & Deductions Dual Column -->
      <table class="salary-table">
        <thead>
          <tr>
            <th style="width: 32%;">EARNINGS</th>
            <th class="amount-col" style="width: 18%;">AMOUNT (₹)</th>
            <th style="width: 32%;">DEDUCTIONS</th>
            <th class="amount-col" style="width: 18%;">AMOUNT (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Basic Salary</td>
            <td class="amount-col">${formatCurrency(salary.basic || salary.basicSalary)}</td>
            <td>Professional Tax (PT)</td>
            <td class="amount-col">${formatCurrency(salary.professionalTax)}</td>
          </tr>
          <tr>
            <td>House Rent Allowance (HRA)</td>
            <td class="amount-col">${formatCurrency(salary.hra)}</td>
            <td>TDS / Income Tax</td>
            <td class="amount-col">${formatCurrency(salary.tds)}</td>
          </tr>
          <tr>
            <td>Special & Other Allowances</td>
            <td class="amount-col">${formatCurrency(salary.allowances)}</td>
            <td>Standard Deductions / PF</td>
            <td class="amount-col">${formatCurrency(salary.deductions)}</td>
          </tr>
          <tr>
            <td>Performance Incentives</td>
            <td class="amount-col">${formatCurrency(salary.incentives)}</td>
            <td>Other Deductions / LOP</td>
            <td class="amount-col">${formatCurrency(salary.otherDeductions)}</td>
          </tr>
          <tr>
            <td>Bonus & Ex-Gratia</td>
            <td class="amount-col">${formatCurrency(salary.bonus)}</td>
            <td>-</td>
            <td class="amount-col">₹0.00</td>
          </tr>
          <tr class="total-row">
            <td>GROSS EARNINGS</td>
            <td class="amount-col">${formatCurrency(salary.totalEarnings)}</td>
            <td>TOTAL DEDUCTIONS</td>
            <td class="amount-col">${formatCurrency(salary.totalDeductions)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Net Salary Box -->
      <div class="net-box">
        <table style="width: 100%;">
          <tr>
            <td>
              <span style="font-size: 12px; font-weight: 700; color: #595959; text-transform: uppercase;">
                NET SALARY PAYABLE
              </span>
              <div class="net-words">${words}</div>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <span class="net-amount">${formatCurrency(salary.netSalary)}</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Payment Information -->
      <table class="payment-info">
        <tr>
          <td><strong>Payment Mode:</strong> ${salary.paymentMode || 'Bank Transfer'}</td>
          <td><strong>Payment Status:</strong> <span style="color: #237804; font-weight: 700;">${salary.status || 'PAID'}</span></td>
          <td><strong>Payment Date:</strong> ${payDate}</td>
          <td><strong>Ref / UTR:</strong> ${salary.transactionReference || 'UTR-TM-202610-0981'}</td>
        </tr>
      </table>

      <!-- Signatures -->
      <table class="signatures">
        <tr>
          <td>
            <div style="height: 36px;"></div>
            <div class="sig-line">Employer Signature / Authorized Signatory</div>
          </td>
          <td>
            <div style="height: 36px;"></div>
            <div class="sig-line">Employee Signature / Digital Acknowledgement</div>
          </td>
        </tr>
      </table>

      <div class="footer-note">
        This is a system-generated document from TecMotiv ERP. No physical signature is required. For inquiries, contact payroll@tecmotiv.com.
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
      res.setHeader('Content-Disposition', `inline; filename="TecMotiv-SalarySlip-${slipNo}.pdf"`);
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

module.exports = {
  list,
  read,
  create,
  update,
  delete: deleteItem,
  generateSlip,
  downloadSlipPdf,
  audit,
};

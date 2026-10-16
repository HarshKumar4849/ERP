require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function seedSalaryData() {
  try {
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    console.log('✅ Connected to MongoDB');

    const Admin = require('../models/coreModels/Admin');
    const Employee = require('../models/appModels/Employee');
    const Salary = require('../models/appModels/Salary');
    const SalaryAudit = require('../models/appModels/SalaryAudit');

    const hrUser = await Admin.findOne({ email: 'hr@tecmotiv.com' }) || await Admin.findOne();
    const employees = await Employee.find({ removed: false }).limit(6);

    if (employees.length === 0) {
      console.log('⚠️ No employees found to seed salary records.');
      process.exit(0);
    }

    // Clear existing salary records for clean test state
    await Salary.deleteMany({});
    await SalaryAudit.deleteMany({});

    console.log(`💼 Found ${employees.length} employees. Seeding monthly salary records...`);

    const months = [
      { month: 'September', year: 2026, workingDays: 30, paidDays: 30, lopDays: 0 },
      { month: 'October', year: 2026, workingDays: 31, paidDays: 31, lopDays: 0 },
    ];

    const baseProfiles = [
      {
        basic: 45000,
        hra: 18000,
        allowances: 8500,
        incentives: 5000,
        bonus: 0,
        deductions: 2400, // PF
        professionalTax: 200,
        tds: 3500,
        otherDeductions: 0,
      },
      {
        basic: 60000,
        hra: 24000,
        allowances: 12000,
        incentives: 10000,
        bonus: 15000,
        deductions: 3600,
        professionalTax: 200,
        tds: 7500,
        otherDeductions: 500,
      },
      {
        basic: 35000,
        hra: 14000,
        allowances: 6000,
        incentives: 2500,
        bonus: 0,
        deductions: 1800,
        professionalTax: 200,
        tds: 1500,
        otherDeductions: 0,
      },
    ];

    function numberToWords(num) {
      const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
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

    let createdCount = 0;

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const profile = baseProfiles[i % baseProfiles.length];

      for (const m of months) {
        const totalEarnings = profile.basic + profile.hra + profile.allowances + profile.incentives + profile.bonus;
        const totalDeductions = profile.deductions + profile.professionalTax + profile.tds + profile.otherDeductions;
        const netSalary = totalEarnings - totalDeductions;
        const netSalaryWords = numberToWords(netSalary);
        const slipNumber = `TM-SLIP-${m.year}${m.month.slice(0, 3).toUpperCase()}-${1000 + createdCount}`;

        const salaryDoc = new Salary({
          employee: emp._id,
          user: emp.user || hrUser._id,
          month: m.month,
          year: m.year,
          periodLabel: `${m.month} ${m.year}`,
          workingDays: m.workingDays,
          paidDays: m.paidDays,
          lopDays: m.lopDays,

          // Earnings
          basic: profile.basic,
          basicSalary: profile.basic,
          hra: profile.hra,
          allowances: profile.allowances,
          incentives: profile.incentives,
          bonus: profile.bonus,
          totalEarnings,

          // Deductions
          deductions: profile.deductions,
          professionalTax: profile.professionalTax,
          tds: profile.tds,
          otherDeductions: profile.otherDeductions,
          totalDeductions,

          // Net
          netSalary,
          netSalaryWords,
          currency: 'INR',

          // Snapshot
          employeeCode: emp.employeeId || `TM-EMP-00${i + 1}`,
          employeeName: `${emp.name} ${emp.surname || ''}`.trim(),
          designation: emp.designationName || 'Software Engineer',
          department: emp.departmentName || 'Engineering',
          joiningDate: emp.joiningDate || new Date('2024-01-15'),
          panNumber: `ABCDE${1000 + i}F`,
          uanNumber: `10123456${7890 + i}`,
          bankDetails: {
            bankName: 'HDFC Bank Ltd.',
            accountNumber: `5010023456${8000 + i}`,
            ifscCode: 'HDFC0001234',
            branch: 'Silicon Boulevard Branch',
          },

          status: 'Paid',
          paymentMode: 'Bank Transfer',
          paymentDate: new Date(`${m.year}-${m.month === 'September' ? '09' : '10'}-30`),
          transactionReference: `UTR-TM-${m.year}${m.month === 'September' ? '09' : '10'}-${9000 + createdCount}`,

          slipNumber,
          slipGenerated: true,
          slipGeneratedAt: new Date(),
          notes: 'Standard monthly compensation disbursement',
          createdBy: hrUser._id,
          updatedBy: hrUser._id,
        });

        await salaryDoc.save();

        // Audit log
        await new SalaryAudit({
          salary: salaryDoc._id,
          employee: emp._id,
          employeeName: salaryDoc.employeeName,
          periodLabel: salaryDoc.periodLabel,
          action: 'CREATED',
          performedBy: hrUser._id,
          performedByName: `${hrUser.name || 'HR'} ${hrUser.surname || 'Manager'}`.trim(),
          performedByRole: 'HR',
          details: `Processed payroll and generated salary slip #${slipNumber} for ${m.month} ${m.year}`,
          newValues: {
            netSalary,
            totalEarnings,
            totalDeductions,
            status: 'Paid',
          },
          ipAddress: '127.0.0.1',
        }).save();

        createdCount++;
      }
    }

    console.log(`✅ Seeded ${createdCount} salary records and audit entries successfully.`);
    process.exit(0);
  } catch (error) {
    console.error('Seed salary data error:', error);
    process.exit(1);
  }
}

seedSalaryData();

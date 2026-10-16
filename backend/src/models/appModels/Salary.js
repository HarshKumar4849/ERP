const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    removed: {
      type: Boolean,
      default: false,
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'Admin',
    },
    employee: {
      type: mongoose.Schema.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },

    // ==========================================
    // 1. SALARY PERIOD & ATTENDANCE STATS
    // ==========================================
    month: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    periodLabel: {
      type: String,
      trim: true,
    },
    workingDays: {
      type: Number,
      default: 30,
    },
    paidDays: {
      type: Number,
      default: 30,
    },
    lopDays: {
      type: Number,
      default: 0,
    },

    // ==========================================
    // 2. EARNINGS STRUCTURE
    // ==========================================
    basic: {
      type: Number,
      default: 0,
      min: 0,
    },
    hra: {
      type: Number,
      default: 0,
      min: 0,
    },
    allowances: {
      type: Number,
      default: 0,
      min: 0,
    },
    incentives: {
      type: Number,
      default: 0,
      min: 0,
    },
    bonus: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },

    // Backward compatibility with legacy schema
    basicSalary: {
      type: Number,
      default: 0,
    },

    // ==========================================
    // 3. DEDUCTIONS STRUCTURE
    // ==========================================
    deductions: {
      type: Number,
      default: 0,
      min: 0,
    },
    professionalTax: {
      type: Number,
      default: 0,
      min: 0,
    },
    tds: {
      type: Number,
      default: 0,
      min: 0,
    },
    otherDeductions: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDeductions: {
      type: Number,
      default: 0,
    },

    // ==========================================
    // 4. NET SALARY & CURRENCY
    // ==========================================
    netSalary: {
      type: Number,
      required: true,
    },
    netSalaryWords: {
      type: String,
      default: '',
    },
    currency: {
      type: String,
      default: 'INR',
    },

    // ==========================================
    // 5. EMPLOYEE PROFILE SNAPSHOT (AT PAYROLL TIME)
    // ==========================================
    employeeCode: {
      type: String,
      default: '',
    },
    employeeName: {
      type: String,
      default: '',
    },
    designation: {
      type: String,
      default: '',
    },
    department: {
      type: String,
      default: '',
    },
    joiningDate: {
      type: Date,
    },
    panNumber: {
      type: String,
      default: '',
    },
    uanNumber: {
      type: String,
      default: '',
    },
    bankDetails: {
      bankName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      branch: { type: String, default: '' },
    },

    // ==========================================
    // 6. PAYMENT INFORMATION
    // ==========================================
    status: {
      type: String,
      enum: ['Draft', 'Pending', 'Processing', 'Paid', 'Cancelled', 'paid', 'pending', 'processing'],
      default: 'Paid',
    },
    paymentMode: {
      type: String,
      enum: ['Bank Transfer', 'NEFT', 'RTGS', 'IMPS', 'Cheque', 'Cash'],
      default: 'Bank Transfer',
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    transactionReference: {
      type: String,
      trim: true,
      default: '',
    },

    // ==========================================
    // 7. SALARY SLIP DETAILS
    // ==========================================
    slipNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    slipGenerated: {
      type: Boolean,
      default: false,
    },
    slipGeneratedAt: {
      type: Date,
    },

    notes: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'Admin',
    },
    updatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'Admin',
    },
    created: {
      type: Date,
      default: Date.now,
    },
    updated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index to quickly find salary by employee and period
schema.index({ employee: 1, year: 1, month: 1 });

// Pre-save recalculation
schema.pre('save', function (next) {
  // Sync basicSalary for backward compatibility
  if (this.basic && !this.basicSalary) {
    this.basicSalary = this.basic;
  } else if (this.basicSalary && !this.basic) {
    this.basic = this.basicSalary;
  }

  const basicVal = Number(this.basic || 0);
  const hraVal = Number(this.hra || 0);
  const allowancesVal = Number(this.allowances || 0);
  const incentivesVal = Number(this.incentives || 0);
  const bonusVal = Number(this.bonus || 0);
  this.totalEarnings = basicVal + hraVal + allowancesVal + incentivesVal + bonusVal;

  const dedVal = Number(this.deductions || 0);
  const ptVal = Number(this.professionalTax || 0);
  const tdsVal = Number(this.tds || 0);
  const otherVal = Number(this.otherDeductions || 0);
  this.totalDeductions = dedVal + ptVal + tdsVal + otherVal;

  this.netSalary = Math.max(0, this.totalEarnings - this.totalDeductions);
  this.updated = Date.now();
  next();
});

module.exports = mongoose.model('Salary', schema);

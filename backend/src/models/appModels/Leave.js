const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    removed: {
      type: Boolean,
      default: false,
    },
    employee: {
      type: mongoose.Schema.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'Admin',
      index: true,
    },
    department: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    leaveType: {
      type: String,
      enum: [
        'Casual Leave',
        'Sick Leave',
        'Earned/Privilege Leave',
        'Compensatory Off',
        'Half Day',
        'Work From Home',
        'Unpaid Leave',
        'Other',
        // Backward compatibility lowercase
        'casual',
        'sick',
        'annual',
        'parental',
        'unpaid',
      ],
      required: true,
      default: 'Casual Leave',
    },
    fromDate: {
      type: Date,
      required: true,
      index: true,
    },
    toDate: {
      type: Date,
      required: true,
      index: true,
    },
    // Backwards compatibility aliases
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    daysCount: {
      type: Number,
      required: true,
      min: 0.5,
    },
    numberOfDays: {
      type: Number,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    supportingDocument: {
      fileName: String,
      originalName: String,
      path: String,
      mimeType: String,
      size: Number,
    },
    reportingManager: {
      type: mongoose.Schema.ObjectId,
      ref: 'Employee',
    },
    reportingManagerUser: {
      type: mongoose.Schema.ObjectId,
      ref: 'Admin',
    },
    status: {
      type: String,
      enum: [
        'Pending Manager Approval',
        'Pending HR Approval',
        'Approved',
        'Rejected',
        'Cancelled',
        // Backward compatibility
        'pending',
        'approved',
        'rejected',
      ],
      default: 'Pending Manager Approval',
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    managerApproval: {
      status: {
        type: String,
        enum: ['Approved', 'Rejected', 'Pending', 'Skipped'],
        default: 'Pending',
      },
      approver: {
        type: mongoose.Schema.ObjectId,
        ref: 'Admin',
      },
      approverName: String,
      remarks: String,
      timestamp: Date,
    },
    hrApproval: {
      status: {
        type: String,
        enum: ['Approved', 'Rejected', 'Pending'],
        default: 'Pending',
      },
      approver: {
        type: mongoose.Schema.ObjectId,
        ref: 'Admin',
      },
      approverName: String,
      remarks: String,
      timestamp: Date,
    },
    approvalHistory: [
      {
        step: {
          type: String,
          enum: ['MANAGER', 'HR'],
          required: true,
        },
        approver: {
          type: mongoose.Schema.ObjectId,
          ref: 'Admin',
        },
        approverName: String,
        status: {
          type: String,
          enum: ['Approved', 'Rejected'],
          required: true,
        },
        remarks: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
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

// Compound indexing for overlap checks and performance
schema.index({ employee: 1, fromDate: 1, toDate: 1, removed: 1 });
schema.index({ department: 1, status: 1 });

schema.pre('save', function (next) {
  if (this.fromDate && !this.startDate) this.startDate = this.fromDate;
  if (this.startDate && !this.fromDate) this.fromDate = this.startDate;
  if (this.toDate && !this.endDate) this.endDate = this.toDate;
  if (this.endDate && !this.toDate) this.toDate = this.endDate;
  if (this.daysCount && !this.numberOfDays) this.numberOfDays = this.daysCount;
  if (this.numberOfDays && !this.daysCount) this.daysCount = this.numberOfDays;

  // Normalize legacy status names
  if (this.status === 'pending') this.status = 'Pending Manager Approval';
  if (this.status === 'approved') this.status = 'Approved';
  if (this.status === 'rejected') this.status = 'Rejected';

  // Normalize legacy leave type
  const typeMap = {
    casual: 'Casual Leave',
    sick: 'Sick Leave',
    annual: 'Earned/Privilege Leave',
    parental: 'Other',
    unpaid: 'Unpaid Leave',
  };
  if (typeMap[this.leaveType]) {
    this.leaveType = typeMap[this.leaveType];
  }

  this.updated = Date.now();
  next();
});

module.exports = mongoose.model('Leave', schema);

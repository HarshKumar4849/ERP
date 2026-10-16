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
    date: {
      type: Date,
      required: true,
      index: true,
    },
    dateString: {
      type: String,
      trim: true,
      index: true,
    },
    loginTime: {
      type: Date,
    },
    logoutTime: {
      type: Date,
    },
    // Backwards compatibility with legacy clockIn / clockOut
    clockIn: {
      type: Date,
    },
    clockOut: {
      type: Date,
    },
    totalHours: {
      type: Number,
      default: 0,
      min: 0,
    },
    workMode: {
      type: String,
      enum: ['Office', 'Work From Home', 'Client Visit', 'Event', 'Leave', 'Holiday'],
      default: 'Office',
    },
    status: {
      type: String,
      enum: [
        'Present',
        'Absent',
        'Leave',
        'Holiday',
        'Half Day',
        'Late Login',
        'Early Logout',
        'present',
        'late',
        'half_day',
        'wfh',
        'absent',
      ],
      default: 'Present',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    isHalfDayDeclaration: {
      type: Boolean,
      default: false,
    },
    earlyExitReason: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
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

// Compound index for querying an employee's attendance by date
schema.index({ employee: 1, dateString: 1, removed: 1 }, { unique: true });
schema.index({ date: -1, department: 1 });

// Normalize and sync aliases
schema.pre('save', function (next) {
  if (this.loginTime && !this.clockIn) this.clockIn = this.loginTime;
  if (this.clockIn && !this.loginTime) this.loginTime = this.clockIn;
  if (this.logoutTime && !this.clockOut) this.clockOut = this.logoutTime;
  if (this.clockOut && !this.logoutTime) this.logoutTime = this.clockOut;
  if (this.remarks && !this.notes) this.notes = this.remarks;
  if (this.notes && !this.remarks) this.remarks = this.notes;

  if (this.date && !this.dateString) {
    const d = new Date(this.date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.dateString = `${year}-${month}-${day}`;
  }

  // Normalize legacy status names if any
  if (this.status) {
    const map = {
      present: 'Present',
      late: 'Late Login',
      half_day: 'Half Day',
      wfh: 'Present',
      absent: 'Absent',
    };
    if (map[this.status]) {
      this.status = map[this.status];
    }
  }

  this.updated = Date.now();
  next();
});

module.exports = mongoose.model('Attendance', schema);

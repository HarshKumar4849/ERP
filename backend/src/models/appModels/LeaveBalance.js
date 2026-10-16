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
    year: {
      type: Number,
      required: true,
      default: () => new Date().getFullYear(),
      index: true,
    },
    balances: {
      'Casual Leave': {
        allocated: { type: Number, default: 12 },
        used: { type: Number, default: 0 },
        pending: { type: Number, default: 0 },
      },
      'Sick Leave': {
        allocated: { type: Number, default: 10 },
        used: { type: Number, default: 0 },
        pending: { type: Number, default: 0 },
      },
      'Earned/Privilege Leave': {
        allocated: { type: Number, default: 15 },
        used: { type: Number, default: 0 },
        pending: { type: Number, default: 0 },
      },
      'Compensatory Off': {
        allocated: { type: Number, default: 2 },
        used: { type: Number, default: 0 },
        pending: { type: Number, default: 0 },
      },
      'Half Day': {
        allocated: { type: Number, default: 6 },
        used: { type: Number, default: 0 },
        pending: { type: Number, default: 0 },
      },
      'Work From Home': {
        allocated: { type: Number, default: 24 },
        used: { type: Number, default: 0 },
        pending: { type: Number, default: 0 },
      },
      'Unpaid Leave': {
        allocated: { type: Number, default: 0 },
        used: { type: Number, default: 0 },
        pending: { type: Number, default: 0 },
      },
      Other: {
        allocated: { type: Number, default: 5 },
        used: { type: Number, default: 0 },
        pending: { type: Number, default: 0 },
      },
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

// Compound index to ensure 1 balance doc per employee per calendar year
schema.index({ employee: 1, year: 1 }, { unique: true });

schema.pre('save', function (next) {
  this.updated = Date.now();
  next();
});

module.exports = mongoose.model('LeaveBalance', schema);

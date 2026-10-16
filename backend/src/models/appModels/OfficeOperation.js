const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    removed: {
      type: Boolean,
      default: false,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        'Rent',
        'Office Facilities',
        'Housekeeping',
        'Pantry',
        'Stationery',
        'Equipment',
        'Assets',
        'Vendors',
        'Maintenance',
      ],
      required: true,
      index: true,
    },
    vendor: {
      type: String,
      trim: true,
      default: '',
    },
    vendorContact: {
      type: String,
      trim: true,
      default: '',
    },
    amount: {
      type: Number,
      default: 0,
    },
    frequency: {
      type: String,
      enum: ['One-time', 'Monthly', 'Quarterly', 'Annual', 'As Needed'],
      default: 'Monthly',
    },
    dueDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['Active', 'Pending', 'Paid', 'Completed', 'In Progress', 'Scheduled'],
      default: 'Active',
    },
    location: {
      type: String,
      default: 'HQ - Bangalore',
    },
    responsiblePerson: {
      type: String,
      default: 'Admin Team',
    },
    notes: {
      type: String,
      default: '',
    },
    createdBy: {
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

schema.pre('save', function (next) {
  this.updated = Date.now();
  next();
});

module.exports = mongoose.model('OfficeOperation', schema);

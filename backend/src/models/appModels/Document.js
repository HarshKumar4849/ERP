const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    removed: {
      type: Boolean,
      default: false,
    },
    enabled: {
      type: Boolean,
      default: true,
    },

    // Employee Relationship
    employee: {
      type: mongoose.Schema.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    employeeId: {
      type: String,
      trim: true,
      index: true,
    },
    employeeName: {
      type: String,
      trim: true,
    },
    project: {
      type: mongoose.Schema.ObjectId,
      ref: 'Project',
      index: true,
    },

    // Document Type
    documentType: {
      type: String,
      required: true,
      enum: [
        'Aadhaar',
        'PAN',
        'Passport',
        'Education Certificate',
        'Experience Letter',
        'Joining Letter',
        'Appointment Letter',
        'NDA',
        'Employment Agreement',
        'Bank Details',
        'Salary Documents',
        'Resignation',
        'Relieving Letter',
        'Other HR Documents',
      ],
      index: true,
    },

    // Secure File Information (never publicly exposed)
    file: {
      fileName: { type: String, required: true },
      originalName: { type: String, required: true },
      path: { type: String, required: true },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true }, // in bytes
      data: { type: Buffer, select: false }, // Persisted binary file data in database
    },

    // Validity / Lifecycle
    issueDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
      index: true,
    },

    // Verification Workflow
    verificationStatus: {
      type: String,
      enum: ['Pending', 'Verified', 'Rejected'],
      default: 'Pending',
      index: true,
    },
    verifiedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'Admin',
    },
    verifiedByName: {
      type: String,
      trim: true,
    },
    verifiedAt: {
      type: Date,
    },
    verificationRemarks: {
      type: String,
      trim: true,
      default: '',
    },

    // Notes & Remarks
    remarks: {
      type: String,
      trim: true,
      default: '',
    },

    // Audit Info
    uploadedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'Admin',
      required: true,
    },
    uploadedByName: {
      type: String,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      index: true,
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

// Virtual for expiry status
schema.virtual('expiryStatus').get(function () {
  if (!this.expiryDate) return 'No Expiry';
  const now = new Date();
  const exp = new Date(this.expiryDate);
  if (exp < now) return 'Expired';
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (exp.getTime() - now.getTime() <= thirtyDays) return 'Expiring Soon';
  return 'Valid';
});

schema.pre('save', function (next) {
  this.updated = Date.now();
  next();
});

module.exports = mongoose.model('Document', schema);

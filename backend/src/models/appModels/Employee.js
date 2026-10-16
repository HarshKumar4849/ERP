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

    // ==========================================
    // 1. BASIC INFORMATION
    // ==========================================
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    surname: {
      type: String,
      trim: true,
      default: '',
    },
    photo: {
      type: String,
      trim: true,
      default: '',
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Non-Binary', 'Other', 'Prefer not to say'],
      default: 'Prefer not to say',
    },
    birthDate: {
      type: Date,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    personalEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    emergencyContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      relationship: { type: String, default: '' },
    },

    // ==========================================
    // 2. EMPLOYMENT DETAILS
    // ==========================================
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    department: {
      type: mongoose.Schema.ObjectId,
      ref: 'Department',
    },
    departmentName: {
      type: String,
      trim: true,
      default: '',
    },
    designation: {
      type: mongoose.Schema.ObjectId,
      ref: 'Designation',
    },
    designationName: {
      type: String,
      trim: true,
      default: '',
    },
    reportingManager: {
      type: mongoose.Schema.ObjectId,
      ref: 'Employee',
    },
    employmentType: {
      type: String,
      enum: ['Full Time', 'Part Time', 'Intern', 'Consultant'],
      default: 'Full Time',
    },
    probationPeriod: {
      type: String,
      default: '3 Months',
    },
    confirmationDate: {
      type: Date,
    },
    workLocation: {
      type: mongoose.Schema.ObjectId,
      ref: 'Location',
    },
    workLocationName: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['Active', 'On Notice', 'Terminated', 'Resigned', 'Probation', 'On Leave'],
      default: 'Active',
    },
    exitDate: {
      type: Date,
    },
    reasonForExit: {
      type: String,
      trim: true,
      default: '',
    },

    // ==========================================
    // 3. PROFESSIONAL DETAILS
    // ==========================================
    skills: {
      type: [String],
      default: [],
    },
    qualifications: {
      type: [String],
      default: [],
    },
    certifications: {
      type: [String],
      default: [],
    },
    experience: {
      type: String,
      trim: true,
      default: '',
    },
    linkedin: {
      type: String,
      trim: true,
      default: '',
    },
    areasOfExpertise: {
      type: [String],
      default: [],
    },
    assignedProjects: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Project',
      },
    ],
    currentResponsibilities: {
      type: String,
      trim: true,
      default: '',
    },

    // ==========================================
    // 4. SYSTEM & COMPATIBILITY
    // ==========================================
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'Admin',
      index: true,
    },
    bankDetails: {
      bankName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      routingOrIfsc: { type: String, default: '' },
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

// Virtual for Full Name
schema.virtual('fullName').get(function () {
  if (this.name && this.surname) {
    return `${this.name} ${this.surname}`.trim();
  }
  return this.name || '';
});

// Update timestamp before saving
schema.pre('save', function (next) {
  this.updated = Date.now();
  next();
});

module.exports = mongoose.model('Employee', schema);

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const adminSchema = new Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  enabled: {
    type: Boolean,
    default: false,
  },

  email: {
    type: String,
    lowercase: true,
    trim: true,
    required: true,
  },
  name: { type: String, required: true },
  surname: { type: String },
  photo: {
    type: String,
    trim: true,
  },
  created: {
    type: Date,
    default: Date.now,
  },
  role: {
    type: String,
    default: 'EMPLOYEE',
    enum: [
      'MANAGEMENT',
      'HR',
      'FINANCE',
      'ADMIN',
      'DEPARTMENT_HEAD',
      'EMPLOYEE',
      'owner',
      'super_admin',
    ],
  },
  department: {
    type: String,
    trim: true,
    default: null,
  },
  designation: {
    type: String,
    trim: true,
    default: null,
  },
  employeeId: {
    type: String,
    trim: true,
    default: null,
  },
});

// Partial unique index to enforce unique email among active accounts and allow re-registration after deletion
adminSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { removed: false } });

module.exports = mongoose.model('Admin', adminSchema);

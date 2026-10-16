const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.ObjectId,
    ref: 'Employee',
    required: true,
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
    required: true,
  },
  employeeName: {
    type: String,
    trim: true,
    required: true,
  },
  department: {
    type: String,
    trim: true,
    default: 'General',
  },
  policy: {
    type: mongoose.Schema.ObjectId,
    ref: 'Policy',
    required: true,
  },
  policyName: {
    type: String,
    trim: true,
    required: true,
  },
  version: {
    type: String,
    required: true,
    trim: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  statement: {
    type: String,
    default: 'I have read and understood this policy.',
  },
  ipAddress: {
    type: String,
    default: '127.0.0.1',
  },
});

// Compound unique index so an employee cannot duplicate acknowledge the exact same policy version
schema.index({ employee: 1, policy: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('PolicyAcknowledgement', schema);

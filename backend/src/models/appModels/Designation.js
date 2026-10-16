const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  code: {
    type: String,
    trim: true,
    uppercase: true,
  },
  department: {
    type: mongoose.Schema.ObjectId,
    ref: 'Department',
  },
  departmentName: {
    type: String,
    trim: true,
  },
  level: {
    type: String,
    enum: ['Junior', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'Executive'],
    default: 'Mid',
  },
  description: {
    type: String,
    trim: true,
  },
  created: {
    type: Date,
    default: Date.now,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Designation', schema);

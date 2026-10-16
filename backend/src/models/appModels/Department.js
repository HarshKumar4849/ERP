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
    unique: true,
    trim: true,
  },
  code: {
    type: String,
    trim: true,
    uppercase: true,
  },
  description: {
    type: String,
    trim: true,
  },
  head: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
  },
  parentDepartment: {
    type: mongoose.Schema.ObjectId,
    ref: 'Department',
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

module.exports = mongoose.model('Department', schema);

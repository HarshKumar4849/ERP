const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  // Backward compatibility alias
  title: {
    type: String,
    trim: true,
  },
  code: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    enum: ['HR', 'IT', 'COMPANY', 'General'],
    required: true,
    default: 'General',
  },
  subType: {
    type: String,
    trim: true,
    default: 'General Policy',
  },
  version: {
    type: String,
    default: '1.0',
    trim: true,
  },
  effectiveDate: {
    type: Date,
    default: Date.now,
  },
  owner: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
  },
  ownerName: {
    type: String,
    trim: true,
    default: 'Compliance & Legal Team',
  },
  content: {
    type: String,
    default: '',
  },
  document: {
    type: String,
    trim: true,
  },
  file: {
    type: String,
    trim: true,
  },
  acknowledgementRequired: {
    type: Boolean,
    default: true,
  },
  isMandatory: {
    type: Boolean,
    default: true,
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

schema.pre('validate', function (next) {
  if (this.name && !this.title) {
    this.title = this.name;
  } else if (this.title && !this.name) {
    this.name = this.title;
  }
  if (this.document && !this.file) {
    this.file = this.document;
  } else if (this.file && !this.document) {
    this.document = this.file;
  }
  next();
});

schema.pre('save', function (next) {
  this.updated = Date.now();
  next();
});

module.exports = mongoose.model('Policy', schema);

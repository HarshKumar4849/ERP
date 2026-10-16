const mongoose = require('mongoose');

const wishSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
  },
  authorName: {
    type: String,
    trim: true,
    default: 'Team Member',
  },
  authorRole: {
    type: String,
    trim: true,
    default: 'EMPLOYEE',
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const schema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  type: {
    type: String,
    enum: ['Birthday', 'Work Anniversary', 'Achievement', 'Company Milestone', 'Recognition'],
    required: true,
  },
  employee: {
    type: mongoose.Schema.ObjectId,
    ref: 'Employee',
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
  title: {
    type: String,
    required: true,
    trim: true,
  },
  occasionDate: {
    type: Date,
    required: true,
  },
  yearsCompleted: {
    type: Number,
    default: 0,
  },
  message: {
    type: String,
    default: '',
  },
  wishes: {
    type: [wishSchema],
    default: [],
  },
  reminderScheduled: {
    type: Boolean,
    default: true,
  },
  reminderDaysBefore: {
    type: Number,
    default: 7, // Default reminder: 7 days before the occasion
  },
  reminderSent: {
    type: Boolean,
    default: false,
  },
  giftOrVoucher: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['Upcoming', 'Active Today', 'Celebrated', 'Archived'],
    default: 'Upcoming',
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

// Update timestamp before saving
schema.pre('save', function (next) {
  this.updated = Date.now();
  next();
});

module.exports = mongoose.model('Celebration', schema);

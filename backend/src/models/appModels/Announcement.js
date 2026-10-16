const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  summary: {
    type: String,
    trim: true,
    default: '',
  },
  section: {
    type: String,
    enum: ['COMPANY NEWS', 'ANNOUNCEMENTS', 'EVENTS', 'RECOGNITION'],
    required: true,
    default: 'ANNOUNCEMENTS',
  },
  subType: {
    type: String,
    trim: true,
    default: 'General',
  },
  category: {
    type: String,
    default: 'Announcement',
  },
  department: {
    type: String,
    default: 'All',
  },
  priority: {
    type: String,
    enum: ['Normal', 'High', 'Urgent'],
    default: 'Normal',
  },
  pinned: {
    type: Boolean,
    default: false,
  },
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
  },
  authorName: {
    type: String,
    trim: true,
    default: 'Executive Leadership',
  },
  coverImage: {
    type: String,
    default: '',
  },
  tags: {
    type: [String],
    default: [],
  },
  likes: {
    type: Number,
    default: 0,
  },
  date: {
    type: Date,
    default: Date.now,
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

schema.pre('save', function (next) {
  this.updated = Date.now();
  next();
});

module.exports = mongoose.model('Announcement', schema);

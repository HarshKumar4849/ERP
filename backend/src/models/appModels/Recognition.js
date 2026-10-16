const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  fromUser: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
    required: true,
  },
  toUser: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
    required: true,
  },
  badge: {
    type: String,
    enum: ['Spot Award', 'Team Player', 'Innovator', 'Customer Hero', 'Leadership', 'Kudos'],
    default: 'Kudos',
  },
  message: {
    type: String,
    required: true,
  },
  points: {
    type: Number,
    default: 10,
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

module.exports = mongoose.model('Recognition', schema);

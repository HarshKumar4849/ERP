const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  recipient: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
    required: true,
    index: true,
  },
  recipientEmployee: {
    type: mongoose.Schema.ObjectId,
    ref: 'Employee',
    index: true,
  },
  type: {
    type: String,
    enum: [
      'LEAVE_SUBMITTED',
      'LEAVE_APPROVED',
      'LEAVE_REJECTED',
      'TASK_ASSIGNED',
      'TASK_DUE',
      'TASK_OVERDUE',
      'BIRTHDAY',
      'ANNIVERSARY',
      'POLICY_ACKNOWLEDGEMENT',
      'DOCUMENT_EXPIRY',
      'PROBATION_ENDING',
      'EVENT_REMINDER',
      'RECOGNITION_NOMINATION',
      'SALARY_SLIP_AVAILABLE',
      'SAAS_RENEWAL',
      'SYSTEM_ANNOUNCEMENT',
    ],
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  link: {
    type: String,
    default: '',
    trim: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  readAt: {
    type: Date,
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  },
  channelStatuses: {
    inApp: {
      type: String,
      enum: ['pending', 'delivered', 'failed'],
      default: 'delivered',
    },
    email: {
      type: String,
      enum: ['none', 'queued', 'sent', 'failed'],
      default: 'none',
    },
    whatsapp: {
      type: String,
      enum: ['none', 'queued', 'sent', 'failed'],
      default: 'none',
    },
  },
  created: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
  // Idempotency identifier to prevent duplicate notifications on retry
  eventId: {
    type: String,
    trim: true,
    index: true,
  },
  // Expiry/archive metadata
  expiresAt: {
    type: Date,
  },
  archivedAt: {
    type: Date,
  },
});

schema.pre('save', function (next) {
  this.updated = Date.now();
  if (this.isModified('read') && this.read && !this.readAt) {
    this.readAt = Date.now();
  }
  next();
});

module.exports = mongoose.model('Notification', schema);

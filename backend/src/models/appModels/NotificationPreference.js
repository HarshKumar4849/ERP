const mongoose = require('mongoose');

const defaultTypePref = () => ({
  inApp: true,
  email: true,
  whatsapp: false,
});

const schema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
    required: true,
    unique: true,
    index: true,
  },
  employee: {
    type: mongoose.Schema.ObjectId,
    ref: 'Employee',
    index: true,
  },
  // Master Channel Toggles
  channels: {
    inApp: {
      type: Boolean,
      default: true,
    },
    email: {
      type: Boolean,
      default: true,
    },
    whatsapp: {
      type: Boolean,
      default: false,
    },
  },
  whatsappPhone: {
    type: String,
    trim: true,
    default: '',
  },
  // Granular Category / Event Preferences
  typePreferences: {
    leaveSubmitted: { type: Object, default: defaultTypePref },
    leaveApproved: { type: Object, default: defaultTypePref },
    leaveRejected: { type: Object, default: defaultTypePref },
    taskAssigned: { type: Object, default: defaultTypePref },
    taskDue: { type: Object, default: defaultTypePref },
    taskOverdue: { type: Object, default: () => ({ inApp: true, email: true, whatsapp: true }) },
    birthday: { type: Object, default: defaultTypePref },
    anniversary: { type: Object, default: defaultTypePref },
    policyAcknowledgement: { type: Object, default: defaultTypePref },
    documentExpiry: { type: Object, default: defaultTypePref },
    probationEnding: { type: Object, default: defaultTypePref },
    eventReminder: { type: Object, default: defaultTypePref },
    recognitionNomination: { type: Object, default: defaultTypePref },
    salarySlipAvailable: { type: Object, default: defaultTypePref },
    saasRenewal: { type: Object, default: defaultTypePref },
  },
  // Do Not Disturb
  dndEnabled: {
    type: Boolean,
    default: false,
  },
  dndStart: {
    type: String,
    default: '22:00',
  },
  dndEnd: {
    type: String,
    default: '08:00',
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

module.exports = mongoose.model('NotificationPreference', schema);

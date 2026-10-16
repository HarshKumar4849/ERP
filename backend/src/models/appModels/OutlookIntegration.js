const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
    index: true,
  },
  scopeType: {
    type: String,
    enum: ['user', 'organization'],
    default: 'organization',
  },
  provider: {
    type: String,
    enum: ['google', 'microsoft'],
    default: 'google',
  },
  googleEmail: {
    type: String,
    trim: true,
    default: '',
  },
  meetEnabled: {
    type: Boolean,
    default: true,
  },
  outlookEmail: {
    type: String,
    trim: true,
    default: '',
  },
  displayName: {
    type: String,
    trim: true,
    default: '',
  },
  tenantId: {
    type: String,
    trim: true,
    default: 'common',
  },
  isConnected: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['connected', 'disconnected', 'token_expired', 'syncing', 'error'],
    default: 'disconnected',
  },
  // OAuth Tokens (Strictly tokens only - never store Microsoft passwords!)
  accessToken: {
    type: String,
    default: '',
  },
  refreshToken: {
    type: String,
    default: '',
  },
  tokenExpiresAt: {
    type: Date,
  },
  tokenScope: {
    type: String,
    default: 'Calendars.ReadWrite offline_access User.Read',
  },
  // Sync Configuration
  syncDirection: {
    type: String,
    enum: ['two-way', 'to-outlook', 'from-outlook'],
    default: 'two-way',
  },
  sourceOfTruth: {
    type: String,
    enum: ['TECMOTIV', 'OUTLOOK'],
    default: 'TECMOTIV',
  },
  autoSyncIntervalMinutes: {
    type: Number,
    default: 60,
  },
  // Sync Status & Metrics
  lastSyncAt: {
    type: Date,
  },
  lastSyncStatus: {
    type: String,
    enum: ['success', 'partial', 'failed', 'never'],
    default: 'never',
  },
  syncedCount: {
    type: Number,
    default: 0,
  },
  lastError: {
    type: String,
    default: '',
  },
  syncLogs: [
    {
      timestamp: {
        type: Date,
        default: Date.now,
      },
      action: {
        type: String,
        default: 'sync',
      },
      details: {
        type: String,
        default: '',
      },
      status: {
        type: String,
        default: 'success',
      },
      count: {
        type: Number,
        default: 0,
      },
    },
  ],
  isSandbox: {
    type: Boolean,
    default: false,
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

// CRITICAL SECURITY RULE: NEVER STORE MICROSOFT PASSWORDS
schema.virtual('password').set(function () {
  throw new Error('SECURITY VIOLATION: Storing Microsoft account passwords in ERP is strictly forbidden! Only OAuth access/refresh tokens are permitted.');
});

schema.virtual('microsoftPassword').set(function () {
  throw new Error('SECURITY VIOLATION: Storing Microsoft account passwords in ERP is strictly forbidden! Only OAuth access/refresh tokens are permitted.');
});

schema.virtual('accountPassword').set(function () {
  throw new Error('SECURITY VIOLATION: Storing Microsoft account passwords in ERP is strictly forbidden! Only OAuth access/refresh tokens are permitted.');
});

schema.pre('validate', function (next) {
  if (
    this.password ||
    this.microsoftPassword ||
    this.accountPassword ||
    (this._doc && (this._doc.password || this._doc.microsoftPassword || this._doc.accountPassword))
  ) {
    return next(
      new Error(
        'SECURITY VIOLATION: Storing Microsoft account passwords in ERP is strictly forbidden! Only OAuth access/refresh tokens are permitted.'
      )
    );
  }
  next();
});

schema.pre('save', function (next) {
  if (
    this.password ||
    this.microsoftPassword ||
    this.accountPassword ||
    (this._doc && (this._doc.password || this._doc.microsoftPassword || this._doc.accountPassword))
  ) {
    return next(
      new Error(
        'SECURITY VIOLATION: Storing Microsoft account passwords in ERP is strictly forbidden! Only OAuth access/refresh tokens are permitted.'
      )
    );
  }
  this.updated = Date.now();
  next();
});

module.exports = mongoose.model('OutlookIntegration', schema);

const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  serviceName: {
    type: String,
    required: true,
    trim: true,
  },
  serviceType: {
    type: String,
    enum: [
      'Microsoft 365',
      'Email Accounts',
      'Domain',
      'Hostinger',
      'AWS',
      'Claude',
      'Google Cloud',
      'Canva',
      'CRM',
      'Other SaaS',
    ],
    required: true,
    default: 'Other SaaS',
  },
  customServiceName: {
    type: String,
    trim: true,
    default: '',
  },
  accountOwner: {
    type: mongoose.Schema.ObjectId,
    ref: 'Employee',
  },
  accountOwnerName: {
    type: String,
    trim: true,
    default: 'IT Operations Lead',
  },
  loginEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  renewalDate: {
    type: Date,
    required: true,
  },
  billingCycle: {
    type: String,
    enum: ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly', 'Multi-Year', 'One-Time'],
    default: 'Yearly',
  },
  cost: {
    type: Number,
    required: true,
    default: 0,
  },
  currency: {
    type: String,
    enum: ['INR', 'USD', 'EUR', 'GBP'],
    default: 'INR',
  },
  paymentMethod: {
    type: String,
    enum: [
      'Corporate Credit Card',
      'Bank Wire / NEFT',
      'Auto-Debit / Standing Instruction',
      'PayPal',
      'UPI / Net Banking',
      'Corporate Debit Card',
      'Vendor Invoice / PO',
      'Other',
    ],
    default: 'Corporate Credit Card',
  },
  paymentMethodDetails: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['Active', 'Expiring Soon', 'Expired', 'Cancelled', 'Under Review'],
    default: 'Active',
  },
  reminderDaysBefore: {
    type: Number,
    default: 15,
  },
  reminderSent: {
    type: Boolean,
    default: false,
  },
  notes: {
    type: String,
    default: '',
  },
  serviceUrl: {
    type: String,
    trim: true,
    default: '',
  },
  department: {
    type: String,
    default: 'IT',
  },
  lastRenewedDate: {
    type: Date,
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
  },
  updatedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
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

// CRITICAL SECURITY ENFORCEMENT:
// NEVER store passwords or secrets in the ERP under any circumstance.
schema.pre('save', function (next) {
  this.updated = Date.now();

  // Strip any accidental or injected credential properties
  if (this._doc) {
    delete this._doc.password;
    delete this._doc.secret;
    delete this._doc.apiKey;
    delete this._doc.token;
  }

  // Automatic status calculation based on renewal date
  if (this.renewalDate && this.status !== 'Cancelled') {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const renewal = new Date(this.renewalDate.getFullYear(), this.renewalDate.getMonth(), this.renewalDate.getDate());

    const diffMs = renewal.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      this.status = 'Expired';
    } else if (daysLeft <= (this.reminderDaysBefore || 15)) {
      this.status = 'Expiring Soon';
    } else if (this.status === 'Expired' || this.status === 'Expiring Soon') {
      this.status = 'Active';
    }
  }

  next();
});

module.exports = mongoose.model('DigitalService', schema);

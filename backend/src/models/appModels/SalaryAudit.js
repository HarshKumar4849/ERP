const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  salary: {
    type: mongoose.Schema.ObjectId,
    ref: 'Salary',
    required: true,
    index: true,
  },
  employee: {
    type: mongoose.Schema.ObjectId,
    ref: 'Employee',
    required: true,
  },
  employeeName: {
    type: String,
    default: '',
  },
  periodLabel: {
    type: String,
    default: '',
  },
  action: {
    type: String,
    enum: ['CREATED', 'UPDATED', 'STATUS_CHANGE', 'SLIP_GENERATED', 'SLIP_DOWNLOADED', 'DELETED'],
    required: true,
  },
  performedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
    required: true,
  },
  performedByName: {
    type: String,
    default: '',
  },
  performedByRole: {
    type: String,
    default: '',
  },
  details: {
    type: String,
    default: '',
  },
  previousValues: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  newValues: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  ipAddress: {
    type: String,
    default: '',
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model('SalaryAudit', schema);

const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    removed: {
      type: Boolean,
      default: false,
    },
    // Asset Core Details
    name: {
      type: String,
      required: true,
      trim: true,
    },
    assetId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    category: {
      type: String,
      enum: ['Laptop', 'Monitor', 'Mobile', 'Furniture', 'Equipment', 'Pantry', 'Stationery', 'Other'],
      default: 'Laptop',
    },
    brand: {
      type: String,
      trim: true,
      default: '',
    },
    model: {
      type: String,
      trim: true,
      default: '',
    },
    serialNumber: {
      type: String,
      trim: true,
      default: '',
    },

    // Lifecycle Status: Available -> Issued -> Returned -> Maintenance -> Available
    status: {
      type: String,
      enum: ['Available', 'Issued', 'Returned', 'Maintenance'],
      default: 'Available',
      index: true,
    },

    // Current Assignment Details
    employee: {
      type: mongoose.Schema.ObjectId,
      ref: 'Employee',
      index: true,
    },
    employeeName: {
      type: String,
      default: '',
    },
    employeeCode: {
      type: String,
      default: '',
    },
    dateIssued: {
      type: Date,
    },
    condition: {
      type: String,
      enum: ['New', 'Good', 'Fair', 'Damaged'],
      default: 'Good',
    },
    returnDate: {
      type: Date,
    },
    expectedReturnDate: {
      type: Date,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },

    // Maintenance Details
    maintenanceIssue: {
      type: String,
      default: '',
    },
    maintenanceVendor: {
      type: String,
      default: '',
    },
    maintenanceCost: {
      type: Number,
      default: 0,
    },
    maintenanceStartDate: {
      type: Date,
    },
    maintenanceEndDate: {
      type: Date,
    },

    // Purchase & Location Details
    cost: {
      type: Number,
      default: 0,
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    location: {
      type: String,
      default: 'HQ - Bangalore',
    },

    // Complete Lifecycle & Assignment History
    history: [
      {
        action: {
          type: String,
          enum: [
            'CREATED',
            'ASSIGNED',
            'RETURNED',
            'SENT_TO_MAINTENANCE',
            'MAINTENANCE_COMPLETED',
            'STATUS_CHANGE',
          ],
          required: true,
        },
        employee: {
          type: mongoose.Schema.ObjectId,
          ref: 'Employee',
        },
        employeeName: String,
        date: {
          type: Date,
          default: Date.now,
        },
        condition: String,
        performedBy: {
          type: mongoose.Schema.ObjectId,
          ref: 'Admin',
        },
        performedByName: String,
        remarks: String,
      },
    ],

    created: {
      type: Date,
      default: Date.now,
    },
    updated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

schema.pre('save', function (next) {
  this.updated = Date.now();
  next();
});

module.exports = mongoose.model('Asset', schema);

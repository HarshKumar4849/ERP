const mongoose = require('mongoose');

const deliverableSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  dueDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed'],
    default: 'Pending',
  },
  completedAt: {
    type: Date,
  },
});

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  date: {
    type: Date,
    required: true,
  },
  meetingLink: {
    type: String,
    trim: true,
    default: '',
  },
  agenda: {
    type: String,
    trim: true,
    default: '',
  },
  calendarEvent: {
    type: mongoose.Schema.ObjectId,
    ref: 'Event',
  },
});

const documentItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  fileName: {
    type: String,
    trim: true,
  },
  fileUrl: {
    type: String,
    trim: true,
  },
  fileType: {
    type: String,
    default: 'PDF',
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  documentRef: {
    type: mongoose.Schema.ObjectId,
    ref: 'Document',
  },
});

const githubRepoSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    repoId: {
      type: Number,
    },
    repoOwner: {
      type: String,
      trim: true,
    },
    repoName: {
      type: String,
      trim: true,
    },
    fullName: {
      type: String,
      trim: true,
    },
    repoUrl: {
      type: String,
      trim: true,
    },
    defaultBranch: {
      type: String,
      default: 'main',
    },
    lastSyncAt: {
      type: Date,
    },
    syncStatus: {
      type: String,
      enum: ['idle', 'syncing', 'success', 'error'],
      default: 'idle',
    },
    syncError: {
      type: String,
      default: '',
    },
    linkedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'Admin',
    },
    linkedAt: {
      type: Date,
    },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    removed: {
      type: Boolean,
      default: false,
    },
    // GitHub Integration Linkage
    github: {
      type: githubRepoSchema,
      default: () => ({ enabled: false, syncStatus: 'idle' }),
    },
    // Core Fields
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
    client: {
      type: String,
      required: true,
      trim: true,
      default: 'Internal Client',
    },
    category: {
      type: String,
      enum: ['MDS', 'B2B', 'B2G', 'Consulting', 'Events'],
      required: true,
      index: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Stakeholders (Referenced to Employee collection)
    projectManager: {
      type: mongoose.Schema.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    projectManagerName: {
      type: String,
      default: '',
    },
    teamMembers: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'Employee',
        index: true,
      },
    ],

    // Timeline & Financials
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    targetDate: {
      type: Date,
      required: true,
    },
    budget: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Planning', 'In Progress', 'On Hold', 'Completed', 'Overdue', 'Cancelled', 'active'],
      default: 'In Progress',
      index: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Connected Resources
    deliverables: {
      type: [deliverableSchema],
      default: [],
    },
    meetings: {
      type: [meetingSchema],
      default: [],
    },
    documents: {
      type: [documentItemSchema],
      default: [],
    },

    // Detailed Notes
    notes: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },

    // System
    createdBy: {
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

module.exports = mongoose.model('Project', schema);

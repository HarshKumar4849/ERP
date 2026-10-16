const mongoose = require('mongoose');

const subtaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
  },
  assignedTo: {
    type: mongoose.Schema.ObjectId,
    ref: 'Employee',
  },
});

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
  },
  employee: {
    type: mongoose.Schema.ObjectId,
    ref: 'Employee',
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
  comment: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const attachmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  file: {
    type: String,
    required: true,
    trim: true,
  },
  size: {
    type: Number,
    default: 0,
  },
  fileType: {
    type: String,
    default: 'file',
  },
  uploadedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
  },
  uploadedByName: {
    type: String,
    trim: true,
    default: '',
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const githubCommitLinkSchema = new mongoose.Schema({
  sha: { type: String, required: true, trim: true },
  shortSha: { type: String, trim: true },
  message: { type: String, trim: true, default: '' },
  author: { type: String, trim: true, default: '' },
  url: { type: String, trim: true, default: '' },
  date: { type: Date, default: Date.now },
  linkedAt: { type: Date, default: Date.now },
  linkedBy: { type: mongoose.Schema.ObjectId, ref: 'Admin' },
});

const githubPullLinkSchema = new mongoose.Schema({
  number: { type: Number, required: true },
  title: { type: String, trim: true, default: '' },
  state: { type: String, trim: true, default: 'open' },
  url: { type: String, trim: true, default: '' },
  isMerged: { type: Boolean, default: false },
  headBranch: { type: String, trim: true, default: '' },
  baseBranch: { type: String, trim: true, default: '' },
  linkedAt: { type: Date, default: Date.now },
  linkedBy: { type: mongoose.Schema.ObjectId, ref: 'Admin' },
});

const githubBranchLinkSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  url: { type: String, trim: true, default: '' },
  linkedAt: { type: Date, default: Date.now },
  linkedBy: { type: mongoose.Schema.ObjectId, ref: 'Admin' },
});

const schema = new mongoose.Schema(
  {
    removed: {
      type: Boolean,
      default: false,
    },
    // Task name / summary
    task: {
      type: String,
      required: true,
      trim: true,
    },
    // Backward compatibility alias with title
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    // Owner / Assignee (Employee reference)
    owner: {
      type: mongoose.Schema.ObjectId,
      ref: 'Employee',
    },
    // Auth user link for owner
    assignedTo: {
      type: mongoose.Schema.ObjectId,
      ref: 'Admin',
    },
    ownerName: {
      type: String,
      trim: true,
      default: '',
    },
    // Reviewer (Employee reference)
    reviewer: {
      type: mongoose.Schema.ObjectId,
      ref: 'Employee',
    },
    reviewerUser: {
      type: mongoose.Schema.ObjectId,
      ref: 'Admin',
    },
    reviewerName: {
      type: String,
      trim: true,
      default: '',
    },
    // Department
    department: {
      type: String,
      required: true,
      trim: true,
    },
    // Project reference or name
    project: {
      type: mongoose.Schema.ObjectId,
      ref: 'Project',
    },
    projectName: {
      type: String,
      trim: true,
      default: '',
    },
    // Priority: Low, Medium, High, Critical
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },
    // Due Date
    dueDate: {
      type: Date,
      required: true,
    },
    // Status: Not Started, In Progress, Waiting, Completed, Overdue, Cancelled
    status: {
      type: String,
      enum: ['Not Started', 'In Progress', 'Waiting', 'Completed', 'Overdue', 'Cancelled'],
      default: 'Not Started',
    },
    // Subtasks checklist
    subtasks: {
      type: [subtaskSchema],
      default: [],
    },
    // Comment thread
    comments: {
      type: [commentSchema],
      default: [],
    },
    // File attachments
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    // Linked GitHub Engineering artifacts
    githubLinks: {
      branches: {
        type: [githubBranchLinkSchema],
        default: [],
      },
      commits: {
        type: [githubCommitLinkSchema],
        default: [],
      },
      pullRequests: {
        type: [githubPullLinkSchema],
        default: [],
      },
    },
    completedAt: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'Admin',
    },
    createdByName: {
      type: String,
      trim: true,
      default: '',
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

// Keep title and task in sync
schema.pre('validate', function (next) {
  if (this.task && !this.title) {
    this.title = this.task;
  } else if (this.title && !this.task) {
    this.task = this.title;
  }
  next();
});

// Auto timestamp and auto status adjustments
schema.pre('save', function (next) {
  this.updated = Date.now();
  if (this.status === 'Completed' && !this.completedAt) {
    this.completedAt = new Date();
  } else if (this.status !== 'Completed' && this.completedAt) {
    this.completedAt = undefined;
  }
  next();
});

// Virtual for overdue detection
schema.virtual('isOverdue').get(function () {
  if (!this.dueDate) return false;
  if (this.status === 'Completed' || this.status === 'Cancelled') return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return new Date(this.dueDate) < new Date();
});

// Virtual for subtasks completion progress percentage
schema.virtual('subtaskProgress').get(function () {
  if (!this.subtasks || this.subtasks.length === 0) return 100;
  const completed = this.subtasks.filter((s) => s.completed).length;
  return Math.round((completed / this.subtasks.length) * 100);
});

module.exports = mongoose.model('Task', schema);

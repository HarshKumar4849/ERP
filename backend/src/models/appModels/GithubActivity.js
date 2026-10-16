const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    deliveryId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    event: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    action: {
      type: String,
      default: '',
      trim: true,
    },
    project: {
      type: mongoose.Schema.ObjectId,
      ref: 'Project',
      index: true,
      default: null,
    },
    repository: {
      id: { type: Number, default: null },
      fullName: { type: String, default: '', trim: true },
      name: { type: String, default: '', trim: true },
      owner: { type: String, default: '', trim: true },
    },
    sender: {
      login: { type: String, default: '', trim: true },
      avatarUrl: { type: String, default: '', trim: true },
    },
    summary: {
      type: String,
      default: '',
      trim: true,
    },
    payloadSummary: {
      ref: { type: String, default: '' },
      headCommitSha: { type: String, default: '' },
      commitCount: { type: Number, default: 0 },
      commits: [
        {
          sha: String,
          shortSha: String,
          message: String,
          author: String,
          url: String,
        },
      ],
      pullRequest: {
        number: Number,
        title: String,
        state: String,
        url: String,
        isMerged: Boolean,
      },
      issue: {
        number: Number,
        title: String,
        state: String,
        url: String,
      },
    },
    processed: {
      type: Boolean,
      default: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
  }
);

schema.index({ project: 1, created: -1 });

module.exports = mongoose.model('GithubActivity', schema);

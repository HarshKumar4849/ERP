const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  removed: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    enum: ['HR Templates', 'Communication', 'Marketing/Event'],
    required: true,
  },
  type: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  subject: {
    type: String,
    default: '',
  },
  content: {
    type: String,
    required: true,
  },
  variables: [
    {
      name: {
        type: String,
        required: true,
      },
      description: {
        type: String,
        default: '',
      },
      defaultValue: {
        type: String,
        default: '',
      },
    },
  ],
  isDefault: {
    type: Boolean,
    default: false,
  },
  tags: [String],
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

schema.pre('save', function (next) {
  this.updated = Date.now();
  if (this.content && (!this.variables || this.variables.length === 0)) {
    const matches = this.content.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
    if (matches) {
      const uniqueNames = [...new Set(matches.map((m) => m.replace(/[\{\}\s]/g, '')))];
      this.variables = uniqueNames.map((name) => ({
        name,
        description: `Dynamic value for ${name}`,
        defaultValue: '',
      }));
    }
  }
  next();
});

module.exports = mongoose.model('Template', schema);

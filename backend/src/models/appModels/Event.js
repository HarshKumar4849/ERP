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
  eventName: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  eventType: {
    type: String,
    enum: [
      'Birthday',
      'Anniversary',
      'Recognition',
      'Festival',
      'Company Event',
      'Webinar',
      'Client Event',
      'Training',
      'CSR Activity',
      // Backward-compatibility:
      'Meeting',
      'Event',
      'Company Activity',
      'Project Milestone',
      'Deadline',
      'Holiday',
    ],
    default: 'Company Event',
  },
  date: {
    type: Date,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
  },
  time: {
    type: String,
    default: '10:00 AM',
  },
  startTime: {
    type: String,
    default: '10:00 AM',
  },
  endTime: {
    type: String,
    default: '12:00 PM',
  },
  venue: {
    type: String,
    default: 'TecMotiv Corporate Auditorium',
  },
  location: {
    type: String,
    default: 'TecMotiv Corporate Auditorium',
  },
  department: {
    type: String,
    default: 'All',
  },
  project: {
    type: mongoose.Schema.ObjectId,
    ref: 'Project',
    index: true,
  },
  organizer: {
    type: mongoose.Schema.ObjectId,
    ref: 'Admin',
  },
  organizerName: {
    type: String,
    trim: true,
    default: 'TecMotiv Events & Culture Committee',
  },
  participants: [
    {
      employee: {
        type: mongoose.Schema.ObjectId,
        ref: 'Employee',
      },
      name: {
        type: String,
        default: '',
      },
      email: {
        type: String,
        default: '',
      },
      status: {
        type: String,
        enum: ['Invited', 'Accepted', 'Declined', 'Attended', 'Absent'],
        default: 'Invited',
      },
      respondedAt: {
        type: Date,
      },
    },
  ],
  attendees: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'Employee',
    },
  ],
  isVirtual: {
    type: Boolean,
    default: false,
  },
  meetingLink: {
    type: String,
    default: '',
  },
  invitation: {
    subject: {
      type: String,
      default: '',
    },
    message: {
      type: String,
      default: '',
    },
    sent: {
      type: Boolean,
      default: false,
    },
    sentAt: {
      type: Date,
    },
    sentBy: {
      type: String,
      default: '',
    },
    recipientCount: {
      type: Number,
      default: 0,
    },
  },
  poster: {
    type: String,
    default: '',
  },
  photos: [
    {
      url: {
        type: String,
        required: true,
      },
      caption: {
        type: String,
        default: '',
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  videos: [
    {
      url: {
        type: String,
        required: true,
      },
      title: {
        type: String,
        default: '',
      },
      platform: {
        type: String,
        default: 'YouTube',
      },
    },
  ],
  eventReport: {
    summary: {
      type: String,
      default: '',
    },
    attendanceCount: {
      type: Number,
      default: 0,
    },
    highlights: {
      type: String,
      default: '',
    },
    outcomes: {
      type: String,
      default: '',
    },
    submittedBy: {
      type: String,
      default: '',
    },
    submittedAt: {
      type: Date,
    },
  },
  reminderDaysBefore: {
    type: Number,
    default: 7, // Default reminder: 7 days before the occasion
  },
  reminderScheduled: {
    type: Boolean,
    default: true,
  },
  // Microsoft 365 / Outlook Integration Fields
  outlookEventId: {
    type: String,
    trim: true,
    index: true,
    sparse: true,
  },
  outlookChangeKey: {
    type: String,
    trim: true,
  },
  lastSyncedToOutlook: {
    type: Date,
  },
  syncSource: {
    type: String,
    enum: ['TECMOTIV', 'OUTLOOK'],
    default: 'TECMOTIV',
  },
  status: {
    type: String,
    enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Scheduled',
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
  if (this.title && !this.eventName) {
    this.eventName = this.title;
  } else if (this.eventName && !this.title) {
    this.title = this.eventName;
  }
  if (this.startDate && !this.date) {
    this.date = this.startDate;
  } else if (this.date && !this.startDate) {
    this.startDate = this.date;
  }
  if (this.venue && !this.location) {
    this.location = this.venue;
  } else if (this.location && !this.venue) {
    this.venue = this.location;
  }
  next();
});

module.exports = mongoose.model('Event', schema);


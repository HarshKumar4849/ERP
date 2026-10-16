require('module-alias/register');
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

const seedNotificationsData = async () => {
  try {
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    console.log('Connected to MongoDB for Notification Seeding.');

    const Admin = require('../models/coreModels/Admin');
    const Notification = require('../models/appModels/Notification');
    const NotificationPreference = require('../models/appModels/NotificationPreference');
    const notificationService = require('../services/notificationService');

    const admins = await Admin.find({});
    if (!admins || admins.length === 0) {
      console.log('No admin users found to seed notifications for.');
      process.exit(0);
    }

    const primaryAdmin = admins.find(a => a.email === 'admin@demo.com') || admins[0];

    // Initialize Notification Preferences
    await NotificationPreference.findOneAndUpdate(
      { user: primaryAdmin._id },
      {
        user: primaryAdmin._id,
        channels: { inApp: true, email: true, whatsapp: true },
        whatsappPhone: '+91 98765 43210',
        dndEnabled: false,
      },
      { upsert: true, new: true }
    );

    // Clean existing seed notifications
    await Notification.deleteMany({ recipient: primaryAdmin._id });

    const sampleNotifications = [
      {
        recipient: primaryAdmin._id,
        type: 'LEAVE_SUBMITTED',
        title: 'Leave Application Submitted: Vikram Malhotra',
        message: 'Vikram Malhotra submitted a Casual Leave request for 3 days (Oct 12 - Oct 15). Review pending.',
        link: '/leave',
        priority: 'normal',
      },
      {
        recipient: primaryAdmin._id,
        type: 'TASK_ASSIGNED',
        title: 'New Task Assigned: Deploy Telemetry Microservice',
        message: 'You have been assigned task "Deploy Telemetry Microservice v2.4". Due Oct 18, 2026.',
        link: '/tasks',
        priority: 'high',
      },
      {
        recipient: primaryAdmin._id,
        type: 'BIRTHDAY',
        title: '🎂 Birthday Today: Priya Nair',
        message: "Today is Priya Nair's birthday (Design & UI/UX)! Send them your warmest wishes.",
        link: '/calendar',
        priority: 'normal',
      },
      {
        recipient: primaryAdmin._id,
        type: 'ANNIVERSARY',
        title: '🏆 3 Year Work Anniversary: Amit Sharma',
        message: 'Congratulations to Amit Sharma for completing 3 years of dedication at TecMotiv Solutions!',
        link: '/calendar',
        priority: 'normal',
      },
      {
        recipient: primaryAdmin._id,
        type: 'POLICY_ACKNOWLEDGEMENT',
        title: 'Policy Acknowledgement Required',
        message: 'Please review and acknowledge the updated "TecMotiv Data Security & Privacy Policy v2.1".',
        link: '/policies',
        priority: 'high',
      },
      {
        recipient: primaryAdmin._id,
        type: 'DOCUMENT_EXPIRY',
        title: 'Document Expiring Soon: Passport Copy',
        message: 'Employee ID TM-EMP-104 passport documentation expires in 15 days.',
        link: '/employee',
        priority: 'high',
      },
      {
        recipient: primaryAdmin._id,
        type: 'PROBATION_ENDING',
        title: 'Probation Ending: Neha Kulkarni',
        message: 'Probation period for Neha Kulkarni concludes in 7 days. Performance review required.',
        link: '/employee',
        priority: 'normal',
      },
      {
        recipient: primaryAdmin._id,
        type: 'EVENT_REMINDER',
        title: 'Event Reminder: Q4 Strategy Townhall',
        message: 'TecMotiv All-Hands Strategy Townhall starts tomorrow at 10:00 AM in the Corporate Auditorium.',
        link: '/events',
        priority: 'normal',
      },
      {
        recipient: primaryAdmin._id,
        type: 'RECOGNITION_NOMINATION',
        title: '🌟 Star of the Quarter Award',
        message: 'You have been recognized as Star of the Quarter for leadership during enterprise migration!',
        link: '/recognition',
        priority: 'normal',
      },
      {
        recipient: primaryAdmin._id,
        type: 'SALARY_SLIP_AVAILABLE',
        title: 'Salary Slip Available: September 2026',
        message: 'Your verified salary slip for September 2026 is ready for download in your self-service portal.',
        link: '/payroll',
        priority: 'normal',
      },
      {
        recipient: primaryAdmin._id,
        type: 'SAAS_RENEWAL',
        title: 'Digital Service Renewal Due: AWS Cloud Hosting',
        message: 'AWS Cloud Hosting annual subscription is due for renewal on Oct 25, 2026 (₹4,50,000/yr).',
        link: '/admin',
        priority: 'urgent',
      },
      {
        recipient: primaryAdmin._id,
        type: 'TASK_OVERDUE',
        title: '⚠️ Task Overdue: ISO 27001 Internal Audit Checklist',
        message: 'Task was due on Oct 05, 2026 and requires immediate sign-off.',
        link: '/tasks',
        priority: 'urgent',
      },
    ];

    for (const notif of sampleNotifications) {
      await notificationService.notify(notif);
    }

    console.log(`✅ Successfully seeded ${sampleNotifications.length} notifications for ${primaryAdmin.email}!`);
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedNotificationsData();

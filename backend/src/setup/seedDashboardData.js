require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function seedDashboardData() {
  try {
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    console.log('✅ Connected to MongoDB');

    const Admin = require('../models/coreModels/Admin');
    const Announcement = require('../models/appModels/Announcement');
    const Event = require('../models/appModels/Event');
    const Policy = require('../models/appModels/Policy');
    const Employee = require('../models/appModels/Employee');

    const mgmtUser = await Admin.findOne({ email: 'management@tecmotiv.com' });
    const hrUser = await Admin.findOne({ email: 'hr@tecmotiv.com' });

    // Ensure employees have valid birthDate and joiningDate for testing birthdays and anniversaries
    const employees = await Employee.find({ removed: false });
    const now = new Date();
    const currentMonth = now.getMonth();

    if (employees.length >= 2) {
      // Set employee 1 birthday to this month
      const bDate1 = new Date(1994, currentMonth, (now.getDate() + 2) % 28 + 1);
      employees[0].birthDate = bDate1;
      // Set joining date to 2 years ago this month
      employees[0].joiningDate = new Date(now.getFullYear() - 2, currentMonth, 15);
      await employees[0].save();

      // Set employee 2 birthday to today!
      const bDate2 = new Date(1996, currentMonth, now.getDate());
      employees[1].birthDate = bDate2;
      // Set joining date to 1 year ago this month
      employees[1].joiningDate = new Date(now.getFullYear() - 1, currentMonth, now.getDate());
      await employees[1].save();

      console.log(`✅ Configured test birthdays and work anniversaries for ${employees[0].name} and ${employees[1].name}`);
    }

    // Seed Announcements
    await Announcement.deleteMany({});

    const announcementsToSeed = [
      {
        title: 'TecMotiv Q4 Strategic Roadmap & Executive Town Hall',
        content: 'Join the executive leadership team this Friday at 3:00 PM EST for our all-hands presentation on product milestones and corporate expansion.',
        category: 'Announcement',
        priority: 'High',
        pinned: true,
        department: 'All',
        author: mgmtUser?._id,
        authorName: 'Marcus Vance (Managing Director)',
        date: new Date(),
      },
      {
        title: 'Information Security: Mandatory Multi-Factor Authentication',
        content: 'All staff must verify their MFA authenticator backup codes by end of this week in accordance with ISO 27001 requirements.',
        category: 'Important Notice',
        priority: 'Urgent',
        pinned: true,
        department: 'Administration',
        author: mgmtUser?._id,
        authorName: 'Alex Mercer (Systems Administrator)',
        date: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        title: 'TecMotiv Awarded Best Enterprise Mobility Innovator 2026',
        content: 'We are thrilled to announce that TecMotiv has been recognized as a top automotive & ERP mobility innovator by TechReview Global.',
        category: 'News',
        priority: 'Normal',
        pinned: false,
        department: 'Marketing',
        author: mgmtUser?._id,
        authorName: 'Marketing Communications',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'Updated Hybrid Work Guidelines & Flex Time Policy',
        content: 'Human Resources has published revised guidelines covering work-from-home quotas and core collaboration hours in the Policy handbook.',
        category: 'Announcement',
        priority: 'Normal',
        pinned: false,
        department: 'Human Resources',
        author: hrUser?._id,
        authorName: 'Sarah Connor (Head of People)',
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    ];

    for (const a of announcementsToSeed) {
      await new Announcement(a).save();
    }
    console.log(`✅ Seeded ${announcementsToSeed.length} Announcements & Notices`);

    // Seed Events & Meetings
    await Event.deleteMany({});

    const todayMeetingDate = new Date();
    todayMeetingDate.setHours(14, 30, 0, 0);

    const todayEventDate = new Date();
    todayEventDate.setHours(16, 0, 0, 0);

    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 4);
    nextWeekDate.setHours(11, 0, 0, 0);

    const eventsToSeed = [
      {
        title: 'Executive Sprint Review & Operations Sync',
        description: 'Review cross-functional OKRs, sprint velocity, and resource allocations.',
        eventType: 'Meeting',
        startDate: todayMeetingDate,
        endDate: new Date(todayMeetingDate.getTime() + 60 * 60 * 1000),
        location: 'Boardroom A / Zoom Bridge',
        isVirtual: true,
        meetingLink: 'https://meet.tecmotiv.com/exec-sync',
        organizer: mgmtUser?._id,
        organizerName: 'Marcus Vance',
      },
      {
        title: 'TecMotiv Monthly Knowledge Sharing Session',
        description: 'Tech talk on Event-Driven Architecture with Kafka and MongoDB Change Streams.',
        eventType: 'Event',
        startDate: todayEventDate,
        endDate: new Date(todayEventDate.getTime() + 90 * 60 * 1000),
        location: 'Innovation Hub Amphitheater',
        isVirtual: false,
        organizer: mgmtUser?._id,
        organizerName: 'Engineering Guild',
      },
      {
        title: 'Q4 Global Product Demo & Client Showcase',
        description: 'Live walkthrough of enterprise features with strategic enterprise automotive partners.',
        eventType: 'Webinar',
        startDate: nextWeekDate,
        endDate: new Date(nextWeekDate.getTime() + 120 * 60 * 1000),
        location: 'Virtual Event Platform',
        isVirtual: true,
        meetingLink: 'https://webinar.tecmotiv.com/q4-showcase',
        organizer: mgmtUser?._id,
        organizerName: 'Product & Marketing Team',
      },
    ];

    for (const ev of eventsToSeed) {
      await new Event(ev).save();
    }
    console.log(`✅ Seeded ${eventsToSeed.length} Events & Meetings`);

    // Ensure Policies exist
    const policyCount = await Policy.countDocuments({ removed: false });
    if (policyCount === 0) {
      await new Policy({
        title: 'Data Protection & Privacy Policy (GDPR / CCPA)',
        code: 'POL-SEC-01',
        category: 'Security',
        version: '2.1',
        content: 'Guidelines on managing personal identifiable information and sensitive business data.',
        isMandatory: true,
      }).save();

      await new Policy({
        title: 'Workplace Conduct & Code of Professional Ethics',
        code: 'POL-HR-02',
        category: 'Conduct',
        version: '1.4',
        content: 'Professional behavioral standards and anti-harassment policies.',
        isMandatory: true,
      }).save();

      await new Policy({
        title: 'Remote & Hybrid Collaboration Policy',
        code: 'POL-OPS-03',
        category: 'Operations',
        version: '3.0',
        content: 'Work from home protocols, equipment allocation, and core working hours.',
        isMandatory: false,
      }).save();
      console.log('✅ Seeded Company Policies');
    }

    console.log('\n🎉 DASHBOARD DATA SEEDED SUCCESSFULLY!');
  } catch (err) {
    console.error('Error seeding dashboard data:', err);
  } finally {
    await mongoose.disconnect();
  }
}

seedDashboardData();

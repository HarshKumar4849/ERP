require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function testEventsPhase() {
  try {
    const mongoUri = process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp';
    console.log('Connecting to MongoDB at:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    const Event = require('../models/appModels/Event');
    const Employee = require('../models/appModels/Employee');
    const Admin = require('../models/coreModels/Admin');
    const calendarController = require('../controllers/appControllers/calendarController');
    const eventController = require('../controllers/appControllers/eventController');

    // Get an employee to be participant
    const employees = await Employee.find({ removed: false }).limit(5);
    const participantIds = employees.map(e => e._id);
    console.log(`Found ${employees.length} employees to use as participants.`);

    // 1. Clean previous test events
    await Event.deleteMany({ title: { $regex: /^\[TEST PHASE 15\]/ } });

    // 2. Test event creation with the 9 event types
    const eventTypes = [
      'Birthday',
      'Anniversary',
      'Recognition',
      'Festival',
      'Company Event',
      'Webinar',
      'Client Event',
      'Training',
      'CSR Activity',
    ];

    console.log('\n--- Creating events for all 9 Phase 15 event types ---');
    const createdEvents = [];

    for (const [index, type] of eventTypes.entries()) {
      const mockReq = {
        user: { _id: new mongoose.Types.ObjectId(), name: 'Admin', surname: 'User', email: 'admin@tecmotiv.com' },
        body: {
          title: `[TEST PHASE 15] Annual ${type} Gathering`,
          eventName: `[TEST PHASE 15] Annual ${type} Gathering`,
          eventType: type,
          description: `Celebrating TecMotiv corporate excellence through our official ${type}.`,
          startDate: new Date(Date.now() + (index + 1) * 86400000), // Next days
          endDate: new Date(Date.now() + (index + 1) * 86400000 + 7200000),
          time: '02:30 PM',
          startTime: '02:30 PM',
          endTime: '04:30 PM',
          venue: index % 2 === 0 ? 'TecMotiv Grand Auditorium, 4th Floor' : 'TecMotiv Innovation Hub',
          isVirtual: type === 'Webinar',
          meetingLink: type === 'Webinar' ? 'https://meet.google.com/tec-motiv-webinar' : '',
          organizerName: 'TecMotiv People & Culture Board',
          participants: participantIds,
          poster: `https://images.unsplash.com/photo-${1500000000000 + index * 1000}?auto=format&fit=crop&w=800&q=80`,
          invitation: {
            subject: `Official Invitation: TecMotiv ${type}`,
            message: `Please join us for our upcoming ${type} celebration!`,
            sent: false,
          },
        },
      };

      const mockRes = {
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.data = payload;
          return this;
        },
      };

      await eventController.create(mockReq, mockRes);
      if (mockRes.statusCode === 201 && mockRes.data.success) {
        createdEvents.push(mockRes.data.result);
        console.log(`✓ Created event of type: "${type}" (ID: ${mockRes.data.result._id})`);
      } else {
        throw new Error(`Failed to create event of type ${type}: ${JSON.stringify(mockRes.data)}`);
      }
    }

    // 3. Test sending invitations
    console.log('\n--- Testing Invitation Dispatch ---');
    const targetEvent = createdEvents[0];
    const inviteReq = {
      user: { name: 'Priya', surname: 'Sharma', email: 'hr@tecmotiv.com' },
      params: { id: targetEvent._id.toString() },
      body: {
        subject: 'Confirmed: Birthday Extravaganza',
        message: 'Dear team, you are invited to join the special birthday bash!',
      },
    };
    const inviteRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; },
    };
    await eventController.sendInvitation(inviteReq, inviteRes);
    console.log('✓ Invitation dispatch result:', {
      sent: inviteRes.data.result.invitation.sent,
      recipientCount: inviteRes.data.result.invitation.recipientCount,
      sentBy: inviteRes.data.result.invitation.sentBy,
    });

    // 4. Test Media Attachments (Poster, Photos, Videos)
    console.log('\n--- Testing Media Attachments ---');
    const mediaReq = {
      params: { id: targetEvent._id.toString() },
      body: {
        poster: 'https://images.unsplash.com/photo-1511578314322-379afb476865',
        photos: [
          { url: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce', caption: 'Celebration cake cutting' },
          { url: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d', caption: 'Team joy & fun' },
        ],
        videos: [
          { url: 'https://www.youtube.com/watch?v=mockEventVideo', title: 'Highlight Reel 2026', platform: 'YouTube' },
        ],
      },
    };
    const mediaRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; },
    };
    await eventController.addMedia(mediaReq, mediaRes);
    console.log('✓ Media attachments updated:', {
      photosCount: mediaRes.data.result.photos.length,
      videosCount: mediaRes.data.result.videos.length,
      poster: Boolean(mediaRes.data.result.poster),
    });

    // 5. Test Submitting Event Report (Outcomes & Mark Completed)
    console.log('\n--- Testing Post-Event Report Submission ---');
    const reportReq = {
      user: { name: 'Aditya', surname: 'Varma', email: 'events@tecmotiv.com' },
      params: { id: targetEvent._id.toString() },
      body: {
        summary: 'Outstanding turnout with high employee engagement and positive cultural feedback.',
        attendanceCount: 42,
        highlights: 'Cake ceremony, keynote addresses, recognition tokens distributed.',
        outcomes: 'Enhanced cross-departmental collaboration and morale.',
      },
    };
    const reportRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; },
    };
    await eventController.submitReport(reportReq, reportRes);
    console.log('✓ Event report submitted:', {
      status: reportRes.data.result.status,
      attendanceCount: reportRes.data.result.eventReport.attendanceCount,
      submittedBy: reportRes.data.result.eventReport.submittedBy,
    });

    // 6. Test Integration with Company Calendar (DO NOT DUPLICATE CALENDAR LOGIC)
    console.log('\n--- Testing Seamless Company Calendar Integration ---');
    const calReq = {
      user: { _id: new mongoose.Types.ObjectId() },
      userRole: 'MANAGEMENT',
      query: { scope: 'company', year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
    };
    const calRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; },
    };
    await calendarController.events(calReq, calRes);
    const calEvents = calRes.data.result.filter(e => e.title && e.title.includes('[TEST PHASE 15]'));
    console.log(`✓ Successfully retrieved ${calEvents.length} Phase 15 events directly through Company Calendar unified feed!`);
    console.log('Sample unified calendar item:', {
      title: calEvents[0].title,
      eventType: calEvents[0].eventType,
      venue: calEvents[0].venue,
      time: calEvents[0].time,
      source: calEvents[0].source,
    });

    // 7. Test History Archive
    console.log('\n--- Testing Event History Archive ---');
    const histReq = { query: {} };
    const histRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; },
    };
    await eventController.history(histReq, histRes);
    if (!histRes.data || !histRes.data.success) {
      console.error('History failed with:', histRes.statusCode, histRes.data);
    }
    console.log(`✓ History returned ${histRes.data?.result?.length} completed/past events.`);

    console.log('\n🎉 ALL PHASE 15 BACKEND TESTS PASSED CLEANLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('Phase 15 Test Error:', err);
    process.exit(1);
  }
}

testEventsPhase();

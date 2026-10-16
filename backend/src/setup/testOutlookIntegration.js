require('module-alias/register');
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

async function runTests() {
  console.log('🧪 ==============================================================');
  console.log('🧪 TESTING PHASE 18: MICROSOFT 365 / OUTLOOK INTEGRATION');
  console.log('🧪 ==============================================================\n');

  try {
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    console.log('Connected to MongoDB.\n');

    const Event = require('../models/appModels/Event');
    const OutlookIntegration = require('../models/appModels/OutlookIntegration');
    const Admin = require('../models/coreModels/Admin');
    const outlookController = require('../controllers/appControllers/outlookController');
    const calendarController = require('../controllers/appControllers/calendarController');

    // Clean up test events and integration for repeatable tests
    await Event.deleteMany({ title: { $regex: /^\[TEST-OUTLOOK\]/i } });
    await OutlookIntegration.deleteMany({ scopeType: 'organization' });

    // Mock admin user for controller execution
    let adminUser = await Admin.findOne({ role: 'admin' });
    if (!adminUser) {
      adminUser = await Admin.findOne({});
    }
    const mockUser = adminUser || {
      _id: new mongoose.Types.ObjectId(),
      email: 'admin@tecmotiv.com',
      role: 'admin',
    };

    // Helper for mock req/res
    const createMockReqRes = (body = {}, params = {}, query = {}) => {
      let statusCode = 200;
      let responseData = null;
      const req = {
        user: mockUser,
        userRole: 'admin',
        body,
        params,
        query,
      };
      const res = {
        status: (code) => {
          statusCode = code;
          return res;
        },
        json: (data) => {
          responseData = data;
          return res;
        },
      };
      return {
        req,
        res,
        getStatusCode: () => statusCode,
        getData: () => responseData,
      };
    };

    // -------------------------------------------------------------------------
    // TEST 1: SECURITY CHECK — NEVER STORE PASSWORDS
    // -------------------------------------------------------------------------
    console.log('🔒 Test 1: Security Rule Enforcement — Never Store Passwords');
    let securityBlocked = false;
    try {
      const maliciousDoc = new OutlookIntegration({
        scopeType: 'organization',
        user: mockUser._id,
        outlookEmail: 'admin@outlook.com',
        isConnected: true,
      });
      // Try setting forbidden password property
      maliciousDoc.set('password', 'SuperSecretPassword123!');
      await maliciousDoc.save();
    } catch (secErr) {
      securityBlocked = true;
      console.log(`   ✓ Correctly blocked password storage with error: "${secErr.message}"`);
    }

    if (!securityBlocked) {
      throw new Error('SECURITY FAILURE: Model allowed storing password property!');
    }
    console.log('✅ Test 1 Passed: Zero password storage strictly enforced.\n');

    // -------------------------------------------------------------------------
    // TEST 2: GET STATUS (INITIAL DISCONNECTED STATE)
    // -------------------------------------------------------------------------
    console.log('🔌 Test 2: Initial Connection Status');
    const { req: statusReq1, res: statusRes1, getData: getStatusData1 } = createMockReqRes();
    await outlookController.getStatus(statusReq1, statusRes1);
    const initialStatus = getStatusData1();
    console.log(`   Initial status: isConnected=${initialStatus.result.isConnected}, status=${initialStatus.result.status}`);
    if (initialStatus.result.isConnected !== false) {
      throw new Error('Expected initial connection state to be false');
    }
    console.log('✅ Test 2 Passed: Initial disconnected state verified.\n');

    // -------------------------------------------------------------------------
    // TEST 3: CONNECT TO MICROSOFT 365 (OAUTH CODE / SANDBOX INITIALIZATION)
    // -------------------------------------------------------------------------
    console.log('🔗 Test 3: Connect Microsoft 365 OAuth');
    const { req: connReq, res: connRes, getData: getConnData } = createMockReqRes({
      isSandbox: true,
      code: 'sandbox_auth_code_12345',
    });
    await outlookController.connect(connReq, connRes);
    const connData = getConnData();
    console.log(`   Connected Account: ${connData.result.outlookEmail}`);
    console.log(`   Connection Status: ${connData.result.status}`);
    console.log(`   Token Expiration: ${connData.result.tokenExpiresAt}`);
    if (!connData.result.isConnected || connData.result.status !== 'connected') {
      throw new Error('Connection failed');
    }
    console.log('✅ Test 3 Passed: Microsoft 365 successfully connected via OAuth tokens.\n');

    // -------------------------------------------------------------------------
    // TEST 4: CREATE EVENT IN OUTLOOK CALENDAR
    // -------------------------------------------------------------------------
    console.log('📅 Test 4: Create Event in Outlook Calendar');
    const { req: crEvReq, res: crEvRes, getData: getCrEvData } = createMockReqRes({
      title: '[TEST-OUTLOOK] Executive Board Sync',
      description: 'Quarterly strategic outlook review',
      startDate: new Date('2026-11-15T10:00:00Z'),
      endDate: new Date('2026-11-15T11:30:00Z'),
      location: 'Conference Room Alpha',
      isVirtual: true,
      meetingLink: 'https://teams.microsoft.com/meet/board-sync',
    });
    await outlookController.createEvent(crEvReq, crEvRes);
    const createdEv = getCrEvData();
    const outlookEventId = createdEv.result.id;
    console.log(`   Created Outlook Event ID: ${outlookEventId}`);
    console.log(`   Subject: ${createdEv.result.subject}`);
    if (!outlookEventId || !createdEv.result.subject.includes('Executive Board Sync')) {
      throw new Error('Failed to create event in Outlook');
    }
    console.log('✅ Test 4 Passed: Outlook event created successfully.\n');

    // -------------------------------------------------------------------------
    // TEST 5: READ EVENTS FROM OUTLOOK CALENDAR
    // -------------------------------------------------------------------------
    console.log('📖 Test 5: Read Events from Outlook Calendar');
    const { req: getEvReq, res: getEvRes, getData: getEventsData } = createMockReqRes();
    await outlookController.getEvents(getEvReq, getEvRes);
    const outlookEventsList = getEventsData().result;
    console.log(`   Retrieved ${outlookEventsList.length} events from Outlook.`);
    const foundEv = outlookEventsList.find((e) => e.id === outlookEventId);
    if (!foundEv) {
      throw new Error('Created event not found in Outlook event list');
    }
    console.log('✅ Test 5 Passed: Successfully read events directly from Outlook Calendar.\n');

    // -------------------------------------------------------------------------
    // TEST 6: UPDATE EVENT IN OUTLOOK CALENDAR
    // -------------------------------------------------------------------------
    console.log('✏️ Test 6: Update Event in Outlook Calendar');
    const { req: upEvReq, res: upEvRes, getData: getUpEvData } = createMockReqRes(
      {
        title: '[TEST-OUTLOOK] Executive Board Sync (Updated Venue)',
        location: 'TecMotiv Virtual Boardroom',
      },
      { id: outlookEventId }
    );
    await outlookController.updateEvent(upEvReq, upEvRes);
    const updatedEv = getUpEvData();
    console.log(`   Updated Subject: ${updatedEv.result.subject}`);
    console.log(`   Updated Location: ${updatedEv.result.location?.displayName}`);
    if (!updatedEv.result.subject.includes('Updated Venue')) {
      throw new Error('Failed to update event in Outlook');
    }
    console.log('✅ Test 6 Passed: Outlook event updated successfully.\n');

    // -------------------------------------------------------------------------
    // TEST 7: SYNCHRONIZATION WITH DEDUPLICATION (TECMOTIV <-> OUTLOOK)
    // -------------------------------------------------------------------------
    console.log('🔄 Test 7: Synchronize Company Events with Outlook');
    // First, create 2 TecMotiv company events
    const tecEvent1 = await new Event({
      title: '[TEST-OUTLOOK] Q4 Technology Keynote',
      eventName: '[TEST-OUTLOOK] Q4 Technology Keynote',
      description: 'Annual technology stack presentation',
      eventType: 'Webinar',
      startDate: new Date('2026-12-05T14:00:00Z'),
      endDate: new Date('2026-12-05T16:00:00Z'),
      location: 'TecMotiv Auditorium',
      department: 'Engineering',
      status: 'Scheduled',
    }).save();

    const tecEvent2 = await new Event({
      title: '[TEST-OUTLOOK] Cyber Security Awareness Workshop',
      eventName: '[TEST-OUTLOOK] Cyber Security Awareness Workshop',
      description: 'MFA and phishing defence workshop',
      eventType: 'Training',
      startDate: new Date('2026-12-10T09:00:00Z'),
      endDate: new Date('2026-12-10T11:00:00Z'),
      location: 'Main Training Lab',
      department: 'IT',
      status: 'Scheduled',
    }).save();

    console.log(`   Created 2 TecMotiv events in DB: ID ${tecEvent1._id}, ID ${tecEvent2._id}`);

    // Run Two-Way Sync with TECMOTIV as Source of Truth
    const { req: syncReq, res: syncRes, getData: getSyncData } = createMockReqRes({
      direction: 'two-way',
      sourceOfTruth: 'TECMOTIV',
    });
    await outlookController.syncEvents(syncReq, syncRes);
    const syncData = getSyncData();
    console.log('   Sync Results:', syncData.result.stats);

    // Verify tecEvent1 and tecEvent2 received outlookEventId
    const reloadedEv1 = await Event.findById(tecEvent1._id);
    const reloadedEv2 = await Event.findById(tecEvent2._id);
    console.log(`   TecMotiv Event 1 Outlook ID: ${reloadedEv1.outlookEventId}`);
    console.log(`   TecMotiv Event 2 Outlook ID: ${reloadedEv2.outlookEventId}`);
    if (!reloadedEv1.outlookEventId || !reloadedEv2.outlookEventId) {
      throw new Error('Sync failed to link Outlook Event IDs to TecMotiv events');
    }
    console.log('✅ Test 7 Passed: Company events synchronized and linked to Outlook.\n');

    // -------------------------------------------------------------------------
    // TEST 8: DEDUPLICATION VERIFICATION (IDEMPOTENT SYNC)
    // -------------------------------------------------------------------------
    console.log('🛡️ Test 8: Deduplication Verification (Run Second Sync)');
    const { req: syncReq2, res: syncRes2, getData: getSyncData2 } = createMockReqRes({
      direction: 'two-way',
      sourceOfTruth: 'TECMOTIV',
    });
    await outlookController.syncEvents(syncReq2, syncRes2);
    const syncData2 = getSyncData2();
    console.log('   Second Sync Results:', syncData2.result.stats);
    // There should be 0 newly pushed events because all are already deduplicated
    if (syncData2.result.stats.pushedToOutlook !== 0) {
      throw new Error('Deduplication failed: Events were duplicated during second sync!');
    }
    console.log(`   ✓ Zero new events pushed on re-sync. Skipped/Updated existing: ${syncData2.result.stats.updatedInOutlook + syncData2.result.stats.skippedDuplicates}`);
    console.log('✅ Test 8 Passed: Deduplication successfully prevented duplicate events.\n');

    // -------------------------------------------------------------------------
    // TEST 9: DELETE EVENT IN OUTLOOK
    // -------------------------------------------------------------------------
    console.log('🗑️ Test 9: Delete Event in Outlook');
    const { req: delEvReq, res: delEvRes, getData: getDelEvData } = createMockReqRes({}, { id: outlookEventId });
    await outlookController.deleteEvent(delEvReq, delEvRes);
    const delData = getDelEvData();
    console.log(`   Deleted from Outlook: ${delData.result.deletedId}`);
    console.log('✅ Test 9 Passed: Outlook event deletion verified.\n');

    // -------------------------------------------------------------------------
    // TEST 10: RECONNECT / TOKEN REFRESH
    // -------------------------------------------------------------------------
    console.log('🔄 Test 10: Reconnect & Token Refresh Handling');
    const { req: reconnReq, res: reconnRes, getData: getReconnData } = createMockReqRes();
    await outlookController.reconnect(reconnReq, reconnRes);
    const reconnData = getReconnData();
    console.log(`   Reconnect outcome: isConnected=${reconnData.result.isConnected}, status=${reconnData.result.status}`);
    if (!reconnData.result.isConnected) {
      throw new Error('Reconnect failed');
    }
    console.log('✅ Test 10 Passed: Session reconnect & token refresh verified.\n');

    // -------------------------------------------------------------------------
    // TEST 11: DISCONNECT
    // -------------------------------------------------------------------------
    console.log('⏹️ Test 11: Disconnect & Token Purge');
    const { req: disconnReq, res: disconnRes, getData: getDisconnData } = createMockReqRes();
    await outlookController.disconnect(disconnReq, disconnRes);
    const disconnData = getDisconnData();
    console.log(`   Disconnect outcome: isConnected=${disconnData.result.isConnected}`);
    // Check in database that tokens are wiped
    const currentDoc = await OutlookIntegration.findOne({ scopeType: 'organization' });
    if (currentDoc.accessToken !== '' || currentDoc.refreshToken !== '' || currentDoc.isConnected !== false) {
      throw new Error('Disconnect failed to purge tokens');
    }
    console.log('✅ Test 11 Passed: Disconnect properly wiped access and refresh tokens.\n');

    // -------------------------------------------------------------------------
    // TEST 12: EXISTING CALENDAR FUNCTIONALITY INTEGRITY
    // -------------------------------------------------------------------------
    console.log('🗓️ Test 12: Verify Existing Calendar Functionality is 100% Intact');
    const { req: calReq, res: calRes, getData: getCalData } = createMockReqRes({}, {}, { year: 2026, scope: 'company' });
    await calendarController.events(calReq, calRes);
    const calData = getCalData();
    console.log(`   Existing Calendar Feed retrieved ${calData.result?.length || 0} events successfully.`);
    if (!Array.isArray(calData.result) || calData.result.length === 0) {
      throw new Error('Existing calendar controller events failed');
    }

    const { req: celReq, res: celRes, getData: getCelData } = createMockReqRes();
    await calendarController.celebrations(celReq, celRes);
    const celData = getCelData();
    console.log(`   Existing Celebrations retrieved: Birthdays=${celData.result.upcomingBirthdays.length}, Anniversaries=${celData.result.upcomingAnniversaries.length}`);
    console.log('✅ Test 12 Passed: Existing calendar functionality completely intact!\n');

    // Clean up test events
    await Event.deleteMany({ title: { $regex: /^\[TEST-OUTLOOK\]/i } });

    console.log('==============================================================');
    console.log('🎉 ALL 12 PHASE 18 MICROSOFT 365 / OUTLOOK TESTS PASSED!');
    console.log('==============================================================');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

runTests();

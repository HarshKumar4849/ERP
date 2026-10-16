require('module-alias/register');
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

async function runTests() {
  console.log('🧪 ==============================================================');
  console.log('🧪 TESTING PHASE 19: CENTRALIZED NOTIFICATION SYSTEM');
  console.log('🧪 ==============================================================\n');

  try {
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    console.log('Connected to MongoDB.\n');

    const Notification = require('../models/appModels/Notification');
    const NotificationPreference = require('../models/appModels/NotificationPreference');
    const Admin = require('../models/coreModels/Admin');
    const notificationService = require('../services/notificationService');
    const notificationController = require('../controllers/appControllers/notificationController');

    // Find test user
    let user = await Admin.findOne({ email: 'admin@demo.com' }) || await Admin.findOne({});
    if (!user) {
      user = await new Admin({
        name: 'TecMotiv',
        surname: 'Administrator',
        email: 'test_admin@tecmotiv.com',
        role: 'admin',
      }).save();
    }

    // Clean test notifications
    await Notification.deleteMany({ recipient: user._id });
    await NotificationPreference.deleteMany({ user: user._id });

    // Helper for mock req/res
    const createMockReqRes = (body = {}, params = {}, query = {}) => {
      let statusCode = 200;
      let responseData = null;
      const req = {
        user,
        userRole: user.role || 'admin',
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
    // TEST 1: DISPATCH ALL 15 REQUIRED NOTIFICATION TYPES THROUGH CENTRAL SERVICE
    // -------------------------------------------------------------------------
    console.log('📢 Test 1: Centralized Dispatch of All 15 Required Event Types');

    const fakeId = new mongoose.Types.ObjectId();

    // 1. Leave submitted
    await notificationService.notifyLeaveSubmitted({
      leave: { _id: fakeId, leaveType: 'Casual Leave', fromDate: new Date(), toDate: new Date(), daysCount: 2 },
      applicantName: 'Vikram Malhotra',
      approverUserIds: [user._id],
    });

    // 2. Leave approved
    await notificationService.notifyLeaveApproved({
      leave: { _id: fakeId, leaveType: 'Sick Leave', daysCount: 1 },
      applicantUserId: user._id,
    });

    // 3. Leave rejected
    await notificationService.notifyLeaveRejected({
      leave: { _id: fakeId, leaveType: 'Privilege Leave' },
      applicantUserId: user._id,
      reason: 'Urgent sprint delivery scheduled',
    });

    // 4. Task assigned
    await notificationService.notifyTaskAssigned({
      task: { _id: fakeId, task: 'Deploy API Gateway v2.4', priority: 'High' },
      assigneeUserId: user._id,
      assignerName: 'Sarah Jenkins',
    });

    // 5. Task due
    await notificationService.notifyTaskDue({
      task: { _id: fakeId, task: 'Q3 Tax Compliance Filing', dueDate: new Date() },
      assigneeUserId: user._id,
    });

    // 6. Task overdue
    await notificationService.notifyTaskOverdue({
      task: { _id: fakeId, task: 'Client Architecture Review', dueDate: new Date() },
      assigneeUserId: user._id,
    });

    // 7. Birthday
    await notificationService.notifyBirthday({
      employee: { _id: fakeId, name: 'Ananya', surname: 'Sharma', departmentName: 'Engineering' },
      colleagueUserIds: [user._id],
    });

    // 8. Anniversary
    await notificationService.notifyAnniversary({
      employee: { _id: fakeId, name: 'Rajesh', surname: 'Kumar', departmentName: 'Operations' },
      colleagueUserIds: [user._id],
      yearsCompleted: 5,
    });

    // 9. Policy acknowledgement
    await notificationService.notifyPolicyAcknowledgement({
      policy: { _id: fakeId, name: 'Information Security Policy 2026', version: '2.0' },
      userIds: [user._id],
    });

    // 10. Document expiry
    await notificationService.notifyDocumentExpiry({
      document: { _id: fakeId, documentType: 'Passport Copy', expiryDate: new Date() },
      userIds: [user._id],
      daysLeft: 14,
    });

    // 11. Probation ending
    await notificationService.notifyProbationEnding({
      employee: { _id: fakeId, name: 'Rohan', surname: 'Verma', departmentName: 'Marketing' },
      hrUserIds: [user._id],
      daysLeft: 7,
    });

    // 12. Event reminder
    await notificationService.notifyEventReminder({
      event: { _id: fakeId, title: 'All-Hands Town Hall', startDate: new Date(), venue: 'TecMotiv Main Hall' },
      participantUserIds: [user._id],
    });

    // 13. Recognition nomination
    await notificationService.notifyRecognitionNomination({
      recipientUserId: user._id,
      nomineeName: 'Pooja Iyer',
      awardName: 'Innovation Pioneer of the Month',
    });

    // 14. Salary slip available
    await notificationService.notifySalarySlipAvailable({
      employeeUserId: user._id,
      salaryPeriod: 'September 2026',
    });

    // 15. SaaS renewal
    await notificationService.notifySaaSRenewal({
      service: { _id: fakeId, serviceName: 'Microsoft 365 Business Premium', serviceType: 'Microsoft 365', renewalDate: new Date(), cost: 120000 },
      adminUserIds: [user._id],
      daysLeft: 10,
    });

    const countInDb = await Notification.countDocuments({ recipient: user._id });
    console.log(`   ✓ Total in-app notifications dispatched and stored in DB: ${countInDb}`);
    if (countInDb !== 15) {
      throw new Error(`Expected exactly 15 notifications, but found ${countInDb}`);
    }
    console.log('✅ Test 1 Passed: All 15 required notification types successfully dispatched through centralized service.\n');

    // -------------------------------------------------------------------------
    // TEST 2: CONTROLLER UNREAD COUNT
    // -------------------------------------------------------------------------
    console.log('🔢 Test 2: Unread Count Calculation');
    const { req: cntReq, res: cntRes, getData: getCntData } = createMockReqRes();
    await notificationController.unreadCount(cntReq, cntRes);
    const countResult = getCntData().result;
    console.log(`   Live Unread Count: ${countResult.count}`);
    if (countResult.count !== 15) {
      throw new Error(`Expected 15 unread notifications, got ${countResult.count}`);
    }
    console.log('✅ Test 2 Passed: Unread badge count verified.\n');

    // -------------------------------------------------------------------------
    // TEST 3: CONTROLLER LIST WITH PAGINATION
    // -------------------------------------------------------------------------
    console.log('📜 Test 3: List Notifications with Pagination');
    const { req: listReq, res: listRes, getData: getListData } = createMockReqRes({}, {}, { page: 1, items: 10 });
    await notificationController.list(listReq, listRes);
    const listResult = getListData();
    console.log(`   Retrieved page 1: ${listResult.result.length} items out of ${listResult.pagination.count} total.`);
    if (listResult.result.length !== 10 || listResult.pagination.count !== 15) {
      throw new Error('Pagination list failed');
    }
    console.log('✅ Test 3 Passed: Notification list pagination working smoothly.\n');

    // -------------------------------------------------------------------------
    // TEST 4: MARK SINGLE NOTIFICATION AS READ
    // -------------------------------------------------------------------------
    console.log('✔️ Test 4: Mark Single Notification Read');
    const firstNotification = listResult.result[0];
    const { req: readReq, res: readRes, getData: getReadData } = createMockReqRes({}, { id: firstNotification._id });
    await notificationController.markRead(readReq, readRes);
    const readResult = getReadData();
    console.log(`   Marked ID ${firstNotification._id} as read. Remaining unread: ${readResult.unreadCount}`);
    if (readResult.unreadCount !== 14 || readResult.result.read !== true) {
      throw new Error('Mark read failed');
    }
    console.log('✅ Test 4 Passed: Individual notification marked as read.\n');

    // -------------------------------------------------------------------------
    // TEST 5: MARK ALL NOTIFICATIONS AS READ
    // -------------------------------------------------------------------------
    console.log('✔️✔️ Test 5: Mark All Read');
    const { req: readAllReq, res: readAllRes, getData: getReadAllData } = createMockReqRes();
    await notificationController.markAllRead(readAllReq, readAllRes);
    const readAllResult = getReadAllData();
    console.log(`   Mark all read executed. Unread count: ${readAllResult.unreadCount}`);
    if (readAllResult.unreadCount !== 0) {
      throw new Error('Mark all read failed');
    }

    const remainingUnreadInDb = await Notification.countDocuments({ recipient: user._id, read: false });
    if (remainingUnreadInDb !== 0) {
      throw new Error('Found unread notifications remaining in DB');
    }
    console.log('✅ Test 5 Passed: All notifications marked as read in single action.\n');

    // -------------------------------------------------------------------------
    // TEST 6: NOTIFICATION PREFERENCES MANAGEMENT
    // -------------------------------------------------------------------------
    console.log('⚙️ Test 6: Notification Preferences (In-App, Email, WhatsApp, DND)');
    const { req: prefReq, res: prefRes, getData: getPrefData } = createMockReqRes();
    await notificationController.getPreferences(prefReq, prefRes);
    const initialPrefs = getPrefData().result;
    console.log(`   Initial Channels: In-App=${initialPrefs.channels.inApp}, Email=${initialPrefs.channels.email}, WhatsApp=${initialPrefs.channels.whatsapp}`);

    // Update preferences to enable WhatsApp with phone number
    const { req: upPrefReq, res: upPrefRes, getData: getUpPrefData } = createMockReqRes({
      channels: {
        inApp: true,
        email: true,
        whatsapp: true,
      },
      whatsappPhone: '+91 98765 43210',
      dndEnabled: true,
      dndStart: '23:00',
      dndEnd: '07:00',
    });
    await notificationController.updatePreferences(upPrefReq, upPrefRes);
    const updatedPrefs = getUpPrefData().result;
    console.log(`   Updated WhatsApp Channel: ${updatedPrefs.channels.whatsapp}`);
    console.log(`   Updated WhatsApp Phone: ${updatedPrefs.whatsappPhone}`);
    console.log(`   DND Active: ${updatedPrefs.dndEnabled} (${updatedPrefs.dndStart} - ${updatedPrefs.dndEnd})`);

    if (!updatedPrefs.channels.whatsapp || updatedPrefs.whatsappPhone !== '+91 98765 43210') {
      throw new Error('Failed to update notification preferences');
    }
    console.log('✅ Test 6 Passed: Notification preferences stored and updated properly.\n');

    // -------------------------------------------------------------------------
    // TEST 7: MULTI-CHANNEL PIPELINE EXECUTION (EMAIL & WHATSAPP ADAPTERS)
    // -------------------------------------------------------------------------
    console.log('🌐 Test 7: Multi-Channel Pipeline Execution with Channels');
    const multiChannelRes = await notificationService.notify({
      recipient: user._id,
      type: notificationService.NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT,
      title: 'Enterprise Notification System Active',
      message: 'All multi-channel delivery adapters (In-App, Email, WhatsApp) are fully prepared.',
      link: '/dashboard',
      priority: 'high',
      channels: ['in_app', 'email', 'whatsapp'],
    });

    console.log('   Multi-Channel Delivery Status:', multiChannelRes[0]?.channelStatuses);
    if (!multiChannelRes[0] || multiChannelRes[0].channelStatuses.inApp !== 'delivered') {
      throw new Error('Multi-channel dispatch failed');
    }
    console.log('✅ Test 7 Passed: Multi-channel pipeline executed with complete channel status tracking.\n');

    // -------------------------------------------------------------------------
    // TEST 8: RESPECTING MUTED PREFERENCES
    // -------------------------------------------------------------------------
    console.log('🔇 Test 8: Respecting Muted Category Preferences');
    // Disable Birthday in preferences
    await notificationController.updatePreferences(
      { user, body: { typePreferences: { birthday: { inApp: false, email: false, whatsapp: false } } } },
      { status: () => ({ json: () => {} }) }
    );

    const mutedResults = await notificationService.notifyBirthday({
      employee: { _id: fakeId, name: 'Test', surname: 'Muted', departmentName: 'HR' },
      colleagueUserIds: [user._id],
    });

    // Notification doc should NOT be created for muted in-app category
    const foundMutedDoc = mutedResults[0]?.notification;
    if (foundMutedDoc) {
      throw new Error('Centralized service failed to respect muted in-app preference!');
    }
    console.log('   ✓ Correctly respected user preferences: In-app delivery skipped when muted.');
    console.log('✅ Test 8 Passed: Centralized service strictly honors user notification preferences.\n');

    // Clean test data
    await Notification.deleteMany({ recipient: user._id });

    console.log('==============================================================');
    console.log('🎉 ALL 8 PHASE 19 CENTRALIZED NOTIFICATION TESTS PASSED!');
    console.log('==============================================================');
    process.exit(0);
  } catch (error) {
    console.error('❌ Notification test failed with error:', error);
    process.exit(1);
  }
}

runTests();

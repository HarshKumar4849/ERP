require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function testDigitalServices() {
  try {
    const mongoUri = process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp';
    console.log('Connecting to MongoDB at:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    const DigitalService = require('../models/appModels/DigitalService');
    const Employee = require('../models/appModels/Employee');
    const digitalServiceController = require('../controllers/appControllers/digitalServiceController');

    // 1. Test Listing & Metrics
    console.log('\n--- 1. Testing List Digital Services & Cost Metrics ---');
    const mockListReq = { query: { scope: 'all' } };
    const mockListRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; },
    };
    await digitalServiceController.list(mockListReq, mockListRes);
    console.log(`✓ Retrieved ${mockListRes.data.result.length} services.`);
    console.log('✓ Overall Counts & Spend:', mockListRes.data.counts);

    // 2. Test Creating Service with Security Check (NO PASSWORDS)
    console.log('\n--- 2. Testing Create Service & Security Check (No Passwords) ---');
    const employee = await Employee.findOne({ removed: false });

    const mockCreateReq = {
      user: { _id: new mongoose.Types.ObjectId() },
      body: {
        serviceName: '[TEST] Datadog Cloud Observability',
        serviceType: 'Other SaaS',
        customServiceName: 'Datadog Pro',
        accountOwner: employee ? employee._id : undefined,
        accountOwnerName: employee ? `${employee.name} ${employee.surname || ''}` : 'Lead DevOps',
        loginEmail: 'devops-alerts@tecmotiv.com',
        renewalDate: new Date(Date.now() + 20 * 86400000), // In 20 days
        billingCycle: 'Monthly',
        cost: 42000,
        currency: 'INR',
        paymentMethod: 'Corporate Credit Card',
        paymentMethodDetails: 'HDFC Corporate ending 4092',
        status: 'Active',
        reminderDaysBefore: 15,
        notes: 'APM tracing and distributed infrastructure monitoring.',
        // Attacker attempts to store a password:
        password: 'SUPER_SECRET_UNAUTHORIZED_PASSWORD',
        secret: 'INJECTED_API_SECRET',
      },
    };
    const mockCreateRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; },
    };
    await digitalServiceController.create(mockCreateReq, mockCreateRes);
    const createdService = mockCreateRes.data.result;
    console.log(`✓ Created service: "${createdService.serviceName}" (ID: ${createdService._id})`);

    // Verify Password was NOT stored
    const rawInDb = await DigitalService.findById(createdService._id).lean();
    if (rawInDb.password !== undefined || rawInDb.secret !== undefined) {
      throw new Error('SECURITY VIOLATION: Password or secret was stored in database!');
    }
    console.log('✓ SECURITY RULE VERIFIED: Password and secret fields strictly absent in database document.');

    // 3. Test Renewal Reminders Detection
    console.log('\n--- 3. Testing Renewal Reminders Feed ---');
    const mockReminderReq = {};
    const mockReminderRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; },
    };
    await digitalServiceController.reminders(mockReminderReq, mockReminderRes);
    console.log(`✓ Detected ${mockReminderRes.data.count} services renewing within 30 days.`);

    // 4. Test Quick Renew Endpoint
    console.log('\n--- 4. Testing Quick Renew Endpoint ---');
    const mockRenewReq = {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { id: createdService._id.toString() },
      body: {},
    };
    const mockRenewRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; },
    };
    await digitalServiceController.renew(mockRenewReq, mockRenewRes);
    console.log('✓ Renew result message:', mockRenewRes.data.message);
    console.log('✓ New renewal date:', mockRenewRes.data.result.renewalDate);

    // 5. Clean up test record
    await DigitalService.deleteOne({ _id: createdService._id });
    console.log('✓ Test record cleaned up.');

    console.log('\n🎉 ALL PHASE 17 BACKEND TESTS PASSED CLEANLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('Phase 17 Test Error:', err);
    process.exit(1);
  }
}

testDigitalServices();

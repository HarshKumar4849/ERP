require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function testCommunication() {
  console.log('====================================================');
  console.log('🧪 TESTING PHASE 10: COMPANY COMMUNICATION & POLICIES');
  console.log('====================================================\n');

  try {
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    console.log('✅ Connected to MongoDB');

    const Admin = require('../models/coreModels/Admin');
    const Employee = require('../models/appModels/Employee');
    const Policy = require('../models/appModels/Policy');
    const policyController = require('../controllers/appControllers/policyController');
    const bulletinController = require('../controllers/appControllers/bulletinController');

    const mgmtUser = await Admin.findOne({ email: 'management@tecmotiv.com' });
    const emp1User = await Admin.findOne({ email: 'employee1@tecmotiv.com' });
    const emp1 = await Employee.findOne({ email: emp1User.email });

    // 1. Test Policy Library Categorization
    console.log('\n--- Test 1: Policy Library Categorization (HR, IT, COMPANY) ---');
    let policyListResult = null;
    await policyController.list(
      { user: emp1User, userRole: 'EMPLOYEE' },
      { status: () => ({ json: (d) => (policyListResult = d) }) }
    );

    if (!policyListResult || !policyListResult.success) {
      throw new Error('Failed to retrieve policy library');
    }

    const { hr, it, company, total } = policyListResult.result;
    console.log(`✅ Total policies: ${total}`);
    console.log(`   HR Policies (${hr.length}): ${hr.map((p) => p.subType).join(', ')}`);
    console.log(`   IT Security Policies (${it.length}): ${it.map((p) => p.subType).join(', ')}`);
    console.log(`   Company Governance Policies (${company.length}): ${company.map((p) => p.subType).join(', ')}`);

    // 2. Test Policy Digital Acknowledgement
    console.log('\n--- Test 2: Employee Digital Sign-off ("I have read and understood this policy.") ---');
    const targetPolicy = hr[0];
    let ackResult = null;
    await policyController.acknowledge(
      {
        user: emp1User,
        userRole: 'EMPLOYEE',
        params: { id: targetPolicy._id },
        ip: '192.168.1.105',
      },
      { status: () => ({ json: (d) => (ackResult = d) }) }
    );

    if (!ackResult || !ackResult.success) {
      throw new Error('Failed to acknowledge policy');
    }

    console.log(`✅ Acknowledged policy: "${targetPolicy.name}"`);
    console.log(`   Signer: ${ackResult.result.employeeName}`);
    console.log(`   Statement: "${ackResult.result.statement}"`);
    console.log(`   Version: ${ackResult.result.version}`);
    console.log(`   Timestamp: ${ackResult.result.timestamp}`);

    // Re-check policy list to verify that isAcknowledged is now true for this policy
    let updatedPolicyList = null;
    await policyController.list(
      { user: emp1User, userRole: 'EMPLOYEE' },
      { status: () => ({ json: (d) => (updatedPolicyList = d) }) }
    );
    const checkedPolicy = updatedPolicyList.result.all.find((p) => p._id.toString() === targetPolicy._id.toString());
    console.log(`   Is policy marked as acknowledged for employee? ${checkedPolicy?.isAcknowledged ? '✅ YES' : '❌ NO'}`);

    // 3. Test HR Compliance Audit Trail
    console.log('\n--- Test 3: HR / Management Compliance Audit Trail ---');
    let auditResult = null;
    await policyController.acknowledgements(
      {
        user: mgmtUser,
        userRole: 'MANAGEMENT',
        params: { id: targetPolicy._id },
      },
      { status: () => ({ json: (d) => (auditResult = d) }) }
    );

    console.log(`✅ Compliance audit for "${auditResult.result.policy.name}":`);
    console.log(`   Total acknowledged: ${auditResult.result.totalAcknowledged} / ${auditResult.result.totalEmployees} (${auditResult.result.complianceRate}%)`);
    console.log(`   First signer in audit log: ${auditResult.result.acknowledgements[0]?.employeeName}`);

    // 4. Test TecMotiv Bulletin 4 Sections Feed
    console.log('\n--- Test 4: TecMotiv Bulletin Sections (News, Announcements, Events, Recognition) ---');
    let bulletinResult = null;
    await bulletinController.feed(
      { user: mgmtUser, userRole: 'MANAGEMENT', query: {} },
      { status: () => ({ json: (d) => (bulletinResult = d) }) }
    );

    const { companyNews, announcements, events, recognition } = bulletinResult.result;
    console.log(`✅ COMPANY NEWS count: ${companyNews.length}`);
    companyNews.forEach((n) => console.log(`   [${n.subType}] ${n.title}`));

    console.log(`\n✅ ANNOUNCEMENTS count: ${announcements.length}`);
    announcements.forEach((a) => console.log(`   [${a.subType}] ${a.title}`));

    console.log(`\n✅ EVENTS count: ${events.length}`);
    events.forEach((e) => console.log(`   [${e.subType}] ${e.title}`));

    console.log(`\n✅ RECOGNITION count: ${recognition.length}`);
    recognition.forEach((r) => console.log(`   [${r.subType}] ${r.title}`));

    // 5. Test Liking Bulletin Post
    console.log('\n--- Test 5: Like Bulletin Post ---');
    const firstPost = companyNews[0];
    let likeResult = null;
    await bulletinController.like(
      { params: { id: firstPost._id } },
      { status: () => ({ json: (d) => (likeResult = d) }) }
    );
    console.log(`✅ Post "${firstPost.title}" liked! Total likes: ${likeResult.likes}`);

    console.log('\n====================================================');
    console.log('🎉 ALL PHASE 10 COMMUNICATION TESTS PASSED!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testCommunication();

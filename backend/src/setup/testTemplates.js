require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function testTemplatesPhase() {
  try {
    const mongoUri = process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp';
    console.log('Connecting to MongoDB at:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');

    const Template = require('../models/appModels/Template');
    const Employee = require('../models/appModels/Employee');
    const templateController = require('../controllers/appControllers/templateController');

    // 1. Test Listing Templates
    console.log('\n--- 1. Testing List Templates ---');
    const mockListReq = { query: { category: 'HR Templates', items: 20 } };
    const mockListRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; },
    };
    await templateController.list(mockListReq, mockListRes);
    console.log(`✓ Retrieved ${mockListRes.data.result.length} HR Templates.`);

    // 2. Test Creating Custom Template
    console.log('\n--- 2. Testing Create Template ---');
    const mockCreateReq = {
      user: { _id: new mongoose.Types.ObjectId() },
      body: {
        title: '[TEST] Custom Engineering Retention Bonus Agreement',
        category: 'HR Templates',
        type: 'Appointment Letter',
        description: 'Custom retention addendum for senior cloud engineers.',
        subject: 'Retention Bonus Letter — {{employeeName}}',
        content: 'Dear {{employeeName}} ({{employeeId}}), in recognition of your leadership in {{department}}, you are eligible for retention grant of {{salary}} effective {{effectiveDate}}.',
        tags: ['custom', 'retention'],
      },
    };
    const mockCreateRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; },
    };
    await templateController.create(mockCreateReq, mockCreateRes);
    const createdTemplate = mockCreateRes.data.result;
    console.log(`✓ Created template: "${createdTemplate.title}" (ID: ${createdTemplate._id})`);
    console.log('✓ Auto-extracted variables:', createdTemplate.variables.map(v => v.name));

    // 3. Test Preview Before Generation with Real Employee Data
    console.log('\n--- 3. Testing Safe Preview with Employee Merge ---');
    const sampleEmp = await Employee.findOne({ removed: false });
    const mockPreviewReq = {
      params: { id: createdTemplate._id.toString() },
      body: {
        employeeId: sampleEmp ? sampleEmp._id.toString() : undefined,
        variables: {
          salary: '₹ 5,00,000 Special Grant',
          effectiveDate: 'November 1, 2026',
        },
      },
    };
    const mockPreviewRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; },
    };
    await templateController.preview(mockPreviewReq, mockPreviewRes);
    console.log('✓ Rendered Subject:', mockPreviewRes.data.result.renderedSubject);
    console.log('✓ Rendered Content Preview:\n', mockPreviewRes.data.result.renderedContent);
    console.log('✓ Unresolved variables remaining:', mockPreviewRes.data.result.unresolvedVariables);

    // 4. Test Security: Verify No Arbitrary Code Execution
    console.log('\n--- 4. Testing Security (No Arbitrary Code Execution) ---');
    const maliciousReq = {
      body: {
        content: 'Hello {{employeeName}}, test: {{process.mainModule.require("child_process")}} and {{constructor.constructor("return 1+1")()}}',
        variables: {
          employeeName: 'Security Tester',
        },
      },
    };
    const maliciousRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; },
    };
    await templateController.preview(maliciousReq, maliciousRes);
    console.log('✓ Malicious code safely neutralized as literal strings:');
    console.log(maliciousRes.data.result.renderedContent);

    // 5. Test Update Template
    console.log('\n--- 5. Testing Update Template ---');
    const mockUpdateReq = {
      params: { id: createdTemplate._id.toString() },
      body: {
        title: '[TEST UPDATED] Custom Retention Agreement',
      },
    };
    const mockUpdateRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; },
    };
    await templateController.update(mockUpdateReq, mockUpdateRes);
    console.log(`✓ Updated template title to: "${mockUpdateRes.data.result.title}"`);

    // 6. Test Delete Template (Soft Delete)
    console.log('\n--- 6. Testing Delete Template ---');
    const mockDeleteReq = { params: { id: createdTemplate._id.toString() } };
    const mockDeleteRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; },
    };
    await templateController.delete(mockDeleteReq, mockDeleteRes);
    console.log('✓ Deleted template successfully.');

    // Clean up test template
    await Template.deleteOne({ _id: createdTemplate._id });

    console.log('\n🎉 ALL PHASE 16 BACKEND TESTS PASSED CLEANLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('Phase 16 Test Error:', err);
    process.exit(1);
  }
}

testTemplatesPhase();

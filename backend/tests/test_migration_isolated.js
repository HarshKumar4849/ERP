const path = require('path');
const mongoose = require(path.join(__dirname, '../node_modules/mongoose'));
const { DATABASE } = require('./qa-env');

async function run() {
  console.log('Connecting to QA database:', DATABASE);
  await mongoose.connect(DATABASE);
  console.log('Connected.');

  const empColl = mongoose.connection.collection('employees');
  const adminColl = mongoose.connection.collection('admins');

  // 1. Inspect existing indexes
  console.log('--- Step 1: Checking QA Indexes ---');
  let empIndexes = await empColl.indexes();
  console.log('QA emp indexes before:', empIndexes);

  const existingEmailIdx = empIndexes.find((i) => i.name === 'email_1');
  if (existingEmailIdx && !existingEmailIdx.partialFilterExpression) {
    console.log('Dropping existing non-partial email_1 on employees...');
    await empColl.dropIndex('email_1');
  }

  await empColl.createIndex(
    { email: 1 },
    { unique: true, partialFilterExpression: { removed: false }, name: 'email_1' }
  );
  console.log('Created partial unique index on employees.');

  let adminIndexes = await adminColl.indexes();
  const existingAdminEmailIdx = adminIndexes.find((i) => i.name === 'email_1');
  if (existingAdminEmailIdx && !existingAdminEmailIdx.partialFilterExpression) {
    await adminColl.dropIndex('email_1');
  }
  await adminColl.createIndex(
    { email: 1 },
    { unique: true, partialFilterExpression: { removed: false }, name: 'email_1' }
  );
  console.log('Created partial unique index on admins.');

  // 2. Test lifecycle in isolated QA database
  console.log('--- Step 2: Testing Lifecycle in QA Database ---');
  const testEmail = `reregister_test_${Date.now()}@tecmotiv.com`;

  // Insert active employee 1
  const doc1 = await empColl.insertOne({
    name: 'Alice',
    email: testEmail,
    employeeId: `TM-TEST-1-${Date.now()}`,
    removed: false,
    enabled: true,
  });
  console.log('Created active employee 1:', doc1.insertedId);

  // Try to insert duplicate active employee -> MUST FAIL
  let dupFailed = false;
  try {
    await empColl.insertOne({
      name: 'Alice Duplicate',
      email: testEmail,
      employeeId: `TM-TEST-2-${Date.now()}`,
      removed: false,
      enabled: true,
    });
  } catch (err) {
    if (err.code === 11000) {
      dupFailed = true;
      console.log('SUCCESS: Duplicate active employee was correctly rejected by partial unique index (code 11000)!');
    } else {
      throw err;
    }
  }
  if (!dupFailed) {
    throw new Error('FAILED: Duplicate active employee was not rejected!');
  }

  // Soft-delete employee 1
  await empColl.updateOne(
    { _id: doc1.insertedId },
    { $set: { removed: true, enabled: false, updated: Date.now() } }
  );
  console.log('Soft-deleted employee 1.');

  // Try to insert new active employee with the SAME email -> MUST SUCCEED!
  const doc2 = await empColl.insertOne({
    name: 'Alice Re-registered',
    email: testEmail,
    employeeId: `TM-TEST-3-${Date.now()}`,
    removed: false,
    enabled: true,
  });
  console.log('SUCCESS: New active employee created with the same email after deletion:', doc2.insertedId);

  // Try to insert ANOTHER active employee with same email -> MUST FAIL again!
  let secondDupFailed = false;
  try {
    await empColl.insertOne({
      name: 'Alice Third Active',
      email: testEmail,
      employeeId: `TM-TEST-4-${Date.now()}`,
      removed: false,
      enabled: true,
    });
  } catch (err) {
    if (err.code === 11000) {
      secondDupFailed = true;
      console.log('SUCCESS: Second active duplicate was rejected by partial unique index (code 11000)!');
    } else {
      throw err;
    }
  }
  if (!secondDupFailed) {
    throw new Error('FAILED: Second active duplicate was not rejected!');
  }

  // Cleanup test docs
  await empColl.deleteMany({ email: testEmail });
  console.log('Cleaned up test documents in QA database.');

  await mongoose.disconnect();
  console.log('--- ALL QA DATABASE VERIFICATIONS PASSED ---');
}

run().catch((err) => {
  console.error('QA Test error:', err);
  process.exit(1);
});

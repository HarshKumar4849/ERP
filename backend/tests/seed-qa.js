const { seedFixtures, cleanupByRunId } = require('./fixtures');
const mongoose = require('mongoose');
const qa = require('./qa-env');

(async () => {
  await cleanupByRunId(qa.RUN_ID);
  await seedFixtures();
  console.log(`QA fixtures seeded for run ${qa.RUN_ID}`);
  await mongoose.disconnect();
})().catch((error) => {
  console.error(`QA fixture setup failed: ${error.message}`);
  process.exitCode = 1;
});

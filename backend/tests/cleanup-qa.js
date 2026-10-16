const { cleanupAllQaFixtures, cleanupByRunId } = require('./fixtures');
const qa = require('./qa-env');

(async () => {
  if (process.env.QA_RUN_ID && !process.argv.includes('--all')) {
    await cleanupByRunId(process.env.QA_RUN_ID);
    console.log(`QA fixtures cleaned for run ${process.env.QA_RUN_ID}`);
  } else {
    await cleanupAllQaFixtures();
    console.log(`All QA audit fixtures cleaned successfully`);
  }
})().catch((error) => {
  console.error(`QA fixture cleanup failed: ${error.message}`);
  process.exitCode = 1;
});

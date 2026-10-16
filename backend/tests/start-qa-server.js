require('module-alias/register');
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));
require('dotenv').config({ path: path.resolve(__dirname, '../.env.qa') });
const qa = require('./qa-env');
const { seedFixtures, cleanupByRunId } = require('./fixtures');

const runId = (process.env.QA_RUN_ID || 'browser-audit-2026').toLowerCase();
qa.RUN_ID = runId;

process.env.DATABASE = qa.DATABASE;
process.env.PORT = process.env.QA_API_PORT || '8888';
process.env.JWT_SECRET = 'ci-only-qa-secret';
process.env.NODE_ENV = 'test';

(async () => {
  await cleanupByRunId(runId);
  await seedFixtures();
  console.log(`QA server fixtures seeded for run ${runId}`);
  require('../src/server');
})().catch((err) => {
  console.error('Failed to initialize QA server:', err);
  process.exit(1);
});

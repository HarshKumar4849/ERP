const { spawnSync } = require('node:child_process');

const testResult = spawnSync(process.execPath, ['--test', 'tests/leave-workflow.test.js'], { stdio: 'inherit', env: process.env });
const cleanupResult = spawnSync(process.execPath, ['tests/cleanup-qa.js'], { stdio: 'inherit', env: process.env });
process.exitCode = testResult.error ? 1 : cleanupResult.error ? 1 : (testResult.status || cleanupResult.status || 0);

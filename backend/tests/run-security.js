const { spawnSync } = require('node:child_process');

const testResult = spawnSync(process.execPath, ['--test', 'tests/security.test.js'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

// Cleanup is deliberately in the same process wrapper and runs only after the
// test process exits. It is guarded by qa-env.js and cannot target prod/dev DBs.
const cleanupResult = spawnSync(process.execPath, ['tests/cleanup-qa.js'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

if (testResult.error) {
  console.error(`Security test runner failed to start: ${testResult.error.message}`);
  process.exitCode = 1;
} else if (cleanupResult.error) {
  console.error(`Security cleanup failed to start: ${cleanupResult.error.message}`);
  process.exitCode = 1;
} else {
  process.exitCode = testResult.status || cleanupResult.status || 0;
}

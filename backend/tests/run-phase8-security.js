const { spawnSync } = require('node:child_process');

const testResult = spawnSync(process.execPath, ['--test', 'tests/phase8-adversarial-security.test.js'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

const cleanupResult = spawnSync(process.execPath, ['tests/cleanup-qa.js'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

if (testResult.error) {
  console.error(`Phase 8 test runner failed to start: ${testResult.error.message}`);
  process.exitCode = 1;
} else if (cleanupResult.error) {
  console.error(`Phase 8 cleanup failed to start: ${cleanupResult.error.message}`);
  process.exitCode = 1;
} else {
  process.exitCode = testResult.status || cleanupResult.status || 0;
}

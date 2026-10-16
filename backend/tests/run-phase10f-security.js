const { spawnSync } = require('node:child_process');

const testResult = spawnSync(process.execPath, ['--test', 'tests/phase10f-github-security.test.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    QA_GITHUB_MOCK: 'true',
    GITHUB_WEBHOOK_SECRET: 'tecmotiv-qa-webhook-secret-99482',
    GITHUB_TOKEN: 'ghp_secretTokenThatMustNeverLeakToClient12345',
  },
  stdio: 'inherit',
});

const cleanupResult = spawnSync(process.execPath, ['tests/cleanup-qa.js'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

if (testResult.error) {
  console.error(`Phase 10F test runner failed to start: ${testResult.error.message}`);
  process.exitCode = 1;
} else if (cleanupResult.error) {
  console.error(`Phase 10F cleanup failed to start: ${cleanupResult.error.message}`);
  process.exitCode = 1;
} else {
  process.exitCode = testResult.status || cleanupResult.status || 0;
}

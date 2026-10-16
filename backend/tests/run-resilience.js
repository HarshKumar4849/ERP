const { spawnSync } = require('node:child_process');

const result = spawnSync(process.execPath, ['--test', 'tests/resilience.test.js'], { stdio: 'inherit', env: process.env });
const cleanup = spawnSync(process.execPath, ['tests/cleanup-qa.js'], { stdio: 'inherit', env: process.env });
process.exitCode = result.error ? 1 : cleanup.error ? 1 : (result.status || cleanup.status || 0);

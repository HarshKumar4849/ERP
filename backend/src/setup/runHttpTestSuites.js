require('module-alias/register');
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const { execSync } = require('child_process');
const mongoose = require('mongoose');
const { globSync } = require('glob');
const path = require('path');

async function run() {
  await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
  const modelsFiles = globSync('./src/models/**/*.js');
  for (const filePath of modelsFiles) {
    require(path.resolve(filePath));
  }

  const app = require('../app');
  const server = app.listen(8888, () => {
    console.log('Test server up on port 8888. Running 5 HTTP test suites...\n');
    const suites = [
      'testAttendance.js',
      'testDocumentVault.js',
      'testEmployeeMaster.js',
      'testLeaveManagement.js',
      'testRbacSecurity.js'
    ];
    let allPass = true;
    for (const s of suites) {
      try {
        console.log('====================================================');
        console.log('RUNNING SUITE: ' + s);
        console.log('====================================================');
        execSync('node src/setup/' + s, { stdio: 'inherit', timeout: 60000 });
        console.log('✅ ' + s + ' PASSED\n');
      } catch (e) {
        console.error('❌ ' + s + ' FAILED\n');
        allPass = false;
      }
    }
    server.close();
    console.log('ALL SUITES PASSED?', allPass ? 'YES ✅' : 'NO ❌');
    process.exit(allPass ? 0 : 1);
  });
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});

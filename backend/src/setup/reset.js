require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

const mongoose = require('mongoose');

function isSafeDatabase(uri) {
  try {
    const dbName = new URL(uri).pathname.replace(/^\//, '').split('?')[0].toLowerCase();
    if (/production|prod|staging/.test(dbName)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function deleteData() {
  const uri = process.env.DATABASE;
  const isConfirmed = process.argv.includes('--confirm-reset') || process.env.ALLOW_DESTRUCTIVE_RESET === 'true';

  if (!isSafeDatabase(uri) && process.env.ALLOW_DESTRUCTIVE_RESET !== 'true') {
    console.error('⛔ SAFETY ABORT: Refusing to reset a production/staging database.');
    console.error('If you genuinely intend to wipe this database, set ALLOW_DESTRUCTIVE_RESET=true and run again.');
    process.exit(1);
  }

  if (!isConfirmed) {
    console.warn('⚠️ WARNING: This will permanently delete Admin, AdminPassword, and Setting records.');
    console.warn('To proceed, re-run with: npm run reset -- --confirm-reset');
    process.exit(0);
  }

  await mongoose.connect(uri);
  const Admin = require('../models/coreModels/Admin');
  const AdminPassword = require('../models/coreModels/AdminPassword');
  const Setting = require('../models/coreModels/Setting');

  await Admin.deleteMany();
  await AdminPassword.deleteMany();
  console.log('👍 Admin records deleted. To seed demo admin, run: npm run setup');

  await Setting.deleteMany();
  console.log('👍 Setting records deleted. To seed default settings, run: npm run setup');

  await mongoose.disconnect();
  process.exit(0);
}

deleteData().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});

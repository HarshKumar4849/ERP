const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local'), override: true });
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });

const { connectDb, disconnectDb } = require('../database');
const ensureIndexes = require('./ensureIndexes');

async function runCli() {
  console.log('--- TecMotiv Database Index Maintenance CLI ---');
  if (!process.env.DATABASE) {
    console.error('❌ Error: DATABASE environment variable is not defined.');
    process.exit(1);
  }

  try {
    console.log('Connecting to database...');
    await connectDb();

    console.log('Running index verification and maintenance...');
    await ensureIndexes(true);

    console.log('✅ Index maintenance completed successfully.');
  } catch (err) {
    console.error('❌ Index maintenance failed:', err);
    process.exit(1);
  } finally {
    await disconnectDb();
    process.exit(0);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = runCli;


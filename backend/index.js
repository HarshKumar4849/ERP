const path = require('path');

// Ensure module resolution works from backend node_modules and monorepo root
module.paths.unshift(path.resolve(__dirname, 'node_modules'));
module.paths.unshift(path.resolve(__dirname, '../node_modules'));

try {
  require('module-alias/register');
} catch (e) {
  // Continue if not required by bundler
}

require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '.env.local'), override: true });

// Robust dual resolution for local Node runtime, Vercel Serverless, and bundlers
let app;
try {
  app = require('./src/app');
} catch (e) {
  try {
    app = require(path.join(__dirname, 'src', 'app'));
  } catch (e2) {
    app = require('../backend/src/app');
  }
}

module.exports = app;

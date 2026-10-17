const path = require('path');

// Ensure module resolution works from backend node_modules
module.paths.unshift(path.resolve(__dirname, 'backend/node_modules'));
module.paths.unshift(path.resolve(__dirname, 'node_modules'));

try {
  require('module-alias/register');
} catch (e) {
  // If already registered or not required by bundler, continue
}

require('dotenv').config({ path: path.resolve(__dirname, 'backend/.env') });
require('dotenv').config({ path: path.resolve(__dirname, 'backend/.env.local'), override: true });

// Static direct resolution for Vercel serverless bundling and runtime
let app;
try {
  app = require('./backend/src/app');
} catch (e) {
  app = require('./src/app');
}

module.exports = app;

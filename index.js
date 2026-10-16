const path = require('path');

// Ensure module resolution works from backend node_modules
module.paths.unshift(path.resolve(__dirname, 'backend/node_modules'));
module.paths.unshift(path.resolve(__dirname, 'node_modules'));

try {
  require('module-alias/register');
} catch (e) {
  // If already registered or not required by bundler, continue
}

module.exports = require('./backend/index');

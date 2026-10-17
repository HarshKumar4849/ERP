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
const candidates = [
  './src/app',
  path.join(__dirname, 'src', 'app'),
  path.resolve(process.cwd(), 'src', 'app'),
  path.resolve(process.cwd(), 'backend', 'src', 'app'),
  path.join(__dirname, '..', 'src', 'app'),
  path.join(__dirname, '..', 'backend', 'src', 'app'),
];

let lastErr = null;
for (const cand of candidates) {
  try {
    app = require(cand);
    if (app) break;
  } catch (err) {
    lastErr = err;
    const isMissingCand =
      err.code === 'MODULE_NOT_FOUND' &&
      (err.message.includes('src/app') || err.message.includes('src\\app') || err.message.includes(cand));
    if (!isMissingCand) {
      console.error(`[CRITICAL] Error executing ${cand}:`, err);
      throw err;
    }
  }
}

if (!app) {
  const fs = require('fs');
  console.error('[CRITICAL] Could not locate src/app. Diagnostics:');
  console.error('__dirname:', __dirname);
  console.error('process.cwd():', process.cwd());
  try { console.error('readdir(__dirname):', fs.readdirSync(__dirname)); } catch (_) {}
  try { console.error('readdir(process.cwd()):', fs.readdirSync(process.cwd())); } catch (_) {}
  try { console.error('readdir(__dirname/..):', fs.readdirSync(path.join(__dirname, '..'))); } catch (_) {}
  throw lastErr || new Error('Could not find src/app module');
}

module.exports = app;

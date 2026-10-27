const path = require('path');
const mongoose = require('mongoose');

// Ensure module resolution works from backend node_modules and root node_modules
module.paths.unshift(path.resolve(__dirname, '../backend/node_modules'));
module.paths.unshift(path.resolve(__dirname, '../node_modules'));

// Register module alias for @ aliases
try {
  const moduleAlias = require('module-alias');
  moduleAlias.addAliases({
    '@': path.resolve(__dirname, '../backend/src'),
    '@/models': path.resolve(__dirname, '../backend/src/models'),
    '@/controllers': path.resolve(__dirname, '../backend/src/controllers'),
    '@/handlers': path.resolve(__dirname, '../backend/src/handlers'),
    '@/middlewares': path.resolve(__dirname, '../backend/src/middlewares'),
    '@/routes': path.resolve(__dirname, '../backend/src/routes'),
    '@/settings': path.resolve(__dirname, '../backend/src/settings'),
    '@/utils': path.resolve(__dirname, '../backend/src/utils'),
  });
} catch (e) {
  // Continue if already registered
}

require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env.local'), override: true });

let app;
try {
  app = require('../backend/src/app');
} catch (e) {
  try {
    app = require('./backend/src/app');
  } catch (e2) {
    app = require(path.join(process.cwd(), 'backend', 'src', 'app'));
  }
}

// Database connection middleware for Vercel serverless execution
let isConnected = false;
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  const dbUri = process.env.DATABASE;
  if (!dbUri) {
    console.error('DATABASE env variable is not defined.');
    return;
  }
  await mongoose.connect(dbUri);
  isConnected = true;
};

// Wrap in serverless request handler
const serverlessHandler = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('MongoDB connection error in serverless:', err);
    return res.status(503).json({
      success: false,
      message: 'Database connection failed. Please try again shortly.',
      error: err.message,
    });
  }
  return app(req, res);
};

module.exports = serverlessHandler;

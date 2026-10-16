const express = require('express');

const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');

const cookieParser = require('cookie-parser');

// Ensure all Mongoose models are registered
require('./models/loadAllModels.js');

const coreAuthRouter = require('./routes/coreRoutes/coreAuth');
const coreApiRouter = require('./routes/coreRoutes/coreApi');
const coreDownloadRouter = require('./routes/coreRoutes/coreDownloadRouter');
const corePublicRouter = require('./routes/coreRoutes/corePublicRouter');
const adminAuth = require('./controllers/coreControllers/adminAuth');

const errorHandlers = require('./handlers/errorHandlers');
const erpApiRouter = require('./routes/appRoutes/appApi');

const fileUpload = require('express-fileupload');
// create our Express app
const app = express();

const defaultLocalOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
  'http://localhost:8888',
];

const configuredOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((url) => url.trim().replace(/\/+$/, ''))
  : [];

const allowedOrigins = [...new Set([...configuredOrigins, ...defaultLocalOrigins])];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, '');

      // Allow localhost and 127.0.0.1 on any port for local development & testing
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin);
      const isVercel = /\.vercel\.app$/.test(cleanOrigin);

      if (isLocalhost || isVercel || allowedOrigins.includes(cleanOrigin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy violation: origin ${cleanOrigin} is not allowed`));
      }
    },
    credentials: true,
  })
);

// Standard HTTP defensive security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Database connection middleware for serverless / pooled environments
let isConnecting = null;
const ensureDbConnection = async (req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    return next();
  }

  if (mongoose.connection.readyState === 2 && isConnecting) {
    try {
      await isConnecting;
      return next();
    } catch (err) {
      return next(err);
    }
  }

  const dbUri = process.env.DATABASE;
  if (!dbUri) {
    console.warn('⚠️ DATABASE connection string is not set in environment variables');
    return next();
  }

  try {
    isConnecting = mongoose.connect(dbUri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      minPoolSize: 1,
      socketTimeoutMS: 45000,
      family: 4,
    });
    await isConnecting;
    isConnecting = null;
    next();
  } catch (err) {
    isConnecting = null;
    console.error('❌ Database connection error:', err.message);
    res.status(500).json({
      success: false,
      result: null,
      message: 'Database connection failed: ' + err.message,
    });
  }
};

app.use(cookieParser());
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

app.use(compression());

// // default options
// app.use(fileUpload());

// GitHub Webhook Endpoint (Direct public HMAC verification)
const githubController = require('./controllers/appControllers/githubController');
app.post('/api/github/webhook', githubController.handleWebhook);

// Health check for load balancers, Vercel proxy, and uptime monitors
app.get(['/health', '/api/health'], async (req, res) => {
  let dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  if (mongoose.connection.readyState === 0 && process.env.DATABASE) {
    try {
      await mongoose.connect(process.env.DATABASE, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10,
        minPoolSize: 1,
        family: 4,
      });
      dbStatus = 'connected';
    } catch (e) {
      dbStatus = 'connecting-failed';
    }
  }
  res.status(200).json({
    status: 'healthy',
    service: 'TecMotiv-ERP-API',
    database: dbStatus,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Here our API Routes
app.use('/api', ensureDbConnection);
app.use('/download', ensureDbConnection);

app.use('/api', coreAuthRouter);
app.use('/api', adminAuth.isValidAuthToken, coreApiRouter);
app.use('/api', adminAuth.isValidAuthToken, erpApiRouter);
app.use('/download', adminAuth.isValidAuthToken, coreDownloadRouter);
app.use('/public', corePublicRouter);

// If that above routes didnt work, we 404 them and forward to error handler
app.use(errorHandlers.notFound);

// production error handler
app.use(errorHandlers.productionErrors);

// done! we export it so we can start the site in start.js
module.exports = app;

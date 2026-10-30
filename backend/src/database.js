const mongoose = require('mongoose');

let connectionPromise = null;

const defaultOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4,
};

function connectDb(uri = process.env.DATABASE, options = {}) {
  if (mongoose.connection.readyState === 1) {
    return Promise.resolve(mongoose.connection);
  }

  if (mongoose.connection.readyState === 2 && connectionPromise) {
    return connectionPromise;
  }

  const dbUri = uri || process.env.DATABASE;
  if (!dbUri) {
    return Promise.reject(new Error('DATABASE environment variable is not defined.'));
  }

  const opts = { ...defaultOptions, ...options };

  connectionPromise = mongoose
    .connect(dbUri, opts)
    .then(() => {
      return mongoose.connection;
    })
    .catch((err) => {
      connectionPromise = null;
      throw err;
    });

  return connectionPromise;
}

// Global connection event logging (safe, no credential leakage)
let eventsConfigured = false;
function setupConnectionEvents() {
  if (eventsConfigured) return;
  eventsConfigured = true;

  mongoose.connection.on('connected', () => {
    console.log('MongoDB connection established successfully.');
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB connection lost. Awaiting automatic reconnect...');
  });
}

setupConnectionEvents();

async function disconnectDb(force = false) {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.connection.close(force);
      console.log('MongoDB connection closed cleanly.');
    } catch (err) {
      console.error('Error closing MongoDB connection:', err.message);
      throw err;
    } finally {
      connectionPromise = null;
    }
  } else {
    connectionPromise = null;
  }
}

module.exports = {
  connectDb,
  disconnectDb,
  defaultOptions,
};


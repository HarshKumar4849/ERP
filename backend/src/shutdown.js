const { disconnectDb } = require('./database');

let isShuttingDown = false;
let shutdownPromise = null;
let activeRequests = 0;
let handlersRegistered = false;

/**
 * Express middleware to track active in-flight requests and reject
 * incoming requests during server shutdown with 503 Service Unavailable.
 */
function trackRequests(req, res, next) {
  if (isShuttingDown) {
    res.setHeader('Connection', 'close');
    return res.status(503).json({
      success: false,
      message: 'Server is currently shutting down. Please retry shortly.',
    });
  }

  activeRequests++;
  let decremented = false;
  const onDone = () => {
    if (!decremented) {
      decremented = true;
      activeRequests--;
    }
  };

  res.on('finish', onDone);
  res.on('close', onDone);
  next();
}

/**
 * Returns current shutdown status and in-flight request count.
 */
function getShutdownState() {
  return {
    isShuttingDown,
    activeRequests,
    handlersRegistered,
  };
}

/**
 * Reset shutdown state (primarily used in automated test teardown).
 */
function resetShutdownState() {
  isShuttingDown = false;
  shutdownPromise = null;
  activeRequests = 0;
}

/**
 * Coordinates graceful shutdown across HTTP server, Socket.IO, schedulers, and MongoDB.
 *
 * @param {Object} options
 * @param {import('http').Server} [options.server] - Node HTTP server instance
 * @param {Object} [options.io] - Socket.IO server instance
 * @param {number} [options.timeoutMs=10000] - Hard upper bound timeout in milliseconds
 * @param {string} [options.signal='SIGTERM'] - The triggering signal
 * @param {boolean} [options.exitProcess=true] - Whether to call process.exit at the end
 * @returns {Promise<void>}
 */
function gracefulShutdown({
  server = null,
  io = null,
  timeoutMs = 10000,
  signal = 'SIGTERM',
  exitProcess = true,
} = {}) {
  // Idempotent: if already shutting down, return the existing in-progress promise
  if (isShuttingDown && shutdownPromise) {
    console.warn(`[Shutdown] Shutdown already in progress. Ignoring duplicate signal (${signal}).`);
    return shutdownPromise;
  }

  isShuttingDown = true;
  console.log(`[Shutdown] Received ${signal}. Initiating graceful shutdown...`);

  shutdownPromise = (async () => {
    // 1. Safety force-exit timer to ensure the process NEVER hangs indefinitely
    let forceTimer = null;
    if (exitProcess) {
      forceTimer = setTimeout(() => {
        console.error(`[Shutdown] Force timeout reached (${timeoutMs}ms). Terminating process.`);
        process.exit(1);
      }, timeoutMs);
      if (forceTimer.unref) forceTimer.unref();
    }

    // 2. Stop background scheduler timers so no new batch jobs trigger
    try {
      const payrollScheduler = require('./services/payrollScheduler');
      if (typeof payrollScheduler.stopScheduler === 'function') {
        payrollScheduler.stopScheduler();
        console.log('[Shutdown] Payroll scheduler stopped.');
      }
    } catch (schedErr) {
      console.warn('[Shutdown] Notice while stopping scheduler:', schedErr.message);
    }

    // 3. Drain active in-flight requests (wait up to 5 seconds or bounded timeout)
    const drainStart = Date.now();
    const maxDrainWait = Math.min(timeoutMs - 2000, 5000);
    while (activeRequests > 0 && Date.now() - drainStart < maxDrainWait) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (activeRequests > 0) {
      console.warn(`[Shutdown] ${activeRequests} request(s) still active after drain period.`);
    } else {
      console.log('[Shutdown] In-flight requests drained successfully.');
    }

    // 4. Close Socket.IO server if active
    if (io && typeof io.close === 'function') {
      try {
        await new Promise((resolve) => {
          io.close(() => {
            console.log('[Shutdown] Socket.IO server closed.');
            resolve();
          });
        });
      } catch (ioErr) {
        console.warn('[Shutdown] Error while closing Socket.IO:', ioErr.message);
      }
    }

    // 5. Stop HTTP server from accepting new connections
    if (server && typeof server.close === 'function') {
      try {
        // Close idle keep-alive connections if supported (Node.js 18.2+)
        if (typeof server.closeIdleConnections === 'function') {
          server.closeIdleConnections();
        }

        await new Promise((resolve) => {
          server.close((err) => {
            if (err) {
              console.error('[Shutdown] Error while closing HTTP server:', err.message);
            } else {
              console.log('[Shutdown] HTTP server closed to new connections.');
            }
            // Always resolve so database disconnect still executes
            resolve();
          });
        });
      } catch (srvErr) {
        console.error('[Shutdown] HTTP server close exception:', srvErr.message);
      }
    }

    // 6. Close MongoDB connection pool cleanly
    try {
      await disconnectDb();
      console.log('[Shutdown] MongoDB connection pool drained and closed.');
    } catch (dbErr) {
      console.error('[Shutdown] Error disconnecting MongoDB:', dbErr.message);
    }

    // 7. Cleanly disconnect Redis cache client if active
    try {
      const cacheService = require('./services/cacheService');
      await cacheService.disconnect();
    } catch (cacheErr) {
      console.warn('[Shutdown] Notice disconnecting Redis:', cacheErr.message);
    }

    if (forceTimer) {
      clearTimeout(forceTimer);
    }

    console.log('[Shutdown] Graceful shutdown completed cleanly.');

    // 8. Exit cleanly only after all cleanup promises have resolved
    if (exitProcess) {
      process.exit(0);
    }
  })();

  return shutdownPromise;
}

/**
 * Registers SIGTERM and SIGINT process signal listeners.
 * Prevents multiple registrations.
 *
 * @param {import('http').Server} server
 * @param {Object} io
 */
function registerShutdownHandlers(server, io) {
  if (handlersRegistered) {
    return;
  }
  handlersRegistered = true;

  const onSignal = (signal) => {
    gracefulShutdown({ server, io, signal, exitProcess: true }).catch((err) => {
      console.error(`[Shutdown] Unexpected error during ${signal} shutdown:`, err);
      process.exit(1);
    });
  };

  process.once('SIGTERM', () => onSignal('SIGTERM'));
  process.once('SIGINT', () => onSignal('SIGINT'));
}

module.exports = {
  trackRequests,
  getShutdownState,
  resetShutdownState,
  gracefulShutdown,
  registerShutdownHandlers,
};


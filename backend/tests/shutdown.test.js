const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(rootDir, '.env.qa') });

const { connectDb, disconnectDb } = require('../src/database');
const {
  trackRequests,
  getShutdownState,
  resetShutdownState,
  gracefulShutdown,
  registerShutdownHandlers,
} = require('../src/shutdown');

test('Backend Lifecycle & Graceful Shutdown Suite', async (t) => {
  t.beforeEach(() => {
    resetShutdownState();
  });

  t.afterEach(async () => {
    await disconnectDb(true);
    resetShutdownState();
  });

  await t.test('1. Normal backend startup connects to MongoDB successfully', async () => {
    const conn = await connectDb();
    assert.ok(conn, 'Database connection should resolve');
    assert.strictEqual(conn.readyState, 1, 'Mongoose readyState should be 1 (connected)');
  });

  await t.test('2. Normal graceful shutdown closes HTTP server and drains MongoDB pool', async () => {
    await connectDb();

    let serverClosed = false;
    const mockServer = http.createServer((req, res) => {
      res.end('ok');
    });

    await new Promise((resolve) => mockServer.listen(0, resolve));
    const port = mockServer.address().port;
    assert.ok(port > 0, 'Server should be listening on dynamic port');

    // Execute graceful shutdown without exiting process
    await gracefulShutdown({
      server: mockServer,
      signal: 'TEST_SHUTDOWN',
      timeoutMs: 3000,
      exitProcess: false,
    });

    const state = getShutdownState();
    assert.strictEqual(state.isShuttingDown, true, 'isShuttingDown flag should be true');

    const mongoose = require('mongoose');
    assert.strictEqual(mongoose.connection.readyState, 0, 'MongoDB connection should be disconnected (readyState 0)');
  });

  await t.test('3. Multiple simultaneous shutdown signals are idempotent', async () => {
    await connectDb();

    const mockServer = http.createServer((req, res) => res.end('ok'));
    await new Promise((resolve) => mockServer.listen(0, resolve));

    // Fire 3 simultaneous shutdown calls
    const p1 = gracefulShutdown({ server: mockServer, signal: 'SIGTERM', timeoutMs: 3000, exitProcess: false });
    const p2 = gracefulShutdown({ server: mockServer, signal: 'SIGINT', timeoutMs: 3000, exitProcess: false });
    const p3 = gracefulShutdown({ server: mockServer, signal: 'SIGTERM', timeoutMs: 3000, exitProcess: false });

    assert.strictEqual(p1, p2, 'Simultaneous shutdown calls must return identical promise');
    assert.strictEqual(p2, p3, 'Simultaneous shutdown calls must return identical promise');

    await Promise.all([p1, p2, p3]);

    const state = getShutdownState();
    assert.strictEqual(state.isShuttingDown, true);
  });

  await t.test('4. Shutdown while requests are in-flight allows drain and rejects new requests with 503', async () => {
    await connectDb();

    let inFlightFinished = false;

    // Simulate in-flight request
    const mockReq = {};
    let finishHandler = null;
    const mockResInFlight = {
      setHeader: () => {},
      status: () => mockResInFlight,
      json: () => {},
      on: (event, handler) => {
        if (event === 'finish') finishHandler = handler;
      },
    };

    trackRequests(mockReq, mockResInFlight, () => {});
    assert.strictEqual(getShutdownState().activeRequests, 1, 'Active requests count should be 1');

    // Initiate shutdown in background
    const shutdownPromise = gracefulShutdown({
      signal: 'SIGTERM',
      timeoutMs: 4000,
      exitProcess: false,
    });

    // New request arriving during shutdown should get 503
    let rejectedWith503 = false;
    let connectionClosed = false;
    const mockResNew = {
      setHeader: (name, val) => {
        if (name === 'Connection' && val === 'close') connectionClosed = true;
      },
      status: (code) => {
        if (code === 503) rejectedWith503 = true;
        return mockResNew;
      },
      json: (body) => {
        assert.strictEqual(body.success, false);
      },
      on: () => {},
    };

    trackRequests({}, mockResNew, () => {
      assert.fail('New requests should not be passed to next() while shutting down');
    });

    assert.strictEqual(rejectedWith503, true, 'New request should receive HTTP 503');
    assert.strictEqual(connectionClosed, true, 'Connection header should be set to close');

    // Finish in-flight request
    setTimeout(() => {
      if (finishHandler) finishHandler();
      inFlightFinished = true;
    }, 100);

    await shutdownPromise;
    assert.strictEqual(inFlightFinished, true, 'In-flight request completed before shutdown resolved');
    assert.strictEqual(getShutdownState().activeRequests, 0, 'Active requests drained to 0');
  });

  await t.test('5. Graceful shutdown handles unavailable/disconnected MongoDB without crashing', async () => {
    // Ensure DB is not connected
    await disconnectDb(true);

    let errorThrown = false;
    try {
      await gracefulShutdown({
        server: null,
        io: null,
        signal: 'SIGTERM',
        timeoutMs: 2000,
        exitProcess: false,
      });
    } catch (err) {
      errorThrown = true;
    }

    assert.strictEqual(errorThrown, false, 'Shutdown must not throw when DB is already disconnected');
    assert.strictEqual(getShutdownState().isShuttingDown, true);
  });

  await t.test('6. registerShutdownHandlers registers handlers safely without duplication', () => {
    const mockServer = http.createServer((req, res) => res.end('ok'));
    registerShutdownHandlers(mockServer, null);
    assert.strictEqual(getShutdownState().handlersRegistered, true, 'Handlers registered flag should be true');

    // Calling again does not throw or double-register
    registerShutdownHandlers(mockServer, null);
    assert.strictEqual(getShutdownState().handlersRegistered, true);
  });
});


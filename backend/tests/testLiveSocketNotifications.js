const { io } = require('../../node_modules/socket.io-client');
const http = require('http');

const SERVER_URL = 'http://127.0.0.1:8888';

// Helper for making HTTP JSON requests
function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER_URL);
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, raw: rawData });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runLiveSocketTests() {
  console.log('🔌 ==============================================================');
  console.log('🔌 LIVE SOCKET.IO NOTIFICATION SYSTEM VERIFICATION');
  console.log('🔌 Target Server: ' + SERVER_URL);
  console.log('🔌 ==============================================================\n');

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Log in via HTTP to obtain a valid JWT token
    // -------------------------------------------------------------------------
    console.log('🔑 Step 1: Authenticating via HTTP to acquire session token...');
    const loginRes = await makeRequest('POST', '/api/login', {
      email: 'hkp12345h@gmail.com',
      password: 'admin123',
    });

    if (loginRes.status !== 200 || !loginRes.data?.result?.token) {
      throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
    }

    const token = loginRes.data.result.token;
    const userId = loginRes.data.result._id;
    console.log(`   ✓ Authenticated successfully as user ${userId} (${loginRes.data.result.name} ${loginRes.data.result.surname})\n`);

    // -------------------------------------------------------------------------
    // STEP 2: Negative Test - Unauthorized socket connection should be rejected
    // -------------------------------------------------------------------------
    console.log('🚫 Step 2: Testing unauthorized connection (no token)...');
    await new Promise((resolve, reject) => {
      const badSocket = io(SERVER_URL, {
        auth: {}, // missing authorization
        transports: ['websocket'],
        reconnection: false,
        timeout: 5000,
      });

      badSocket.on('disconnect', (reason) => {
        console.log(`   ✓ Unauthorized socket was correctly disconnected: reason="${reason}"`);
        badSocket.close();
        resolve();
      });

      badSocket.on('connect', () => {
        badSocket.close();
        reject(new Error('Unauthorized socket was unexpectedly allowed to connect!'));
      });

      setTimeout(() => {
        badSocket.close();
        resolve(); // Timed out or rejected
      }, 3000);
    });
    console.log('✅ Step 2 Passed: Unauthorized socket rejected properly.\n');

    // -------------------------------------------------------------------------
    // STEP 3: Authorized Socket.IO Connection & Initial Notifications
    // -------------------------------------------------------------------------
    console.log('🌐 Step 3: Connecting authorized Socket.IO client...');
    let initialNotificationsReceived = null;

    const socket = io(SERVER_URL, {
      auth: {
        authorization: `Bearer ${token}`,
      },
      transports: ['websocket', 'polling'],
      reconnection: false,
    });

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timed out waiting for socket connect & initial-notifications'));
      }, 7000);

      socket.on('connect', () => {
        console.log(`   ✓ Socket connected successfully! Socket ID: ${socket.id}`);
      });

      socket.on('initial-notifications', (payload) => {
        console.log(`   ✓ Event "initial-notifications" received:`, {
          success: payload.success,
          notificationsCount: payload.notifications?.length,
          unreadCount: payload.unreadCount,
        });
        initialNotificationsReceived = payload;
        clearTimeout(timer);
        resolve();
      });

      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(new Error(`Socket connection error: ${err.message}`));
      });
    });

    if (!initialNotificationsReceived || !initialNotificationsReceived.success) {
      throw new Error('Did not receive valid initial-notifications payload');
    }
    console.log('✅ Step 3 Passed: Live WebSocket connection established and initial notifications synchronized.\n');

    // -------------------------------------------------------------------------
    // STEP 4: Live Event Delivery Verification
    // -------------------------------------------------------------------------
    console.log('⚡ Step 4: Testing live real-time notification dispatch via Socket.IO...');

    let liveNotificationListReceived = null;
    let liveUnreadCountReceived = null;

    const liveEventPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timed out waiting for live socket events after triggering notification'));
      }, 8000);

      socket.on('notification-list', (data) => {
        console.log(`   ⚡ Event "notification-list" received in real-time! Total items: ${data.notifications?.length}`);
        liveNotificationListReceived = data;
        if (liveUnreadCountReceived) {
          clearTimeout(timer);
          resolve();
        }
      });

      socket.on('unread-count', (data) => {
        console.log(`   ⚡ Event "unread-count" received in real-time! Unread count: ${data.count}`);
        liveUnreadCountReceived = data;
        if (liveNotificationListReceived) {
          clearTimeout(timer);
          resolve();
        }
      });
    });

    // Trigger a live notification via HTTP
    console.log('   Sending POST /api/notification/trigger to dispatch live notification...');
    const triggerRes = await makeRequest(
      'POST',
      '/api/notification/trigger',
      {
        recipient: userId,
        type: 'SYSTEM_ANNOUNCEMENT',
        title: 'Real-Time Socket Test Alert',
        message: 'This notification was pushed via live WebSocket connection.',
        link: '/leave',
        priority: 'high',
        channels: ['in_app'],
      },
      token
    );

    if (triggerRes.status !== 201) {
      throw new Error(`Failed to trigger notification: status ${triggerRes.status}`);
    }

    await liveEventPromise;
    console.log('✅ Step 4 Passed: Both "notification-list" and "unread-count" received in real-time over Socket.IO!\n');

    // -------------------------------------------------------------------------
    // STEP 5: Live Read Event Verification
    // -------------------------------------------------------------------------
    console.log('📖 Step 5: Testing real-time mark-as-read socket synchronization...');
    const latestNotif = liveNotificationListReceived.notifications[0];
    if (!latestNotif) {
      throw new Error('No notification found in notification-list payload');
    }

    let readEventReceived = null;
    const readEventPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timed out waiting for notification-read event'));
      }, 8000);

      socket.on('notification-read', (data) => {
        console.log(`   ✓ Event "notification-read" received! Unread remaining: ${data.unreadCount}`);
        readEventReceived = data;
        clearTimeout(timer);
        resolve();
      });
    });

    console.log(`   Sending PATCH /api/notification/read/${latestNotif._id}...`);
    const readRes = await makeRequest('PATCH', `/api/notification/read/${latestNotif._id}`, {}, token);
    if (readRes.status !== 200) {
      throw new Error(`Failed to mark read: status ${readRes.status}`);
    }

    await readEventPromise;
    console.log('✅ Step 5 Passed: Mark-as-read synchronized over WebSocket in real-time!\n');

    // Cleanup socket
    socket.disconnect();

    console.log('==============================================================');
    console.log('🎉 ALL LIVE SOCKET NOTIFICATION VERIFICATION TESTS PASSED!');
    console.log('   ✓ WebSocket Handshake & Authentication (JWT): Working');
    console.log('   ✓ User Room Assignment (user_{userId}): Working');
    console.log('   ✓ Initial Notification Sync: Working');
    console.log('   ✓ Real-time Notification List Push: Working');
    console.log('   ✓ Real-time Badge Unread Count Push: Working');
    console.log('   ✓ Real-time Read State Synchronization: Working');
    console.log('   ✓ Unauthorized Rejection: Working');
    console.log('==============================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Live socket test failed:', err);
    process.exit(1);
  }
}

runLiveSocketTests();

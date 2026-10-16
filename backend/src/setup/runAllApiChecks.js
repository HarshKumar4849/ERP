require('module-alias/register');
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const { globSync } = require('glob');
const path = require('path');
const http = require('http');

async function main() {
  console.log('====================================================');
  console.log('🚀 TECMOTIV ERP COMPREHENSIVE API INTEGRITY AUDIT');
  console.log('====================================================\n');

  // 1. Connect MongoDB
  const dbUri = process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp';
  console.log('1. Connecting to MongoDB at:', dbUri.includes('@') ? dbUri.split('@')[1] : dbUri);
  await mongoose.connect(dbUri);
  console.log('   ✅ MongoDB connected successfully.\n');

  // Load all models
  const modelsFiles = globSync('./src/models/**/*.js');
  for (const filePath of modelsFiles) {
    require(path.resolve(filePath));
  }

  // 2. Start Express app on port 8888 (or 8889 if 8888 in use)
  const app = require('../app');
  const PORT = 8888;
  app.set('port', PORT);
  
  let server;
  try {
    server = await new Promise((resolve, reject) => {
      const s = app.listen(PORT, () => resolve(s));
      s.on('error', reject);
    });
    console.log(`2. Express Server started on PORT: ${PORT}\n`);
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${PORT} is already running. Using existing instance.`);
    } else {
      throw err;
    }
  }

  const BASE_URL = `http://localhost:${PORT}/api`;

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: [],
  };

  async function testApi(name, method, endpoint, token, body = null, expectedStatuses = [200, 201, 202, 203]) {
    results.total++;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = {
      method,
      headers,
    };
    if (body) options.body = JSON.stringify(body);

    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, options);
      const isExpected = expectedStatuses.includes(res.status);
      let json = null;
      try {
        json = await res.json();
      } catch (e) {
        // non-json response
      }

      // If status is an expected error status (like 401, 403, 400) or an expected success status
      if (isExpected) {
        results.passed++;
        console.log(`✅ [${res.status}] ${method} ${endpoint} - ${name}`);
        return { success: true, status: res.status, data: json };
      } else {
        results.failed++;
        const msg = json?.message || `Unexpected status ${res.status}`;
        console.log(`❌ [${res.status}] ${method} ${endpoint} - ${name}: ${msg}`);
        results.failures.push({ name, method, endpoint, status: res.status, error: msg });
        return { success: false, status: res.status, data: json };
      }
    } catch (err) {
      results.failed++;
      console.log(`❌ [NET ERR] ${method} ${endpoint} - ${name}: ${err.message}`);
      results.failures.push({ name, method, endpoint, status: 'NETWORK_ERROR', error: err.message });
      return { success: false, error: err.message };
    }
  }

  // --- Step 3: Auth Endpoints Test ---
  console.log('--- 3. Testing Authentication Endpoints ---');
  let adminToken = null;
  let empToken = null;
  let hrToken = null;

  const adminLogin = await testApi('Admin Login', 'POST', '/login', null, {
    email: 'admin@admin.com',
    password: 'admin123',
  });
  if (adminLogin.success && adminLogin.data?.result?.token) {
    adminToken = adminLogin.data.result.token;
  }

  const empLogin = await testApi('Employee Login', 'POST', '/login', null, {
    email: 'employee1@tecmotiv.com',
    password: 'admin123',
  });
  if (empLogin.success && empLogin.data?.result?.token) {
    empToken = empLogin.data.result.token;
  }

  const hrLogin = await testApi('HR Login', 'POST', '/login', null, {
    email: 'hr@tecmotiv.com',
    password: 'admin123',
  });
  if (hrLogin.success && hrLogin.data?.result?.token) {
    hrToken = hrLogin.data.result.token;
  }

  // Forget password validation test
  await testApi('Forget Password validation', 'POST', '/forgetpassword', null, {
    email: 'admin@admin.com',
  }, [200]);

  if (!adminToken) {
    console.error('CRITICAL: Cannot proceed without Admin Token!');
    if (server) server.close();
    process.exit(1);
  }

  // --- Step 4: Core Admin & Setting Endpoints ---
  console.log('\n--- 4. Testing Core Admin & Setting APIs ---');
  await testApi('Admin List', 'GET', '/admin/list', adminToken);
  await testApi('Settings List', 'GET', '/setting/list', adminToken);
  await testApi('Settings ListAll', 'GET', '/setting/listAll', adminToken);

  // --- Step 5: Entity CRUD Endpoints (List, ListAll, Summary, Search, Filter) ---
  console.log('\n--- 5. Testing Standard Entity Modules Endpoints ---');
  const entities = [
    'employee',
    'department',
    'designation',
    'location',
    'project',
    'task',
    'attendance',
    'leave',
    'leavebalance',
    'salary',
    'salaryaudit',
    'asset',
    'officeoperation',
    'digitalservice',
    'document',
    'policy',
    'policyacknowledgement',
    'event',
    'celebration',
    'announcement',
    'recognition',
    'template',
    'outlookintegration',
    'notification',
    'notificationpreference',
  ];

  for (const entity of entities) {
    await testApi(`${entity.toUpperCase()} List`, 'GET', `/${entity}/list`, adminToken);
    await testApi(`${entity.toUpperCase()} ListAll`, 'GET', `/${entity}/listAll`, adminToken);
    await testApi(`${entity.toUpperCase()} Summary`, 'GET', `/${entity}/summary`, adminToken);
    await testApi(`${entity.toUpperCase()} Search`, 'GET', `/${entity}/search?q=test`, adminToken);
    await testApi(`${entity.toUpperCase()} Filter`, 'GET', `/${entity}/filter?filter=removed&equal=false`, adminToken);
  }

  // --- Step 6: Dedicated ERP Functional Modules ---
  console.log('\n--- 6. Testing Dedicated Domain APIs ---');
  // Dashboard
  await testApi('Dashboard Overview', 'GET', '/dashboard/overview', adminToken);
  await testApi('Dashboard Overview List', 'GET', '/dashboard/overview/list', adminToken);

  // Attendance
  await testApi('Attendance Today Status', 'GET', '/attendance/today', adminToken);
  await testApi('Attendance Monthly Status', 'GET', '/attendance/monthly', adminToken);
  await testApi('Attendance Summary Report', 'GET', '/attendance/report', adminToken);
  await testApi('Attendance Daily Login', 'POST', '/attendance/login', adminToken, {
    workMode: 'Office',
    location: 'NYC-HQ',
    ipAddress: '127.0.0.1',
  }, [200, 400]); // 400 if already logged in today
  await testApi('Attendance Daily Logout', 'POST', '/attendance/logout', adminToken, {}, [200, 400]);

  // Leave Management
  await testApi('Leave Balances', 'GET', '/leave/balance', adminToken);
  await testApi('Leave Calendar', 'GET', '/leave/calendar', adminToken);
  await testApi('Leave Approvals Queue', 'GET', '/leave/approvals-queue', adminToken);

  // Task Tracker
  await testApi('Task Dashboard Summary', 'GET', '/task/dashboard', adminToken);
  await testApi('My Tasks List', 'GET', '/task/my-tasks', adminToken);
  await testApi('Team Tasks List', 'GET', '/task/team-tasks', adminToken);

  // Calendar & Celebrations
  await testApi('Calendar Events Feed', 'GET', '/calendar/events', adminToken);
  await testApi('Calendar Celebrations Feed', 'GET', '/calendar/celebrations', adminToken);

  // Bulletin & Feeds
  await testApi('Bulletin Comms Feed', 'GET', '/bulletin/feed', adminToken);

  // Office & Administration
  await testApi('Office Operations List', 'GET', '/office/list', adminToken);

  // IT & Digital Services
  await testApi('Digital Services Renewal Reminders', 'GET', '/digitalservice/reminders', adminToken);

  // Outlook 365
  await testApi('Outlook Status Check', 'GET', '/outlook/status', adminToken);
  await testApi('Outlook Auth URL Generator', 'GET', '/outlook/auth-url', adminToken);
  await testApi('Outlook Synchronized Events', 'GET', '/outlook/events', adminToken);

  // Notification Center
  await testApi('Notification In-App List', 'GET', '/notification/list', adminToken);
  await testApi('Notification Unread Count', 'GET', '/notification/unread-count', adminToken);
  await testApi('Notification User Preferences', 'GET', '/notification/preferences', adminToken);

  // Step 7: Employee RBAC Security Validation
  console.log('\n--- 7. Testing RBAC Security Restrictions (Negative / Guard Tests) ---');
  if (empToken) {
    // Employee should be DENIED access to Admin Office Management (Expected 403)
    await testApi('Employee Blocked from Office Create (RBAC)', 'POST', '/office/create', empToken, {
      title: 'Hacked',
    }, [403]);

    // Employee restricted to own tasks
    await testApi('Employee My Tasks Access', 'GET', '/task/my-tasks', empToken, null, [200]);
  }

  // --- Step 8: Logout ---
  console.log('\n--- 8. Testing Session Termination (Logout) ---');
  await testApi('Admin Logout', 'POST', '/logout', adminToken);

  // Verify token is invalidated
  await testApi('Invalidated Token Rejected', 'GET', '/admin/list', adminToken, null, [401]);

  console.log('\n====================================================');
  console.log('📊 AUDIT SUMMARY REPORT');
  console.log('====================================================');
  console.log(`Total Endpoints Audited : ${results.total}`);
  console.log(`Passed Checks          : ${results.passed} ✅`);
  console.log(`Failed Checks          : ${results.failed} ❌`);

  if (results.failures.length > 0) {
    console.log('\nList of Failures / Discrepancies:');
    results.failures.forEach((f, idx) => {
      console.log(`  ${idx + 1}. [${f.status}] ${f.method} ${f.endpoint} (${f.name}) - ${f.error}`);
    });
  }

  if (server) {
    server.close();
  }
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});

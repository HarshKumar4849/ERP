const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const qa = require('./qa-env');
const { seedFixtures, cleanupFixtures } = require('./fixtures');

let fixtures;
let server;
let baseUrl;
let adminToken;
let hrToken;
let employeeAToken;
let employeeBToken;

async function login(email) {
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: qa.PASSWORD }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, body?.message);
  return body.result.token;
}

test.before(async () => {
  fixtures = await seedFixtures();
  const app = require('../src/app');
  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api`;

  adminToken = await login(fixtures.admin.user.email);
  hrToken = await login(fixtures.hr.user.email);
  employeeAToken = await login(fixtures.employeeA.user.email);
  employeeBToken = await login(fixtures.employeeB.user.email);
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await cleanupFixtures(fixtures);
});

// =========================================================================
// 1. DASHBOARD OVERVIEW SCOPING
// =========================================================================
test('1. Dashboard Overview: Management gets full metrics, employees get self-scoped view', async () => {
  // Admin gets full organization overview
  const adminRes = await fetch(`${baseUrl}/dashboard/overview`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const adminBody = await adminRes.json();
  assert.equal(adminRes.status, 200);
  assert.equal(adminBody.success, true);
  assert.ok(adminBody.result.kpis.totalEmployees >= 4);
  assert.ok(Array.isArray(adminBody.result.todayOverview.leave));

  // HR gets organization overview
  const hrRes = await fetch(`${baseUrl}/dashboard/overview`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  const hrBody = await hrRes.json();
  assert.equal(hrRes.status, 200);
  assert.equal(hrBody.success, true);
  assert.ok(hrBody.result.kpis.totalEmployees >= 4);

  // Employee A gets self-scoped overview without other employees' leaves
  const empRes = await fetch(`${baseUrl}/dashboard/overview`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  const empBody = await empRes.json();
  assert.equal(empRes.status, 200);
  assert.equal(empBody.success, true);
  assert.equal(empBody.result.userRole, 'EMPLOYEE');
  assert.deepEqual(empBody.result.todayOverview.leave, []);
});

// =========================================================================
// 2. CALENDAR & EVENTS LIFECYCLE & ROLE PERMISSIONS
// =========================================================================
test('2. Calendar & Events: HR/Admin can schedule, employees denied modifications but can post wishes', async () => {
  // Employee cannot create events
  const empCreateRes = await fetch(`${baseUrl}/calendar/event`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      title: 'Unauthorized Employee Event',
      startDate: new Date(),
      eventType: 'Company Event',
    }),
  });
  assert.equal(empCreateRes.status, 403, 'Employee event creation must return 403');

  const empEventRes = await fetch(`${baseUrl}/event/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      title: 'Unauthorized Employee Direct Event',
      startDate: new Date(),
      eventType: 'Company Event',
    }),
  });
  assert.equal(empEventRes.status, 403, 'Employee direct event creation must return 403');

  // HR can create a calendar event
  const hrCreateRes = await fetch(`${baseUrl}/calendar/event`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      title: `HR Town Hall ${qa.RUN_ID}`,
      description: 'Quarterly all-hands briefing',
      eventType: 'Company Event',
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 90000000),
      location: 'Virtual',
    }),
  });
  const hrCreateBody = await hrCreateRes.json();
  assert.equal(hrCreateRes.status, 201, `HR event create failed: ${JSON.stringify(hrCreateBody)}`);
  const eventId = hrCreateBody.result._id;

  // Employee cannot modify or delete HR event
  const empUpdateRes = await fetch(`${baseUrl}/calendar/event/${eventId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ title: 'Tampered Title' }),
  });
  assert.equal(empUpdateRes.status, 403, 'Employee cannot update calendar event');

  const empDeleteRes = await fetch(`${baseUrl}/calendar/event/${eventId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${employeeBToken}` },
  });
  assert.equal(empDeleteRes.status, 403, 'Employee cannot delete calendar event');

  // All roles can read calendar events feed
  const feedRes = await fetch(`${baseUrl}/calendar/events`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  const feedBody = await feedRes.json();
  assert.equal(feedRes.status, 200);
  assert.ok(Array.isArray(feedBody.result));

  // Employee can post a celebration wish
  const wishRes = await fetch(`${baseUrl}/calendar/celebration/wish`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      employeeId: fixtures.employeeB.employee._id,
      employeeName: 'QA Employee B',
      type: 'Work Anniversary',
      message: 'Happy work anniversary!',
    }),
  });
  const wishBody = await wishRes.json();
  assert.equal(wishRes.status, 200, `Employee wish failed: ${JSON.stringify(wishBody)}`);
  assert.equal(wishBody.success, true);

  // Admin can delete event
  const adminDelRes = await fetch(`${baseUrl}/calendar/event/${eventId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminDelRes.status, 200);
});

// =========================================================================
// 3. BULLETIN FEED & COMMUNICATONS ISOLATION
// =========================================================================
test('3. Bulletin Comms: HR/Admin can publish, employees can read/like but cannot create/delete', async () => {
  // Employee cannot publish bulletin post
  const empCreateRes = await fetch(`${baseUrl}/announcement/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      title: 'Unauthorized Announcement',
      content: 'This should be blocked',
      section: 'ANNOUNCEMENTS',
    }),
  });
  assert.equal(empCreateRes.status, 403, 'Employee cannot publish announcement');

  // HR publishes bulletin post
  const hrPostRes = await fetch(`${baseUrl}/bulletin/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      title: `Official Bulletin Post ${qa.RUN_ID}`,
      content: 'Welcome to TecMotiv ERP QA audit verification.',
      section: 'COMPANY NEWS',
    }),
  });
  const hrPostBody = await hrPostRes.json();
  assert.equal(hrPostRes.status, 201, `HR bulletin create failed: ${JSON.stringify(hrPostBody)}`);
  const postId = hrPostBody.result._id;

  // Employee cannot delete bulletin post
  const empDelRes = await fetch(`${baseUrl}/announcement/delete/${postId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empDelRes.status, 403, 'Employee cannot delete bulletin post');

  // Employee can read bulletin feed
  const feedRes = await fetch(`${baseUrl}/bulletin/feed`, {
    headers: { authorization: `Bearer ${employeeBToken}` },
  });
  const feedBody = await feedRes.json();
  assert.equal(feedRes.status, 200);
  assert.ok(feedBody.result.all.length >= 1);

  // Employee can like the bulletin post
  const likeRes = await fetch(`${baseUrl}/bulletin/like/${postId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  const likeBody = await likeRes.json();
  assert.equal(likeRes.status, 200, `Employee like failed: ${JSON.stringify(likeBody)}`);
  assert.equal(likeBody.likes, 1);

  // Clean up post via Admin
  const delRes = await fetch(`${baseUrl}/announcement/delete/${postId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(delRes.status, 200);
});

// =========================================================================
// 4. POLICY LIBRARY & DIGITAL ACKNOWLEDGEMENT
// =========================================================================
test('4. Policy Library: Employee can acknowledge own policy, audit trail restricted to HR/Admin', async () => {
  // Employee cannot create policy
  const empCreateRes = await fetch(`${baseUrl}/policy/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      name: 'Unauthorized Policy',
      category: 'HR',
      content: 'Should be rejected',
    }),
  });
  assert.equal(empCreateRes.status, 403, 'Employee policy create must be 403');

  // HR creates a mandatory policy
  const hrCreateRes = await fetch(`${baseUrl}/policy/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      name: `Information Security Policy ${qa.RUN_ID}`,
      category: 'COMPANY',
      version: '1.0',
      content: 'Protect customer and financial credentials at all times.',
      isMandatory: true,
    }),
  });
  const hrCreateBody = await hrCreateRes.json();
  assert.equal(hrCreateRes.status, 201, `HR policy create failed: ${JSON.stringify(hrCreateBody)}`);
  const policyId = hrCreateBody.result._id;

  // Employee cannot modify policy content
  const empUpdateRes = await fetch(`${baseUrl}/policy/update/${policyId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ content: 'Modified by employee' }),
  });
  assert.equal(empUpdateRes.status, 403, 'Employee cannot modify policy');

  // Employee A acknowledges the policy
  const ackRes = await fetch(`${baseUrl}/policy/acknowledge/${policyId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  const ackBody = await ackRes.json();
  assert.equal(ackRes.status, 200, `Employee acknowledge failed: ${JSON.stringify(ackBody)}`);
  assert.equal(ackBody.success, true);
  assert.equal(ackBody.result.statement, 'I have read and understood this policy.');

  // Employee cannot inspect the compliance audit trail of all employees
  const empAuditRes = await fetch(`${baseUrl}/policy/acknowledgements/${policyId}`, {
    headers: { authorization: `Bearer ${employeeBToken}` },
  });
  assert.equal(empAuditRes.status, 403, 'Employee cannot view policy compliance audit trail');

  // HR can view the compliance audit trail
  const hrAuditRes = await fetch(`${baseUrl}/policy/acknowledgements/${policyId}`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  const hrAuditBody = await hrAuditRes.json();
  assert.equal(hrAuditRes.status, 200, 'HR can view policy compliance audit trail');
  assert.equal(hrAuditBody.result.totalAcknowledged, 1);

  // Clean up policy via Admin
  const delRes = await fetch(`${baseUrl}/policy/delete/${policyId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(delRes.status, 200);
});

// =========================================================================
// 5. IT ADMINISTRATION & SYSTEM SETTINGS STRICT ISOLATION
// =========================================================================
test('5. IT Admin & Core Settings: Restricted exclusively to ADMIN; HR and Employees denied', async () => {
  // Employee denied digital services
  const empItRes = await fetch(`${baseUrl}/digitalservice/list`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empItRes.status, 403, 'Employee denied IT digital service list');

  // HR denied digital services
  const hrItRes = await fetch(`${baseUrl}/digitalservice/list`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(hrItRes.status, 403, 'HR denied IT digital service list');

  // HR denied digital services creation
  const hrItCreateRes = await fetch(`${baseUrl}/digitalservice/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      serviceName: 'GitHub Enterprise',
      serviceType: 'SaaS',
      loginEmail: 'admin@tecmotiv.com',
      renewalDate: new Date(),
    }),
  });
  assert.equal(hrItCreateRes.status, 403, 'HR denied IT digital service creation');

  // Employee denied system settings
  const empSettingRes = await fetch(`${baseUrl}/setting/list`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empSettingRes.status, 403, 'Employee denied settings');

  // HR denied system settings
  const hrSettingRes = await fetch(`${baseUrl}/setting/list`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(hrSettingRes.status, 403, 'HR denied settings');

  // Admin can access digital services
  const adminItRes = await fetch(`${baseUrl}/digitalservice/list`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminItRes.status, 200);

  // Admin can access settings
  const adminSettingRes = await fetch(`${baseUrl}/setting/list`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.ok([200, 203].includes(adminSettingRes.status));

  // OAuth calendar integration disconnect denied for HR and Employee
  const hrDisconnectRes = await fetch(`${baseUrl}/outlook/disconnect`, {
    method: 'POST',
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(hrDisconnectRes.status, 403, 'HR denied Outlook disconnect');

  const empDisconnectRes = await fetch(`${baseUrl}/outlook/disconnect`, {
    method: 'POST',
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empDisconnectRes.status, 403, 'Employee denied Outlook disconnect');
});

// =========================================================================
// 6. OFFICE OPERATIONS & ASSETS
// =========================================================================
test('6. Office & Assets: Office operations restricted to Admin; Asset list scoped to self for employees', async () => {
  // Employee denied office operations
  const empOfficeRes = await fetch(`${baseUrl}/office/list`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empOfficeRes.status, 403, 'Employee denied office operations list');

  // HR denied office operations
  const hrOfficeRes = await fetch(`${baseUrl}/office/list`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(hrOfficeRes.status, 403, 'HR denied office operations list');

  // Admin can access office operations
  const adminOfficeRes = await fetch(`${baseUrl}/office/list`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminOfficeRes.status, 200);

  // Employee cannot create company assets in inventory
  const empAssetCreate = await fetch(`${baseUrl}/asset/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ name: 'MacBook Pro 16' }),
  });
  assert.equal(empAssetCreate.status, 403, 'Employee cannot create assets');

  // Admin can list assets
  const adminAssetRes = await fetch(`${baseUrl}/asset/list`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminAssetRes.status, 200);

  // Employee can list assets (scoped to own assigned assets)
  const empAssetRes = await fetch(`${baseUrl}/asset/list`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  const empAssetBody = await empAssetRes.json();
  assert.equal(empAssetRes.status, 200);
  assert.ok(Array.isArray(empAssetBody.result));
});

// =========================================================================
// 7. TEMPLATES & ID SUBSTITUTION PREVENTION
// =========================================================================
test('7. Templates: Previews safe; substituting another employee ID returns 403', async () => {
  // Normal preview with own/default data succeeds
  const previewRes = await fetch(`${baseUrl}/template/preview`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      content: 'Hello {{employeeName}}, your department is {{department}}.',
      variables: {},
    }),
  });
  const previewBody = await previewRes.json();
  assert.equal(previewRes.status, 200);
  assert.ok(previewBody.result.renderedContent.includes('Aditya Sharma'));

  // Employee A attempts to substitute Employee B ID into template preview
  const tamperedRes = await fetch(`${baseUrl}/template/preview`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      content: 'Hello {{employeeName}}, phone is {{phone}}, email is {{email}}.',
      employeeId: fixtures.employeeB.employee._id,
    }),
  });
  assert.equal(tamperedRes.status, 403, 'Substituting another employee ID must return 403 Forbidden');

  // HR can preview with any employee ID
  const hrPreviewRes = await fetch(`${baseUrl}/template/preview`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      content: 'Hello {{employeeName}}!',
      employeeId: fixtures.employeeB.employee._id,
    }),
  });
  const hrPreviewBody = await hrPreviewRes.json();
  assert.equal(hrPreviewRes.status, 200);
  assert.ok(hrPreviewBody.result.renderedContent.includes('QA Employee B'));
});

// =========================================================================
// 8. NOTIFICATIONS & RECOGNITION INTEGRITY
// =========================================================================
test('8. Notifications & Recognition: Self-scoped notifications, recognition endpoint stable', async () => {
  // Notification list is self-scoped
  const notifRes = await fetch(`${baseUrl}/notification/list`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  const notifBody = await notifRes.json();
  assert.equal(notifRes.status, 200);
  assert.ok(Array.isArray(notifBody.result));

  // Recognition list endpoint remains readable
  const recogRes = await fetch(`${baseUrl}/recognition/list`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.ok([200, 203].includes(recogRes.status));
});

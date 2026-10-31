const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const qa = require('./qa-env');
const { seedFixtures, cleanupFixtures, emailFor } = require('./fixtures');
const { createApiClient } = require('./api-client');
const {
  getCompanyDateInfo,
} = require('../src/controllers/appControllers/employeeController/availabilityHelper');

let server;
let fixtures;
let baseUrl;
let adminClient;
let hrClient;
let employeeClient;

test.before(async () => {
  fixtures = await seedFixtures();
  require('../src/models/loadAllModels');

  const app = require('../src/app');
  server = await new Promise((resolve) => {
    const instance = app.listen(qa.PORT, qa.HOST, () => resolve(instance));
  });
  baseUrl = `http://${qa.HOST}:${server.address().port}/api`;

  adminClient = createApiClient(baseUrl);
  await adminClient.login(emailFor('admin'), qa.PASSWORD);

  hrClient = createApiClient(baseUrl);
  await hrClient.login(emailFor('hr'), qa.PASSWORD);

  employeeClient = createApiClient(baseUrl);
  await employeeClient.login(emailFor('employee'), qa.PASSWORD);
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  const Attendance = mongoose.model('Attendance');
  const Leave = mongoose.model('Leave');
  const Event = mongoose.model('Event');

  const empIds = [
    fixtures.employee?.employee?._id,
    fixtures.employeeB?.employee?._id,
    fixtures.employeeSales?.employee?._id,
    fixtures.employeeFinance?.employee?._id,
  ].filter(Boolean);

  await Attendance.deleteMany({ employee: { $in: empIds } });
  await Leave.deleteMany({ employee: { $in: empIds } });
  await Event.deleteMany({ title: /QA_AVAILABILITY/i });

  await cleanupFixtures(fixtures);
});

test('Scenario 1: Employee checked in today -> Status is Present (Green)', async () => {
  const Attendance = mongoose.model('Attendance');
  const empA = fixtures.employee.employee;
  const { dateString, startOfDay } = getCompanyDateInfo(new Date());

  await Attendance.deleteMany({ employee: empA._id, dateString });
  await Attendance.create({
    employee: empA._id,
    date: startOfDay,
    dateString,
    loginTime: new Date(),
    status: 'Present',
    workMode: 'Office',
  });

  const res = await adminClient.request(`/employee/availability?ids=${empA._id}`);
  assert.equal(res.status, 200);
  const data = await res.json();
  const avail = data.result[empA._id.toString()];

  assert.ok(avail, 'Availability must exist for employee');
  assert.equal(avail.status, 'present');
  assert.equal(avail.dotColor, 'green');
  assert.equal(avail.conflict, false);
  assert.ok(avail.label.includes('Present'));
});

test('Scenario 2: Employee has approved leave today -> Status is On Leave (Red)', async () => {
  const Leave = mongoose.model('Leave');
  const Attendance = mongoose.model('Attendance');
  const empB = fixtures.employeeB.employee;
  const { dateString, startOfDay, endOfDay } = getCompanyDateInfo(new Date());

  await Attendance.deleteMany({ employee: empB._id, dateString });
  await Leave.deleteMany({ employee: empB._id });

  await Leave.create({
    employee: empB._id,
    leaveType: 'Casual Leave',
    fromDate: startOfDay,
    toDate: endOfDay,
    daysCount: 1,
    reason: 'Personal QA testing',
    status: 'Approved',
  });

  const res = await adminClient.request(`/employee/availability?ids=${empB._id}`);
  assert.equal(res.status, 200);
  const data = await res.json();
  const avail = data.result[empB._id.toString()];

  assert.ok(avail);
  assert.equal(avail.status, 'on_leave');
  assert.equal(avail.dotColor, 'red');
  assert.equal(avail.label, 'On Leave');
});

test('Scenario 3: Employee has pending leave -> Not automatically Red', async () => {
  const Leave = mongoose.model('Leave');
  const Attendance = mongoose.model('Attendance');
  const empSales = fixtures.employeeSales.employee;
  const { dateString, startOfDay, endOfDay } = getCompanyDateInfo(new Date());

  await Attendance.deleteMany({ employee: empSales._id, dateString });
  await Leave.deleteMany({ employee: empSales._id });

  await Leave.create({
    employee: empSales._id,
    leaveType: 'Sick Leave',
    fromDate: startOfDay,
    toDate: endOfDay,
    daysCount: 1,
    reason: 'Pending leave test',
    status: 'Pending Manager Approval',
  });

  const res = await adminClient.request(`/employee/availability?ids=${empSales._id}`);
  const data = await res.json();
  const avail = data.result[empSales._id.toString()];

  assert.ok(avail);
  assert.notEqual(avail.status, 'on_leave');
  assert.notEqual(avail.dotColor, 'red');
});

test('Scenario 4: Employee has rejected leave -> Not Red', async () => {
  const Leave = mongoose.model('Leave');
  const Attendance = mongoose.model('Attendance');
  const empFin = fixtures.employeeFinance.employee;
  const { dateString, startOfDay, endOfDay } = getCompanyDateInfo(new Date());

  await Attendance.deleteMany({ employee: empFin._id, dateString });
  await Leave.deleteMany({ employee: empFin._id });

  await Leave.create({
    employee: empFin._id,
    leaveType: 'Earned/Privilege Leave',
    fromDate: startOfDay,
    toDate: endOfDay,
    daysCount: 1,
    reason: 'Rejected leave test',
    status: 'Rejected',
  });

  const res = await adminClient.request(`/employee/availability?ids=${empFin._id}`);
  const data = await res.json();
  const avail = data.result[empFin._id.toString()];

  assert.ok(avail);
  assert.notEqual(avail.status, 'on_leave');
  assert.notEqual(avail.dotColor, 'red');
});

test('Scenario 5: Employee has no attendance and no leave -> Grey (Not Checked In / Weekend / Holiday)', async () => {
  const Attendance = mongoose.model('Attendance');
  const Leave = mongoose.model('Leave');
  const empFin = fixtures.employeeFinance.employee;
  const { dateString, isWeekend } = getCompanyDateInfo(new Date());

  await Attendance.deleteMany({ employee: empFin._id, dateString });
  await Leave.deleteMany({ employee: empFin._id });

  const res = await adminClient.request(`/employee/availability?ids=${empFin._id}`);
  const data = await res.json();
  const avail = data.result[empFin._id.toString()];

  assert.ok(avail);
  assert.equal(avail.dotColor, 'grey');
  if (isWeekend) {
    assert.equal(avail.status, 'weekend');
    assert.equal(avail.label, 'Weekend');
  } else {
    assert.equal(avail.status, 'not_checked_in');
    assert.equal(avail.label, 'Not Checked In');
  }
});

test('Scenario 6: Employee checks in after initial load -> Status updates to Green', async () => {
  const Attendance = mongoose.model('Attendance');
  const Leave = mongoose.model('Leave');
  const empSales = fixtures.employeeSales.employee;
  const { dateString, startOfDay } = getCompanyDateInfo(new Date());

  await Attendance.deleteMany({ employee: empSales._id, dateString });
  await Leave.deleteMany({ employee: empSales._id });

  // Initial: Grey
  const before = await adminClient.request(`/employee/availability?ids=${empSales._id}`);
  const beforeData = await before.json();
  assert.equal(beforeData.result[empSales._id.toString()].dotColor, 'grey');

  // Check-in occurs
  await Attendance.create({
    employee: empSales._id,
    date: startOfDay,
    dateString,
    loginTime: new Date(),
    status: 'Present',
    workMode: 'Work From Home',
  });

  // Re-fetch availability
  const after = await adminClient.request(`/employee/availability?ids=${empSales._id}`);
  const afterData = await after.json();
  const afterAvail = afterData.result[empSales._id.toString()];

  assert.equal(afterAvail.status, 'present');
  assert.equal(afterAvail.dotColor, 'green');
  assert.ok(afterAvail.label.includes('Present (WFH)'));
});

test('Scenario 7: Leave gets approved while dashboard open -> Status updates to Red', async () => {
  const Attendance = mongoose.model('Attendance');
  const Leave = mongoose.model('Leave');
  const empB = fixtures.employeeB.employee;
  const { dateString, startOfDay, endOfDay } = getCompanyDateInfo(new Date());

  await Attendance.deleteMany({ employee: empB._id, dateString });
  await Leave.deleteMany({ employee: empB._id });

  const leaveDoc = await Leave.create({
    employee: empB._id,
    leaveType: 'Casual Leave',
    fromDate: startOfDay,
    toDate: endOfDay,
    daysCount: 1,
    reason: 'Testing approval workflow',
    status: 'Pending HR Approval',
  });

  // Before approval: Not Red
  const before = await adminClient.request(`/employee/availability?ids=${empB._id}`);
  const beforeData = await before.json();
  assert.notEqual(beforeData.result[empB._id.toString()].status, 'on_leave');

  // HR approves the leave
  leaveDoc.status = 'Approved';
  await leaveDoc.save();

  // Re-fetch availability
  const after = await adminClient.request(`/employee/availability?ids=${empB._id}`);
  const afterData = await after.json();
  const afterAvail = afterData.result[empB._id.toString()];

  assert.equal(afterAvail.status, 'on_leave');
  assert.equal(afterAvail.dotColor, 'red');
});

test('Scenario 8: Approved leave is cancelled -> Status recalculates from Red', async () => {
  const Leave = mongoose.model('Leave');
  const Attendance = mongoose.model('Attendance');
  const empB = fixtures.employeeB.employee;
  const { dateString } = getCompanyDateInfo(new Date());

  await Attendance.deleteMany({ employee: empB._id, dateString });
  const activeLeave = await Leave.findOne({ employee: empB._id, status: 'Approved' });
  assert.ok(activeLeave, 'Approved leave must exist from Scenario 7');

  // Cancel leave
  activeLeave.status = 'Cancelled';
  await activeLeave.save();

  const res = await adminClient.request(`/employee/availability?ids=${empB._id}`);
  const data = await res.json();
  const avail = data.result[empB._id.toString()];

  assert.notEqual(avail.status, 'on_leave');
  assert.notEqual(avail.dotColor, 'red');
  assert.equal(avail.dotColor, 'grey');
});

test('Scenario 9: Multi-day approved leave -> Red throughout approved dates', async () => {
  const Leave = mongoose.model('Leave');
  const Attendance = mongoose.model('Attendance');
  const empFin = fixtures.employeeFinance.employee;

  const now = new Date();
  const multiStart = new Date(now);
  multiStart.setDate(multiStart.getDate() - 2);
  const multiEnd = new Date(now);
  multiEnd.setDate(multiEnd.getDate() + 3);

  const { dateString } = getCompanyDateInfo(now);
  await Attendance.deleteMany({ employee: empFin._id, dateString });
  await Leave.deleteMany({ employee: empFin._id });

  await Leave.create({
    employee: empFin._id,
    leaveType: 'Earned/Privilege Leave',
    fromDate: multiStart,
    toDate: multiEnd,
    daysCount: 6,
    reason: 'Multi-day vacation',
    status: 'Approved',
  });

  const res = await adminClient.request(`/employee/availability?ids=${empFin._id}`);
  const data = await res.json();
  const avail = data.result[empFin._id.toString()];

  assert.equal(avail.status, 'on_leave');
  assert.equal(avail.dotColor, 'red');
  assert.equal(avail.label, 'On Leave');
});

test('Scenario 10: Half-day leave handling (without check-in -> Amber Half Day Leave; with check-in -> Amber Half Day Checked In)', async () => {
  const Leave = mongoose.model('Leave');
  const Attendance = mongoose.model('Attendance');
  const empSales = fixtures.employeeSales.employee;
  const { dateString, startOfDay, endOfDay } = getCompanyDateInfo(new Date());

  await Attendance.deleteMany({ employee: empSales._id, dateString });
  await Leave.deleteMany({ employee: empSales._id });

  await Leave.create({
    employee: empSales._id,
    leaveType: 'Half Day',
    fromDate: startOfDay,
    toDate: endOfDay,
    daysCount: 0.5,
    reason: 'Doctor appointment morning',
    status: 'Approved',
  });

  // A. Without attendance -> partial_day Amber
  const res1 = await adminClient.request(`/employee/availability?ids=${empSales._id}`);
  const data1 = await res1.json();
  const avail1 = data1.result[empSales._id.toString()];

  assert.equal(avail1.status, 'partial_day');
  assert.equal(avail1.dotColor, 'amber');
  assert.equal(avail1.label, 'Half Day Leave');

  // B. With attendance -> partial_day Amber (Checked In)
  await Attendance.create({
    employee: empSales._id,
    date: startOfDay,
    dateString,
    loginTime: new Date(),
    status: 'Half Day',
    workMode: 'Office',
  });

  const res2 = await adminClient.request(`/employee/availability?ids=${empSales._id}`);
  const data2 = await res2.json();
  const avail2 = data2.result[empSales._id.toString()];

  assert.equal(avail2.status, 'partial_day');
  assert.equal(avail2.dotColor, 'amber');
  assert.equal(avail2.label, 'Half Day (Checked In)');
});

test('Scenario 11: Company Holiday handling (No silent green classification)', async () => {
  const Event = mongoose.model('Event');
  const Attendance = mongoose.model('Attendance');
  const Leave = mongoose.model('Leave');
  const empB = fixtures.employeeB.employee;
  const { dateString, startOfDay, endOfDay } = getCompanyDateInfo(new Date());

  await Attendance.deleteMany({ employee: empB._id, dateString });
  await Leave.deleteMany({ employee: empB._id });

  const holiday = await Event.create({
    title: 'QA_AVAILABILITY_NATIONAL_HOLIDAY',
    eventName: 'QA Independence Celebration',
    eventType: 'Holiday',
    startDate: startOfDay,
    endDate: endOfDay,
  });

  const res = await adminClient.request(`/employee/availability?ids=${empB._id}`);
  const data = await res.json();
  const avail = data.result[empB._id.toString()];

  assert.equal(avail.status, 'holiday');
  assert.equal(avail.dotColor, 'grey');
  assert.ok(avail.label.includes('Holiday'));

  await Event.deleteOne({ _id: holiday._id });
});

test('Scenario 12: RBAC Security - Employees cannot query other employee records or receive private details', async () => {
  const empA = fixtures.employee.employee;
  const empB = fixtures.employeeB.employee;

  // Employee queries /employee/availability
  const res = await employeeClient.request(`/employee/availability?ids=${empB._id}`);
  assert.equal(res.status, 200);
  const data = await res.json();

  // Must only contain calling employee profile, NOT empB
  assert.equal(data.result[empB._id.toString()], undefined, 'Employee cannot access another employee availability');
  assert.ok(data.result[empA._id.toString()], 'Employee can see their own availability');

  // Ensure zero confidential leave reasons or notes are exposed
  const ownAvail = data.result[empA._id.toString()];
  assert.equal(ownAvail.reason, undefined);
  assert.equal(ownAvail.rejectionReason, undefined);
  assert.equal(ownAvail.supportingDocument, undefined);
});

test('Scenario 13: Existing employee list and pagination endpoints remain unaffected', async () => {
  const res = await adminClient.request('/employee/list?page=1&items=5');
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.result));
  assert.ok(body.pagination);
  assert.equal(body.pagination.page, 1);
  assert.ok(body.pagination.count >= 1);

  // Verify availability is attached to each employee record in the list
  const first = body.result[0];
  assert.ok(first.availability, 'Availability must be attached to employee record');
  assert.ok(first.availability.status);
  assert.ok(first.availability.dotColor);
  assert.ok(first.availability.label);
});

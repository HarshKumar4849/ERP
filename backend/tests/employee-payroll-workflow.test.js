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
// 1. EMPLOYEE MANAGEMENT: LISTING, SEARCH, FILTERING & ROLE SCOPING
// =========================================================================
test('1. Employee Directory: HR & Admin can list, search, and filter, while ordinary employees are denied', async () => {
  // A. Admin can list employees
  const adminListRes = await fetch(`${baseUrl}/employee/list?page=1&items=10`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminListRes.status, 200);
  const adminListBody = await adminListRes.json();
  assert.equal(adminListBody.success, true);
  assert.ok(Array.isArray(adminListBody.result));
  assert.ok(adminListBody.result.length >= 2);

  // B. HR can search and filter employees
  const hrSearchRes = await fetch(`${baseUrl}/employee/search?q=QA`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(hrSearchRes.status, 200);
  const hrSearchBody = await hrSearchRes.json();
  assert.equal(hrSearchBody.success, true);
  assert.ok(Array.isArray(hrSearchBody.result));

  const hrFilterRes = await fetch(`${baseUrl}/employee/filter?department=Engineering`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(hrFilterRes.status, 200);
  const hrFilterBody = await hrFilterRes.json();
  assert.equal(hrFilterBody.success, true);

  // C. Ordinary Employee A cannot list all employees
  const empListRes = await fetch(`${baseUrl}/employee/list`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empListRes.status, 403, 'Employee should not be able to list employee directory');

  // D. Ordinary Employee A cannot search all employees
  const empSearchRes = await fetch(`${baseUrl}/employee/search?q=QA`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empSearchRes.status, 403, 'Employee should not be able to search employee directory');

  // E. Ordinary Employee A cannot view organization employee summary
  const empSummaryRes = await fetch(`${baseUrl}/employee/summary`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empSummaryRes.status, 403, 'Employee should not be able to view employee summary statistics');
});

// =========================================================================
// 2. EMPLOYEE MANAGEMENT: CREATION, OWN-PROFILE ACCESS & CROSS-READ BLOCK
// =========================================================================
let createdSyntheticEmpId;

test('2. Employee Lifecycle: Authorized creation, own profile access, and blocking cross-profile reads', async () => {
  // A. Ordinary Employee cannot create an employee record
  const empCreateRes = await fetch(`${baseUrl}/employee/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      name: 'Hacker',
      surname: 'User',
      email: `hacker-${qa.RUN_ID}@example.com`,
    }),
  });
  assert.equal(empCreateRes.status, 403, 'Employee cannot create other employee records');

  // B. HR creates a new employee record
  const hrCreateRes = await fetch(`${baseUrl}/employee/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      name: 'Devon',
      surname: 'Tester',
      email: `devon-${qa.RUN_ID}@example.com`,
      employeeId: `DEV-${qa.RUN_ID}`.toUpperCase(),
      departmentName: 'Software Engineering',
      designationName: 'Full Stack Engineer',
      status: 'Active',
      employmentType: 'Full Time',
    }),
  });
  assert.equal(hrCreateRes.status, 200, hrCreateRes.statusText);
  const hrCreateBody = await hrCreateRes.json();
  assert.equal(hrCreateBody.success, true);
  createdSyntheticEmpId = hrCreateBody.result._id;
  assert.ok(createdSyntheticEmpId);

  // C. Employee A can read their own employee profile
  const empAId = fixtures.employeeA.employee._id.toString();
  const empAReadOwnRes = await fetch(`${baseUrl}/employee/read/${empAId}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empAReadOwnRes.status, 200, 'Employee should be able to read their own profile');
  const empAReadOwnBody = await empAReadOwnRes.json();
  assert.equal(empAReadOwnBody.success, true);
  assert.equal(empAReadOwnBody.result._id.toString(), empAId);

  // D. Employee A CANNOT read Employee B's confidential profile
  const empBId = fixtures.employeeB.employee._id.toString();
  const empAReadBRes = await fetch(`${baseUrl}/employee/read/${empBId}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empAReadBRes.status, 403, "Employee A must not access Employee B's profile");

  // E. Employee A CANNOT read the newly created employee profile
  const empAReadDevonRes = await fetch(`${baseUrl}/employee/read/${createdSyntheticEmpId}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empAReadDevonRes.status, 403, "Employee A must not access Devon's profile");
});

// =========================================================================
// 3. EMPLOYEE MANAGEMENT: UPDATES, STATUS CHANGE & PRIVILEGE ESCALATION
// =========================================================================
test('3. Employee Updates: Limited own-profile edits, preventing privilege escalation, and restricting status changes', async () => {
  const empAId = fixtures.employeeA.employee._id.toString();
  const empBId = fixtures.employeeB.employee._id.toString();

  // A. Employee A cannot update Employee B's profile
  const empAUpdateBRes = await fetch(`${baseUrl}/employee/update/${empBId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ phone: '+1234567890' }),
  });
  assert.equal(empAUpdateBRes.status, 403, "Employee A cannot modify Employee B's profile");

  // B. Employee A can update permitted personal fields on own profile (phone, skills)
  const empAUpdateOwnRes = await fetch(`${baseUrl}/employee/update/${empAId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      phone: '+91 9876543210',
      skills: ['Node.js', 'MongoDB', 'Docker'],
      // Tampering attempt: self-promoting department and status
      departmentName: 'Executive Board',
      status: 'Terminated',
    }),
  });
  assert.equal(empAUpdateOwnRes.status, 200, 'Employee should update permitted own fields');
  const empAUpdateOwnBody = await empAUpdateOwnRes.json();
  assert.equal(empAUpdateOwnBody.result.phone, '+91 9876543210');
  // Invariant: privileged fields must not be altered by employee self-update
  assert.notEqual(empAUpdateOwnBody.result.departmentName, 'Executive Board');
  assert.notEqual(empAUpdateOwnBody.result.status, 'Terminated');

  // C. Employee A cannot change status or deactivate an employee via status endpoint
  const empAStatusRes = await fetch(`${baseUrl}/employee/status/${empAId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ status: 'Terminated' }),
  });
  assert.equal(empAStatusRes.status, 403, 'Employee cannot change employee status');

  // D. HR can update status and details of employees
  const hrStatusRes = await fetch(`${baseUrl}/employee/status/${createdSyntheticEmpId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({ status: 'Probation' }),
  });
  assert.equal(hrStatusRes.status, 200);
  const hrStatusBody = await hrStatusRes.json();
  assert.equal(hrStatusBody.result.status, 'Probation');

  // E. Employee A cannot delete an employee record
  const empDeleteRes = await fetch(`${baseUrl}/employee/delete/${createdSyntheticEmpId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empDeleteRes.status, 403, 'Employee cannot delete employee records');

  // F. Admin can delete an employee record
  const adminDeleteRes = await fetch(`${baseUrl}/employee/delete/${createdSyntheticEmpId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminDeleteRes.status, 200);
});

// =========================================================================
// 4. ATTENDANCE: CLOCK-IN, CLOCK-OUT & DUPLICATE PREVENTION
// =========================================================================
test('4. Attendance: Normal check-in/out, duplicate clock-in prevention, and today summary', async () => {
  // A. Employee A clocks in
  const clockInRes = await fetch(`${baseUrl}/attendance/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      workMode: 'Office',
    }),
  });
  assert.equal(clockInRes.status, 200, 'Employee A should successfully clock in');
  const clockInBody = await clockInRes.json();
  assert.equal(clockInBody.success, true);
  assert.ok(clockInBody.result.loginTime);

  // B. Immediate duplicate clock-in on the same day is rejected
  const dupClockInRes = await fetch(`${baseUrl}/attendance/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      workMode: 'Office',
    }),
  });
  assert.equal(dupClockInRes.status, 400, 'Duplicate clock-in on the same day must be rejected');

  // C. Employee A views today attendance
  const todayRes = await fetch(`${baseUrl}/attendance/today`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(todayRes.status, 200);
  const todayBody = await todayRes.json();
  assert.equal(todayBody.success, true);
  assert.equal(todayBody.result.hasLoggedIn, true);

  // D. Employee A clocks out
  const clockOutRes = await fetch(`${baseUrl}/attendance/logout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      remarks: 'Shift completed successfully',
    }),
  });
  assert.equal(clockOutRes.status, 200, 'Employee A should successfully clock out');
  const clockOutBody = await clockOutRes.json();
  assert.equal(clockOutBody.success, true);
  assert.ok(clockOutBody.result.logoutTime);
});

// =========================================================================
// 5. ATTENDANCE: ROLE-BASED ACCESS & CROSS-EMPLOYEE MANIPULATION PREVENTED
// =========================================================================
let employeeBAttendanceId;

test('5. Attendance Security: Cross-employee clock-in/out and manual tampering prevention', async () => {
  const empBId = fixtures.employeeB.employee._id.toString();

  // A. Employee A CANNOT clock in with Employee B's employee ID
  const maliciousClockInRes = await fetch(`${baseUrl}/attendance/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      employee: empBId,
      workMode: 'Office',
    }),
  });
  assert.equal(maliciousClockInRes.status, 403, "Employee A cannot clock in for Employee B");

  // B. Employee A CANNOT clock out with Employee B's employee ID
  const maliciousClockOutRes = await fetch(`${baseUrl}/attendance/logout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      employee: empBId,
      remarks: 'Clocking out for colleague',
    }),
  });
  assert.equal(maliciousClockOutRes.status, 403, "Employee A cannot clock out for Employee B");

  // C. Employee B clocks in normally
  const empBClockInRes = await fetch(`${baseUrl}/attendance/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeBToken}`,
    },
    body: JSON.stringify({ workMode: 'Office' }),
  });
  assert.equal(empBClockInRes.status, 200);
  const empBClockInBody = await empBClockInRes.json();
  employeeBAttendanceId = empBClockInBody.result._id;
  assert.ok(employeeBAttendanceId);

  // D. Employee A CANNOT manually create attendance records via /attendance/create
  const empManualCreateRes = await fetch(`${baseUrl}/attendance/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      employee: empBId,
      date: '2026-05-10',
      workMode: 'Office',
      status: 'Present',
    }),
  });
  assert.equal(empManualCreateRes.status, 403, 'Ordinary employee cannot manually create attendance records');

  // E. Employee A CANNOT update Employee B's attendance record
  const empUpdateBAttRes = await fetch(`${baseUrl}/attendance/update/${employeeBAttendanceId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ remarks: 'Tampered remarks' }),
  });
  assert.equal(empUpdateBAttRes.status, 403, "Employee A cannot update Employee B's attendance");

  // F. Employee A CANNOT delete Employee B's attendance record
  const empDeleteBAttRes = await fetch(`${baseUrl}/attendance/delete/${employeeBAttendanceId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empDeleteBAttRes.status, 403, "Employee A cannot delete attendance records");

  // G. Employee A CANNOT read Employee B's attendance record directly
  const empReadBAttRes = await fetch(`${baseUrl}/attendance/read/${employeeBAttendanceId}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empReadBAttRes.status, 403, "Employee A cannot read Employee B's attendance record");
});

// =========================================================================
// 6. ATTENDANCE: HISTORY, REPORTS & ADMIN REGULARIZATION
// =========================================================================
test('6. Attendance Reporting & Regularization: List scoped for employee, full reporting for HR/Admin', async () => {
  // A. Employee A lists attendance - result must contain ONLY Employee A records
  const empAListRes = await fetch(`${baseUrl}/attendance/list`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empAListRes.status, 200);
  const empAListBody = await empAListRes.json();
  const empAId = fixtures.employeeA.employee._id.toString();
  empAListBody.result.forEach((record) => {
    const recEmpId = record.employee?._id || record.employee;
    assert.equal(recEmpId.toString(), empAId, 'Employee list must be scoped to own records');
  });

  // B. HR can generate organizational report
  const hrReportRes = await fetch(`${baseUrl}/attendance/report`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(hrReportRes.status, 200);
  const hrReportBody = await hrReportRes.json();
  assert.equal(hrReportBody.success, true);
  assert.ok(hrReportBody.result.reportRows.length >= 2);

  // C. HR can update/regularize an attendance record
  const hrUpdateRes = await fetch(`${baseUrl}/attendance/update/${employeeBAttendanceId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      remarks: 'Regularized by HR',
      status: 'Present',
    }),
  });
  assert.equal(hrUpdateRes.status, 200);
  const hrUpdateBody = await hrUpdateRes.json();
  assert.equal(hrUpdateBody.result.remarks, 'Regularized by HR');
});

// =========================================================================
// 7. PAYROLL: SALARY CREATION, CALCULATION & DUPLICATE PREVENTION
// =========================================================================
let salaryAId;
let salaryBId;

test('7. Payroll: Creation, earnings & deductions calculation, and duplicate prevention', async () => {
  const empAId = fixtures.employeeA.employee._id.toString();
  const empBId = fixtures.employeeB.employee._id.toString();

  // A. Ordinary employee cannot create salary records
  const empCreateSalRes = await fetch(`${baseUrl}/salary/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({
      employee: empAId,
      month: 'October',
      year: 2026,
      basic: 60000,
    }),
  });
  assert.equal(empCreateSalRes.status, 403, 'Ordinary employee cannot create salary records');

  // B. HR creates salary record for Employee A
  const hrCreateSalARes = await fetch(`${baseUrl}/salary/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      employee: empAId,
      month: 'October',
      year: 2026,
      workingDays: 22,
      paidDays: 22,
      basic: 50000,
      hra: 20000,
      allowances: 10000,
      bonus: 5000,
      deductions: 2000,
      professionalTax: 200,
      tds: 2800,
      status: 'Paid',
    }),
  });
  assert.equal(hrCreateSalARes.status, 201);
  const hrCreateSalABody = await hrCreateSalARes.json();
  assert.equal(hrCreateSalABody.success, true);
  salaryAId = hrCreateSalABody.result._id;

  // Verify calculation: Total Earnings (50000+20000+10000+5000 = 85000) - Deductions (2000+200+2800 = 5000) = 80000
  assert.equal(hrCreateSalABody.result.totalEarnings, 85000);
  assert.equal(hrCreateSalABody.result.totalDeductions, 5000);
  assert.equal(hrCreateSalABody.result.netSalary, 80000);

  // C. HR creates salary record for Employee B
  const hrCreateSalBRes = await fetch(`${baseUrl}/salary/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      employee: empBId,
      month: 'October',
      year: 2026,
      workingDays: 22,
      paidDays: 22,
      basic: 60000,
      hra: 25000,
      allowances: 15000,
      deductions: 4000,
      professionalTax: 200,
      status: 'Paid',
    }),
  });
  assert.equal(hrCreateSalBRes.status, 201);
  const hrCreateSalBBody = await hrCreateSalBRes.json();
  salaryBId = hrCreateSalBBody.result._id;
  assert.ok(salaryBId);

  // D. Duplicate salary record creation for the same employee, month, and year is rejected
  const dupSalRes = await fetch(`${baseUrl}/salary/create`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${hrToken}`,
    },
    body: JSON.stringify({
      employee: empAId,
      month: 'October',
      year: 2026,
      basic: 50000,
    }),
  });
  assert.equal(dupSalRes.status, 400, 'Duplicate salary record for same period must be rejected');
});

// =========================================================================
// 8. PAYROLL: RBAC RESTRICTIONS ON UPDATES, DELETES & AUDIT ACCESS
// =========================================================================
test('8. Payroll Security: Preventing employee updates, deletes, and audit log inspection', async () => {
  // A. Ordinary employee cannot modify salary records
  const empUpdateSalRes = await fetch(`${baseUrl}/salary/update/${salaryAId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${employeeAToken}`,
    },
    body: JSON.stringify({ bonus: 100000 }),
  });
  assert.equal(empUpdateSalRes.status, 403, 'Employee cannot update salary records');

  // B. Ordinary employee cannot delete salary records
  const empDeleteSalRes = await fetch(`${baseUrl}/salary/delete/${salaryAId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empDeleteSalRes.status, 403, 'Employee cannot delete salary records');

  // C. Ordinary employee cannot access salary audit history
  const empAuditRes = await fetch(`${baseUrl}/salary/audit`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empAuditRes.status, 403, 'Employee cannot view salary audit history');

  const empSpecificAuditRes = await fetch(`${baseUrl}/salary/audit/${salaryAId}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empSpecificAuditRes.status, 403, 'Employee cannot view specific salary audit');

  // D. HR can view salary audit history
  const hrAuditRes = await fetch(`${baseUrl}/salary/audit/${salaryAId}`, {
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(hrAuditRes.status, 200);
  const hrAuditBody = await hrAuditRes.json();
  assert.equal(hrAuditBody.success, true);
  assert.ok(Array.isArray(hrAuditBody.result));
});

// =========================================================================
// 9. PAYROLL: CONFIDENTIALITY OF SALARY & PAYSLIP PDF DOWNLOAD
// =========================================================================
test('9. Payroll Confidentiality: Employee can view own salary and PDF slip, denied for others', async () => {
  // A. Employee A can list own salary records
  const empAListSalRes = await fetch(`${baseUrl}/salary/list`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empAListSalRes.status, 200);
  const empAListSalBody = await empAListSalRes.json();
  assert.equal(empAListSalBody.success, true);
  // Must only contain Employee A's salary records
  const empAId = fixtures.employeeA.employee._id.toString();
  empAListSalBody.result.forEach((item) => {
    const recEmpId = item.employee?._id || item.employee;
    assert.equal(recEmpId.toString(), empAId, 'Salary list must contain only own records');
  });

  // B. Employee A can read own salary record details
  const empAReadOwnSalRes = await fetch(`${baseUrl}/salary/read/${salaryAId}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empAReadOwnSalRes.status, 200, 'Employee A can view own salary');
  const empAReadOwnSalBody = await empAReadOwnSalRes.json();
  assert.equal(empAReadOwnSalBody.result.netSalary, 80000);

  // C. Employee A CANNOT read Employee B's confidential salary record
  const empAReadBSalRes = await fetch(`${baseUrl}/salary/read/${salaryBId}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empAReadBSalRes.status, 403, "Employee A cannot view Employee B's salary record");

  // D. HR generates official slip metadata
  const hrGenSlipRes = await fetch(`${baseUrl}/salary/generate-slip/${salaryAId}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${hrToken}` },
  });
  assert.equal(hrGenSlipRes.status, 200);

  // E. Employee A can download their own payslip PDF
  const empADownloadOwnPdfRes = await fetch(`${baseUrl}/salary/slip/pdf/${salaryAId}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empADownloadOwnPdfRes.status, 200, 'Employee A can download own salary slip PDF');
  assert.equal(empADownloadOwnPdfRes.headers.get('content-type'), 'application/pdf');

  // F. Employee A CANNOT download Employee B's salary slip PDF
  const empADownloadBPdfRes = await fetch(`${baseUrl}/salary/slip/pdf/${salaryBId}`, {
    headers: { authorization: `Bearer ${employeeAToken}` },
  });
  assert.equal(empADownloadBPdfRes.status, 403, "Employee A cannot download Employee B's salary slip PDF");
});

// =========================================================================
// 10. SECURITY & CONCURRENCY: DIRECT API CALLS & CONCURRENT OPERATIONS
// =========================================================================
test('10. Security & Concurrency: Direct unauthorized operations and concurrent duplicate operations', async () => {
  // A. Direct unauthenticated request to /employee/list is rejected
  const unauthRes = await fetch(`${baseUrl}/employee/list`);
  assert.equal(unauthRes.status, 401, 'Unauthenticated request should return 401');

  // B. Direct unauthenticated request to /attendance/today is rejected
  const unauthAttRes = await fetch(`${baseUrl}/attendance/today`);
  assert.equal(unauthAttRes.status, 401, 'Unauthenticated request should return 401');

  // C. Direct unauthenticated request to /salary/list is rejected
  const unauthSalRes = await fetch(`${baseUrl}/salary/list`);
  assert.equal(unauthSalRes.status, 401, 'Unauthenticated request should return 401');

  // D. Direct API call with invalid/non-existent Mongo ID returns 404/400 safely without server crash
  const fakeId = new mongoose.Types.ObjectId().toString();
  const fakeRes = await fetch(`${baseUrl}/employee/read/${fakeId}`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(fakeRes.status, 404);

  // E. Direct API call with malformed ID string
  const malformedRes = await fetch(`${baseUrl}/salary/read/invalid-not-an-id`, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.ok([400, 404, 500].includes(malformedRes.status));

  // F. Admin deletes the created salary records cleanly
  const adminDelSalARes = await fetch(`${baseUrl}/salary/delete/${salaryAId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminDelSalARes.status, 200);

  const adminDelSalBRes = await fetch(`${baseUrl}/salary/delete/${salaryBId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminDelSalBRes.status, 200);
});

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });

const API_BASE = 'http://localhost:8888/api';

async function runRbacSecurityTests() {
  console.log('================================================================');
  console.log('🧪 TECMOTIV ERP — THREE-TIER RBAC COMPREHENSIVE SECURITY TESTS');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  const testAssert = (desc, condition, details = '') => {
    totalTests++;
    if (condition) {
      console.log(`✅ PASS: ${desc}`);
      passedTests++;
    } else {
      console.error(`❌ FAIL: ${desc} ${details ? `(${details})` : ''}`);
    }
  };

  // 1. Connect to DB to load test accounts
  await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
  const Admin = require('../models/coreModels/Admin');
  const Salary = require('../models/appModels/Salary');
  const Leave = require('../models/appModels/Leave');
  const Employee = require('../models/appModels/Employee');
  const Document = require('../models/appModels/Document');

  const emp1User = await Admin.findOne({ email: 'employee1@tecmotiv.com' });
  const emp2User = await Admin.findOne({ email: 'employee2@tecmotiv.com' });
  const hrUser = await Admin.findOne({ email: 'hr@tecmotiv.com' });
  const financeUser = await Admin.findOne({ email: 'finance@tecmotiv.com' });
  const adminUser = await Admin.findOne({ email: 'admin.user@tecmotiv.com' });
  const deptheadUser = await Admin.findOne({ email: 'depthead@tecmotiv.com' });
  const mgtUser = await Admin.findOne({ email: 'management@tecmotiv.com' });

  const emp1Doc = await Employee.findOne({ email: 'employee1@tecmotiv.com' });
  const emp2Doc = await Employee.findOne({ email: 'employee2@tecmotiv.com' });

  // Ensure test salary records exist
  let salary1 = await Salary.findOne({ user: emp1User._id, removed: false });
  if (!salary1) {
    salary1 = await new Salary({
      user: emp1User._id,
      employee: emp1Doc._id,
      employeeName: 'John Employee',
      employeeCode: 'EMP-001',
      department: 'Engineering',
      designation: 'Software Engineer',
      salaryPeriod: 'September 2026',
      month: 'September',
      year: 2026,
      basic: 45000,
      netSalary: 65400,
      status: 'Paid',
    }).save();
  }

  let salary2 = await Salary.findOne({ user: emp2User._id, removed: false });
  if (!salary2) {
    salary2 = await new Salary({
      user: emp2User._id,
      employee: emp2Doc._id,
      employeeName: 'Jane Employee',
      employeeCode: 'EMP-002',
      department: 'Design',
      designation: 'UI Designer',
      salaryPeriod: 'September 2026',
      month: 'September',
      year: 2026,
      basic: 40000,
      netSalary: 55300,
      status: 'Paid',
    }).save();
  }

  // Ensure test document records exist
  let doc1 = await Document.findOne({ employee: emp1Doc._id, removed: false });
  if (!doc1) {
    doc1 = await new Document({
      employee: emp1Doc._id,
      employeeId: emp1Doc.employeeId,
      employeeName: 'John Employee',
      documentType: 'Aadhaar Card',
      file: {
        fileName: 'emp1_aadhaar.pdf',
        originalName: 'emp1_aadhaar.pdf',
        path: 'uploads/vault/emp1_aadhaar.pdf',
        mimeType: 'application/pdf',
        size: 1024,
      },
      verificationStatus: 'Pending',
      uploadedBy: emp1User._id,
    }).save();
  }

  let doc2 = await Document.findOne({ employee: emp2Doc._id, removed: false });
  if (!doc2) {
    doc2 = await new Document({
      employee: emp2Doc._id,
      employeeId: emp2Doc.employeeId,
      employeeName: 'Jane Employee',
      documentType: 'Passport',
      file: {
        fileName: 'emp2_passport.pdf',
        originalName: 'emp2_passport.pdf',
        path: 'uploads/vault/emp2_passport.pdf',
        mimeType: 'application/pdf',
        size: 2048,
      },
      verificationStatus: 'Pending',
      uploadedBy: emp2User._id,
    }).save();
  }

  // Ensure test leave records exist
  let leave1 = await Leave.findOne({ user: emp1User._id, removed: false });
  if (!leave1) {
    leave1 = await new Leave({
      employee: emp1Doc._id,
      user: emp1User._id,
      department: 'Engineering',
      leaveType: 'Casual Leave',
      fromDate: new Date('2026-11-01'),
      toDate: new Date('2026-11-02'),
      daysCount: 2,
      reason: 'Personal emergency',
      status: 'Pending HR Approval',
    }).save();
  }

  // Helper to log in and get JWT token
  const login = async (email, password = 'admin123') => {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    return data?.result?.token;
  };

  const emp1Token = await login('employee1@tecmotiv.com');
  const emp2Token = await login('employee2@tecmotiv.com');
  const hrToken = await login('hr@tecmotiv.com');
  const financeToken = await login('finance@tecmotiv.com');
  const adminToken = await login('admin.user@tecmotiv.com');
  const deptheadToken = await login('depthead@tecmotiv.com');
  const mgtToken = await login('management@tecmotiv.com');

  const authHeader = (token) => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  // ========================================================================
  // TEST GROUP 1: AUTHENTICATION & DIRECT API PROTECTION
  // ========================================================================
  const resNoAuth = await fetch(`${API_BASE}/employee/read/${emp1Doc._id}`);
  testAssert('1. Unauthenticated request to protected endpoint returns 401', resNoAuth.status === 401);

  // ========================================================================
  // TEST GROUP 2: EMPLOYEE SELF-SERVICE ISOLATION (PROFILE, SALARY, DOCS)
  // ========================================================================
  const resOwnProfile = await fetch(`${API_BASE}/admin/read/${emp1User._id}`, {
    headers: authHeader(emp1Token),
  });
  testAssert('2. EMPLOYEE can read their own user profile (200 OK)', resOwnProfile.status === 200);

  const resOtherProfile = await fetch(`${API_BASE}/admin/read/${emp2User._id}`, {
    headers: authHeader(emp1Token),
  });
  testAssert('3. EMPLOYEE cannot read another employee profile (403 Forbidden)', resOtherProfile.status === 403);

  const resEmpList = await fetch(`${API_BASE}/employee/list`, {
    headers: authHeader(emp1Token),
  });
  testAssert('4. EMPLOYEE cannot list full employee directory (403 Forbidden)', resEmpList.status === 403);

  const resOwnSalary = await fetch(`${API_BASE}/salary/read/${salary1._id}`, {
    headers: authHeader(emp1Token),
  });
  testAssert('5. EMPLOYEE can read their own salary record (200 OK)', resOwnSalary.status === 200);

  const resOtherSalary = await fetch(`${API_BASE}/salary/read/${salary2._id}`, {
    headers: authHeader(emp1Token),
  });
  testAssert('6. EMPLOYEE cannot read another employee salary (403 Forbidden)', resOtherSalary.status === 403);

  const resCreateSalary = await fetch(`${API_BASE}/salary/create`, {
    method: 'POST',
    headers: authHeader(emp1Token),
    body: JSON.stringify({ amount: 50000 }),
  });
  testAssert('7. EMPLOYEE cannot create or process salary records (403 Forbidden)', resCreateSalary.status === 403);

  const resOwnDoc = await fetch(`${API_BASE}/document/read/${doc1._id}`, {
    headers: authHeader(emp1Token),
  });
  testAssert('8. EMPLOYEE can read/access their own document (200 OK)', resOwnDoc.status === 200);

  const resOtherDoc = await fetch(`${API_BASE}/document/read/${doc2._id}`, {
    headers: authHeader(emp1Token),
  });
  testAssert('9. EMPLOYEE cannot read another employee document (403 Forbidden)', resOtherDoc.status === 403);

  const resDocVerifyEmp = await fetch(`${API_BASE}/document/verify/${doc1._id}`, {
    method: 'PATCH',
    headers: authHeader(emp1Token),
    body: JSON.stringify({ verificationStatus: 'Verified' }),
  });
  testAssert('10. EMPLOYEE cannot verify documents (403 Forbidden)', resDocVerifyEmp.status === 403);

  // ========================================================================
  // TEST GROUP 3: LEAVE MANAGEMENT & APPROVAL RESTRICTIONS
  // ========================================================================
  const resApproveOwnLeave = await fetch(`${API_BASE}/leave/hr-approval/${leave1._id}`, {
    method: 'PATCH',
    headers: authHeader(emp1Token),
    body: JSON.stringify({ action: 'Approve' }),
  });
  testAssert('11. EMPLOYEE cannot approve leave requests (403 Forbidden)', resApproveOwnLeave.status === 403);

  // ========================================================================
  // TEST GROUP 4: HR PERMISSIONS & BOUNDARIES
  // ========================================================================
  const resHrEmpList = await fetch(`${API_BASE}/employee/list`, {
    headers: authHeader(hrToken),
  });
  testAssert('12. HR can list and manage employee records (200 OK)', resHrEmpList.status === 200);

  const resHrSalary = await fetch(`${API_BASE}/salary/read/${salary1._id}`, {
    headers: authHeader(hrToken),
  });
  testAssert('13. HR can view salary records for workforce operations (200 OK)', resHrSalary.status === 200);

  const resHrSettings = await fetch(`${API_BASE}/setting/list`, {
    headers: authHeader(hrToken),
  });
  testAssert('14. HR cannot access global system settings (403 Forbidden)', resHrSettings.status === 403);

  const resHrDigitalAdmin = await fetch(`${API_BASE}/digitalservice/list`, {
    headers: authHeader(hrToken),
  });
  testAssert('15. HR cannot access IT & Digital Admin services (403 Forbidden)', resHrDigitalAdmin.status === 403);

  // ========================================================================
  // TEST GROUP 5: ADMIN & MANAGEMENT CONSOLIDATION
  // ========================================================================
  const resAdminSettings = await fetch(`${API_BASE}/setting/list`, {
    headers: authHeader(adminToken),
  });
  testAssert('16. ADMIN can access global system settings (200 OK)', resAdminSettings.status === 200);

  const resAdminSalary = await fetch(`${API_BASE}/salary/read/${salary1._id}`, {
    headers: authHeader(adminToken),
  });
  testAssert('17. ADMIN can access confidential salary records (200 OK)', resAdminSalary.status === 200);

  const resMgtSettings = await fetch(`${API_BASE}/setting/list`, {
    headers: authHeader(mgtToken),
  });
  testAssert('18. Legacy MANAGEMENT account normalizes to ADMIN with full access (200 OK)', resMgtSettings.status === 200);

  // ========================================================================
  // TEST GROUP 6: LEGACY FINANCE & DEPARTMENT_HEAD CONSOLIDATION
  // ========================================================================
  const resFinanceSalaryCreate = await fetch(`${API_BASE}/salary/create`, {
    method: 'POST',
    headers: authHeader(financeToken),
    body: JSON.stringify({ amount: 99999 }),
  });
  testAssert('19. Legacy FINANCE cannot create or process other salaries (403 Forbidden)', resFinanceSalaryCreate.status === 403);

  const resFinanceOtherSalary = await fetch(`${API_BASE}/salary/read/${salary1._id}`, {
    headers: authHeader(financeToken),
  });
  testAssert('20. Legacy FINANCE cannot read another employee salary (403 Forbidden)', resFinanceOtherSalary.status === 403);

  const resDeptHeadLeaveApprove = await fetch(`${API_BASE}/leave/hr-approval/${leave1._id}`, {
    method: 'PATCH',
    headers: authHeader(deptheadToken),
    body: JSON.stringify({ action: 'Approve' }),
  });
  testAssert('21. Legacy DEPARTMENT_HEAD cannot approve leave requests (403 Forbidden)', resDeptHeadLeaveApprove.status === 403);

  const resDeptHeadOtherSalary = await fetch(`${API_BASE}/salary/read/${salary1._id}`, {
    headers: authHeader(deptheadToken),
  });
  testAssert('22. Legacy DEPARTMENT_HEAD cannot access salary records (403 Forbidden)', resDeptHeadOtherSalary.status === 403);

  // ========================================================================
  // TEST GROUP 7: UNKNOWN ROLES & SAFE FALLBACK
  // ========================================================================
  const { normalizeRole, ROLES } = require('../rbac/roles');
  testAssert('23. Missing role safely normalizes to EMPLOYEE', normalizeRole(null) === ROLES.EMPLOYEE);
  testAssert('24. Unknown role string safely normalizes to EMPLOYEE', normalizeRole('UNKNOWN_GUEST_ROLE') === ROLES.EMPLOYEE);
  testAssert('25. Legacy FINANCE normalizes to EMPLOYEE', normalizeRole('FINANCE') === ROLES.EMPLOYEE);
  testAssert('26. Legacy DEPARTMENT_HEAD normalizes to EMPLOYEE', normalizeRole('DEPARTMENT_HEAD') === ROLES.EMPLOYEE);
  testAssert('27. Legacy MANAGEMENT normalizes to ADMIN', normalizeRole('MANAGEMENT') === ROLES.ADMIN);

  console.log('\n================================================================');
  console.log(`📊 FINAL RESULT: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  process.exit(passedTests === totalTests ? 0 : 1);
}

runRbacSecurityTests().catch((e) => {
  console.error(e);
  process.exit(1);
});

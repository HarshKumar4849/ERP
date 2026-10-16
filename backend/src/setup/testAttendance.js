require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:8888/api';

async function runAttendanceTests() {
  console.log('====================================================');
  console.log('   PHASE 5 — ATTENDANCE & DAILY LOGIN TEST SUITE     ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const testCase = async (name, fn) => {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Reason: ${err.message}`);
      failed++;
    }
  };

  try {
    const loginUser = async (email, password = 'admin123') => {
      const res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(`Login failed for ${email}: ${data.message}`);
      }
      return {
        token: data.result.token,
        user: data.result,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.result.token}`,
        },
      };
    };

    console.log('Logging in test accounts...');
    const mgmt = await loginUser('management@tecmotiv.com');
    const hr = await loginUser('hr@tecmotiv.com');
    const deptHead = await loginUser('depthead@tecmotiv.com'); // Engineering Dept Head
    const emp1 = await loginUser('employee1@tecmotiv.com'); // Engineering Employee (John Doe)
    const emp2 = await loginUser('employee2@tecmotiv.com'); // Marketing Employee (Jane Smith)
    console.log('All test accounts authenticated.\n');

    // Fetch employee profiles
    const emp1Res = await fetch(`${BASE_URL}/employee/read/${emp1.user._id}`, { headers: hr.headers });
    const emp1Profile = (await emp1Res.json()).result;

    const emp2Res = await fetch(`${BASE_URL}/employee/read/${emp2.user._id}`, { headers: hr.headers });
    const emp2Profile = (await emp2Res.json()).result;

    // Connect to DB for cleanup of test-specific records
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    require('../models/appModels/Employee');
    const Attendance = require('../models/appModels/Attendance');

    // Clean today's records for test employees using local date string
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    await Attendance.deleteMany({
      employee: { $in: [emp1Profile._id, emp2Profile._id] },
      dateString: todayStr,
    });

    // -------------------------------------------------------------
    // TEST 1: Logout without login rejection
    // -------------------------------------------------------------
    await testCase('1. Logout without prior login rejection (Employee 1)', async () => {
      const res = await fetch(`${BASE_URL}/attendance/logout`, {
        method: 'POST',
        headers: emp1.headers,
        body: JSON.stringify({ remarks: 'Premature logout attempt' }),
      });
      const data = await res.json();
      if (res.status !== 400 || !data.message?.includes('Logout without login')) {
        throw new Error(`Expected 400 Logout without login, got status ${res.status}: ${data.message}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 2: Future timestamp rejection
    // -------------------------------------------------------------
    await testCase('2. Future timestamp rejection on login', async () => {
      const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
      const res = await fetch(`${BASE_URL}/attendance/login`, {
        method: 'POST',
        headers: emp1.headers,
        body: JSON.stringify({ timestamp: futureTime.toISOString(), workMode: 'Office' }),
      });
      const data = await res.json();
      if (res.status !== 400 || !data.message?.includes('future')) {
        throw new Error(`Expected 400 future timestamp message, got status ${res.status}: ${data.message}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 3: Employee 1 checks in (Clock In - Office mode)
    // -------------------------------------------------------------
    let clockInTime = new Date();
    await testCase('3. Employee 1 Clock-in (Office mode)', async () => {
      const res = await fetch(`${BASE_URL}/attendance/login`, {
        method: 'POST',
        headers: emp1.headers,
        body: JSON.stringify({ workMode: 'Office', remarks: 'Morning check-in for sprint work' }),
      });
      const data = await res.json();
      if (!data.success || !data.result.loginTime) {
        throw new Error(`Clock-in did not set loginTime: ${data.message}`);
      }
      if (data.result.workMode !== 'Office') {
        throw new Error(`Expected Office, got ${data.result.workMode}`);
      }
      clockInTime = new Date(data.result.loginTime);
    });

    // -------------------------------------------------------------
    // TEST 4: Duplicate login rejection
    // -------------------------------------------------------------
    await testCase('4. Duplicate login rejection for today (Employee 1)', async () => {
      const res = await fetch(`${BASE_URL}/attendance/login`, {
        method: 'POST',
        headers: emp1.headers,
        body: JSON.stringify({ workMode: 'Office' }),
      });
      const data = await res.json();
      if (res.status !== 400 || !data.message?.includes('Duplicate login')) {
        throw new Error(`Expected 400 Duplicate login, got status ${res.status}: ${data.message}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 5: Employee 1 Checks Today Status
    // -------------------------------------------------------------
    await testCase('5. Read today status (/api/attendance/today)', async () => {
      const res = await fetch(`${BASE_URL}/attendance/today`, {
        method: 'GET',
        headers: emp1.headers,
      });
      const data = await res.json();
      if (!data.success || !data.result.hasLoggedIn || data.result.hasLoggedOut) {
        throw new Error(`Expected hasLoggedIn: true, hasLoggedOut: false, got ${JSON.stringify(data.result)}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 6: Invalid timestamps: Logout earlier than login
    // -------------------------------------------------------------
    await testCase('6. Invalid timestamps rejection (logout earlier than login)', async () => {
      const earlierTime = new Date(clockInTime.getTime() - 10 * 60 * 1000); // 10 mins before login
      const res = await fetch(`${BASE_URL}/attendance/logout`, {
        method: 'POST',
        headers: emp1.headers,
        body: JSON.stringify({ timestamp: earlierTime.toISOString() }),
      });
      const data = await res.json();
      if (res.status !== 400 || !data.message?.includes('strictly after')) {
        throw new Error(`Expected 400 invalid timestamps, got status ${res.status}: ${data.message}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 7: Clock Out (Logout)
    // -------------------------------------------------------------
    await testCase('7. Clock out successfully & calculate total hours (Employee 1)', async () => {
      const res = await fetch(`${BASE_URL}/attendance/logout`, {
        method: 'POST',
        headers: emp1.headers,
        body: JSON.stringify({ remarks: 'Completed all sprint backlog tasks' }),
      });
      const data = await res.json();
      if (!data.success || !data.result.logoutTime) {
        throw new Error(`Logout did not set logoutTime: ${data.message}`);
      }
      if (data.result.totalHours === undefined) {
        throw new Error('Total hours was not calculated on logout');
      }
    });

    // -------------------------------------------------------------
    // TEST 8: Already logged-out rejection
    // -------------------------------------------------------------
    await testCase('8. Rejection of second logout (Already logged out)', async () => {
      const res = await fetch(`${BASE_URL}/attendance/logout`, {
        method: 'POST',
        headers: emp1.headers,
        body: JSON.stringify({ remarks: 'Second logout attempt' }),
      });
      const data = await res.json();
      if (res.status !== 400 || !data.message?.includes('Already logged out')) {
        throw new Error(`Expected 400 Already logged out, got status ${res.status}: ${data.message}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 9: Employee 2 checks in (Work From Home)
    // -------------------------------------------------------------
    await testCase('9. Employee 2 Clock-in (Work From Home mode)', async () => {
      const res = await fetch(`${BASE_URL}/attendance/login`, {
        method: 'POST',
        headers: emp2.headers,
        body: JSON.stringify({ workMode: 'Work From Home', remarks: 'Remote marketing campaign launch' }),
      });
      const data = await res.json();
      if (!data.success || data.result.workMode !== 'Work From Home') {
        throw new Error(`Failed to clock in with Work From Home: ${data.message}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 10: Security: Employee cannot manipulate peer's attendance
    // -------------------------------------------------------------
    await testCase("10. Security: Employee cannot manipulate peer's attendance", async () => {
      const res = await fetch(`${BASE_URL}/attendance/create`, {
        method: 'POST',
        headers: emp1.headers,
        body: JSON.stringify({ employee: emp2Profile._id, date: new Date().toISOString(), status: 'Present' }),
      });
      const data = await res.json();
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}: ${data.message}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 11: Security: Employee cannot delete attendance records
    // -------------------------------------------------------------
    await testCase('11. Security: Employee cannot delete attendance records', async () => {
      const todayRecord = await Attendance.findOne({ employee: emp1Profile._id, dateString: todayStr });
      if (!todayRecord) {
        throw new Error('Could not find record to test delete');
      }
      const res = await fetch(`${BASE_URL}/attendance/delete/${todayRecord._id}`, {
        method: 'DELETE',
        headers: emp1.headers,
      });
      const data = await res.json();
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}: ${data.message}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 12: Monthly Calculations Endpoint
    // -------------------------------------------------------------
    await testCase('12. Monthly calculations metrics computation', async () => {
      const res = await fetch(`${BASE_URL}/attendance/monthly`, {
        method: 'GET',
        headers: emp1.headers,
      });
      const data = await res.json();
      if (!data.success || !data.result.metrics) {
        throw new Error(`Monthly response missing metrics: ${data.message}`);
      }
      const m = data.result.metrics;
      const expectedKeys = [
        'workingDays',
        'present',
        'absent',
        'leave',
        'wfh',
        'halfDay',
        'lateLogin',
        'earlyLogout',
        'totalWorkingHours',
      ];
      for (const k of expectedKeys) {
        if (m[k] === undefined) {
          throw new Error(`Missing expected calculation key: ${k}`);
        }
      }
    });

    // -------------------------------------------------------------
    // TEST 13: Attendance Report Endpoint
    // -------------------------------------------------------------
    await testCase('13. Attendance Reports summary (/api/attendance/report)', async () => {
      const res = await fetch(`${BASE_URL}/attendance/report`, {
        method: 'GET',
        headers: hr.headers,
      });
      const data = await res.json();
      if (!data.success || !Array.isArray(data.result.reportRows)) {
        throw new Error(`Report endpoint missing reportRows: ${data.message}`);
      }
      if (data.result.reportRows.length === 0) {
        throw new Error('Report rows should not be empty');
      }
    });

    // -------------------------------------------------------------
    // TEST 14: Department Head Scope (Team attendance isolation)
    // -------------------------------------------------------------
    await testCase('14. Department Head scoped to their department (Engineering)', async () => {
      const res = await fetch(`${BASE_URL}/attendance/list`, {
        method: 'GET',
        headers: deptHead.headers,
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(`Dept head list failed: ${data.message}`);
      }
      const nonEngineering = data.result.filter(
        (r) => r.department && r.department.toLowerCase() !== 'engineering'
      );
      if (nonEngineering.length > 0) {
        throw new Error(`Dept head received records from other departments: ${nonEngineering.map(n => n.department).join(', ')}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 15: HR / Management Full Access & Filters
    // -------------------------------------------------------------
    await testCase('15. HR / Management filter by department and employee', async () => {
      const res = await fetch(`${BASE_URL}/attendance/list?department=Marketing`, {
        method: 'GET',
        headers: hr.headers,
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(`HR filtered list failed: ${data.message}`);
      }
      for (const r of data.result) {
        if (r.department && r.department.toLowerCase() !== 'marketing') {
          throw new Error(`Found non-Marketing record in filtered result: ${r.department}`);
        }
      }
    });

    // -------------------------------------------------------------
    // TEST 16: HR Manual Regularization
    // -------------------------------------------------------------
    await testCase('16. HR manual attendance regularization / create', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const pastDateStr = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}-${String(pastDate.getDate()).padStart(2, '0')}`;

      // Delete if already existed
      await Attendance.deleteMany({ employee: emp1Profile._id, dateString: pastDateStr });

      const res = await fetch(`${BASE_URL}/attendance/create`, {
        method: 'POST',
        headers: hr.headers,
        body: JSON.stringify({
          employee: emp1Profile._id,
          date: pastDate.toISOString(),
          loginTime: new Date(pastDate.setHours(9, 0, 0)).toISOString(),
          logoutTime: new Date(pastDate.setHours(17, 30, 0)).toISOString(),
          workMode: 'Office',
          status: 'Present',
          remarks: 'HR Regularization for past onsite work',
        }),
      });

      const data = await res.json();
      if (!data.success || data.result.totalHours !== 8.5) {
        throw new Error(`Expected totalHours 8.5, got ${data.result?.totalHours}: ${data.message}`);
      }
    });

    console.log('\n====================================================');
    console.log(`ATTENDANCE TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  }
}

runAttendanceTests();

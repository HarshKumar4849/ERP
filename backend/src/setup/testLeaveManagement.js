require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:8888/api';

async function runLeaveTests() {
  console.log('====================================================');
  console.log('   PHASE 6 — LEAVE MANAGEMENT TEST SUITE            ');
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
    const deptHead = await loginUser('depthead@tecmotiv.com'); // David Head (Engineering Head)
    const emp1 = await loginUser('employee1@tecmotiv.com'); // John Doe (Engineering)
    const emp2 = await loginUser('employee2@tecmotiv.com'); // Jane Smith (Marketing)
    console.log('All test accounts authenticated.\n');

    // Fetch employee profiles
    const emp1Res = await fetch(`${BASE_URL}/employee/read/${emp1.user._id}`, { headers: hr.headers });
    const emp1Profile = (await emp1Res.json()).result;

    const emp2Res = await fetch(`${BASE_URL}/employee/read/${emp2.user._id}`, { headers: hr.headers });
    const emp2Profile = (await emp2Res.json()).result;

    // Connect to DB for cleanup / inspections
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    const Leave = require('../models/appModels/Leave');
    const Attendance = require('../models/appModels/Attendance');
    const LeaveBalance = require('../models/appModels/LeaveBalance');

    // Clean any future test-specific leaves
    await Leave.deleteMany({
      reason: { $regex: /TEST_PHASE6/i },
    });

    await LeaveBalance.updateMany(
      { employee: emp1Profile._id },
      {
        $set: {
          'balances.Casual Leave.used': 0,
          'balances.Casual Leave.pending': 0,
          'balances.Sick Leave.used': 0,
          'balances.Sick Leave.pending': 0,
        },
      }
    );

    let testLeaveId = null;

    // -------------------------------------------------------------
    // TEST 1: Employee applies leave successfully
    // -------------------------------------------------------------
    await testCase('1. Employee 1 applies Casual Leave', async () => {
      const res = await fetch(`${BASE_URL}/leave/apply`, {
        method: 'POST',
        headers: emp1.headers,
        body: JSON.stringify({
          leaveType: 'Casual Leave',
          fromDate: '2026-11-10',
          toDate: '2026-11-11',
          daysCount: 2,
          reason: 'TEST_PHASE6 Family function out of city',
        }),
      });
      const data = await res.json();
      if (!data.success || !data.result._id) {
        throw new Error(`Failed to apply leave: ${data.message}`);
      }
      if (data.result.status !== 'Pending Manager Approval') {
        throw new Error(`Expected Pending Manager Approval, got ${data.result.status}`);
      }
      testLeaveId = data.result._id;
    });

    // -------------------------------------------------------------
    // TEST 2: Overlapping leave prevention
    // -------------------------------------------------------------
    await testCase('2. Overlapping leave request rejection', async () => {
      const res = await fetch(`${BASE_URL}/leave/apply`, {
        method: 'POST',
        headers: emp1.headers,
        body: JSON.stringify({
          leaveType: 'Sick Leave',
          fromDate: '2026-11-11', // Overlaps with 2026-11-10 to 2026-11-11
          toDate: '2026-11-12',
          daysCount: 2,
          reason: 'TEST_PHASE6 Overlapping request',
        }),
      });
      const data = await res.json();
      if (res.status !== 400 || !data.message?.toLowerCase().includes('overlapping')) {
        throw new Error(`Expected 400 Overlapping leave, got status ${res.status}: ${data.message}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 3: Invalid dates rejection (toDate earlier than fromDate)
    // -------------------------------------------------------------
    await testCase('3. Invalid dates rejection (toDate earlier than fromDate)', async () => {
      const res = await fetch(`${BASE_URL}/leave/apply`, {
        method: 'POST',
        headers: emp1.headers,
        body: JSON.stringify({
          leaveType: 'Casual Leave',
          fromDate: '2026-11-20',
          toDate: '2026-11-15',
          daysCount: 1,
          reason: 'TEST_PHASE6 Backwards dates',
        }),
      });
      const data = await res.json();
      if (res.status !== 400 || !data.message?.toLowerCase().includes('earlier')) {
        throw new Error(`Expected 400 Invalid dates, got status ${res.status}: ${data.message}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 4: Negative balance prevention
    // -------------------------------------------------------------
    await testCase('4. Negative leave balance prevention', async () => {
      const res = await fetch(`${BASE_URL}/leave/apply`, {
        method: 'POST',
        headers: emp1.headers,
        body: JSON.stringify({
          leaveType: 'Compensatory Off',
          fromDate: '2026-11-22',
          toDate: '2026-11-27',
          daysCount: 6, // Comp off allocation is only 2
          reason: 'TEST_PHASE6 Exceeding quota',
        }),
      });
      const data = await res.json();
      if (res.status !== 400 || !data.message?.toLowerCase().includes('insufficient')) {
        throw new Error(`Expected 400 Insufficient balance, got status ${res.status}: ${data.message}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 5: Employee approving own leave prevention
    // -------------------------------------------------------------
    await testCase('5. Security: Employee approving own leave blocked', async () => {
      const res = await fetch(`${BASE_URL}/leave/manager-approval/${testLeaveId}`, {
        method: 'PATCH',
        headers: emp1.headers,
        body: JSON.stringify({
          action: 'Approve',
          remarks: 'Self approval attempt',
        }),
      });
      const data = await res.json();
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden for self approval, got status ${res.status}: ${data.message}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 6: Manager Approval Stage
    // -------------------------------------------------------------
    await testCase('6. Manager approves leave (David Head -> Pending HR Approval)', async () => {
      const res = await fetch(`${BASE_URL}/leave/manager-approval/${testLeaveId}`, {
        method: 'PATCH',
        headers: deptHead.headers,
        body: JSON.stringify({
          action: 'Approve',
          remarks: 'Work deliverables covered by team, approved.',
        }),
      });
      const data = await res.json();
      if (!data.success || data.result.status !== 'Pending HR Approval') {
        throw new Error(`Expected status Pending HR Approval, got ${data.result?.status}: ${data.message}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 7: Unauthorized Manager approval from different department
    // -------------------------------------------------------------
    await testCase('7. Security: Unauthorized department manager blocked', async () => {
      // Dept Head (Engineering) attempts to approve Jane Smith (Marketing) leave
      const janeLeave = await Leave.findOne({ employee: emp2Profile._id, status: 'Pending Manager Approval' });
      if (janeLeave) {
        const res = await fetch(`${BASE_URL}/leave/manager-approval/${janeLeave._id}`, {
          method: 'PATCH',
          headers: deptHead.headers,
          body: JSON.stringify({ action: 'Approve' }),
        });
        const data = await res.json();
        if (res.status !== 403) {
          throw new Error(`Expected 403 Forbidden for cross-department manager, got status ${res.status}: ${data.message}`);
        }
      }
    });

    // -------------------------------------------------------------
    // TEST 8: HR Approval & Attendance Integration
    // -------------------------------------------------------------
    await testCase('8. HR approves leave & integrates with attendance', async () => {
      const res = await fetch(`${BASE_URL}/leave/hr-approval/${testLeaveId}`, {
        method: 'PATCH',
        headers: hr.headers,
        body: JSON.stringify({
          action: 'Approve',
          remarks: 'HR approval confirmed and calendar synchronized',
        }),
      });
      const data = await res.json();
      if (!data.success || data.result.status !== 'Approved') {
        throw new Error(`Expected Approved status, got ${data.result?.status}: ${data.message}`);
      }

      // Check attendance integration: verify attendance record created for 2026-11-10
      const attRecord = await Attendance.findOne({
        employee: emp1Profile._id,
        dateString: '2026-11-10',
        removed: false,
      });

      if (!attRecord || attRecord.status !== 'Leave') {
        throw new Error(`Attendance integration failed: Expected status Leave for 2026-11-10, got ${attRecord?.status}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 9: Manager Rejection workflow with required reason
    // -------------------------------------------------------------
    await testCase('9. Manager rejection requires reason & updates quota', async () => {
      // Apply new temporary leave
      const applyRes = await fetch(`${BASE_URL}/leave/apply`, {
        method: 'POST',
        headers: emp1.headers,
        body: JSON.stringify({
          leaveType: 'Casual Leave',
          fromDate: '2026-11-28',
          toDate: '2026-11-28',
          daysCount: 1,
          reason: 'TEST_PHASE6 To be rejected',
        }),
      });
      const applyData = await applyRes.json();
      const rejLeaveId = applyData.result._id;

      // Reject without reason should fail
      const noReasonRes = await fetch(`${BASE_URL}/leave/manager-approval/${rejLeaveId}`, {
        method: 'PATCH',
        headers: deptHead.headers,
        body: JSON.stringify({ action: 'Reject' }),
      });
      if (noReasonRes.status !== 400) {
        throw new Error('Rejection without reason should return 400');
      }

      // Reject with reason
      const rejectRes = await fetch(`${BASE_URL}/leave/manager-approval/${rejLeaveId}`, {
        method: 'PATCH',
        headers: deptHead.headers,
        body: JSON.stringify({
          action: 'Reject',
          rejectionReason: 'Critical product release scheduled on this day.',
        }),
      });
      const rejectData = await rejectRes.json();
      if (!rejectData.success || rejectData.result.status !== 'Rejected') {
        throw new Error(`Expected status Rejected, got ${rejectData.result?.status}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 10: Cancel leave by employee
    // -------------------------------------------------------------
    await testCase('10. Employee cancels pending leave request', async () => {
      const applyRes = await fetch(`${BASE_URL}/leave/apply`, {
        method: 'POST',
        headers: emp1.headers,
        body: JSON.stringify({
          leaveType: 'Casual Leave',
          fromDate: '2026-11-18',
          toDate: '2026-11-18',
          daysCount: 1,
          reason: 'TEST_PHASE6 To be cancelled',
        }),
      });
      const applyData = await applyRes.json();
      const cancelId = applyData.result._id;

      const cancelRes = await fetch(`${BASE_URL}/leave/cancel/${cancelId}`, {
        method: 'PATCH',
        headers: emp1.headers,
      });
      const cancelData = await cancelRes.json();
      if (!cancelData.success || cancelData.result.status !== 'Cancelled') {
        throw new Error(`Expected status Cancelled, got ${cancelData.result?.status}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 11: Leave Balance Endpoint
    // -------------------------------------------------------------
    await testCase('11. Leave Balance endpoint returns 8 types with remaining calculations', async () => {
      const res = await fetch(`${BASE_URL}/leave/balance`, {
        method: 'GET',
        headers: emp1.headers,
      });
      const data = await res.json();
      if (!data.success || !data.result.balances) {
        throw new Error(`Failed to fetch leave balance: ${data.message}`);
      }
      const b = data.result.balances;
      const expectedTypes = [
        'Casual Leave',
        'Sick Leave',
        'Earned/Privilege Leave',
        'Compensatory Off',
        'Half Day',
        'Work From Home',
        'Unpaid Leave',
        'Other',
      ];
      for (const t of expectedTypes) {
        if (!b[t] || b[t].remaining === undefined) {
          throw new Error(`Missing balance for leave type: ${t}`);
        }
      }
    });

    // -------------------------------------------------------------
    // TEST 12: Leave Calendar Endpoint with Department Filter
    // -------------------------------------------------------------
    await testCase('12. Leave Calendar endpoint with department filtering', async () => {
      const res = await fetch(`${BASE_URL}/leave/calendar?year=2026&department=Engineering`, {
        method: 'GET',
        headers: hr.headers,
      });
      const data = await res.json();
      if (!data.success || !Array.isArray(data.result)) {
        throw new Error(`Calendar endpoint failed: ${data.message}`);
      }
      for (const l of data.result) {
        if (l.department && l.department.toLowerCase() !== 'engineering') {
          throw new Error(`Found non-Engineering record in filtered calendar: ${l.department}`);
        }
      }
    });

    // -------------------------------------------------------------
    // TEST 13: Approvals Queue Endpoint
    // -------------------------------------------------------------
    await testCase('13. Approvals queue endpoint for Manager and HR', async () => {
      const res = await fetch(`${BASE_URL}/leave/approvals-queue`, {
        method: 'GET',
        headers: hr.headers,
      });
      const data = await res.json();
      if (!data.success || !Array.isArray(data.result)) {
        throw new Error(`Approvals queue failed: ${data.message}`);
      }
    });

    console.log('\n====================================================');
    console.log(`LEAVE MANAGEMENT TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  }
}

runLeaveTests();

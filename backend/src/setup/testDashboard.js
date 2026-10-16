require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function testDashboard() {
  console.log('====================================================');
  console.log('🧪 TESTING PHASE 8: TECMOTIV MANAGEMENT DASHBOARD');
  console.log('====================================================\n');

  try {
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    console.log('✅ Connected to MongoDB');

    const Admin = require('../models/coreModels/Admin');
    const dashboardController = require('../controllers/appControllers/dashboardController');

    const mgmtUser = await Admin.findOne({ email: 'management@tecmotiv.com' });
    const deptHeadUser = await Admin.findOne({ email: 'depthead@tecmotiv.com' });
    const emp1User = await Admin.findOne({ email: 'employee1@tecmotiv.com' });

    console.log('\n--- Test 1: Management Overview Endpoint ---');
    let mgmtResponse = null;
    await dashboardController.overview(
      { user: mgmtUser, userRole: 'MANAGEMENT' },
      { status: () => ({ json: (d) => (mgmtResponse = d) }) }
    );

    if (!mgmtResponse || !mgmtResponse.success) {
      throw new Error('Management dashboard response failed: ' + JSON.stringify(mgmtResponse));
    }

    const { kpis, todayOverview, myTasks, companyUpdates, upcoming } = mgmtResponse.result;

    console.log('✅ Management KPI Metrics:');
    console.log(`   Total Employees: ${kpis.totalEmployees}`);
    console.log(`   Present Today: ${kpis.presentToday}`);
    console.log(`   On Leave: ${kpis.onLeave}`);
    console.log(`   Absent: ${kpis.absent}`);
    console.log(`   New Joiners: ${kpis.newJoiners}`);
    console.log(`   Birthdays This Month: ${kpis.birthdaysThisMonth}`);
    console.log(`   Work Anniversaries: ${kpis.workAnniversaries}`);
    console.log(`   Open Tasks: ${kpis.openTasks}`);
    console.log(`   Overdue Tasks: ${kpis.overdueTasks}`);
    console.log(`   Upcoming Events: ${kpis.upcomingEvents}`);

    console.log('\n✅ Today Overview Data:');
    console.log(`   Recent check-ins count: ${todayOverview.attendance.recentCheckIns.length}`);
    console.log(`   Today approved leaves: ${todayOverview.leave.length}`);
    console.log(`   Birthdays today/week: ${todayOverview.birthdays.length}`);
    console.log(`   Anniversaries today/week: ${todayOverview.anniversaries.length}`);
    console.log(`   Important meetings today: ${todayOverview.importantMeetings.length}`);
    console.log(`   Company events today: ${todayOverview.companyEvents.length}`);

    console.log('\n✅ Company Updates Data:');
    console.log(`   Announcements count: ${companyUpdates.announcements.length}`);
    console.log(`   Policies count: ${companyUpdates.policies.length}`);
    console.log(`   Important notices count: ${companyUpdates.importantNotices.length}`);

    console.log('\n✅ Upcoming Data:');
    console.log(`   Upcoming meetings: ${upcoming.meetings.length}`);
    console.log(`   Upcoming events: ${upcoming.events.length}`);
    console.log(`   Project milestones: ${upcoming.projectMilestones.length}`);

    console.log('\n--- Test 2: Department Head Scoped Overview ---');
    let deptResponse = null;
    await dashboardController.overview(
      { user: deptHeadUser, userRole: 'DEPARTMENT_HEAD' },
      { status: () => ({ json: (d) => (deptResponse = d) }) }
    );
    console.log(`✅ Dept Head KPI: Total Employees in team = ${deptResponse.result.kpis.totalEmployees}`);

    console.log('\n--- Test 3: Employee Scoped Overview ---');
    let empResponse = null;
    await dashboardController.overview(
      { user: emp1User, userRole: 'EMPLOYEE' },
      { status: () => ({ json: (d) => (empResponse = d) }) }
    );
    console.log(`✅ Employee My Tasks counts:`, empResponse.result.myTasks.counts);

    console.log('\n====================================================');
    console.log('🎉 ALL PHASE 8 DASHBOARD BACKEND TESTS PASSED!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testDashboard();

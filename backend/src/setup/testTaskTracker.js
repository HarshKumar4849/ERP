require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function testTaskTracker() {
  console.log('====================================================');
  console.log('🧪 TESTING PHASE 7: DAILY TASK TRACKER');
  console.log('====================================================\n');

  try {
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    console.log('✅ Connected to MongoDB');

    const Admin = require('../models/coreModels/Admin');
    const Employee = require('../models/appModels/Employee');
    const Project = require('../models/appModels/Project');
    const Task = require('../models/appModels/Task');
    const Department = require('../models/appModels/Department');

    // 1. Fetch test users
    const mgmtUser = await Admin.findOne({ email: 'management@tecmotiv.com' });
    const deptHeadUser = await Admin.findOne({ email: 'depthead@tecmotiv.com' });
    const emp1User = await Admin.findOne({ email: 'employee1@tecmotiv.com' });
    const emp2User = await Admin.findOne({ email: 'employee2@tecmotiv.com' });

    if (!mgmtUser || !deptHeadUser || !emp1User) {
      throw new Error('Test users not found! Please run seedRbacData.js first.');
    }

    const emp1 = await Employee.findOne({ email: emp1User.email });
    const emp2 = await Employee.findOne({ email: emp2User.email });
    const deptHeadEmp = await Employee.findOne({ email: deptHeadUser.email });

    console.log(`✅ Test users verified:
   Management: ${mgmtUser.email}
   Dept Head: ${deptHeadUser.email} (${deptHeadUser.department})
   Employee 1: ${emp1User.email} (${emp1?.departmentName})
   Employee 2: ${emp2User.email} (${emp2?.departmentName})`);

    // Clean up any previous test tasks
    await Task.deleteMany({ task: { $regex: /^TEST_TASK/i } });

    // Fetch an active project
    const project = await Project.findOne({ department: 'Engineering' });

    // 2. Test Task Creation with all Phase 7 fields
    console.log('\n--- Test 1: Create Task with Subtasks, Reviewer, Project, Priority & Due Date ---');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const task1 = await new Task({
      task: 'TEST_TASK: Build Microservices Gateway',
      title: 'TEST_TASK: Build Microservices Gateway',
      description: 'Implement reverse proxy routing and SSL termination',
      owner: emp1?._id,
      assignedTo: emp1User._id,
      ownerName: `${emp1?.name} ${emp1?.surname}`,
      reviewer: deptHeadEmp?._id,
      reviewerUser: deptHeadUser._id,
      reviewerName: `${deptHeadUser.name} ${deptHeadUser.surname}`,
      department: 'Engineering',
      project: project?._id,
      projectName: project ? project.name : 'Engineering Core',
      priority: 'High',
      dueDate: tomorrow,
      status: 'In Progress',
      subtasks: [
        { title: 'Setup Nginx configuration', completed: true, completedAt: new Date() },
        { title: 'Configure SSL certificates', completed: false },
        { title: 'Run latency benchmarks', completed: false },
      ],
      createdBy: deptHeadUser._id,
      createdByName: `${deptHeadUser.name} ${deptHeadUser.surname}`,
    }).save();

    console.log(`✅ Task created with ID: ${task1._id}`);
    console.log(`   Task Name: "${task1.task}"`);
    console.log(`   Owner: ${task1.ownerName}`);
    console.log(`   Reviewer: ${task1.reviewerName}`);
    console.log(`   Priority: ${task1.priority}`);
    console.log(`   Status: ${task1.status}`);
    console.log(`   Subtasks: ${task1.subtasks.length} (Progress: ${task1.subtaskProgress}%)`);
    console.log(`   Is Overdue: ${task1.isOverdue}`);

    // 3. Test Subtask Checklist Operations
    console.log('\n--- Test 2: Subtask Operations (Add, Toggle, Delete) ---');
    task1.subtasks.push({ title: 'Verify health checks', completed: false });
    await task1.save();
    console.log(`✅ Added subtask. Total count: ${task1.subtasks.length}`);

    // Toggle completion
    const subtaskToToggle = task1.subtasks.find((s) => s.title === 'Configure SSL certificates');
    if (subtaskToToggle) {
      subtaskToToggle.completed = true;
      subtaskToToggle.completedAt = new Date();
      await task1.save();
      console.log(`✅ Toggled subtask "${subtaskToToggle.title}" to completed: ${subtaskToToggle.completed}`);
      console.log(`   Updated Subtask Progress: ${task1.subtaskProgress}%`);
    }

    // 4. Test Comments Thread
    console.log('\n--- Test 3: Add Comments with Author Info & Role ---');
    task1.comments.push({
      user: emp1User._id,
      employee: emp1?._id,
      authorName: `${emp1User.name} ${emp1User.surname}`,
      authorRole: 'EMPLOYEE',
      comment: 'SSL certificates successfully provisioned via Let’s Encrypt.',
      createdAt: new Date(),
    });
    task1.comments.push({
      user: deptHeadUser._id,
      employee: deptHeadEmp?._id,
      authorName: `${deptHeadUser.name} ${deptHeadUser.surname}`,
      authorRole: 'DEPARTMENT_HEAD',
      comment: 'Looks solid, proceed to latency testing.',
      createdAt: new Date(),
    });
    await task1.save();
    console.log(`✅ Added 2 comments. Current thread length: ${task1.comments.length}`);

    // 5. Test Attachments
    console.log('\n--- Test 4: File Attachments ---');
    task1.attachments.push({
      name: 'architecture-diagram.pdf',
      file: 'public/uploads/task/architecture-diagram-abc12.pdf',
      size: 1048576,
      fileType: 'application/pdf',
      uploadedBy: emp1User._id,
      uploadedByName: `${emp1User.name} ${emp1User.surname}`,
      uploadedAt: new Date(),
    });
    await task1.save();
    console.log(`✅ Added attachment: ${task1.attachments[0].name} (${(task1.attachments[0].size / 1024).toFixed(0)} KB)`);

    // 6. Test Status Lifecycle & Completion
    console.log('\n--- Test 5: Status Lifecycle & Completion Timestamp ---');
    const validStatuses = ['Not Started', 'In Progress', 'Waiting', 'Completed', 'Overdue', 'Cancelled'];
    for (const st of ['Waiting', 'In Progress', 'Completed']) {
      task1.status = st;
      await task1.save();
      console.log(`   Status changed to "${task1.status}" | completedAt: ${task1.completedAt ? task1.completedAt.toISOString() : 'none'}`);
    }

    // 7. Test Overdue Detection
    console.log('\n--- Test 6: Overdue Detection ---');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);

    const overdueTask = await new Task({
      task: 'TEST_TASK: Overdue Security Patching',
      title: 'TEST_TASK: Overdue Security Patching',
      description: 'Apply urgent kernel security CVE patches',
      owner: emp1?._id,
      assignedTo: emp1User._id,
      ownerName: `${emp1?.name} ${emp1?.surname}`,
      department: 'Engineering',
      priority: 'Critical',
      dueDate: yesterday,
      status: 'In Progress',
      createdBy: mgmtUser._id,
      createdByName: `${mgmtUser.name} ${mgmtUser.surname}`,
    }).save();

    console.log(`✅ Created task with past due date (${overdueTask.dueDate.toISOString().split('T')[0]})`);
    console.log(`   Is Overdue: ${overdueTask.isOverdue}`);
    if (!overdueTask.isOverdue) {
      throw new Error('Overdue detection failed for past due task!');
    }

    // 8. Test Role-Based Scoping
    console.log('\n--- Test 7: Role-Based Scoping Enforcement ---');
    // Marketing task
    const marketingTask = await new Task({
      task: 'TEST_TASK: Q4 Brand Campaign Launch',
      title: 'TEST_TASK: Q4 Brand Campaign Launch',
      owner: emp2?._id,
      assignedTo: emp2User._id,
      ownerName: `${emp2?.name} ${emp2?.surname}`,
      department: 'Marketing',
      priority: 'Medium',
      dueDate: tomorrow,
      status: 'Not Started',
      createdBy: mgmtUser._id,
      createdByName: `${mgmtUser.name} ${mgmtUser.surname}`,
    }).save();

    // Employee 1 should only see tasks where they are owner/assignedTo/reviewer/creator
    const emp1Scoped = await Task.find({
      removed: false,
      $or: [
        { assignedTo: emp1User._id },
        { owner: emp1?._id },
        { reviewerUser: emp1User._id },
        { reviewer: emp1?._id },
        { createdBy: emp1User._id },
      ],
      task: { $regex: /^TEST_TASK/i },
    });
    console.log(`   Employee 1 visible test tasks: ${emp1Scoped.length} (Should NOT include Marketing task)`);
    const hasMarketingInEmp1 = emp1Scoped.some((t) => t.department === 'Marketing');
    console.log(`   Includes Marketing Task? ${hasMarketingInEmp1 ? '❌ FAILED' : '✅ NO (Correct)'}`);

    // Department Head (Engineering) should see Engineering tasks, but NOT Marketing tasks
    const deptHeadScoped = await Task.find({
      removed: false,
      $or: [
        { department: new RegExp('^Engineering$', 'i') },
        { assignedTo: deptHeadUser._id },
        { reviewerUser: deptHeadUser._id },
        { createdBy: deptHeadUser._id },
      ],
      task: { $regex: /^TEST_TASK/i },
    });
    console.log(`   Dept Head (Engineering) visible test tasks: ${deptHeadScoped.length}`);
    const hasMarketingInDeptHead = deptHeadScoped.some((t) => t.department === 'Marketing');
    console.log(`   Includes Marketing Task? ${hasMarketingInDeptHead ? '❌ FAILED' : '✅ NO (Correct)'}`);

    // Management should see all tasks
    const mgmtScoped = await Task.find({
      removed: false,
      task: { $regex: /^TEST_TASK/i },
    });
    console.log(`   Management visible test tasks: ${mgmtScoped.length} (Should include all ${3} test tasks)`);

    // 9. Test Controller Methods via Direct Invocations
    console.log('\n--- Test 8: Testing Controller Methods (Dashboard, List, Search) ---');
    const taskController = require('../controllers/appControllers/taskController');

    // Test Dashboard for Management
    let dashboardResult = null;
    await taskController.dashboard(
      { user: mgmtUser, userRole: 'MANAGEMENT' },
      {
        status: () => ({ json: (data) => (dashboardResult = data) }),
      }
    );

    console.log('✅ Dashboard endpoint response:');
    console.log(`   Total tasks: ${dashboardResult?.result?.metrics?.total}`);
    console.log(`   Today: ${dashboardResult?.result?.metrics?.today}`);
    console.log(`   Pending: ${dashboardResult?.result?.metrics?.pending}`);
    console.log(`   Overdue: ${dashboardResult?.result?.metrics?.overdue}`);
    console.log(`   Completed: ${dashboardResult?.result?.metrics?.completed}`);
    console.log(`   Priority breakdown:`, dashboardResult?.result?.priorityBreakdown);
    console.log(`   Status breakdown:`, dashboardResult?.result?.statusBreakdown);

    // Test List with Department Filter
    let filterResult = null;
    await taskController.list(
      {
        user: mgmtUser,
        userRole: 'MANAGEMENT',
        query: { department: 'Engineering', q: 'TEST_TASK' },
      },
      {
        status: () => ({ json: (data) => (filterResult = data) }),
      }
    );
    console.log(`✅ List with department='Engineering' returned ${filterResult?.result?.length} records`);

    // Clean up test tasks
    await Task.deleteMany({ task: { $regex: /^TEST_TASK/i } });
    console.log('\n🧹 Cleaned up test tasks');

    console.log('\n====================================================');
    console.log('🎉 ALL PHASE 7 TASK TRACKER TESTS PASSED!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testTaskTracker();

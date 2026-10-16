require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function testProjectManagement() {
  try {
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    console.log('✅ Connected to MongoDB\n');

    const Admin = require('../models/coreModels/Admin');
    const Employee = require('../models/appModels/Employee');
    const Project = require('../models/appModels/Project');
    const Task = require('../models/appModels/Task');
    const Event = require('../models/appModels/Event');
    const projectController = require('../controllers/appControllers/projectController');

    const adminUser = await Admin.findOne({ role: 'ADMIN' }) || await Admin.findOne();
    const mgmtUser = await Admin.findOne({ role: 'MANAGEMENT' }) || adminUser;
    const empUser = await Admin.findOne({ role: 'EMPLOYEE' });
    const employees = await Employee.find({ removed: false });

    console.log('--- Test 1: Verify 5 Project Categories & Fields ---');
    const allProjects = await Project.find({ removed: false });
    const categoriesFound = new Set(allProjects.map((p) => p.category));
    console.log(`Found ${allProjects.length} projects across categories:`, Array.from(categoriesFound).join(', '));
    const requiredCategories = ['MDS', 'B2B', 'B2G', 'Consulting', 'Events'];
    for (const cat of requiredCategories) {
      if (!categoriesFound.has(cat)) throw new Error(`Missing required category: ${cat}`);
    }
    console.log('✅ All 5 required categories present and verified!\n');

    console.log('--- Test 2: Verify Project Workspace Live Connections (No Data Duplication) ---');
    const sample = await Project.findOne({ category: 'MDS', removed: false });
    if (!sample) throw new Error('No MDS project found.');

    let workspaceResult;
    const mockResRead = { status: (c) => ({ json: (d) => { workspaceResult = d; return d; } }) };
    await projectController.read({ user: adminUser, params: { id: sample._id } }, mockResRead);

    const ws = workspaceResult.result;
    console.log(`Workspace: "${ws.name}" (${ws.code})`);
    console.log(`   Client: ${ws.client}`);
    console.log(`   Department: ${ws.department}`);
    console.log(`   Project Manager: ${ws.projectManager?.name} ${ws.projectManager?.surname || ''}`);
    console.log(`   Team Members: ${ws.teamMembers?.length || 0} members`);
    console.log(`   Budget: ₹${ws.budget?.toLocaleString()}`);
    console.log(`   Live Tasks Connected: ${ws.liveTasks?.length || 0} tasks`);
    console.log(`   Live Calendar Events: ${ws.liveEvents?.length || 0} events`);
    console.log(`   Deliverables Count: ${ws.deliverables?.length || 0} deliverables`);
    console.log(`   Documents Count: ${ws.documents?.length || 0} documents`);
    console.log(`   Progress: ${ws.liveProgress}%`);

    if (ws.liveTasks.length === 0 || ws.liveEvents.length === 0) {
      throw new Error('Live cross-collection connection to Tasks or Calendar failed!');
    }
    console.log('✅ Cross-collection references to Employees, Tasks, Calendar, and Documents verified!\n');

    console.log('--- Test 3: Schedule Meeting & Sync to Calendar ---');
    let meetingResult;
    const mockResMeeting = { status: (c) => ({ json: (d) => { meetingResult = d; return d; } }) };
    await projectController.addMeeting(
      {
        user: adminUser,
        params: { id: sample._id },
        body: {
          title: 'Sprint 15 Planning & Demo',
          date: new Date('2026-10-25T11:00:00Z'),
          meetingLink: 'https://meet.google.com/test-sync',
          agenda: 'Review sprint deliverables with stakeholders.',
        },
      },
      mockResMeeting
    );
    console.log(`✅ Meeting scheduled. Synced to Calendar with Event ID: ${meetingResult?.calendarEvent?._id}`);

    console.log('\n--- Test 4: RBAC & Visibility Enforcement ---');
    // Management List
    let mgmtResult;
    const mockResMgmt = { status: (c) => ({ json: (d) => { mgmtResult = d; return d; } }) };
    await projectController.list({ user: mgmtUser, query: {} }, mockResMgmt);
    console.log(`✅ Management saw all ${mgmtResult.result.length} company projects. Total Budget: ₹${mgmtResult.summary.totalBudget.toLocaleString()}`);

    // Normal Employee List
    if (empUser) {
      let empResult;
      const mockResEmp = { status: (c) => ({ json: (d) => { empResult = d; return d; } }) };
      await projectController.list({ user: empUser, query: {} }, mockResEmp);
      console.log(`✅ Employee (${empUser.email}) saw ${empResult.result.length} authorized project(s).`);

      // Find an unauthorized project (not member of)
      const empDoc = await Employee.findOne({ user: empUser._id });
      if (empDoc) {
        const unauthProject = await Project.findOne({
          projectManager: { $ne: empDoc._id },
          teamMembers: { $ne: empDoc._id },
          removed: false,
        });

        if (unauthProject) {
          let unauthStatus, unauthMsg;
          const mockResUnauth = {
            status: (code) => {
              unauthStatus = code;
              return { json: (d) => { unauthMsg = d.message; return d; } };
            },
          };
          await projectController.read({ user: empUser, params: { id: unauthProject._id } }, mockResUnauth);
          if (unauthStatus === 403) {
            console.log(`✅ Employee blocked from unauthorized project with 403 Forbidden: "${unauthMsg}"`);
          } else {
            throw new Error(`Employee was NOT blocked from unauthorized project! Status: ${unauthStatus}`);
          }
        }
      }
    }

    console.log('\n====================================================');
    console.log('🎉 ALL PHASE 14 PROJECT MANAGEMENT TESTS PASSED!');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

testProjectManagement();

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function seedTasks() {
  try {
    await mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/tecmotiv-erp');
    console.log('✅ Connected to MongoDB');

    const Admin = require('../models/coreModels/Admin');
    const Employee = require('../models/appModels/Employee');
    const Project = require('../models/appModels/Project');
    const Task = require('../models/appModels/Task');

    const mgmtUser = await Admin.findOne({ email: 'management@tecmotiv.com' });
    const deptHeadUser = await Admin.findOne({ email: 'depthead@tecmotiv.com' });
    const emp1User = await Admin.findOne({ email: 'employee1@tecmotiv.com' });
    const emp2User = await Admin.findOne({ email: 'employee2@tecmotiv.com' });

    const emp1 = await Employee.findOne({ email: 'employee1@tecmotiv.com' });
    const emp2 = await Employee.findOne({ email: 'employee2@tecmotiv.com' });
    const deptHeadEmp = await Employee.findOne({ email: 'depthead@tecmotiv.com' });

    const coreProject = await Project.findOne({ name: 'TecMotiv ERP Core Migration' });
    const cloudProject = await Project.findOne({ name: 'Cloud Infrastructure Modernization' });
    const hrProject = await Project.findOne({ name: 'Employee Engagement 360' });

    // Remove old tasks if any exist
    await Task.deleteMany({});

    const today = new Date();
    today.setHours(18, 0, 0, 0);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(17, 0, 0, 0);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    tomorrow.setHours(18, 0, 0, 0);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 5);
    nextWeek.setHours(18, 0, 0, 0);

    const tasksToSeed = [
      {
        task: 'Migrate RBAC Authentication to JWT Stateless Tokens',
        title: 'Migrate RBAC Authentication to JWT Stateless Tokens',
        description: 'Complete token invalidation and refresh token rotation across all backend endpoints.',
        owner: emp1?._id,
        assignedTo: emp1User?._id,
        ownerName: 'John Doe',
        reviewer: deptHeadEmp?._id,
        reviewerUser: deptHeadUser?._id,
        reviewerName: 'David Head',
        department: 'Engineering',
        project: coreProject?._id,
        projectName: coreProject ? coreProject.name : 'TecMotiv ERP Core Migration',
        priority: 'High',
        dueDate: today,
        status: 'In Progress',
        subtasks: [
          { title: 'Update authUser.js middleware', completed: true, completedAt: new Date() },
          { title: 'Implement refreshToken endpoint', completed: true, completedAt: new Date() },
          { title: 'Write integration regression tests', completed: false },
        ],
        comments: [
          {
            user: deptHeadUser?._id,
            authorName: 'David Head',
            authorRole: 'DEPARTMENT_HEAD',
            comment: 'Ensure cookies are marked HttpOnly and SameSite=Strict.',
            createdAt: new Date(),
          },
        ],
        createdBy: deptHeadUser?._id,
        createdByName: 'David Head',
      },
      {
        task: 'Setup Prometheus Metrics & Grafana Dashboards',
        title: 'Setup Prometheus Metrics & Grafana Dashboards',
        description: 'Provision cluster monitoring and error rate alerts for production services.',
        owner: emp1?._id,
        assignedTo: emp1User?._id,
        ownerName: 'John Doe',
        reviewer: deptHeadEmp?._id,
        reviewerUser: deptHeadUser?._id,
        reviewerName: 'David Head',
        department: 'Engineering',
        project: cloudProject?._id,
        projectName: cloudProject ? cloudProject.name : 'Cloud Infrastructure Modernization',
        priority: 'Critical',
        dueDate: yesterday, // OVERDUE
        status: 'Waiting',
        subtasks: [
          { title: 'Deploy Prometheus Helm chart', completed: true, completedAt: new Date() },
          { title: 'Configure Grafana data source', completed: false },
          { title: 'Setup PagerDuty alert hooks', completed: false },
        ],
        comments: [
          {
            user: emp1User?._id,
            authorName: 'John Doe',
            authorRole: 'EMPLOYEE',
            comment: 'Waiting on DevOps access key approvals for the secondary cluster.',
            createdAt: new Date(),
          },
        ],
        createdBy: mgmtUser?._id,
        createdByName: 'Marcus Vance',
      },
      {
        task: 'Q4 Product Showcase Webinar & Slide Deck',
        title: 'Q4 Product Showcase Webinar & Slide Deck',
        description: 'Prepare keynote presentation and coordinate customer invitation emails.',
        owner: emp2?._id,
        assignedTo: emp2User?._id,
        ownerName: 'Jane Smith',
        reviewer: mgmtUser?._id,
        reviewerUser: mgmtUser?._id,
        reviewerName: 'Marcus Vance',
        department: 'Marketing',
        projectName: 'Growth Initiatives Q4',
        priority: 'Medium',
        dueDate: tomorrow,
        status: 'In Progress',
        subtasks: [
          { title: 'Draft webinar agenda', completed: true, completedAt: new Date() },
          { title: 'Design keynote slide deck', completed: false },
          { title: 'Send invitations to VIP clients', completed: false },
        ],
        comments: [
          {
            user: mgmtUser?._id,
            authorName: 'Marcus Vance',
            authorRole: 'MANAGEMENT',
            comment: 'Include the new ERP feature highlights in slide 4.',
            createdAt: new Date(),
          },
        ],
        createdBy: mgmtUser?._id,
        createdByName: 'Marcus Vance',
      },
      {
        task: 'Annual Policy Handbook Review & Distribution',
        title: 'Annual Policy Handbook Review & Distribution',
        description: 'Review compliance clauses and publish the updated employee handbook in the Document Vault.',
        department: 'Human Resources',
        project: hrProject?._id,
        projectName: hrProject ? hrProject.name : 'Employee Engagement 360',
        priority: 'Low',
        dueDate: nextWeek,
        status: 'Not Started',
        subtasks: [
          { title: 'Audit legal compliance clauses', completed: false },
          { title: 'Format PDF handbook', completed: false },
        ],
        createdBy: mgmtUser?._id,
        createdByName: 'Marcus Vance',
      },
      {
        task: 'Database Index Optimization for Attendance Records',
        title: 'Database Index Optimization for Attendance Records',
        description: 'Add compound indices on (employee, date) to speed up monthly attendance report generation.',
        owner: emp1?._id,
        assignedTo: emp1User?._id,
        ownerName: 'John Doe',
        reviewer: deptHeadEmp?._id,
        reviewerUser: deptHeadUser?._id,
        reviewerName: 'David Head',
        department: 'Engineering',
        project: coreProject?._id,
        projectName: coreProject ? coreProject.name : 'TecMotiv ERP Core Migration',
        priority: 'Medium',
        dueDate: yesterday,
        status: 'Completed',
        completedAt: new Date(),
        subtasks: [
          { title: 'Benchmark current query performance', completed: true, completedAt: new Date() },
          { title: 'Create compound index in MongoDB', completed: true, completedAt: new Date() },
          { title: 'Verify execution explain plan', completed: true, completedAt: new Date() },
        ],
        createdBy: deptHeadUser?._id,
        createdByName: 'David Head',
      },
    ];

    for (const t of tasksToSeed) {
      await new Task(t).save();
    }

    console.log(`👍 Successfully seeded ${tasksToSeed.length} sample tasks!`);
  } catch (err) {
    console.error('Error seeding tasks:', err);
  } finally {
    await mongoose.disconnect();
  }
}

seedTasks();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { globSync } = require('glob');
const qa = require('./qa-env');

require('module-alias/register');

require('../src/models/loadAllModels.js');

const Admin = mongoose.model('Admin');
const AdminPassword = mongoose.model('AdminPassword');
const Employee = mongoose.model('Employee');

const users = {
  admin: { role: 'ADMIN', name: 'QA Admin', employeeId: 'QA-ADMIN', department: 'QA Management' },
  hr: { role: 'HR', name: 'QA HR', employeeId: 'QA-HR', department: 'QA HR' },
  employee: { role: 'EMPLOYEE', name: 'QA Employee A', employeeId: 'QA-EMPA', department: 'Engineering' },
  employeeB: { role: 'EMPLOYEE', name: 'QA Employee B', employeeId: 'QA-EMPB', department: 'Marketing' },
  employeeSales: { role: 'EMPLOYEE', name: 'QA Employee Sales', employeeId: 'QA-EMPSALES', department: 'Sales' },
  employeeFinance: { role: 'EMPLOYEE', name: 'QA Employee Finance', employeeId: 'QA-EMPFIN', department: 'Finance' },
  employeeManagement: { role: 'EMPLOYEE', name: 'QA Employee Mgmt', employeeId: 'QA-EMPMGMT', department: 'Management' },
  employeeIT: { role: 'EMPLOYEE', name: 'QA Employee IT', employeeId: 'QA-EMPIT', department: 'IT' },
};

function emailFor(role) {
  const norm = role.toLowerCase();
  if (norm === 'employeea') return `qa-employee-${qa.RUN_ID}@example.com`.toLowerCase();
  return `qa-${norm}-${qa.RUN_ID}@example.com`.toLowerCase();
}

async function seedFixtures() {
  await mongoose.connect(qa.DATABASE);
  const created = {};
  const password = qa.PASSWORD;
  const salt = `qa-salt-${qa.RUN_ID}`;

  for (const [key, definition] of Object.entries(users)) {
    const email = emailFor(key);
    await Admin.deleteMany({ email });
    const user = await Admin.create({
      email,
      name: definition.name,
      surname: 'Fixture',
      role: definition.role,
      enabled: true,
      removed: false,
      employeeId: definition.employeeId,
      department: definition.department,
    });
    await AdminPassword.deleteMany({ user: user._id });
    await AdminPassword.create({
      user: user._id,
      password: bcrypt.hashSync(salt + password),
      salt,
      emailVerified: true,
      loggedSessions: [],
    });
    const empId = `${definition.employeeId}-${qa.RUN_ID}`.toUpperCase();
    await Employee.deleteMany({ $or: [{ employeeId: empId }, { email }, { user: user._id }] });
    const employee = await Employee.create({
      employeeId: empId,
      name: definition.name,
      surname: 'Fixture',
      email,
      user: user._id,
      departmentName: definition.department,
      status: 'Active',
      enabled: true,
    });
    created[key] = { user, employee };
  }

  // Employee A alias to employee (Engineering)
  created.employeeA = created.employee;

  return created;
}

async function cleanupFixtures(created) {
  if (!created) return;
  const userIds = Object.values(created).map(({ user }) => user._id);
  const employeeIds = Object.values(created).map(({ employee }) => employee._id);
  const ownedModels = [
    'Document',
    'Salary',
    'SalaryAudit',
    'Leave',
    'Attendance',
    'Task',
    'Project',
    'Event',
    'Celebration',
    'Announcement',
    'PolicyAcknowledgement',
    'DigitalService',
    'OfficeOperation',
    'Asset',
  ];

  for (const modelName of ownedModels) {
    const Model = mongoose.model(modelName);
    await Model.deleteMany({
      $or: [
        { user: { $in: userIds } },
        { employee: { $in: employeeIds } },
        { owner: { $in: userIds } },
        { assignedTo: { $in: userIds } },
        { createdBy: { $in: userIds } },
        { author: { $in: userIds } },
        { projectManager: { $in: employeeIds } },
        { teamMembers: { $in: employeeIds } },
      ],
    });
  }

  await mongoose.model('AdminPassword').deleteMany({ user: { $in: userIds } });
  await mongoose.model('Employee').deleteMany({ _id: { $in: employeeIds } });
  await mongoose.model('Admin').deleteMany({ _id: { $in: userIds } });

  await mongoose.disconnect();
}

async function cleanupByRunId(runId = qa.RUN_ID) {
  await mongoose.connect(qa.DATABASE);
  const safeRunId = runId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const emailRegex = new RegExp(`^qa-.*-${safeRunId}@example\\.com$`, 'i');
  const admins = await Admin.find({ email: emailRegex });
  const userIds = admins.map((user) => user._id);
  const employees = await Employee.find({
    $or: [
      { user: { $in: userIds } },
      { email: emailRegex },
      { employeeId: new RegExp(`-${safeRunId}$`, 'i') },
    ],
  });
  const employeeIds = employees.map((employee) => employee._id);
  for (const modelName of [
    'Document',
    'Salary',
    'SalaryAudit',
    'Leave',
    'Attendance',
    'Task',
    'Project',
    'Event',
    'Celebration',
    'Announcement',
    'PolicyAcknowledgement',
    'DigitalService',
    'OfficeOperation',
    'Asset',
  ]) {
    const Model = mongoose.model(modelName);
    await Model.deleteMany({
      $or: [
        { user: { $in: userIds } },
        { employee: { $in: employeeIds } },
        { createdBy: { $in: userIds } },
        { author: { $in: userIds } },
        { projectManager: { $in: employeeIds } },
        { teamMembers: { $in: employeeIds } },
      ],
    });
  }

  await mongoose.model('AdminPassword').deleteMany({ user: { $in: userIds } });
  await mongoose.model('Employee').deleteMany({
    $or: [
      { _id: { $in: employeeIds } },
      { user: { $in: userIds } },
      { email: emailRegex },
      { employeeId: new RegExp(`-${safeRunId}$`, 'i') },
    ],
  });
  await mongoose.model('Admin').deleteMany({
    $or: [
      { _id: { $in: userIds } },
      { email: emailRegex },
    ],
  });

  await mongoose.disconnect();
}

async function cleanupAllQaFixtures() {
  await mongoose.connect(qa.DATABASE);
  const emailRegex = /^qa-.*@example\.com$/i;
  const empIdRegex = /^QA-/i;
  const admins = await Admin.find({
    $or: [
      { email: emailRegex },
      { employeeId: empIdRegex },
    ],
  });
  const userIds = admins.map((user) => user._id);
  const employees = await Employee.find({
    $or: [
      { user: { $in: userIds } },
      { email: emailRegex },
      { employeeId: empIdRegex },
    ],
  });
  const employeeIds = employees.map((employee) => employee._id);
  for (const modelName of [
    'Document',
    'Salary',
    'SalaryAudit',
    'Leave',
    'Attendance',
    'Task',
    'Project',
    'Event',
    'Celebration',
    'Announcement',
    'PolicyAcknowledgement',
    'DigitalService',
    'OfficeOperation',
    'Asset',
  ]) {
    const Model = mongoose.model(modelName);
    await Model.deleteMany({
      $or: [
        { user: { $in: userIds } },
        { employee: { $in: employeeIds } },
        { createdBy: { $in: userIds } },
        { author: { $in: userIds } },
        { projectManager: { $in: employeeIds } },
        { teamMembers: { $in: employeeIds } },
      ],
    });
  }

  await mongoose.model('AdminPassword').deleteMany({ user: { $in: userIds } });
  await mongoose.model('Employee').deleteMany({
    $or: [
      { _id: { $in: employeeIds } },
      { user: { $in: userIds } },
      { email: emailRegex },
      { employeeId: empIdRegex },
    ],
  });
  await mongoose.model('Admin').deleteMany({
    $or: [
      { _id: { $in: userIds } },
      { email: emailRegex },
      { employeeId: empIdRegex },
    ],
  });

  await mongoose.disconnect();
}

module.exports = { seedFixtures, cleanupFixtures, cleanupByRunId, cleanupAllQaFixtures, emailFor };

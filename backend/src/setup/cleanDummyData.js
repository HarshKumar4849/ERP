require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function cleanDummyData() {
  const uri = process.env.DATABASE;
  if (!uri) {
    console.error('❌ DATABASE environment variable is not set.');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected successfully to:', uri.replace(/:[^:]*@/, ':****@'));

  const Admin = mongoose.models.Admin || require('../models/coreModels/Admin');
  const AdminPassword = mongoose.models.AdminPassword || require('../models/coreModels/AdminPassword');
  const Employee = mongoose.models.Employee || require('../models/appModels/Employee');
  const Project = mongoose.models.Project || require('../models/appModels/Project');
  const Task = mongoose.models.Task || require('../models/appModels/Task');
  const Attendance = mongoose.models.Attendance || require('../models/appModels/Attendance');
  const Leave = mongoose.models.Leave || require('../models/appModels/Leave');
  const LeaveBalance = mongoose.models.LeaveBalance || require('../models/appModels/LeaveBalance');
  const Salary = mongoose.models.Salary || require('../models/appModels/Salary');
  const SalaryAudit = mongoose.models.SalaryAudit || require('../models/appModels/SalaryAudit');
  const Event = mongoose.models.Event || require('../models/appModels/Event');
  const Celebration = mongoose.models.Celebration || require('../models/appModels/Celebration');
  const Announcement = mongoose.models.Announcement || require('../models/appModels/Announcement');
  const Asset = mongoose.models.Asset || require('../models/appModels/Asset');
  const OfficeOperation = mongoose.models.OfficeOperation || require('../models/appModels/OfficeOperation');
  const Document = mongoose.models.Document || require('../models/appModels/Document');
  const GithubActivity = mongoose.models.GithubActivity || require('../models/appModels/GithubActivity');
  const Notification = mongoose.models.Notification || require('../models/appModels/Notification');
  const PolicyAcknowledgement = mongoose.models.PolicyAcknowledgement || require('../models/appModels/PolicyAcknowledgement');

  console.log('\n🧹 Cleaning operational collections...');

  // 1. Operational entities
  const pRes = await Project.deleteMany({});
  console.log(`   - Projects removed: ${pRes.deletedCount}`);

  const tRes = await Task.deleteMany({});
  console.log(`   - Tasks removed: ${tRes.deletedCount}`);

  const attRes = await Attendance.deleteMany({});
  console.log(`   - Attendance logs removed: ${attRes.deletedCount}`);

  const lRes = await Leave.deleteMany({});
  console.log(`   - Leave applications removed: ${lRes.deletedCount}`);

  const lbRes = await LeaveBalance.deleteMany({});
  console.log(`   - Leave balances reset: ${lbRes.deletedCount}`);

  const sRes = await Salary.deleteMany({});
  console.log(`   - Salary slips removed: ${sRes.deletedCount}`);

  const saRes = await SalaryAudit.deleteMany({});
  console.log(`   - Salary audits removed: ${saRes.deletedCount}`);

  const evRes = await Event.deleteMany({});
  console.log(`   - Events removed: ${evRes.deletedCount}`);

  const celRes = await Celebration.deleteMany({});
  console.log(`   - Celebrations removed: ${celRes.deletedCount}`);

  const annRes = await Announcement.deleteMany({});
  console.log(`   - Announcements removed: ${annRes.deletedCount}`);

  const asRes = await Asset.deleteMany({});
  console.log(`   - Hardware/Assets removed: ${asRes.deletedCount}`);

  const offRes = await OfficeOperation.deleteMany({});
  console.log(`   - Office operations removed: ${offRes.deletedCount}`);

  const docRes = await Document.deleteMany({});
  console.log(`   - Vault documents removed: ${docRes.deletedCount}`);

  const ghRes = await GithubActivity.deleteMany({});
  console.log(`   - GitHub activity logs removed: ${ghRes.deletedCount}`);

  const notifRes = await Notification.deleteMany({});
  console.log(`   - Notifications removed: ${notifRes.deletedCount}`);

  const paRes = await PolicyAcknowledgement.deleteMany({});
  console.log(`   - Policy acknowledgements removed: ${paRes.deletedCount}`);

  // 2. Identify mock test accounts vs real user accounts
  const mockEmails = [
    'management@tecmotiv.com',
    'hr@tecmotiv.com',
    'finance@tecmotiv.com',
    'admin.user@tecmotiv.com',
    'depthead@tecmotiv.com',
    'employee1@tecmotiv.com',
    'employee2@tecmotiv.com',
    'otp.test.check@tecmotiv.com',
    'otptest123@tecmotiv.com',
    'robert.taylor@tecmotiv.com'
  ];

  console.log('\n👤 Cleaning mock user accounts & employees...');

  // Delete mock employees
  const empRes = await Employee.deleteMany({
    $or: [
      { email: { $in: mockEmails } },
      { name: { $in: ['Robert', 'Marcus', 'Sarah', 'David', 'Frank', 'John', 'Jane'] } }
    ]
  });
  console.log(`   - Mock employees removed: ${empRes.deletedCount}`);

  // Find admins to remove
  const adminsToRemove = await Admin.find({
    $or: [
      { email: { $in: mockEmails } },
      { name: { $in: ['Marcus', 'Sarah', 'Alex', 'Frank', 'David', 'John', 'Jane'] } }
    ]
  }).lean();

  const adminIdsToRemove = adminsToRemove.map(a => a._id);
  if (adminIdsToRemove.length > 0) {
    await AdminPassword.deleteMany({ user: { $in: adminIdsToRemove } });
    const delAdminRes = await Admin.deleteMany({ _id: { $in: adminIdsToRemove } });
    console.log(`   - Mock Admin accounts removed: ${delAdminRes.deletedCount}`);
  }

  // Ensure primary admin account exists and has proper ADMIN role
  const primaryAdmin = await Admin.findOne({ email: 'admin@admin.com' });
  if (primaryAdmin) {
    primaryAdmin.role = 'ADMIN';
    primaryAdmin.enabled = true;
    primaryAdmin.removed = false;
    await primaryAdmin.save();
    console.log(`\n👑 Primary Admin preserved: ${primaryAdmin.email} (Role: ${primaryAdmin.role})`);
  }

  const remainingAdmins = await Admin.find({}).select('email name surname role').lean();
  console.log('\n📋 Remaining Active User Accounts:');
  remainingAdmins.forEach(a => {
    console.log(`   - ${a.email} (${a.name} ${a.surname || ''}) [${a.role}]`);
  });

  const remainingEmployees = await Employee.find({ removed: false }).select('name surname email').lean();
  console.log(`\n📋 Remaining Employees count: ${remainingEmployees.length}`);

  console.log('\n🎉 Clean-up complete! Database is now clean with real production state.');
  process.exit(0);
}

cleanDummyData().catch(err => {
  console.error('❌ Clean-up failed:', err);
  process.exit(1);
});

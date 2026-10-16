// Static model loader for bundlers (Vercel, Rolldown, esbuild, Rollup) and production runtimes
// This ensures that all Mongoose schemas and models are bundled and registered.

require('./coreModels/Admin.js');
require('./coreModels/AdminPassword.js');
require('./coreModels/Setting.js');
require('./coreModels/Upload.js');

require('./appModels/Announcement.js');
require('./appModels/Asset.js');
require('./appModels/Attendance.js');
require('./appModels/Celebration.js');
require('./appModels/Department.js');
require('./appModels/Designation.js');
require('./appModels/DigitalService.js');
require('./appModels/Document.js');
require('./appModels/Employee.js');
require('./appModels/Event.js');
require('./appModels/GithubActivity.js');
require('./appModels/Leave.js');
require('./appModels/LeaveBalance.js');
require('./appModels/Location.js');
require('./appModels/Notification.js');
require('./appModels/NotificationPreference.js');
require('./appModels/OfficeOperation.js');
require('./appModels/OutlookIntegration.js');
require('./appModels/Policy.js');
require('./appModels/PolicyAcknowledgement.js');
require('./appModels/Project.js');
require('./appModels/Recognition.js');
require('./appModels/Salary.js');
require('./appModels/SalaryAudit.js');
require('./appModels/Task.js');
require('./appModels/Template.js');

module.exports = true;

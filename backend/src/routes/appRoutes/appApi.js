const express = require('express');
const { catchErrors } = require('../../handlers/errorHandlers');
const rbacMiddleware = require('../../middlewares/rbacMiddleware');
const router = express.Router();

const appControllers = require('../../controllers/appControllers');
const { routesList } = require('../../models/utils');

const routerApp = (entity, controller) => {
  if (entity !== 'document') {
    router.route(`/${entity}/create`).post(rbacMiddleware(entity, 'create'), catchErrors(controller['create']));
  }
  router.route(`/${entity}/read/:id`).get(rbacMiddleware(entity, 'read'), catchErrors(controller['read']));
  router.route(`/${entity}/update/:id`).patch(rbacMiddleware(entity, 'update'), catchErrors(controller['update']));
  router.route(`/${entity}/delete/:id`).delete(rbacMiddleware(entity, 'delete'), catchErrors(controller['delete']));
  router.route(`/${entity}/search`).get(rbacMiddleware(entity, 'search'), catchErrors(controller['search']));
  router.route(`/${entity}/list`).get(rbacMiddleware(entity, 'list'), catchErrors(controller['list']));
  router.route(`/${entity}/listAll`).get(rbacMiddleware(entity, 'list'), catchErrors(controller['listAll']));
  router.route(`/${entity}/filter`).get(rbacMiddleware(entity, 'filter'), catchErrors(controller['filter']));
  router.route(`/${entity}/summary`).get(rbacMiddleware(entity, 'summary'), catchErrors(controller['summary']));
};

routesList.forEach(({ entity, controllerName }) => {
  const controller = appControllers[controllerName];
  if (controller) {
    routerApp(entity, controller);
  }
});

const { singleStorageUpload } = require('../../middlewares/uploadMiddleware');
const vaultUpload = require('../../middlewares/uploadMiddleware/vaultStorageUpload');

// Dedicated employee endpoints: Photo Upload & Quick Status Change
if (appControllers['employeeController']) {
  router.route('/employee/upload-photo/:id').patch(
    rbacMiddleware('employee', 'update'),
    singleStorageUpload({ entity: 'employee', fieldName: 'photo', fileType: 'image' }),
    catchErrors(appControllers['employeeController'].uploadPhoto)
  );

  router.route('/employee/status/:id').patch(
    rbacMiddleware('employee', 'update'),
    catchErrors(appControllers['employeeController'].changeStatus)
  );
}

// Dedicated Document Vault endpoints: Secure Upload, Download, and Verification
if (appControllers['documentController']) {
  router.route('/document/create').post(
    rbacMiddleware('document', 'create'),
    vaultUpload,
    catchErrors(appControllers['documentController'].create)
  );

  router.route('/document/upload').post(
    rbacMiddleware('document', 'create'),
    vaultUpload,
    catchErrors(appControllers['documentController'].create)
  );

  router.route('/document/download/:id').get(
    rbacMiddleware('document', 'read'),
    catchErrors(appControllers['documentController'].download)
  );

  router.route('/document/verify/:id').patch(
    rbacMiddleware('document', 'update'),
    catchErrors(appControllers['documentController'].verify)
  );
}

// Dedicated Attendance endpoints: Login, Logout, Today's status, Monthly calculations & Reports
if (appControllers['attendanceController']) {
  router.route('/attendance/login').post(
    rbacMiddleware('attendance', 'create'),
    catchErrors(appControllers['attendanceController'].login)
  );

  router.route('/attendance/logout').post(
    rbacMiddleware('attendance', 'create'),
    catchErrors(appControllers['attendanceController'].logout)
  );

  router.route('/attendance/today').get(
    rbacMiddleware('attendance', 'read'),
    catchErrors(appControllers['attendanceController'].today)
  );

  router.route('/attendance/monthly').get(
    rbacMiddleware('attendance', 'summary'),
    catchErrors(appControllers['attendanceController'].monthly)
  );

  router.route('/attendance/report').get(
    rbacMiddleware('attendance', 'summary'),
    catchErrors(appControllers['attendanceController'].report)
  );
}

// Dedicated Leave endpoints: Apply, Cancel, Multi-Stage Approvals, Balance & Calendar
if (appControllers['leaveController']) {
  router.route('/leave/apply').post(
    rbacMiddleware('leave', 'create'),
    catchErrors(appControllers['leaveController'].apply)
  );

  router.route('/leave/cancel/:id').patch(
    rbacMiddleware('leave', 'update'),
    catchErrors(appControllers['leaveController'].cancel)
  );

  router.route('/leave/manager-approval/:id').patch(
    rbacMiddleware('leave', 'update'),
    catchErrors(appControllers['leaveController'].managerApproval)
  );

  router.route('/leave/hr-approval/:id').patch(
    rbacMiddleware('leave', 'update'),
    catchErrors(appControllers['leaveController'].hrApproval)
  );

  router.route('/leave/balance').get(
    rbacMiddleware('leave', 'summary'),
    catchErrors(appControllers['leaveController'].balance)
  );

  router.route('/leave/calendar').get(
    rbacMiddleware('leave', 'list'),
    catchErrors(appControllers['leaveController'].calendar)
  );

  router.route('/leave/approvals-queue').get(
    rbacMiddleware('leave', 'list'),
    catchErrors(appControllers['leaveController'].approvalsQueue)
  );
}

// Dedicated Task Tracker endpoints: Dashboard, My Tasks, Team Tasks, Status, Subtasks, Comments, Attachments
if (appControllers['taskController']) {
  router.route('/task/dashboard').get(
    rbacMiddleware('task', 'read'),
    catchErrors(appControllers['taskController'].dashboard)
  );
  router.route('/task/dashboard/list').get(
    rbacMiddleware('task', 'read'),
    catchErrors(appControllers['taskController'].dashboard)
  );

  router.route('/task/my-tasks').get(
    rbacMiddleware('task', 'list'),
    catchErrors(appControllers['taskController'].myTasks)
  );

  router.route('/task/team-tasks').get(
    rbacMiddleware('task', 'list'),
    catchErrors(appControllers['taskController'].teamTasks)
  );

  router.route('/task/status/:id').patch(
    rbacMiddleware('task', 'update'),
    catchErrors(appControllers['taskController'].changeStatus)
  );

  router.route('/task/:id/subtask').post(
    rbacMiddleware('task', 'update'),
    catchErrors(appControllers['taskController'].addSubtask)
  );

  router.route('/task/:id/subtask/:subtaskId').patch(
    rbacMiddleware('task', 'update'),
    catchErrors(appControllers['taskController'].updateSubtask)
  );

  router.route('/task/:id/subtask/:subtaskId').delete(
    rbacMiddleware('task', 'update'),
    catchErrors(appControllers['taskController'].deleteSubtask)
  );

  router.route('/task/:id/comment').post(
    rbacMiddleware('task', 'update'),
    catchErrors(appControllers['taskController'].addComment)
  );

  router.route('/task/:id/attachment').post(
    rbacMiddleware('task', 'update'),
    singleStorageUpload({ entity: 'task', fieldName: 'file' }),
    catchErrors(appControllers['taskController'].addAttachment)
  );

  router.route('/task/:id/github').get(
    rbacMiddleware('task', 'read'),
    catchErrors(appControllers['taskController'].getGithubLinks)
  );

  router.route('/task/:id/github/link').post(
    rbacMiddleware('task', 'update'),
    catchErrors(appControllers['taskController'].linkGithub)
  );

  router.route('/task/:id/github/unlink').post(
    rbacMiddleware('task', 'update'),
    catchErrors(appControllers['taskController'].unlinkGithub)
  );
}

// Dedicated TecMotiv Management Dashboard endpoint
if (appControllers['dashboardController']) {
  router.route('/dashboard/overview').get(
    rbacMiddleware('dashboard', 'read'),
    catchErrors(appControllers['dashboardController'].overview)
  );
  router.route('/dashboard/overview/list').get(
    rbacMiddleware('dashboard', 'read'),
    catchErrors(appControllers['dashboardController'].overview)
  );
}

// Dedicated Company Calendar & Celebrations endpoints
if (appControllers['calendarController']) {
  router.route('/calendar/events').get(
    rbacMiddleware('calendar', 'read'),
    catchErrors(appControllers['calendarController'].events)
  );

  router.route('/calendar/celebrations').get(
    rbacMiddleware('calendar', 'read'),
    catchErrors(appControllers['calendarController'].celebrations)
  );

  router.route('/calendar/celebration/:id/wish').post(
    rbacMiddleware('calendar', 'create'),
    catchErrors(appControllers['calendarController'].addWish)
  );

  router.route('/calendar/celebration/wish').post(
    rbacMiddleware('calendar', 'create'),
    catchErrors(appControllers['calendarController'].addWish)
  );

  router.route('/calendar/event').post(
    rbacMiddleware('calendar', 'create'),
    catchErrors(appControllers['calendarController'].createEvent)
  );

  router.route('/calendar/event/:id').patch(
    rbacMiddleware('calendar', 'update'),
    catchErrors(appControllers['calendarController'].updateEvent)
  );

  router.route('/calendar/event/:id').delete(
    rbacMiddleware('calendar', 'delete'),
    catchErrors(appControllers['calendarController'].deleteEvent)
  );
}

// Dedicated Policy Library & Digital Acknowledgment endpoints
if (appControllers['policyController']) {
  router.route('/policy/acknowledge/:id').post(
    rbacMiddleware('policy', 'update'),
    catchErrors(appControllers['policyController'].acknowledge)
  );

  router.route('/policy/acknowledgements/:id').get(
    rbacMiddleware('policy', 'read'),
    catchErrors(appControllers['policyController'].acknowledgements)
  );
}

// Dedicated TecMotiv Bulletin & Company Comms endpoints
if (appControllers['bulletinController']) {
  router.route('/bulletin/feed').get(
    rbacMiddleware('bulletin', 'read'),
    catchErrors(appControllers['bulletinController'].feed)
  );

  router.route('/bulletin/create').post(
    rbacMiddleware('bulletin', 'create'),
    catchErrors(appControllers['bulletinController'].create)
  );

  router.route('/bulletin/like/:id').post(
    rbacMiddleware('bulletin', 'update'),
    catchErrors(appControllers['bulletinController'].like)
  );

  router.route('/bulletin/delete/:id').delete(
    rbacMiddleware('bulletin', 'delete'),
    catchErrors(appControllers['bulletinController'].delete)
  );
}

// Dedicated Salary & Salary Slip endpoints
if (appControllers['salaryController']) {
  router.route('/salary/slip/pdf/:id').get(
    rbacMiddleware('salary', 'read'),
    catchErrors(appControllers['salaryController'].downloadSlipPdf)
  );

  router.route('/salary/generate-slip/:id').post(
    rbacMiddleware('salary', 'update'),
    catchErrors(appControllers['salaryController'].generateSlip)
  );

  router.route('/salary/audit/:id').get(
    rbacMiddleware('salary', 'read'),
    catchErrors(appControllers['salaryController'].audit)
  );

  router.route('/salary/audit').get(
    rbacMiddleware('salary', 'read'),
    catchErrors(appControllers['salaryController'].audit)
  );
}

// Dedicated Asset Management & Lifecycle endpoints
if (appControllers['assetController']) {
  router.route('/asset/assign/:id').post(
    rbacMiddleware('asset', 'update'),
    catchErrors(appControllers['assetController'].assign)
  );

  router.route('/asset/return/:id').post(
    rbacMiddleware('asset', 'update'),
    catchErrors(appControllers['assetController'].returnAsset)
  );

  router.route('/asset/maintenance/:id').post(
    rbacMiddleware('asset', 'update'),
    catchErrors(appControllers['assetController'].maintenance)
  );

  router.route('/asset/complete-maintenance/:id').post(
    rbacMiddleware('asset', 'update'),
    catchErrors(appControllers['assetController'].completeMaintenance)
  );

  router.route('/asset/history/:id').get(
    rbacMiddleware('asset', 'read'),
    catchErrors(appControllers['assetController'].history)
  );
}

// Dedicated Office Management endpoints (Rent, Facilities, Housekeeping, Pantry, etc.)
if (appControllers['officeController']) {
  router.route('/office/list').get(
    rbacMiddleware('office', 'list'),
    catchErrors(appControllers['officeController'].list)
  );

  router.route('/office/create').post(
    rbacMiddleware('office', 'create'),
    catchErrors(appControllers['officeController'].create)
  );

  router.route('/office/update/:id').patch(
    rbacMiddleware('office', 'update'),
    catchErrors(appControllers['officeController'].update)
  );

  router.route('/office/delete/:id').delete(
    rbacMiddleware('office', 'delete'),
    catchErrors(appControllers['officeController'].delete)
  );
}

// Dedicated Project Workspace endpoints (Deliverables, Meetings, Documents)
if (appControllers['projectController']) {
  router.route('/project/deliverable/:id').post(
    rbacMiddleware('project', 'update'),
    catchErrors(appControllers['projectController'].addDeliverable)
  );

  router.route('/project/meeting/:id').post(
    rbacMiddleware('project', 'update'),
    catchErrors(appControllers['projectController'].addMeeting)
  );

  router.route('/project/document/:id').post(
    rbacMiddleware('project', 'update'),
    catchErrors(appControllers['projectController'].addDocument)
  );
}

// Dedicated Events & Celebrations endpoints (Invitations, Media, Reports, History)
if (appControllers['eventController']) {
  router.route('/event/history').get(
    rbacMiddleware('event', 'read'),
    catchErrors(appControllers['eventController'].history)
  );

  router.route('/event/invite/:id').post(
    rbacMiddleware('event', 'update'),
    catchErrors(appControllers['eventController'].sendInvitation)
  );

  router.route('/event/media/:id').post(
    rbacMiddleware('event', 'update'),
    catchErrors(appControllers['eventController'].addMedia)
  );

  router.route('/event/report/:id').post(
    rbacMiddleware('event', 'update'),
    catchErrors(appControllers['eventController'].submitReport)
  );
}

// Dedicated Template Library endpoints (Safe Preview & Generation)
if (appControllers['templateController']) {
  router.route('/template/preview').post(
    rbacMiddleware('template', 'read'),
    catchErrors(appControllers['templateController'].preview)
  );

  router.route('/template/preview/:id').post(
    rbacMiddleware('template', 'read'),
    catchErrors(appControllers['templateController'].preview)
  );

  router.route('/template/generate/:id').post(
    rbacMiddleware('template', 'read'),
    catchErrors(appControllers['templateController'].generate)
  );
}

// Dedicated IT & Digital Admin endpoints (Renewals & Reminders)
if (appControllers['digitalServiceController']) {
  router.route('/digitalservice/reminders').get(
    rbacMiddleware('digitalservice', 'read'),
    catchErrors(appControllers['digitalServiceController'].reminders)
  );

  router.route('/digitalservice/renew/:id').post(
    rbacMiddleware('digitalservice', 'update'),
    catchErrors(appControllers['digitalServiceController'].renew)
  );
}

// Dedicated Google Calendar & Google Meet Integration endpoints
const gCalController = appControllers['googleCalendarController'] || appControllers['outlookController'];
if (gCalController) {
  // Primary Google Calendar Routes
  router.route('/google/status').get(rbacMiddleware('calendar', 'read'), catchErrors(gCalController.getStatus));
  router.route('/google/auth-url').get(rbacMiddleware('calendar', 'read'), catchErrors(gCalController.getAuthUrl));
  router.route('/google/connect').post(rbacMiddleware('calendar', 'create'), catchErrors(gCalController.connect));
  router.route('/google/reconnect').post(rbacMiddleware('calendar', 'update'), catchErrors(gCalController.reconnect || gCalController.connect));
  router.route('/google/disconnect').post(rbacMiddleware('calendar', 'update'), catchErrors(gCalController.disconnect));
  router.route('/google/sync').post(rbacMiddleware('calendar', 'update'), catchErrors(gCalController.syncEvents));
  router.route('/google/events').get(rbacMiddleware('calendar', 'read'), catchErrors(gCalController.getEvents));
  router.route('/google/event').post(rbacMiddleware('calendar', 'create'), catchErrors(gCalController.createEvent));
  router.route('/google/event/:id').delete(rbacMiddleware('calendar', 'delete'), catchErrors(gCalController.deleteEvent || gCalController.disconnect));

  // Legacy / Outlook compatibility aliases
  router.route('/outlook/status').get(rbacMiddleware('calendar', 'read'), catchErrors(gCalController.getStatus));
  router.route('/outlook/auth-url').get(rbacMiddleware('calendar', 'read'), catchErrors(gCalController.getAuthUrl));
  router.route('/outlook/connect').post(rbacMiddleware('calendar', 'create'), catchErrors(gCalController.connect));
  router.route('/outlook/reconnect').post(rbacMiddleware('calendar', 'update'), catchErrors(gCalController.reconnect || gCalController.connect));
  router.route('/outlook/disconnect').post(rbacMiddleware('calendar', 'update'), catchErrors(gCalController.disconnect));
  router.route('/outlook/sync').post(rbacMiddleware('calendar', 'update'), catchErrors(gCalController.syncEvents));
  router.route('/outlook/events').get(rbacMiddleware('calendar', 'read'), catchErrors(gCalController.getEvents));
  router.route('/outlook/event').post(rbacMiddleware('calendar', 'create'), catchErrors(gCalController.createEvent));
}

// Dedicated Notification Center endpoints (Phase 19)
if (appControllers['notificationController']) {
  router.route('/notification/list').get(
    rbacMiddleware('notification', 'read'),
    catchErrors(appControllers['notificationController'].list)
  );

  router.route('/notification/unread-count').get(
    rbacMiddleware('notification', 'read'),
    catchErrors(appControllers['notificationController'].unreadCount)
  );

  router.route('/notification/read/:id').patch(
    rbacMiddleware('notification', 'update'),
    catchErrors(appControllers['notificationController'].markRead)
  );

  router.route('/notification/read-all').patch(
    rbacMiddleware('notification', 'update'),
    catchErrors(appControllers['notificationController'].markAllRead)
  );

  router.route('/notification/clear-all').delete(
    rbacMiddleware('notification', 'delete'),
    catchErrors(appControllers['notificationController'].clearAll)
  );

  router.route('/notification/delete/:id').delete(
    rbacMiddleware('notification', 'delete'),
    catchErrors(appControllers['notificationController'].delete)
  );

  router.route('/notification/preferences').get(
    rbacMiddleware('notification', 'read'),
    catchErrors(appControllers['notificationController'].getPreferences)
  );

  router.route('/notification/preferences').patch(
    rbacMiddleware('notification', 'update'),
    catchErrors(appControllers['notificationController'].updatePreferences)
  );

  router.route('/notification/trigger').post(
    rbacMiddleware('notification', 'create'),
    catchErrors(appControllers['notificationController'].trigger)
  );
}

// Dedicated GitHub Integration endpoints for TecMotiv Engineering Projects
if (appControllers['githubController']) {
  const { githubProxyLimiter, githubSyncLimiter } = require('../../middlewares/githubRateLimiter');

  router.route('/github/project/:projectId/link').post(
    rbacMiddleware('project', 'update'),
    catchErrors(appControllers['githubController'].linkRepository)
  );

  router.route('/github/project/:projectId/unlink').post(
    rbacMiddleware('project', 'update'),
    catchErrors(appControllers['githubController'].unlinkRepository)
  );

  router.route('/github/project/:projectId/overview').get(
    rbacMiddleware('project', 'read'),
    githubProxyLimiter,
    catchErrors(appControllers['githubController'].getRepositoryOverview)
  );

  router.route('/github/project/:projectId/commits').get(
    rbacMiddleware('project', 'read'),
    githubProxyLimiter,
    catchErrors(appControllers['githubController'].getCommits)
  );

  router.route('/github/project/:projectId/pulls').get(
    rbacMiddleware('project', 'read'),
    githubProxyLimiter,
    catchErrors(appControllers['githubController'].getPullRequests)
  );

  router.route('/github/project/:projectId/issues').get(
    rbacMiddleware('project', 'read'),
    githubProxyLimiter,
    catchErrors(appControllers['githubController'].getIssues)
  );

  router.route('/github/project/:projectId/branches').get(
    rbacMiddleware('project', 'read'),
    githubProxyLimiter,
    catchErrors(appControllers['githubController'].getBranches)
  );

  router.route('/github/project/:projectId/sync').post(
    rbacMiddleware('project', 'update'),
    githubSyncLimiter,
    catchErrors(appControllers['githubController'].syncRepository)
  );

  router.route('/github/project/:projectId/activity').get(
    rbacMiddleware('project', 'read'),
    githubProxyLimiter,
    catchErrors(appControllers['githubController'].getActivity)
  );
}

module.exports = router;



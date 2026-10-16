const { ROLES, normalizeRole } = require('./roles');

const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  SEARCH: 'search',
  FILTER: 'filter',
  SUMMARY: 'summary',
};

const ALL_ACTIONS = Object.values(ACTIONS);
const READ_ACTIONS = [ACTIONS.READ, ACTIONS.LIST, ACTIONS.SEARCH, ACTIONS.FILTER, ACTIONS.SUMMARY];

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: {
    '*': ALL_ACTIONS,
  },

  [ROLES.HR]: {
    employee: ALL_ACTIONS,
    department: ALL_ACTIONS,
    designation: ALL_ACTIONS,
    location: ALL_ACTIONS,
    document: ALL_ACTIONS,
    attendance: ALL_ACTIONS,
    leave: ALL_ACTIONS,
    leavebalance: ALL_ACTIONS,
    salary: ALL_ACTIONS,
    payroll: ALL_ACTIONS,
    policy: ALL_ACTIONS,
    announcement: ALL_ACTIONS,
    bulletin: ALL_ACTIONS,
    template: ALL_ACTIONS,
    calendar: ALL_ACTIONS,
    task: ALL_ACTIONS,
    project: ALL_ACTIONS,
    admin: [ACTIONS.READ, ACTIONS.LIST], // directory read
  },

  [ROLES.EMPLOYEE]: {
    employee: [ACTIONS.READ, ACTIONS.UPDATE],
    department: READ_ACTIONS,
    designation: READ_ACTIONS,
    location: READ_ACTIONS,
    project: READ_ACTIONS,
    attendance: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.LIST, ACTIONS.SUMMARY],
    leave: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.LIST, ACTIONS.SUMMARY],
    leavebalance: [ACTIONS.READ, ACTIONS.LIST, ACTIONS.SUMMARY],
    salary: [ACTIONS.READ, ACTIONS.LIST],
    asset: [ACTIONS.READ, ACTIONS.LIST],
    task: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.LIST, ACTIONS.SEARCH, ACTIONS.FILTER, ACTIONS.SUMMARY],
    calendar: [...READ_ACTIONS, ACTIONS.CREATE],
    policy: [...READ_ACTIONS, ACTIONS.UPDATE],
    announcement: READ_ACTIONS,
    bulletin: [...READ_ACTIONS, ACTIONS.UPDATE],
    template: READ_ACTIONS,
    recognition: [ACTIONS.READ, ACTIONS.LIST],
     document: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.LIST, ACTIONS.SEARCH, ACTIONS.FILTER, ACTIONS.SUMMARY],
    admin: [ACTIONS.READ, ACTIONS.UPDATE], // own profile
  },
};

const isActionAllowed = (rawRole, resource, action) => {
  const role = normalizeRole(rawRole);
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;

  // Admin has universal wildcard
  if (permissions['*']) return true;

  const resKey = resource.toLowerCase();
  if (resKey === 'dashboard') return true;

  // Notifications & preferences are accessed through dedicated self-scoped
  // endpoints (/notification/*, /notification/preferences). The generic CRUD
  // entity routes are additionally guarded by ownership checks in
  // rbacMiddleware, so they stay restricted to explicit rules below.
  if (resKey === 'notification') {
    return ALL_ACTIONS.includes(action.toLowerCase()) || action.toLowerCase() === 'listall';
  }
  if (resKey === 'notificationpreference') {
    return ['read', 'update', 'list', 'listall', 'summary', 'filter', 'search'].includes(
      action.toLowerCase()
    );
  }
  // The raw integration document stores OAuth tokens - never expose it through
  // generic CRUD routes. Only admin may administer it.
  if (resKey === 'outlookintegration') {
    return role === ROLES.ADMIN;
  }
  if (resKey === 'recognition') {
    // Recognition is delivered by the external Shoutout application. The
    // legacy entity remains readable but is not creatable via generic CRUD.
    return ['read', 'list', 'listall', 'search', 'filter', 'summary'].includes(
      action.toLowerCase()
    );
  }
  if (resKey === 'event' || resKey === 'outlook') {
    const calendarAllowed = isActionAllowed(role, 'calendar', action);
    if (calendarAllowed) return true;
  }

  // Project updates: allow at matrix level so that Project Managers (who are employees)
  // can update and manage their projects (fine-grained PM check is strictly enforced in rbacMiddleware).
  if (resKey === 'project' && action.toLowerCase() === 'update') {
    return true;
  }

  const resourceRules = permissions[resKey];
  if (!resourceRules) return false;

  if (resourceRules.includes('*') || resourceRules.includes(action.toLowerCase())) {
    return true;
  }

  // listAll maps to list
  if (action.toLowerCase() === 'listall' && resourceRules.includes(ACTIONS.LIST)) {
    return true;
  }

  return false;
};

module.exports = {
  ACTIONS,
  ALL_ACTIONS,
  READ_ACTIONS,
  ROLE_PERMISSIONS,
  isActionAllowed,
};

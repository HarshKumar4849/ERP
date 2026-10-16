export const ROLES = {
  ADMIN: 'ADMIN',
  HR: 'HR',
  EMPLOYEE: 'EMPLOYEE',
  // Backward-compatibility aliases for legacy code references
  MANAGEMENT: 'ADMIN',
  FINANCE: 'EMPLOYEE',
  DEPARTMENT_HEAD: 'EMPLOYEE',
};

// Normalize role string into exactly three effective categories: ADMIN, HR, EMPLOYEE
export const normalizeRole = (role) => {
  if (!role) return ROLES.EMPLOYEE;
  const upper = String(role).toUpperCase().trim();

  // 1. ADMIN (Admin, Operations Manager, Management, Owner, Super Admin)
  if (
    upper === 'ADMIN' ||
    upper === 'OPERATIONS_MANAGER' ||
    upper === 'MANAGEMENT' ||
    upper === 'OWNER' ||
    upper === 'SUPER_ADMIN'
  ) {
    return ROLES.ADMIN;
  }

  // 2. HR (HR, HR Manager, HR Executive, Human Resources, etc.)
  if (
    upper === 'HR' ||
    upper === 'HR_MANAGER' ||
    upper === 'HR MANAGER' ||
    upper === 'HR EXECUTIVE' ||
    upper === 'HR_EXECUTIVE' ||
    upper === 'HUMAN RESOURCES' ||
    upper === 'HUMAN_RESOURCES' ||
    upper.startsWith('HR')
  ) {
    return ROLES.HR;
  }

  // 3. EMPLOYEE (All other users: Finance, Dept Heads, Developers, IT, Marketing, etc.)
  return ROLES.EMPLOYEE;
};

// Module keys mapped to allowed roles in the 3-tier model
export const MODULE_PERMISSIONS = {
  dashboard: [ROLES.ADMIN, ROLES.HR, ROLES.EMPLOYEE],
  employees: [ROLES.ADMIN, ROLES.HR],
  attendance: [ROLES.ADMIN, ROLES.HR, ROLES.EMPLOYEE],
  leave: [ROLES.ADMIN, ROLES.HR, ROLES.EMPLOYEE],
  tasks: [ROLES.ADMIN, ROLES.HR, ROLES.EMPLOYEE],
  projects: [ROLES.ADMIN, ROLES.HR, ROLES.EMPLOYEE],
  payroll: [ROLES.ADMIN, ROLES.HR, ROLES.EMPLOYEE],
  documents: [ROLES.ADMIN, ROLES.HR, ROLES.EMPLOYEE],
  calendar: [ROLES.ADMIN, ROLES.HR, ROLES.EMPLOYEE],
  events: [ROLES.ADMIN, ROLES.HR, ROLES.EMPLOYEE],
  recognition: [ROLES.ADMIN, ROLES.HR, ROLES.EMPLOYEE],
  bulletin: [ROLES.ADMIN, ROLES.HR, ROLES.EMPLOYEE],
  policies: [ROLES.ADMIN, ROLES.HR, ROLES.EMPLOYEE],
  admin: [ROLES.ADMIN],
  templates: [ROLES.ADMIN, ROLES.HR],
  itadmin: [ROLES.ADMIN],
  digitalservice: [ROLES.ADMIN],
  settings: [ROLES.ADMIN],
};

export const canAccessModule = (userRole, moduleKey) => {
  const role = normalizeRole(userRole);
  if (role === ROLES.ADMIN) return true; // ADMIN has organization-wide access

  const allowedRoles = MODULE_PERMISSIONS[moduleKey.toLowerCase()];
  if (!allowedRoles) return false;

  return allowedRoles.includes(role);
};

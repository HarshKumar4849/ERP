const ROLES = {
  ADMIN: 'ADMIN',
  HR: 'HR',
  EMPLOYEE: 'EMPLOYEE',
  // Backward-compatibility aliases for legacy code references
  MANAGEMENT: 'ADMIN',
  FINANCE: 'EMPLOYEE',
  DEPARTMENT_HEAD: 'EMPLOYEE',
};

// Normalize legacy or alternate casing into exactly three effective roles: ADMIN, HR, EMPLOYEE
const normalizeRole = (role) => {
  if (!role) return ROLES.EMPLOYEE;
  const upper = String(role).toUpperCase().trim();

  // 1. ADMIN mappings (Admin, Operations Manager, Management, Owner, Super Admin)
  if (
    upper === 'ADMIN' ||
    upper === 'OPERATIONS_MANAGER' ||
    upper === 'MANAGEMENT' ||
    upper === 'OWNER' ||
    upper === 'SUPER_ADMIN'
  ) {
    return ROLES.ADMIN;
  }

  // 2. HR mappings (HR, HR Manager, HR Executive, Human Resources, etc.)
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

  // 3. EMPLOYEE mappings (All other users: Finance, Dept Heads, IT, Marketing, Devs, etc.)
  return ROLES.EMPLOYEE;
};

module.exports = {
  ROLES,
  normalizeRole,
};

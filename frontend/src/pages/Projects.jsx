import React from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { normalizeRole } from '@/utils/rbac';
import ProjectDashboard from '@/modules/ProjectModule';

export default function Projects() {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const userRole = normalizeRole(currentAdmin?.role);

  return (
    <div style={{ padding: '0 8px 32px' }}>
      <ProjectDashboard userRole={userRole} currentAdmin={currentAdmin} />
    </div>
  );
}

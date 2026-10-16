import React from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { normalizeRole } from '@/utils/rbac';
import { DigitalAdminDashboard } from '@/modules/DigitalAdminModule';

export default function ItAdmin() {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const userRole = normalizeRole(currentAdmin?.role);

  return (
    <div style={{ padding: '0 8px 32px' }}>
      <DigitalAdminDashboard userRole={userRole} currentAdmin={currentAdmin} />
    </div>
  );
}

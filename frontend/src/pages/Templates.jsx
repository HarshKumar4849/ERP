import React from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { normalizeRole } from '@/utils/rbac';
import { TemplateLibrary } from '@/modules/TemplateModule';

export default function Templates() {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const userRole = normalizeRole(currentAdmin?.role);

  return (
    <div style={{ padding: '0 8px 32px' }}>
      <TemplateLibrary userRole={userRole} />
    </div>
  );
}

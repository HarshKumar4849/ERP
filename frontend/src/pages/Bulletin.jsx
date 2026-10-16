import React from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { normalizeRole } from '@/utils/rbac';
import BulletinFeed from '@/modules/BulletinModule';

export default function Bulletin() {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const userRole = normalizeRole(currentAdmin?.role);

  return (
    <div style={{ padding: '0 8px 32px' }}>
      <BulletinFeed userRole={userRole} currentAdmin={currentAdmin} />
    </div>
  );
}

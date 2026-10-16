import { useLayoutEffect } from 'react';
import { useEffect } from 'react';
import { selectAppSettings } from '@/redux/settings/selectors';
import { useDispatch, useSelector } from 'react-redux';

import { Layout } from 'antd';

import { useAppContext } from '@/context/appContext';

import Navigation from '@/apps/Navigation/NavigationContainer';

import HeaderContent from '@/apps/Header/HeaderContainer';
import PageLoader from '@/components/PageLoader';

import { settingsAction } from '@/redux/settings/actions';

import { selectSettings } from '@/redux/settings/selectors';

import AppRouter from '@/router/AppRouter';

import useResponsive from '@/hooks/useResponsive';

import storePersist from '@/redux/storePersist';

import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { normalizeRole, ROLES } from '@/utils/rbac';

export default function ErpCrmApp() {
  const { Content } = Layout;
  const { isMobile } = useResponsive();
  const dispatch = useDispatch();

  const currentAdmin = useSelector(selectCurrentAdmin);
  const rawRole = currentAdmin?.role || 'EMPLOYEE';
  const role = normalizeRole(rawRole);
  const canFetchSettings = role === ROLES.ADMIN;

  useEffect(() => {
    if (canFetchSettings) {
      dispatch(settingsAction.list({ entity: 'setting' }));
    }
  }, [canFetchSettings, dispatch]);

  return (
    <Layout hasSider style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Navigation />

      <Layout style={{ minHeight: '100vh', background: '#f8fafc', minWidth: 0 }}>
        <HeaderContent />
        <Content
          style={{
            margin: isMobile ? '16px auto 24px' : '24px auto 32px',
            overflow: 'initial',
            width: '100%',
            padding: isMobile ? '0 12px' : '0 24px',
            maxWidth: 1440,
            minWidth: 0,
          }}
        >
          <AppRouter />
        </Content>
      </Layout>
    </Layout>
  );
}

import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Drawer, Layout, Menu } from 'antd';
import { useSelector } from 'react-redux';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { canAccessModule } from '@/utils/rbac';

import { useAppContext } from '@/context/appContext';

import useLanguage from '@/locale/useLanguage';
import logoIcon from '@/style/images/logo-icon.svg';

import useResponsive from '@/hooks/useResponsive';
import { SHOUTOUT_URL } from '@/config/serverApiConfig';

import {
  DashboardOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CoffeeOutlined,
  CheckSquareOutlined,
  ProjectOutlined,
  DollarOutlined,
  CalendarOutlined,
  GiftOutlined,
  TrophyOutlined,
  NotificationOutlined,
  FileProtectOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  CloudOutlined,
  SettingOutlined,
  MenuOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

export default function Navigation() {
  const { isMobile } = useResponsive();

  return isMobile ? <MobileSidebar /> : <Sidebar collapsible={false} />;
}

function Sidebar({ collapsible, isMobile = false, onNavigate }) {
  let location = useLocation();

  const { state: stateApp, appContextAction } = useAppContext();
  const { isNavMenuClose } = stateApp;
  const { navMenu } = appContextAction;
  const [showLogoApp, setLogoApp] = useState(isNavMenuClose);
  const [currentPath, setCurrentPath] = useState(location.pathname.slice(1) || 'dashboard');

  const translate = useLanguage();
  const navigate = useNavigate();

  const currentAdmin = useSelector(selectCurrentAdmin);
  const userRole = currentAdmin?.role || 'EMPLOYEE';

  const handleItemClick = (path, isExternal = false, externalUrl = null) => {
    if (onNavigate) {
      onNavigate();
    }
    if (isExternal && externalUrl) {
      window.location.href = externalUrl;
    } else if (path) {
      navigate(path);
    }
  };

  const items = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: <Link to={'/'} onClick={() => onNavigate && onNavigate()}>{translate('Dashboard')}</Link>,
    },
    {
      key: 'employees',
      icon: <TeamOutlined />,
      label: <Link to={'/employees'} onClick={() => onNavigate && onNavigate()}>{translate('Employees')}</Link>,
    },
    {
      key: 'attendance',
      icon: <ClockCircleOutlined />,
      label: <Link to={'/attendance'} onClick={() => onNavigate && onNavigate()}>{translate('Attendance')}</Link>,
    },
    {
      key: 'leave',
      icon: <CoffeeOutlined />,
      label: <Link to={'/leave'} onClick={() => onNavigate && onNavigate()}>{translate('Leave')}</Link>,
    },
    {
      key: 'tasks',
      icon: <CheckSquareOutlined />,
      label: <Link to={'/tasks'} onClick={() => onNavigate && onNavigate()}>{translate('Tasks')}</Link>,
    },
    {
      key: 'projects',
      icon: <ProjectOutlined />,
      label: <Link to={'/projects'} onClick={() => onNavigate && onNavigate()}>{translate('Projects')}</Link>,
    },
    {
      key: 'payroll',
      icon: <DollarOutlined />,
      label: <Link to={'/payroll'} onClick={() => onNavigate && onNavigate()}>{translate('Payroll')}</Link>,
    },
    {
      key: 'documents',
      icon: <FileProtectOutlined />,
      label: <Link to={'/documents'} onClick={() => onNavigate && onNavigate()}>{translate('Document Vault')}</Link>,
    },
    {
      key: 'calendar',
      icon: <CalendarOutlined />,
      label: <Link to={'/calendar'} onClick={() => onNavigate && onNavigate()}>{translate('Calendar')}</Link>,
    },
    {
      key: 'events',
      icon: <GiftOutlined />,
      label: <Link to={'/events'} onClick={() => onNavigate && onNavigate()}>{translate('Events & Celebrations')}</Link>,
    },
    {
      key: 'recognition',
      icon: <TrophyOutlined />,
      label: (
        <a href={SHOUTOUT_URL} rel="noopener noreferrer">
          {translate('Recognition')}
        </a>
      ),
      onClick: () => {
        if (onNavigate) onNavigate();
        window.location.href = SHOUTOUT_URL;
      },
    },
    {
      key: 'bulletin',
      icon: <NotificationOutlined />,
      label: <Link to={'/bulletin'} onClick={() => onNavigate && onNavigate()}>{translate('Bulletin / News')}</Link>,
    },
    {
      key: 'policies',
      icon: <FileProtectOutlined />,
      label: <Link to={'/policies'} onClick={() => onNavigate && onNavigate()}>{translate('Policies')}</Link>,
    },
    {
      key: 'admin',
      icon: <SafetyCertificateOutlined />,
      label: <Link to={'/admin'} onClick={() => onNavigate && onNavigate()}>{translate('Admin')}</Link>,
    },
    {
      key: 'itadmin',
      icon: <CloudOutlined />,
      label: <Link to={'/it-admin'} onClick={() => onNavigate && onNavigate()}>{translate('IT & Digital Admin')}</Link>,
    },
    {
      key: 'templates',
      icon: <FileTextOutlined />,
      label: <Link to={'/templates'} onClick={() => onNavigate && onNavigate()}>{translate('Templates')}</Link>,
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: <Link to={'/settings'} onClick={() => onNavigate && onNavigate()}>{translate('Settings')}</Link>,
    },
  ];

  useEffect(() => {
    if (location) {
      const path = location.pathname.slice(1);
      if (path === '' || path === '/') {
        setCurrentPath('dashboard');
      } else {
        const primary = path.split('/')[0].replace(/[-_\s]/g, '').toLowerCase();
        setCurrentPath(primary);
      }
    }
  }, [location]);

  useEffect(() => {
    if (isNavMenuClose) {
      setLogoApp(isNavMenuClose);
    }
    const timer = setTimeout(() => {
      if (!isNavMenuClose) {
        setLogoApp(isNavMenuClose);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [isNavMenuClose]);

  const onCollapse = () => {
    navMenu.collapse();
  };

  if (isMobile) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div
          className="logo"
          onClick={() => {
            if (onNavigate) onNavigate();
            navigate('/');
          }}
          style={{
            cursor: 'pointer',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            margin: 0,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <img src={logoIcon} alt="TecMotiv Logo" style={{ height: '32px' }} />
          <div style={{ marginLeft: 12, lineHeight: 1.2 }}>
            <span
              style={{
                fontSize: '17px',
                fontWeight: '800',
                letterSpacing: '0.3px',
                color: '#22242a',
                display: 'block',
              }}
            >
              Tecmotiv
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '0.8px',
                color: '#0097a7',
                textTransform: 'uppercase',
              }}
            >
              Solutions ERP
            </span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Menu
            items={items.filter((item) => canAccessModule(userRole, item.key))}
            mode="inline"
            theme={'light'}
            selectedKeys={[currentPath]}
            style={{
              width: '100%',
              borderRight: 0,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <Sider
      collapsible={collapsible}
      collapsed={collapsible ? isNavMenuClose : collapsible}
      onCollapse={onCollapse}
      className="navigation"
      width={256}
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
        zIndex: 100,
        boxShadow: '1px 0 6px rgba(0,21,41,0.06)',
      }}
      theme={'light'}
    >
      <div
        className="logo"
        onClick={() => navigate('/')}
        style={{
          cursor: 'pointer',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <img src={logoIcon} alt="TecMotiv Logo" style={{ height: '32px' }} />

        {!showLogoApp && (
          <div style={{ marginLeft: 12, lineHeight: 1.2 }}>
            <span
              style={{
                fontSize: '17px',
                fontWeight: '800',
                letterSpacing: '0.3px',
                color: '#22242a',
                display: 'block',
              }}
            >
              Tecmotiv
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '0.8px',
                color: '#0097a7',
                textTransform: 'uppercase',
              }}
            >
              Solutions ERP
            </span>
          </div>
        )}
      </div>
      <Menu
        items={items.filter((item) => canAccessModule(userRole, item.key))}
        mode="inline"
        theme={'light'}
        selectedKeys={[currentPath]}
        style={{
          width: 256,
          borderRight: 0,
        }}
      />
    </Sider>
  );
}

function MobileSidebar() {
  const { state: stateApp, appContextAction } = useAppContext();
  const { isNavMenuClose } = stateApp;
  const { navMenu } = appContextAction;

  // In mobile context, menu is open when isNavMenuClose is false
  const isOpen = !isNavMenuClose;

  const onClose = () => {
    navMenu.close();
  };

  return (
    <Drawer
      width={Math.min(280, typeof window !== 'undefined' ? window.innerWidth * 0.85 : 280)}
      placement={'left'}
      closable={true}
      onClose={onClose}
      open={isOpen}
      styles={{ body: { padding: 0 } }}
      maskClosable={true}
      keyboard={true}
    >
      <Sidebar collapsible={false} isMobile={true} onNavigate={onClose} />
    </Drawer>
  );
}

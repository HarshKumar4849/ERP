import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Dropdown, Layout, Tag, Space, Badge, Button, Tooltip } from 'antd';
import {
  LogoutOutlined,
  ToolOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  ApartmentOutlined,
  BellOutlined,
  MenuOutlined,
} from '@ant-design/icons';

import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { FILE_BASE_URL } from '@/config/serverApiConfig';
import useLanguage from '@/locale/useLanguage';
import { canAccessModule, normalizeRole, ROLES } from '@/utils/rbac';
import { request } from '@/request';
import { NotificationCenterDrawer } from '@/modules/NotificationModule';
import { useAppContext } from '@/context/appContext';
import useResponsive from '@/hooks/useResponsive';
import logoIcon from '@/style/images/logo-icon.svg';
import { getSocket } from '@/utils/socket';

export default function HeaderContent() {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const { Header } = Layout;
  const navigate = useNavigate();

  const { isMobile } = useResponsive();
  const { appContextAction } = useAppContext();
  const { navMenu } = appContextAction;

  const translate = useLanguage();
  const rawRole = currentAdmin?.role || 'EMPLOYEE';
  const role = normalizeRole(rawRole);

  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);

  const fetchUnreadCount = async () => {
    try {
      const res = await request.get({ entity: 'notification/unread-count' });
      if (res && res.success && res.result) {
        setUnreadCount(res.result.count || 0);
      }
    } catch (e) {
      // quiet catch
    }
  };

  useEffect(() => {
    fetchUnreadCount();

    // Setup real-time WebSocket connection
    const socket = getSocket();
    if (socket) {
      const handleUnreadCount = (data) => {
        if (data && typeof data.count === 'number') {
          setUnreadCount(data.count);
        }
      };

      const handleInitialNotifications = (data) => {
        if (data && typeof data.unreadCount === 'number') {
          setUnreadCount(data.unreadCount);
        }
      };

      socket.on('unread-count', handleUnreadCount);
      socket.on('initial-notifications', handleInitialNotifications);

      return () => {
        socket.off('unread-count', handleUnreadCount);
        socket.off('initial-notifications', handleInitialNotifications);
      };
    }

    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [currentAdmin]);

  const getRoleColor = (r) => {
    switch (normalizeRole(r)) {
      case ROLES.ADMIN:
        return 'purple';
      case ROLES.HR:
        return 'magenta';
      case ROLES.EMPLOYEE:
      default:
        return 'blue';
    }
  };

  const ProfileDropdown = () => {
    return (
      <div className="profileDropdown" onClick={() => navigate('/profile')}>
        <Avatar
          size="large"
          className="last"
          src={currentAdmin?.photo ? FILE_BASE_URL + currentAdmin?.photo : undefined}
          style={{
            color: '#1677ff',
            backgroundColor: currentAdmin?.photo ? 'none' : '#e6f4ff',
            boxShadow: 'rgba(22, 119, 255, 0.2) 0px 0px 6px 1px',
          }}
        >
          {currentAdmin?.name?.charAt(0)?.toUpperCase()}
        </Avatar>
        <div className="profileDropdownInfo">
          <p style={{ fontWeight: 600 }}>
            {currentAdmin?.name} {currentAdmin?.surname}
          </p>
          <p style={{ fontSize: 12, color: '#8c8c8c' }}>{currentAdmin?.email}</p>
        </div>
      </div>
    );
  };

  const DropdownMenu = ({ text }) => {
    return <span>{text}</span>;
  };

  const items = [
    {
      label: <ProfileDropdown className="headerDropDownMenu" />,
      key: 'ProfileDropdown',
    },
    {
      type: 'divider',
    },
    {
      icon: <UserOutlined />,
      key: 'settingProfile',
      label: (
        <Link to={'/profile'}>
          <DropdownMenu text={translate('profile_settings')} />
        </Link>
      ),
    },
    ...(canAccessModule(role, 'admin')
      ? [
          {
            icon: <SafetyCertificateOutlined />,
            key: 'adminPanel',
            label: <Link to={'/admin'}>{translate('Admin Panel')}</Link>,
          },
        ]
      : []),
    ...(canAccessModule(role, 'settings')
      ? [
          {
            icon: <ToolOutlined />,
            key: 'settingApp',
            label: <Link to={'/settings'}>{translate('app_settings')}</Link>,
          },
        ]
      : []),
    {
      type: 'divider',
    },
    {
      icon: <LogoutOutlined />,
      key: 'logout',
      label: <Link to={'/logout'}>{translate('logout')}</Link>,
    },
  ];

  return (
    <Header
      style={{
        padding: isMobile ? '10px 16px' : '14px 28px',
        background: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #f0f0f0',
        position: 'sticky',
        top: 0,
        zIndex: 99,
        boxShadow: '0 1px 4px rgba(0,21,41,0.04)',
      }}
    >
      {/* Left side: Hamburger button + Branding on mobile, Organization Title on Desktop */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {isMobile && (
          <Button
            className="mobile-sidebar-btn"
            type="text"
            shape="circle"
            size="large"
            icon={<MenuOutlined style={{ fontSize: 18, color: '#002244' }} />}
            onClick={() => navMenu.open()}
            aria-label="Open navigation menu"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          />
        )}
        {isMobile ? (
          <div
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            <img src={logoIcon} alt="TecMotiv" style={{ height: 26 }} />
            <span style={{ fontWeight: 800, fontSize: 16, color: '#002244', letterSpacing: '0.2px' }}>
              Tecmotiv
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#002244' }}>
              TecMotiv Solutions • Enterprise ERP
            </span>
          </div>
        )}
      </div>

      {/* Right side: Role/Dept, Notification Bell, User Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14 }}>
        <Space size={6} wrap={false} style={{ display: 'flex', alignItems: 'center' }}>
          {!isMobile && currentAdmin?.department && (
            <Tag
              icon={<ApartmentOutlined />}
              color="default"
              style={{ borderRadius: 12, padding: '2px 8px', fontSize: 11, margin: 0 }}
            >
              {currentAdmin.department}
            </Tag>
          )}
          <Tag
            color={getRoleColor(role)}
            style={{ borderRadius: 12, padding: '2px 8px', fontWeight: 600, fontSize: 11, margin: 0 }}
          >
            {normalizeRole(role)}
          </Tag>
        </Space>

        {/* Notification Center Trigger Bell */}
        <Tooltip title="Notifications">
          <Badge count={unreadCount} overflowCount={99} size="small" offset={[-4, 4]}>
            <Button
              type="text"
              shape="circle"
              icon={<BellOutlined style={{ fontSize: 18, color: '#595959' }} />}
              onClick={() => setIsNotificationDrawerOpen(true)}
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: unreadCount > 0 ? '#f0f7ff' : 'transparent',
                border: unreadCount > 0 ? '1px solid #bae0ff' : 'none',
              }}
            />
          </Badge>
        </Tooltip>

        <Dropdown
          menu={{ items }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Avatar
            className="last"
            src={currentAdmin?.photo ? FILE_BASE_URL + currentAdmin?.photo : undefined}
            style={{
              color: '#1677ff',
              backgroundColor: currentAdmin?.photo ? 'none' : '#e6f4ff',
              boxShadow: 'rgba(22, 119, 255, 0.2) 0px 0px 6px 1px',
              cursor: 'pointer',
            }}
            size={isMobile ? 'default' : 'large'}
          >
            {currentAdmin?.name?.charAt(0)?.toUpperCase()}
          </Avatar>
        </Dropdown>
      </div>

      {/* Notification Center Slide-Out Drawer */}
      <NotificationCenterDrawer
        visible={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        onRefreshCount={setUnreadCount}
      />
    </Header>
  );
}

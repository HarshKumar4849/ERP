import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Tabs, Typography, Button, Space, Tag } from 'antd';
import {
  CalendarOutlined,
  UserOutlined,
  TeamOutlined,
  GiftOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  CloudSyncOutlined,
} from '@ant-design/icons';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { normalizeRole, ROLES } from '@/utils/rbac';

import {
  CalendarView,
  CelebrationsManager,
  EventFormModal,
  GoogleCalendarSyncModal,
} from '@/modules/CalendarModule';

const { Title, Text } = Typography;

export default function Calendar() {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const userRole = normalizeRole(currentAdmin?.role);

  const isManagementOrHr =
    userRole === ROLES.HR || userRole === ROLES.ADMIN;

  const [activeTab, setActiveTab] = useState(isManagementOrHr ? 'company' : 'my');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const tabItems = [
    {
      key: 'my',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <UserOutlined style={{ marginRight: 6 }} /> My Calendar
        </span>
      ),
      children: (
        <CalendarView
          key={`my-${refreshKey}`}
          scope="my"
          userRole={userRole}
          onOpenCreateEvent={() => setIsEventModalOpen(true)}
          refreshKey={refreshKey}
        />
      ),
    },
    {
      key: 'company',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <TeamOutlined style={{ marginRight: 6 }} /> Company Calendar
        </span>
      ),
      children: (
        <CalendarView
          key={`company-${refreshKey}`}
          scope="company"
          userRole={userRole}
          onOpenCreateEvent={() => setIsEventModalOpen(true)}
          refreshKey={refreshKey}
        />
      ),
    },
    {
      key: 'celebrations',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <GiftOutlined style={{ marginRight: 6 }} /> Birthdays & Anniversaries
        </span>
      ),
      children: (
        <CelebrationsManager
          key={`celebrations-${refreshKey}`}
          userRole={userRole}
          currentAdmin={currentAdmin}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '0 8px 32px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Company Calendar & Celebrations
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Schedule and track meetings, events, approved leaves, deadlines, client visits, and birthdays.
          </Text>
        </div>

        {/* wrap keeps the sync/create actions inside the header on tablet/mobile */}
        <Space wrap>
          <Tag color="purple" style={{ padding: '4px 10px', borderRadius: 6, fontSize: 13 }}>
            Role: <strong>{userRole}</strong>
          </Tag>
          <Button
            icon={<CloudSyncOutlined style={{ color: '#4285F4' }} />}
            size="large"
            style={{ borderRadius: 8, fontWeight: 600, borderColor: '#4285F4', color: '#4285F4' }}
            onClick={() => setIsGoogleModalOpen(true)}
          >
            Google Calendar & Meet Sync
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            style={{ borderRadius: 8, fontWeight: 600 }}
            onClick={() => setIsEventModalOpen(true)}
          >
            Schedule Event
          </Button>
        </Space>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
        style={{ marginBottom: 16 }}
      />

      {/* Event Creation Modal */}
      <EventFormModal
        visible={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSuccess={handleRefresh}
      />

      {/* Google Calendar & Google Meet Sync Modal */}
      <GoogleCalendarSyncModal
        visible={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}

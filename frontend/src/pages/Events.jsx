import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Tabs, Typography, Button, Space, Tag } from 'antd';
import {
  GiftOutlined,
  CalendarOutlined,
  PlusOutlined,
  TrophyOutlined,
  HistoryOutlined,
  AppstoreOutlined,
  CloudSyncOutlined,
} from '@ant-design/icons';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { normalizeRole } from '@/utils/rbac';

import {
  EventsList,
  EventFormModal,
  EventDetailsDrawer,
  EventInvitationModal,
  EventMediaModal,
  EventReportModal,
  EventHistoryView,
} from '@/modules/EventsModule';

import { CelebrationsManager, CalendarView, OutlookSyncModal } from '@/modules/CalendarModule';

const { Title, Text } = Typography;

export default function Events() {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const userRole = normalizeRole(currentAdmin?.role);

  const [activeTab, setActiveTab] = useState('eventsList');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isOutlookModalOpen, setIsOutlookModalOpen] = useState(false);

  // Modals & Drawers state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedEventForDetails, setSelectedEventForDetails] = useState(null);
  const [invitationEvent, setInvitationEvent] = useState(null);
  const [mediaEvent, setMediaEvent] = useState(null);
  const [reportEvent, setReportEvent] = useState(null);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleOpenCreate = () => {
    setEditingEvent(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (event) => {
    setEditingEvent(event);
    setIsFormModalOpen(true);
    if (selectedEventForDetails) {
      setSelectedEventForDetails(null);
    }
  };

  const handleSelectEvent = (event) => {
    setSelectedEventForDetails(event);
  };

  const tabItems = [
    {
      key: 'eventsList',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <AppstoreOutlined style={{ marginRight: 6 }} /> Events & Celebrations
        </span>
      ),
      children: (
        <EventsList
          key={`events-list-${refreshKey}`}
          userRole={userRole}
          onOpenCreate={handleOpenCreate}
          onSelectEvent={handleSelectEvent}
          onEditEvent={handleOpenEdit}
          onOpenInvitation={(ev) => setInvitationEvent(ev)}
          onOpenMedia={(ev) => setMediaEvent(ev)}
          onOpenReport={(ev) => setReportEvent(ev)}
          refreshKey={refreshKey}
        />
      ),
    },
    {
      key: 'calendar',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <CalendarOutlined style={{ marginRight: 6 }} /> Event Calendar
        </span>
      ),
      children: (
        <CalendarView
          key={`calendar-view-${refreshKey}`}
          scope="company"
          userRole={userRole}
          onOpenCreateEvent={handleOpenCreate}
          refreshKey={refreshKey}
        />
      ),
    },
    {
      key: 'history',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <HistoryOutlined style={{ marginRight: 6 }} /> Event History & Archive
        </span>
      ),
      children: (
        <EventHistoryView
          key={`history-view-${refreshKey}`}
          onSelectEvent={handleSelectEvent}
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
      {/* Header */}
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
          <Title level={2} style={{ margin: 0, color: '#002244' }}>
            Events & Celebrations Hub
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Organize festivals, birthdays, anniversaries, town halls, webinars, recognitions, CSR, and training.
          </Text>
        </div>

        {/* wrap keeps the sync/create actions inside the header on mobile */}
        <Space wrap>
          <Button
            icon={<CloudSyncOutlined style={{ color: '#0078D4' }} />}
            size="large"
            style={{ borderRadius: 8, fontWeight: 600, borderColor: '#0078D4', color: '#0078D4' }}
            onClick={() => setIsOutlookModalOpen(true)}
          >
            Outlook 365 Sync
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            style={{ borderRadius: 8, fontWeight: 600, background: '#002244', borderColor: '#002244' }}
            onClick={handleOpenCreate}
          >
            Create Event
          </Button>
        </Space>
      </div>

      {/* Main Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
        style={{ marginBottom: 16 }}
      />

      {/* Create / Edit Modal */}
      <EventFormModal
        visible={isFormModalOpen}
        eventData={editingEvent}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingEvent(null);
        }}
        onSuccess={handleRefresh}
      />

      {/* Details Slide-out Drawer */}
      <EventDetailsDrawer
        visible={Boolean(selectedEventForDetails)}
        event={selectedEventForDetails}
        onClose={() => setSelectedEventForDetails(null)}
        onEdit={(ev) => handleOpenEdit(ev)}
        onOpenInvitation={(ev) => setInvitationEvent(ev)}
        onOpenMedia={(ev) => setMediaEvent(ev)}
        onOpenReport={(ev) => setReportEvent(ev)}
      />

      {/* Invitations Dispatch Modal */}
      <EventInvitationModal
        visible={Boolean(invitationEvent)}
        event={invitationEvent}
        onClose={() => setInvitationEvent(null)}
        onSuccess={() => {
          handleRefresh();
          if (selectedEventForDetails) {
            setSelectedEventForDetails(null);
          }
        }}
      />

      {/* Media & Attachments Modal */}
      <EventMediaModal
        visible={Boolean(mediaEvent)}
        event={mediaEvent}
        onClose={() => setMediaEvent(null)}
        onSuccess={() => {
          handleRefresh();
          if (selectedEventForDetails) {
            setSelectedEventForDetails(null);
          }
        }}
      />

      {/* Post-Event Report Modal */}
      <EventReportModal
        visible={Boolean(reportEvent)}
        event={reportEvent}
        onClose={() => setReportEvent(null)}
        onSuccess={() => {
          handleRefresh();
          if (selectedEventForDetails) {
            setSelectedEventForDetails(null);
          }
        }}
      />

      {/* Microsoft 365 / Outlook Sync Modal */}
      <OutlookSyncModal
        visible={isOutlookModalOpen}
        onClose={() => setIsOutlookModalOpen(false)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}

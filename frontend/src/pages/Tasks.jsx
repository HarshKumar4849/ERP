import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Tabs, Typography, Button, Space, Tag, Badge } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { normalizeRole, ROLES } from '@/utils/rbac';

import {
  TaskDashboard,
  TaskList,
  TaskDetailDrawer,
  TaskFormModal,
} from '@/modules/TaskModule';

const { Title, Text } = Typography;

export default function Tasks() {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const userRole = normalizeRole(currentAdmin?.role);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  // Drawer & Modal state
  const [selectedTask, setSelectedTask] = useState(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editTaskData, setEditTaskData] = useState(null);

  const isHrOrAdmin = userRole === ROLES.HR || userRole === ROLES.ADMIN;
  const isManagementOrHr = isHrOrAdmin;

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleOpenTaskDetails = (task) => {
    setSelectedTask(task);
    setIsDetailDrawerOpen(true);
  };

  const handleCloseTaskDetails = () => {
    setIsDetailDrawerOpen(false);
    setSelectedTask(null);
  };

  const handleOpenCreateModal = () => {
    setEditTaskData(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (task) => {
    setEditTaskData(task);
    setIsFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setIsFormModalOpen(false);
    setEditTaskData(null);
  };

  const handleFormSuccess = () => {
    handleRefresh();
  };

  const tabItems = [
    {
      key: 'dashboard',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <DashboardOutlined style={{ marginRight: 6 }} /> Task Dashboard
        </span>
      ),
      children: (
        <TaskDashboard
          key={`dashboard-${refreshKey}`}
          onSelectTask={handleOpenTaskDetails}
          onNavigateTab={(tabKey) => setActiveTab(tabKey)}
        />
      ),
    },
    {
      key: 'my',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <UserOutlined style={{ marginRight: 6 }} /> My Tasks
        </span>
      ),
      children: (
        <TaskList
          key={`my-${refreshKey}`}
          scope="my"
          userRole={userRole}
          currentAdmin={currentAdmin}
          onOpenTaskDetails={handleOpenTaskDetails}
          onOpenCreateModal={handleOpenCreateModal}
          onOpenEditModal={handleOpenEditModal}
          refreshKey={refreshKey}
        />
      ),
    },
    ...(isHrOrAdmin
      ? [
          {
            key: 'team',
            label: (
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                <TeamOutlined style={{ marginRight: 6 }} /> Team Tasks
              </span>
            ),
            children: (
              <TaskList
                key={`team-${refreshKey}`}
                scope="team"
                userRole={userRole}
                currentAdmin={currentAdmin}
                onOpenTaskDetails={handleOpenTaskDetails}
                onOpenCreateModal={handleOpenCreateModal}
                onOpenEditModal={handleOpenEditModal}
                refreshKey={refreshKey}
              />
            ),
          },
        ]
      : []),
    {
      key: 'all',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <UnorderedListOutlined style={{ marginRight: 6 }} />{' '}
          {isManagementOrHr ? 'All Tasks' : 'Task Directory'}
        </span>
      ),
      children: (
        <TaskList
          key={`all-${refreshKey}`}
          scope={isManagementOrHr ? 'all' : 'my'}
          userRole={userRole}
          currentAdmin={currentAdmin}
          onOpenTaskDetails={handleOpenTaskDetails}
          onOpenCreateModal={handleOpenCreateModal}
          onOpenEditModal={handleOpenEditModal}
          refreshKey={refreshKey}
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
            Daily Task Tracker
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Assign, coordinate, review, and track operational deliverables and daily duties.
          </Text>
        </div>

        <Space>
          <Tag color="blue" style={{ padding: '4px 10px', borderRadius: 6, fontSize: 13 }}>
            Role: <strong>{userRole}</strong>
          </Tag>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            style={{ borderRadius: 8, fontWeight: 600 }}
            onClick={handleOpenCreateModal}
          >
            Create Task
          </Button>
        </Space>
      </div>

      {/* Tabs Navigation */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
        style={{ marginBottom: 16 }}
      />

      {/* Detail Drawer */}
      <TaskDetailDrawer
        visible={isDetailDrawerOpen}
        onClose={handleCloseTaskDetails}
        taskId={selectedTask?._id}
        onTaskUpdated={handleRefresh}
        onEditTask={(task) => {
          setIsDetailDrawerOpen(false);
          handleOpenEditModal(task);
        }}
      />

      {/* Create / Edit Modal */}
      <TaskFormModal
        visible={isFormModalOpen}
        onClose={handleCloseFormModal}
        initialData={editTaskData}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Tabs, Typography, Space, Tag, Badge } from 'antd';
import {
  CalendarOutlined,
  SolutionOutlined,
  CheckCircleOutlined,
  PieChartOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { normalizeRole, ROLES } from '@/utils/rbac';
import { request } from '@/request';

import LeaveBalanceCards from '@/modules/LeaveModule/LeaveBalanceCards';
import LeaveApplicationsTable from '@/modules/LeaveModule/LeaveApplicationsTable';
import LeaveCalendarView from '@/modules/LeaveModule/LeaveCalendarView';
import LeaveApprovalsQueue from '@/modules/LeaveModule/LeaveApprovalsQueue';

const { Title, Text } = Typography;

export default function Leave() {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const userRole = normalizeRole(currentAdmin?.role);
  const [activeTab, setActiveTab] = useState('applications');
  const [balanceRefreshKey, setBalanceRefreshKey] = useState(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  const isHrOrAdmin = userRole === ROLES.HR || userRole === ROLES.ADMIN;

  const handleRefreshAll = () => {
    setBalanceRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    if (isHrOrAdmin) {
      request
        .get({ entity: 'leave/approvals-queue' })
        .then((res) => {
          if (res?.result) {
            const count = res.result.filter((r) =>
              userRole === ROLES.HR ? r.status === 'Pending HR Approval' : true
            ).length;
            setPendingApprovalsCount(count);
          }
        })
        .catch(() => {});
    }
  }, [userRole, balanceRefreshKey]);

  const tabItems = [
    {
      key: 'applications',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <SolutionOutlined style={{ marginRight: 6 }} /> Leave Applications
        </span>
      ),
      children: (
        <div>
          <LeaveBalanceCards
            key={`cards-${balanceRefreshKey}`}
            currentAdmin={currentAdmin}
            userRole={userRole}
          />
          <LeaveApplicationsTable
            currentAdmin={currentAdmin}
            userRole={userRole}
            onRefreshBalances={handleRefreshAll}
          />
        </div>
      ),
    },
    {
      key: 'calendar',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <CalendarOutlined style={{ marginRight: 6 }} /> Leave Calendar
        </span>
      ),
      children: (
        <LeaveCalendarView
          currentAdmin={currentAdmin}
          userRole={userRole}
        />
      ),
    },
    {
      key: 'balances',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <PieChartOutlined style={{ marginRight: 6 }} /> Leave Balances & Allowances
        </span>
      ),
      children: (
        <LeaveBalanceCards
          key={`bal-tab-${balanceRefreshKey}`}
          currentAdmin={currentAdmin}
          userRole={userRole}
        />
      ),
    },
    ...(isHrOrAdmin
      ? [
          {
            key: 'approvals',
            label: (
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                <CheckCircleOutlined style={{ marginRight: 6 }} />
                Leave Approvals Queue{' '}
                {pendingApprovalsCount > 0 && (
                  <Badge
                    count={pendingApprovalsCount}
                    style={{ backgroundColor: '#2563eb', marginLeft: 4 }}
                  />
                )}
              </span>
            ),
            children: (
              <LeaveApprovalsQueue
                currentAdmin={currentAdmin}
                userRole={userRole}
                onApprovalDone={handleRefreshAll}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* HEADER SECTION */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Space align="center" size={10}>
            <Title level={3} style={{ margin: 0, color: '#002244', fontWeight: 700 }}>
              Leave Management
            </Title>
            <Tag color="blue" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4 }}>
              Phase 6
            </Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 4 }}>
            Multi-stage employee time off requests, quota balance tracking, manager & HR approvals, and calendar synchronization.
          </Text>
        </div>

        <div>
          <Space orientation="horizontal" size={8}>
            <Tag icon={<SafetyOutlined />} color="geekblue" style={{ fontSize: 12, padding: '4px 10px' }}>
              Role: {userRole}
            </Tag>
            {currentAdmin?.department && (
              <Tag color="purple" style={{ fontSize: 12, padding: '4px 10px' }}>
                Dept: {currentAdmin.department}
              </Tag>
            )}
          </Space>
        </div>
      </div>

      {/* TABS CONTAINER */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        size="large"
        items={tabItems}
        style={{
          background: 'transparent',
        }}
      />
    </div>
  );
}

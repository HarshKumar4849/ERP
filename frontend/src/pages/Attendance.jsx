import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Tabs, Typography, Space, Tag } from 'antd';
import {
  ClockCircleOutlined,
  TableOutlined,
  CalendarOutlined,
  BarChartOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { normalizeRole, ROLES } from '@/utils/rbac';

import DailyLoginDashboard from '@/modules/AttendanceModule/DailyLoginDashboard';
import AttendanceRecordsTable from '@/modules/AttendanceModule/AttendanceRecordsTable';
import MonthlyAttendanceView from '@/modules/AttendanceModule/MonthlyAttendanceView';
import AttendanceReportsView from '@/modules/AttendanceModule/AttendanceReportsView';

const { Title, Text } = Typography;

export default function Attendance() {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const userRole = normalizeRole(currentAdmin?.role);
  const [activeTab, setActiveTab] = useState('daily');

  const tabItems = [
    {
      key: 'daily',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <ClockCircleOutlined style={{ marginRight: 6 }} /> Daily Login Dashboard
        </span>
      ),
      children: (
        <DailyLoginDashboard
          currentAdmin={currentAdmin}
          userRole={userRole}
          onNavigateToRecords={() => setActiveTab('records')}
        />
      ),
    },
    {
      key: 'records',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <TableOutlined style={{ marginRight: 6 }} /> Attendance Records
        </span>
      ),
      children: (
        <AttendanceRecordsTable
          currentAdmin={currentAdmin}
          userRole={userRole}
        />
      ),
    },
    {
      key: 'monthly',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <CalendarOutlined style={{ marginRight: 6 }} /> Monthly Attendance
        </span>
      ),
      children: (
        <MonthlyAttendanceView
          currentAdmin={currentAdmin}
          userRole={userRole}
        />
      ),
    },
    {
      key: 'reports',
      label: (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          <BarChartOutlined style={{ marginRight: 6 }} /> Attendance Reports
        </span>
      ),
      children: (
        <AttendanceReportsView
          currentAdmin={currentAdmin}
          userRole={userRole}
        />
      ),
    },
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
              Attendance & Daily Login
            </Title>
            <Tag color="cyan" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4 }}>
              Phase 5
            </Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 4 }}>
            Real-time clock-in/out, multi-mode work tracking, monthly compliance audits, and attendance reports.
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

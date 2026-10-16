import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  DatePicker,
  Select,
  Typography,
  Space,
  Badge,
  Tag,
  Tooltip,
  Spin,
  Button,
} from 'antd';
import {
  CalendarOutlined,
  FilterOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';
import { ROLES } from '@/utils/rbac';

const { Title, Text } = Typography;

export default function LeaveCalendarView({ currentAdmin, userRole }) {
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [selectedDept, setSelectedDept] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);

  const isHrOrAdmin = userRole === ROLES.HR || userRole === ROLES.ADMIN;

  useEffect(() => {
    const fetchDepts = async () => {
      if (isHrOrAdmin) {
        try {
          const res = await request.listAll({ entity: 'department' });
          if (res?.success) setDepartments(res.result || []);
        } catch (err) {
          console.error(err);
        }
      }
    };
    fetchDepts();
  }, [userRole]);

  const fetchCalendarLeaves = async () => {
    setLoading(true);
    try {
      const year = selectedMonth.year();
      const month = selectedMonth.month() + 1;

      let query = `year=${year}&month=${month}`;
      if (selectedDept) query += `&department=${encodeURIComponent(selectedDept)}`;

      const res = await request.get({ entity: `leave/calendar?${query}` });
      setLeaves(res?.result || []);
    } catch (err) {
      console.error('Failed to load leave calendar', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarLeaves();
  }, [selectedMonth, selectedDept]);

  // Map leaves by day of the selected month
  const leavesByDay = {};
  leaves.forEach((l) => {
    const from = dayjs(l.fromDate || l.startDate);
    const to = dayjs(l.toDate || l.endDate);
    const fromVal = from.startOf('day').valueOf();
    const toVal = to.endOf('day').valueOf();

    const daysInCurMonth = selectedMonth.daysInMonth();
    for (let day = 1; day <= daysInCurMonth; day++) {
      const curDate = selectedMonth.date(day);
      const curVal = curDate.startOf('day').valueOf();
      if (curVal >= fromVal && curVal <= toVal) {
        if (!leavesByDay[day]) leavesByDay[day] = [];
        leavesByDay[day].push(l);
      }
    }
  });

  // Calendar cells
  const daysInMonth = selectedMonth.daysInMonth();
  const firstDayOfWeek = selectedMonth.startOf('month').day();

  const daysGrid = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    daysGrid.push({ isEmpty: true, key: `empty-${i}` });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const curDate = selectedMonth.date(day);
    const dayOfWeek = curDate.day();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayLeaves = leavesByDay[day] || [];

    daysGrid.push({
      isEmpty: false,
      day,
      date: curDate,
      isWeekend,
      leaves: dayLeaves,
      key: `day-${day}`,
    });
  }

  const getLeaveColor = (type) => {
    const map = {
      'Casual Leave': '#0284c7',
      'Sick Leave': '#ef4444',
      'Earned/Privilege Leave': '#d97706',
      'Compensatory Off': '#10B981',
      'Half Day': '#8b5cf6',
      'Work From Home': '#2563eb',
      'Unpaid Leave': '#64748b',
      Other: '#4b5563',
    };
    return map[type] || '#002244';
  };

  return (
    <Card
      bordered={false}
      style={{
        borderRadius: 16,
        boxShadow: '0 8px 24px rgba(0, 34, 68, 0.08)',
      }}
    >
      {/* HEADER CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#002244' }}>
            Annual & Monthly Leave Calendar
          </Title>
          <Text type="secondary">
            Visual overview of team coverage, planned leaves, and department availability.
          </Text>
        </div>

        <Space orientation="horizontal" size={10} wrap>
          {isHrOrAdmin && (
            <Select
              placeholder="All Departments"
              style={{ width: 180 }}
              value={selectedDept}
              onChange={setSelectedDept}
              allowClear
            >
              {departments.map((d) => (
                <Select.Option key={d.name} value={d.name}>
                  {d.name}
                </Select.Option>
              ))}
            </Select>
          )}

          <DatePicker
            picker="month"
            value={selectedMonth}
            onChange={(val) => val && setSelectedMonth(val)}
            allowClear={false}
            style={{ width: 160 }}
          />
        </Space>
      </div>

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <Spin tip="Rendering calendar view..." />
        </div>
      ) : (
        <div>
          {/* Weekday Labels Header */}
          <Row gutter={[8, 8]} style={{ marginBottom: 8, textAlign: 'center' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, idx) => (
              <Col span={3} key={d} style={{ flex: '1 1 14.28%' }}>
                <Text strong style={{ color: idx === 0 || idx === 6 ? '#94a3b8' : '#002244' }}>
                  {d}
                </Text>
              </Col>
            ))}
          </Row>

          {/* Calendar Grid Cells */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {daysGrid.map((item) => {
              if (item.isEmpty) {
                return (
                  <div
                    key={item.key}
                    style={{
                      flex: '1 1 calc(14.28% - 8px)',
                      minHeight: 100,
                      background: '#f8fafc',
                      borderRadius: 8,
                      border: '1px dashed #e2e8f0',
                    }}
                  />
                );
              }

              return (
                <div
                  key={item.key}
                  style={{
                    flex: '1 1 calc(14.28% - 8px)',
                    minHeight: 100,
                    background: item.isWeekend ? '#f8fafc' : '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 6,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: item.isWeekend ? '#94a3b8' : '#002244' }}>
                      {item.day}
                    </span>
                    {item.leaves.length > 0 && (
                      <Badge count={item.leaves.length} style={{ backgroundColor: '#002244', fontSize: 10 }} />
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', maxHeight: 75 }}>
                    {item.leaves.map((l) => {
                      const empName = l.employee?.name ? `${l.employee.name} ${l.employee.surname || ''}`.trim() : 'Employee';
                      const color = getLeaveColor(l.leaveType);
                      return (
                        <Tooltip
                          key={l._id}
                          title={`${empName} • ${l.leaveType} (${l.status}) - "${l.reason}"`}
                        >
                          <div
                            style={{
                              background: color,
                              color: '#fff',
                              fontSize: 10,
                              borderRadius: 4,
                              padding: '2px 5px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            {empName.split(' ')[0]}: {l.leaveType}
                          </div>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

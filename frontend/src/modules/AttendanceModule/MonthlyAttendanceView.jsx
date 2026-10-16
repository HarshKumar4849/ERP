import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  DatePicker,
  Select,
  Typography,
  Space,
  Statistic,
  Tag,
  Spin,
  Tooltip,
  Badge,
  Avatar,
  Table,
} from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  HomeOutlined,
  ClockCircleOutlined,
  FieldTimeOutlined,
  WarningOutlined,
  HourglassOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';
import { ROLES } from '@/utils/rbac';

const { Title, Text, Paragraph } = Typography;

export default function MonthlyAttendanceView({ currentAdmin, userRole }) {
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [monthlyData, setMonthlyData] = useState(null);

  const isHrOrAdmin = userRole === ROLES.HR || userRole === ROLES.ADMIN;

  // Load employee list for dropdown (HR / Admin)
  useEffect(() => {
    const fetchEmployees = async () => {
      if (isHrOrAdmin) {
        try {
          const res = await request.listAll({ entity: 'employee' });
          if (res?.success) {
            let list = res.result || [];
            setEmployees(list);
            if (list.length > 0 && !selectedEmployee) {
              setSelectedEmployee(list[0]._id);
            }
          }
        } catch (err) {
          console.error('Failed to fetch employees', err);
        }
      }
    };
    fetchEmployees();
  }, [userRole]);

  const fetchMonthlyCalculations = async () => {
    setLoading(true);
    try {
      const year = selectedMonth.year();
      const month = selectedMonth.month() + 1; // 1-12

      let query = `year=${year}&month=${month}`;
      if (isHrOrAdmin && selectedEmployee) {
        query += `&employee=${selectedEmployee}`;
      }

      // fetch monthly calculations
      const res = await request.get({ entity: `attendance/monthly?${query}` });
      const data = res?.result || res;
      setMonthlyData(data);
    } catch (err) {
      console.error('Failed to fetch monthly attendance', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyCalculations();
  }, [selectedMonth, selectedEmployee]);

  const metrics = monthlyData?.metrics || {
    workingDays: 0,
    present: 0,
    absent: 0,
    leave: 0,
    wfh: 0,
    halfDay: 0,
    lateLogin: 0,
    earlyLogout: 0,
    totalWorkingHours: 0,
    avgWorkingHours: 0,
  };

  const records = monthlyData?.records || [];

  // Group records by day number
  const recordsByDay = {};
  records.forEach((r) => {
    const d = dayjs(r.date || r.dateString).date();
    recordsByDay[d] = r;
  });

  // Build calendar matrix for selected month
  const daysInMonth = selectedMonth.daysInMonth();
  const firstDayOfWeek = selectedMonth.startOf('month').day(); // 0 is Sunday

  const daysGrid = [];
  // Empty slots for preceding days
  for (let i = 0; i < firstDayOfWeek; i++) {
    daysGrid.push({ isEmpty: true, key: `empty-${i}` });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const curDate = selectedMonth.date(day);
    const dayOfWeek = curDate.day();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const record = recordsByDay[day];

    daysGrid.push({
      isEmpty: false,
      day,
      date: curDate,
      isWeekend,
      record,
      key: `day-${day}`,
    });
  }

  const getStatusColor = (status) => {
    const map = {
      Present: '#10B981',
      'Late Login': '#f59e0b',
      'Early Logout': '#ea580c',
      'Half Day': '#8b5cf6',
      Absent: '#ef4444',
      Leave: '#0284c7',
      Holiday: '#ec4899',
    };
    return map[status] || '#94a3b8';
  };

  const kpiCards = [
    { title: 'Working Days', value: metrics.workingDays, icon: <CalendarOutlined />, color: '#002244', bg: '#f1f5f9' },
    { title: 'Present', value: metrics.present, icon: <CheckCircleOutlined />, color: '#10B981', bg: '#ecfdf5' },
    { title: 'Absent', value: metrics.absent, icon: <CloseCircleOutlined />, color: '#ef4444', bg: '#fef2f2' },
    { title: 'Leave', value: metrics.leave, icon: <CalendarOutlined />, color: '#0284c7', bg: '#f0f9ff' },
    { title: 'Work From Home', value: metrics.wfh, icon: <HomeOutlined />, color: '#2563eb', bg: '#eff6ff' },
    { title: 'Half Day', value: metrics.halfDay, icon: <HourglassOutlined />, color: '#8b5cf6', bg: '#f5f3ff' },
    { title: 'Late Login', value: metrics.lateLogin, icon: <ClockCircleOutlined />, color: '#d97706', bg: '#fffbeb' },
    { title: 'Early Logout', value: metrics.earlyLogout, icon: <WarningOutlined />, color: '#ea580c', bg: '#fff7ed' },
    { title: 'Total Hours', value: `${metrics.totalWorkingHours} hrs`, sub: `Avg ${metrics.avgWorkingHours}h / day`, icon: <FieldTimeOutlined />, color: '#0f766e', bg: '#f0fdfa' },
  ];

  return (
    <div>
      {/* HEADER CONTROLS */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          boxShadow: '0 8px 24px rgba(0, 34, 68, 0.08)',
          marginBottom: 20,
        }}
      >
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} md={12}>
            <Title level={4} style={{ margin: 0, color: '#002244' }}>
              Monthly Attendance & Compliance Breakdown
            </Title>
            <Text type="secondary">
              Review monthly hour calculations, working day quotas, and day-by-day logs.
            </Text>
          </Col>

          <Col xs={24} md={12} style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            {isHrOrAdmin && (
              <Select
                style={{ width: 220 }}
                placeholder="Select Employee"
                value={selectedEmployee}
                onChange={setSelectedEmployee}
                showSearch
                filterOption={(input, option) =>
                  (option?.children || '').toLowerCase().includes(input.toLowerCase())
                }
              >
                {employees.map((e) => (
                  <Select.Option key={e._id} value={e._id}>
                    {e.name} {e.surname} ({e.employeeId})
                  </Select.Option>
                ))}
              </Select>
            )}

            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={(val) => val && setSelectedMonth(val)}
              allowClear={false}
              style={{ width: 150 }}
            />
          </Col>
        </Row>
      </Card>

      {/* 9 KPI METRIC CARDS */}
      <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
        {kpiCards.map((kpi, idx) => (
          <Col xs={12} sm={8} md={6} lg={4} xl={idx === 8 ? 5 : 2} key={kpi.title} style={{ flex: '1 1 180px' }}>
            <Card
              size="small"
              bordered={false}
              style={{
                borderRadius: 12,
                background: kpi.bg,
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                height: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ color: kpi.color, fontSize: 16 }}>{kpi.icon}</span>
                <Text style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{kpi.title}</Text>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: kpi.color }}>
                {kpi.value}
              </div>
              {kpi.sub && (
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{kpi.sub}</div>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {/* MONTHLY CALENDAR GRID */}
      <Card
        title={
          <Space orientation="horizontal" size={8}>
            <CalendarOutlined style={{ color: '#002244' }} />
            <span>Attendance Calendar — {selectedMonth.format('MMMM YYYY')}</span>
          </Space>
        }
        bordered={false}
        style={{
          borderRadius: 16,
          boxShadow: '0 8px 24px rgba(0, 34, 68, 0.08)',
          marginBottom: 20,
        }}
      >
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <Spin size="large" />
            <div style={{ marginTop: 12, color: '#8c8c8c' }}>Calculating monthly metrics...</div>
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

            {/* Calendar Cells */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {daysGrid.map((item) => {
                if (item.isEmpty) {
                  return (
                    <div
                      key={item.key}
                      style={{
                        flex: '1 1 calc(14.28% - 8px)',
                        minHeight: 90,
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px dashed #e2e8f0',
                      }}
                    />
                  );
                }

                const rec = item.record;
                const statusColor = rec ? getStatusColor(rec.status) : item.isWeekend ? '#cbd5e1' : '#e2e8f0';

                return (
                  <Tooltip
                    key={item.key}
                    title={
                      rec ? (
                        <div>
                          <div><strong>Status:</strong> {rec.status}</div>
                          <div><strong>Mode:</strong> {rec.workMode}</div>
                          {rec.loginTime && <div><strong>In:</strong> {dayjs(rec.loginTime).format('hh:mm A')}</div>}
                          {rec.logoutTime && <div><strong>Out:</strong> {dayjs(rec.logoutTime).format('hh:mm A')}</div>}
                          <div><strong>Hours:</strong> {rec.totalHours || 0} hrs</div>
                          {rec.remarks && <div><strong>Remarks:</strong> {rec.remarks}</div>}
                        </div>
                      ) : item.isWeekend ? (
                        'Weekend'
                      ) : (
                        'No record logged'
                      )
                    }
                  >
                    <div
                      style={{
                        flex: '1 1 calc(14.28% - 8px)',
                        minHeight: 90,
                        background: rec ? '#ffffff' : item.isWeekend ? '#f8fafc' : '#ffffff',
                        border: `1.5px solid ${rec ? statusColor : '#e2e8f0'}`,
                        borderRadius: 8,
                        padding: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: rec ? 'pointer' : 'default',
                        transition: 'transform 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: item.isWeekend ? '#94a3b8' : '#002244',
                          }}
                        >
                          {item.day}
                        </span>
                        {rec && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: statusColor,
                            }}
                          >
                            {rec.totalHours || 0}h
                          </span>
                        )}
                      </div>

                      {rec ? (
                        <div style={{ marginTop: 6 }}>
                          <Tag
                            color={rec.workMode === 'Work From Home' ? 'blue' : 'geekblue'}
                            style={{ fontSize: 10, margin: '2px 0', padding: '0 4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {rec.workMode}
                          </Tag>
                          <div style={{ fontSize: 11, fontWeight: 600, color: statusColor, marginTop: 2 }}>
                            {rec.status}
                          </div>
                        </div>
                      ) : item.isWeekend ? (
                        <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
                          Off
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'center' }}>
                          —
                        </div>
                      )}
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

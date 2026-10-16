import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  DatePicker,
  Select,
  Button,
  Table,
  Typography,
  Space,
  Statistic,
  Tag,
  Progress,
  Avatar,
  message,
} from 'antd';
import {
  FileTextOutlined,
  DownloadOutlined,
  FilterOutlined,
  TeamOutlined,
  UserOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';
import { ROLES } from '@/utils/rbac';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function AttendanceReportsView({ currentAdmin, userRole }) {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [reportData, setReportData] = useState([]);

  const isHrOrAdmin = userRole === ROLES.HR || userRole === ROLES.ADMIN;

  useEffect(() => {
    const fetchAux = async () => {
      try {
        if (isHrOrAdmin) {
          const deptRes = await request.listAll({ entity: 'department' });
          if (deptRes?.success) setDepartments(deptRes.result || []);

          const empRes = await request.listAll({ entity: 'employee' });
          if (empRes?.success) {
            setEmployees(empRes.result || []);
          }
        }
      } catch (err) {
        console.error('Aux fetch error', err);
      }
    };
    fetchAux();
  }, [userRole]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const options = {};
      if (dateRange && dateRange[0] && dateRange[1]) {
        options.startDate = dateRange[0].format('YYYY-MM-DD');
        options.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      if (selectedDept) options.department = selectedDept;
      if (selectedEmployee) options.employee = selectedEmployee;

      let query = '';
      const params = new URLSearchParams(options).toString();
      if (params) query = `?${params}`;

      const res = await request.get({ entity: `attendance/report${query}` });
      const data = res?.result || res;
      setReportData(data?.reportRows || []);
    } catch (err) {
      console.error('Report fetch error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [dateRange, selectedDept, selectedEmployee]);

  const handleExportCSV = () => {
    if (!reportData || reportData.length === 0) {
      message.warning('No report data available to export');
      return;
    }

    const headers = [
      'Employee ID',
      'Name',
      'Department',
      'Designation',
      'Total Logged',
      'Present',
      'Absent',
      'Leave',
      'WFH',
      'Half Day',
      'Late Logins',
      'Early Logouts',
      'Total Hours',
      'Avg Hours/Day',
    ];

    const csvRows = [headers.join(',')];

    reportData.forEach((r) => {
      const row = [
        `"${r.employeeId || ''}"`,
        `"${r.fullName || ''}"`,
        `"${r.department || ''}"`,
        `"${r.designation || ''}"`,
        r.totalLogged || 0,
        r.present || 0,
        r.absent || 0,
        r.leave || 0,
        r.wfh || 0,
        r.halfDay || 0,
        r.late || 0,
        r.earlyLogout || 0,
        r.totalHours || 0,
        r.avgHours || 0,
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `TecMotiv_Attendance_Report_${dateRange[0]?.format('YYYYMMDD')}_${dateRange[1]?.format('YYYYMMDD')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Report exported to CSV successfully');
  };

  // Aggregate statistics across rows
  const totalEmployees = reportData.length;
  const totalHoursSum = reportData.reduce((acc, r) => acc + (r.totalHours || 0), 0);
  const totalPresentsSum = reportData.reduce((acc, r) => acc + (r.present || 0), 0);
  const totalLateSum = reportData.reduce((acc, r) => acc + (r.late || 0), 0);

  const columns = [
    {
      title: 'Employee',
      dataIndex: 'fullName',
      key: 'fullName',
      width: 220,
      render: (name, record) => (
        <Space orientation="horizontal" size={10}>
          <Avatar src={record.photo} icon={<UserOutlined />} style={{ backgroundColor: '#002244' }} />
          <div>
            <Text strong style={{ color: '#002244', display: 'block', fontSize: 13 }}>
              {name}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.employeeId} • {record.designation}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 140,
      render: (dept) => <Tag color="geekblue">{dept}</Tag>,
    },
    {
      title: 'Present',
      dataIndex: 'present',
      key: 'present',
      align: 'center',
      width: 90,
      render: (val) => <Tag color="green"><strong>{val}</strong></Tag>,
    },
    {
      title: 'WFH',
      dataIndex: 'wfh',
      key: 'wfh',
      align: 'center',
      width: 80,
      render: (val) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: 'Leave',
      dataIndex: 'leave',
      key: 'leave',
      align: 'center',
      width: 80,
      render: (val) => <Tag color="cyan">{val}</Tag>,
    },
    {
      title: 'Half Day',
      dataIndex: 'halfDay',
      key: 'halfDay',
      align: 'center',
      width: 90,
      render: (val) => <Tag color="purple">{val}</Tag>,
    },
    {
      title: 'Late',
      dataIndex: 'late',
      key: 'late',
      align: 'center',
      width: 80,
      render: (val) => (
        <Tag color={val > 0 ? 'orange' : 'default'}>
          {val}
        </Tag>
      ),
    },
    {
      title: 'Early Out',
      dataIndex: 'earlyLogout',
      key: 'earlyLogout',
      align: 'center',
      width: 90,
      render: (val) => (
        <Tag color={val > 0 ? 'volcano' : 'default'}>
          {val}
        </Tag>
      ),
    },
    {
      title: 'Total Hours',
      dataIndex: 'totalHours',
      key: 'totalHours',
      align: 'right',
      width: 110,
      render: (hours) => (
        <strong style={{ color: '#002244', fontSize: 14 }}>
          {hours} hrs
        </strong>
      ),
    },
    {
      title: 'Avg Hours',
      dataIndex: 'avgHours',
      key: 'avgHours',
      align: 'right',
      width: 100,
      render: (avg) => <Text style={{ color: '#475569' }}>{avg}h / day</Text>,
    },
    {
      title: 'Attendance Rate',
      key: 'rate',
      width: 150,
      render: (_, r) => {
        const totalPossible = r.totalLogged || 1;
        const rate = Math.min(100, Math.round(((r.present + r.wfh + r.halfDay * 0.5) / totalPossible) * 100));
        return (
          <Progress
            percent={rate}
            size="small"
            status={rate >= 90 ? 'success' : rate >= 75 ? 'normal' : 'exception'}
          />
        );
      },
    },
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
          <Col xs={24} md={10}>
            <Title level={4} style={{ margin: 0, color: '#002244' }}>
              Attendance Analytics & Department Reports
            </Title>
            <Text type="secondary">
              Cross-organization punctuality metrics, working hour audits, and attendance rates.
            </Text>
          </Col>

          <Col xs={24} md={14} style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              allowClear={false}
              style={{ width: 240 }}
            />

            {isHrOrAdmin && (
              <Select
                placeholder="All Departments"
                style={{ width: 160 }}
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

            {isHrOrAdmin && (
              <Select
                placeholder="All Employees"
                style={{ width: 170 }}
                value={selectedEmployee}
                onChange={setSelectedEmployee}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.children || '').toLowerCase().includes(input.toLowerCase())
                }
              >
                {employees.map((e) => (
                  <Select.Option key={e._id} value={e._id}>
                    {e.name} {e.surname}
                  </Select.Option>
                ))}
              </Select>
            )}

            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportCSV}
              style={{ backgroundColor: '#10B981', borderColor: '#10B981', fontWeight: 600 }}
            >
              Export CSV
            </Button>
          </Col>
        </Row>
      </Card>

      {/* SUMMARY STATS BAR */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small" bordered={false} style={{ borderRadius: 12, background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title="Monitored Employees"
              value={totalEmployees}
              prefix={<TeamOutlined style={{ color: '#002244' }} />}
              valueStyle={{ fontWeight: 700, color: '#002244' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" bordered={false} style={{ borderRadius: 12, background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title="Total Logged Hours"
              value={`${Math.round(totalHoursSum * 10) / 10} hrs`}
              prefix={<ClockCircleOutlined style={{ color: '#10B981' }} />}
              valueStyle={{ fontWeight: 700, color: '#10B981' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" bordered={false} style={{ borderRadius: 12, background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title="Total Present Entries"
              value={totalPresentsSum}
              prefix={<CheckCircleOutlined style={{ color: '#2563eb' }} />}
              valueStyle={{ fontWeight: 700, color: '#2563eb' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" bordered={false} style={{ borderRadius: 12, background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title="Total Late Incidents"
              value={totalLateSum}
              prefix={<ClockCircleOutlined style={{ color: '#f59e0b' }} />}
              valueStyle={{ fontWeight: 700, color: '#f59e0b' }}
            />
          </Card>
        </Col>
      </Row>

      {/* REPORT TABLE */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          boxShadow: '0 8px 24px rgba(0, 34, 68, 0.08)',
        }}
      >
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={reportData}
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `Total ${t} employees` }}
          scroll={{ x: 1100 }}
        />
      </Card>
    </div>
  );
}

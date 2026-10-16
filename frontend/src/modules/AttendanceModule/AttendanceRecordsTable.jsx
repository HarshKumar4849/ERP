import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Row,
  Col,
  Input,
  Select,
  DatePicker,
  Button,
  Tag,
  Space,
  Avatar,
  Modal,
  Form,
  TimePicker,
  message,
  Popconfirm,
  Tooltip,
  Typography,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  BankOutlined,
  HomeOutlined,
  CarOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';
import { ROLES } from '@/utils/rbac';

const { Text } = Typography;
const { RangePicker } = DatePicker;

export default function AttendanceRecordsTable({ currentAdmin, userRole }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedWorkMode, setSelectedWorkMode] = useState(null);
  const [dateRange, setDateRange] = useState(null);

  // Aux state for dropdowns
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const isHrOrAdmin = userRole === ROLES.HR || userRole === ROLES.ADMIN;

  const fetchRecords = async (page = 1, limit = 15) => {
    setLoading(true);
    try {
      const options = {
        page,
        items: limit,
      };

      if (searchQuery.trim()) options.q = searchQuery.trim();
      if (selectedDept) options.department = selectedDept;
      if (selectedStatus) options.status = selectedStatus;
      if (selectedWorkMode) options.workMode = selectedWorkMode;
      if (dateRange && dateRange[0] && dateRange[1]) {
        options.startDate = dateRange[0].format('YYYY-MM-DD');
        options.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      const res = await request.list({ entity: 'attendance', options });
      if (res?.success) {
        setData(res.result || []);
        if (res.pagination) {
          setPagination({
            current: res.pagination.page,
            pageSize: limit,
            total: res.pagination.count,
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch attendance logs', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch departments & employees for filters
  useEffect(() => {
    const fetchAuxData = async () => {
      try {
        if (isHrOrAdmin) {
          const deptRes = await request.listAll({ entity: 'department' });
          if (deptRes?.success) setDepartments(deptRes.result || []);

          const empRes = await request.listAll({ entity: 'employee' });
          if (empRes?.success) setEmployees(empRes.result || []);
        }
      } catch (err) {
        console.error('Aux data error', err);
      }
    };
    fetchAuxData();
  }, [userRole]);

  useEffect(() => {
    fetchRecords(1, pagination.pageSize);
  }, [selectedDept, selectedStatus, selectedWorkMode, dateRange]);

  const handleSearch = () => {
    fetchRecords(1, pagination.pageSize);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDept(null);
    setSelectedStatus(null);
    setSelectedWorkMode(null);
    setDateRange(null);
    fetchRecords(1, pagination.pageSize);
  };

  const openCreateModal = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      date: dayjs(),
      workMode: 'Office',
      status: 'Present',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (record) => {
    setEditingRecord(record);
    form.resetFields();
    form.setFieldsValue({
      employee: record.employee?._id || record.employee,
      date: record.date ? dayjs(record.date) : dayjs(),
      loginTime: record.loginTime ? dayjs(record.loginTime) : null,
      logoutTime: record.logoutTime ? dayjs(record.logoutTime) : null,
      workMode: record.workMode || 'Office',
      status: record.status || 'Present',
      totalHours: record.totalHours || 0,
      remarks: record.remarks || '',
    });
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (values) => {
    setModalSubmitting(true);
    try {
      const payload = {
        ...values,
        date: values.date ? values.date.toISOString() : undefined,
        loginTime: values.loginTime ? values.loginTime.toISOString() : undefined,
        logoutTime: values.logoutTime ? values.logoutTime.toISOString() : undefined,
      };

      if (editingRecord) {
        const res = await request.update({
          entity: 'attendance',
          id: editingRecord._id,
          jsonData: payload,
        });
        if (res?.success) {
          message.success('Attendance record updated successfully');
          setIsModalOpen(false);
          fetchRecords(pagination.current, pagination.pageSize);
        } else {
          message.error(res?.message || 'Update failed');
        }
      } else {
        const res = await request.create({
          entity: 'attendance',
          jsonData: payload,
        });
        if (res?.success) {
          message.success('Attendance record created successfully');
          setIsModalOpen(false);
          fetchRecords(1, pagination.pageSize);
        } else {
          message.error(res?.message || 'Creation failed');
        }
      }
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await request.delete({ entity: 'attendance', id });
      if (res?.success) {
        message.success('Attendance record deleted');
        fetchRecords(pagination.current, pagination.pageSize);
      } else {
        message.error(res?.message || 'Delete failed');
      }
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || 'Delete failed');
    }
  };

  const getWorkModeTag = (mode) => {
    const config = {
      Office: { color: 'blue', icon: <BankOutlined /> },
      'Work From Home': { color: 'green', icon: <HomeOutlined /> },
      'Client Visit': { color: 'purple', icon: <CarOutlined /> },
      Event: { color: 'orange', icon: <CalendarOutlined /> },
      Leave: { color: 'cyan', icon: <CalendarOutlined /> },
      Holiday: { color: 'volcano', icon: <CalendarOutlined /> },
    };
    const c = config[mode] || { color: 'default', icon: null };
    return (
      <Tag color={c.color} icon={c.icon} style={{ borderRadius: 4, fontWeight: 500 }}>
        {mode}
      </Tag>
    );
  };

  const getStatusTag = (status) => {
    const map = {
      Present: 'success',
      'Late Login': 'warning',
      'Early Logout': 'orange',
      'Half Day': 'purple',
      Absent: 'error',
      Leave: 'processing',
      Holiday: 'magenta',
    };
    return (
      <Tag color={map[status] || 'default'} style={{ borderRadius: 4, fontWeight: 600 }}>
        {status}
      </Tag>
    );
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (val, record) => {
        const d = dayjs(val || record.dateString);
        return (
          <div>
            <Text strong style={{ color: '#002244' }}>{d.format('YYYY-MM-DD')}</Text>
            <div style={{ fontSize: 11, color: '#64748b' }}>{d.format('dddd')}</div>
          </div>
        );
      },
    },
    {
      title: 'Employee',
      dataIndex: 'employee',
      key: 'employee',
      width: 220,
      render: (emp) => {
        if (!emp) return <Text type="secondary">—</Text>;
        const fullName = `${emp.name || ''} ${emp.surname || ''}`.trim() || emp.fullName || emp.email;
        return (
          <Space orientation="horizontal" size={10}>
            <Avatar
              src={emp.photo}
              icon={<UserOutlined />}
              style={{ backgroundColor: '#002244' }}
            />
            <div>
              <Text strong style={{ color: '#002244', display: 'block', fontSize: 13 }}>
                {fullName}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {emp.employeeId || 'EMP'} • {emp.designationName || emp.departmentName || ''}
              </Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      width: 140,
      render: (dept, record) => (
        <Tag color="geekblue" style={{ borderRadius: 4 }}>
          {dept || record.employee?.departmentName || '—'}
        </Tag>
      ),
    },
    {
      title: 'Work Mode',
      dataIndex: 'workMode',
      key: 'workMode',
      width: 150,
      render: (mode) => getWorkModeTag(mode),
    },
    {
      title: 'Login Time',
      dataIndex: 'loginTime',
      key: 'loginTime',
      width: 110,
      render: (val) =>
        val ? (
          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#065f46' }}>
            {dayjs(val).format('hh:mm A')}
          </span>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Logout Time',
      dataIndex: 'logoutTime',
      key: 'logoutTime',
      width: 110,
      render: (val) =>
        val ? (
          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1e293b' }}>
            {dayjs(val).format('hh:mm A')}
          </span>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Total Hours',
      dataIndex: 'totalHours',
      key: 'totalHours',
      width: 110,
      render: (hours) => (
        <span style={{ fontWeight: 700, color: hours >= 7.5 ? '#10B981' : hours > 0 ? '#f59e0b' : '#94a3b8' }}>
          {hours !== undefined ? `${hours} hrs` : '0 hrs'}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => getStatusTag(status),
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true,
      render: (text) =>
        text ? (
          <Tooltip title={text}>
            <span style={{ color: '#475569', fontSize: 12 }}>{text}</span>
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ];

  // If user has administrative or HR rights, append Actions column
  if (isHrOrAdmin) {
    columns.push({
      title: 'Action',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Space orientation="horizontal" size={6}>
          <Tooltip title="Edit / Regularize">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ color: '#0284c7' }} />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          {isHrOrAdmin && (
            <Popconfirm
              title="Delete attendance record?"
              description="Are you sure you want to soft delete this entry?"
              onConfirm={() => handleDelete(record._id)}
              okText="Yes"
              cancelText="No"
            >
              <Tooltip title="Delete">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    });
  }

  return (
    <Card
      bordered={false}
      style={{
        borderRadius: 16,
        boxShadow: '0 8px 24px rgba(0, 34, 68, 0.08)',
      }}
    >
      {/* FILTER CONTROLS BAR */}
      <div style={{ marginBottom: 20 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Search remarks, employee..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>

          {isHrOrAdmin && (
            <Col xs={24} sm={12} md={4}>
              <Select
                placeholder="Department"
                style={{ width: '100%' }}
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
            </Col>
          )}

          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="Work Mode"
              style={{ width: '100%' }}
              value={selectedWorkMode}
              onChange={setSelectedWorkMode}
              allowClear
            >
              <Select.Option value="Office">Office</Select.Option>
              <Select.Option value="Work From Home">Work From Home</Select.Option>
              <Select.Option value="Client Visit">Client Visit</Select.Option>
              <Select.Option value="Event">Event</Select.Option>
              <Select.Option value="Leave">Leave</Select.Option>
              <Select.Option value="Holiday">Holiday</Select.Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="Status"
              style={{ width: '100%' }}
              value={selectedStatus}
              onChange={setSelectedStatus}
              allowClear
            >
              <Select.Option value="Present">Present</Select.Option>
              <Select.Option value="Late Login">Late Login</Select.Option>
              <Select.Option value="Early Logout">Early Logout</Select.Option>
              <Select.Option value="Half Day">Half Day</Select.Option>
              <Select.Option value="Absent">Absent</Select.Option>
              <Select.Option value="Leave">Leave</Select.Option>
              <Select.Option value="Holiday">Holiday</Select.Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange}
              onChange={setDateRange}
            />
          </Col>

          <Col xs={24} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <Space orientation="horizontal" size={8}>
              <Button type="primary" icon={<FilterOutlined />} onClick={handleSearch} style={{ backgroundColor: '#002244', borderColor: '#002244' }}>
                Apply Filter
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>
                Reset
              </Button>
            </Space>

            {isHrOrAdmin && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateModal}
                style={{
                  backgroundColor: '#10B981',
                  borderColor: '#10B981',
                  borderRadius: 8,
                  fontWeight: 600,
                }}
              >
                Add Manual / Regularization Entry
              </Button>
            )}
          </Col>
        </Row>
      </div>

      {/* DATA TABLE */}
      <Table
        rowKey="_id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} records`,
          onChange: (page, pageSize) => fetchRecords(page, pageSize),
        }}
        scroll={{ x: 1000 }}
      />

      {/* MODAL: CREATE / EDIT ATTENDANCE RECORD */}
      <Modal
        title={editingRecord ? 'Edit / Regularize Attendance Record' : 'Manual Attendance Entry'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleModalSubmit} style={{ marginTop: 16 }}>
          <Form.Item
            name="employee"
            label="Employee"
            rules={[{ required: true, message: 'Please select an employee' }]}
          >
            <Select
              placeholder="Select Employee"
              showSearch
              filterOption={(input, option) =>
                (option?.children || '').toLowerCase().includes(input.toLowerCase())
              }
              disabled={!!editingRecord}
            >
              {employees.map((e) => (
                <Select.Option key={e._id} value={e._id}>
                  {e.name} {e.surname} ({e.employeeId} - {e.departmentName || ''})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="date"
                label="Attendance Date"
                rules={[{ required: true, message: 'Date is required' }]}
              >
                <DatePicker style={{ width: '100%' }} disabled={!!editingRecord} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="workMode"
                label="Work Mode"
                rules={[{ required: true }]}
              >
                <Select>
                  <Select.Option value="Office">Office</Select.Option>
                  <Select.Option value="Work From Home">Work From Home</Select.Option>
                  <Select.Option value="Client Visit">Client Visit</Select.Option>
                  <Select.Option value="Event">Event</Select.Option>
                  <Select.Option value="Leave">Leave</Select.Option>
                  <Select.Option value="Holiday">Holiday</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="loginTime" label="Login Time">
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="logoutTime" label="Logout Time">
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="Present">Present</Select.Option>
                  <Select.Option value="Late Login">Late Login</Select.Option>
                  <Select.Option value="Early Logout">Early Logout</Select.Option>
                  <Select.Option value="Half Day">Half Day</Select.Option>
                  <Select.Option value="Absent">Absent</Select.Option>
                  <Select.Option value="Leave">Leave</Select.Option>
                  <Select.Option value="Holiday">Holiday</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="totalHours" label="Total Working Hours">
                <Input type="number" step="0.1" placeholder="Auto-calculated if blank" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remarks" label="Remarks / Regularization Justification">
            <Input.TextArea rows={3} placeholder="Provide remarks or reason for entry/modification" />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={modalSubmitting}
              style={{ backgroundColor: '#002244', borderColor: '#002244' }}
            >
              {editingRecord ? 'Save Changes' : 'Create Record'}
            </Button>
          </div>
        </Form>
      </Modal>
    </Card>
  );
}

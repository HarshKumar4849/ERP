import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  Modal,
  Form,
  InputNumber,
  DatePicker,
  Typography,
  Tabs,
  Statistic,
  Popconfirm,
  message,
} from 'antd';
import {
  BankOutlined,
  PlusOutlined,
  SearchOutlined,
  DollarOutlined,
  ShopOutlined,
  CoffeeOutlined,
  FileTextOutlined,
  ToolOutlined,
  TeamOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const OFFICE_CATEGORIES = [
  { key: 'ALL', label: 'All Operations', icon: <ShopOutlined /> },
  { key: 'Rent', label: 'Rent & Lease', icon: <BankOutlined />, color: '#002244' },
  { key: 'Office Facilities', label: 'Office Facilities', icon: <ShopOutlined />, color: '#1890ff' },
  { key: 'Housekeeping', label: 'Housekeeping', icon: <AuditOutlined />, color: '#52c41a' },
  { key: 'Pantry', label: 'Pantry & Beverages', icon: <CoffeeOutlined />, color: '#fa8c16' },
  { key: 'Stationery', label: 'Stationery & Supplies', icon: <FileTextOutlined />, color: '#722ed1' },
  { key: 'Equipment', label: 'Equipment & Infra', icon: <ToolOutlined />, color: '#13c2c2' },
  { key: 'Assets', label: 'Fixed Assets Audit', icon: <ShopOutlined />, color: '#eb2f96' },
  { key: 'Vendors', label: 'Vendors & Partners', icon: <TeamOutlined />, color: '#faad14' },
  { key: 'Maintenance', label: 'AMC Maintenance', icon: <ToolOutlined />, color: '#f5222d' },
];

function formatCurrency(amount) {
  const val = Number(amount || 0);
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OfficeManagementTab() {
  const [loading, setLoading] = useState(false);
  const [operations, setOperations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchOfficeOps = async () => {
    try {
      setLoading(true);
      const query = activeCategory !== 'ALL' ? `?category=${encodeURIComponent(activeCategory)}` : '';
      const res = await request.list({ entity: `office/list${query}` });
      if (res && res.success) {
        setOperations(res.result || []);
        if (res.summary) setSummary(res.summary);
      }
    } catch (err) {
      console.error('Failed to load office operations:', err);
      message.error('Unable to fetch office operations records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficeOps();
  }, [activeCategory]);

  const handleCreateSubmit = async (values) => {
    try {
      setSubmitting(true);
      const res = await request.post({
        entity: 'office/create',
        jsonData: values,
      });
      if (res && res.success) {
        message.success('Office management record added.');
        setModalVisible(false);
        form.resetFields();
        fetchOfficeOps();
      } else {
        message.error(res?.message || 'Failed to add record');
      }
    } catch (err) {
      message.error('Error creating office management record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await request.delete({ entity: `office/delete/${id}` });
      if (res && res.success) {
        message.success('Record deleted.');
        fetchOfficeOps();
      }
    } catch (err) {
      message.error('Failed to delete record.');
    }
  };

  const filteredOps = operations.filter((op) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      op.title?.toLowerCase().includes(q) ||
      op.vendor?.toLowerCase().includes(q) ||
      op.category?.toLowerCase().includes(q) ||
      op.responsiblePerson?.toLowerCase().includes(q)
    );
  });

  const columns = [
    {
      title: 'Operation / Item',
      key: 'title',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#002244', fontSize: 13 }}>{r.title}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
            <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
              {r.category}
            </Tag>{' '}
            • {r.location || 'HQ'}
          </div>
        </div>
      ),
    },
    {
      title: 'Vendor / Partner',
      key: 'vendor',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.vendor || 'In-House'}</div>
          {r.vendorContact && (
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.vendorContact}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Cost / Amount',
      key: 'amount',
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 700, color: '#002244' }}>{formatCurrency(r.amount)}</span>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.frequency || 'Monthly'}</div>
        </div>
      ),
    },
    {
      title: 'Due Date',
      key: 'dueDate',
      render: (_, r) => (
        <span style={{ fontSize: 12 }}>
          {r.dueDate ? dayjs(r.dueDate).format('DD MMM YYYY') : 'Periodic'}
        </span>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => {
        const isDone = ['Paid', 'Completed'].includes(r.status);
        return (
          <Tag color={isDone ? 'success' : 'processing'} style={{ borderRadius: 12 }}>
            {r.status || 'Active'}
          </Tag>
        );
      },
    },
    {
      title: 'Responsible Lead',
      dataIndex: 'responsiblePerson',
      key: 'responsiblePerson',
      render: (t) => <span style={{ fontSize: 12 }}>{t || 'Admin Operations'}</span>,
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => (
        <Popconfirm
          title="Delete this office record?"
          onConfirm={() => handleDelete(r._id)}
          okText="Yes"
          cancelText="No"
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      {/* Expenditure Overview Bar */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, background: '#f8fbff', border: '1px solid #e6f0fa' }}>
            <Statistic
              title="Total Administration Ops"
              value={summary?.totalRecords || operations.length}
              prefix={<ShopOutlined style={{ color: '#002244' }} />}
              valueStyle={{ color: '#002244', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, background: '#f6ffed', border: '1px solid #d9f7be' }}>
            <Statistic
              title="Total Recurring Budget"
              value={summary?.totalExpenditure || 0}
              prefix="₹"
              precision={2}
              valueStyle={{ color: '#237804', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, background: '#fff7e6', border: '1px solid #ffe7ba' }}>
            <Statistic
              title="Active Categories"
              value={OFFICE_CATEGORIES.length - 1}
              prefix={<BankOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, background: '#fff0f6', border: '1px solid #ffd6e7' }}>
            <Statistic
              title="Headquarters Location"
              value="Bangalore HQ"
              prefix={<ShopOutlined style={{ color: '#eb2f96' }} />}
              valueStyle={{ color: '#eb2f96', fontWeight: 700, fontSize: 18 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Table Card */}
      <Card bordered={false} style={{ borderRadius: 16 }}>
        {/* Category Tabs */}
        <Tabs
          activeKey={activeCategory}
          onChange={setActiveCategory}
          items={OFFICE_CATEGORIES.map((c) => ({
            key: c.key,
            label: (
              <Space size={6}>
                {c.icon}
                <span>{c.label}</span>
              </Space>
            ),
          }))}
          style={{ marginBottom: 16 }}
        />

        {/* Controls */}
        <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={10}>
            <Input
              placeholder="Search office operations, vendors, notes..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </Col>
          <Col xs={24} md={14} style={{ textAlign: 'right' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                form.setFieldsValue({
                  category: activeCategory !== 'ALL' ? activeCategory : 'Rent',
                  frequency: 'Monthly',
                  status: 'Active',
                  location: 'Bangalore HQ',
                  responsiblePerson: 'Admin Operations',
                });
                setModalVisible(true);
              }}
              style={{ backgroundColor: '#002244', borderColor: '#002244', borderRadius: 8 }}
            >
              Add Office Record
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={filteredOps}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* Add Office Record Modal */}
      <Modal
        title={
          <Space>
            <BankOutlined style={{ color: '#002244' }} />
            <span>Add Office Management Operation</span>
          </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={680}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="category"
                label="Operation Category"
                rules={[{ required: true, message: 'Please select category' }]}
              >
                <Select>
                  {OFFICE_CATEGORIES.filter((c) => c.key !== 'ALL').map((c) => (
                    <Option key={c.key} value={c.key}>
                      {c.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="title"
                label="Operation / Expense Title"
                rules={[{ required: true, message: 'Title is required' }]}
              >
                <Input placeholder="e.g. Monthly High-Speed Fiber Internet Lease" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="vendor" label="Vendor / Partner Name">
                <Input placeholder="e.g. Tata Telecommunications" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="vendorContact" label="Vendor Contact / Phone / Email">
                <Input placeholder="e.g. support@tatatele.com" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="amount" label="Cost / Budget (₹)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="frequency" label="Billing Frequency">
                <Select>
                  <Option value="One-time">One-time</Option>
                  <Option value="Monthly">Monthly</Option>
                  <Option value="Quarterly">Quarterly</Option>
                  <Option value="Annual">Annual</Option>
                  <Option value="As Needed">As Needed</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Status">
                <Select>
                  <Option value="Active">Active</Option>
                  <Option value="Pending">Pending</Option>
                  <Option value="In Progress">In Progress</Option>
                  <Option value="Completed">Completed</Option>
                  <Option value="Scheduled">Scheduled</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="location" label="Office Location / Floor">
                <Input placeholder="e.g. Silicon Park - Floor 3" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="responsiblePerson" label="Responsible Lead / Staff">
                <Input placeholder="e.g. Admin Facilities Lead" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes & Specifications">
            <TextArea rows={3} placeholder="Contract notes, renewal dates, SLA details..." />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                style={{ backgroundColor: '#002244', borderColor: '#002244' }}
              >
                Save Record
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

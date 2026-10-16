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
  Avatar,
  Typography,
  Tooltip,
  Progress,
  Statistic,
  Badge,
  Divider,
  message,
} from 'antd';
import {
  ProjectOutlined,
  UserOutlined,
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  EyeOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  TeamOutlined,
  FlagOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';
import { ROLES, normalizeRole } from '@/utils/rbac';
import ProjectWorkspaceModal from './ProjectWorkspaceModal';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const PROJECT_CATEGORIES = ['MDS', 'B2B', 'B2G', 'Consulting', 'Events'];

function formatCurrency(amount) {
  const val = Number(amount || 0);
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProjectDashboard({ userRole, currentAdmin }) {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Selected Project for Workspace Drawer
  const [selectedProject, setSelectedProject] = useState(null);
  const [workspaceVisible, setWorkspaceVisible] = useState(false);

  // Create Project Modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createForm] = Form.useForm();

  const role = normalizeRole(userRole || currentAdmin?.role);
  const isEmployee = role === ROLES.EMPLOYEE;
  const canCreate = [ROLES.ADMIN, ROLES.HR].includes(role);

  // Fetch Projects List
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const queryParams = [];
      if (selectedCategory && selectedCategory !== 'ALL') queryParams.push(`category=${selectedCategory}`);
      if (selectedStatus && selectedStatus !== 'ALL') queryParams.push(`status=${selectedStatus}`);

      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const res = await request.list({ entity: `project/list${queryString}` });

      if (res && res.success) {
        setProjects(res.result || []);
        if (res.summary) setSummary(res.summary);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      message.error('Unable to fetch projects.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Employees for PM & Team dropdown.
  // The employee directory is restricted to ADMIN/HR, so only roles that can
  // actually create or manage projects may load it.
  const fetchEmployees = async () => {
    if (!canCreate) return;
    try {
      const res = await request.list({ entity: 'employee' });
      if (res && res.success) {
        setEmployees(res.result || []);
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedStatus]);

  // Open Workspace for a specific project
  const handleOpenWorkspace = async (proj) => {
    try {
      // Fetch full populated workspace with live tasks, calendar events, docs
      const res = await request.read({ entity: 'project', id: proj._id });
      if (res && res.success) {
        setSelectedProject(res.result);
        setWorkspaceVisible(true);
      }
    } catch (err) {
      message.error('Failed to load project workspace.');
    }
  };

  // Create Project Submit
  const handleCreateSubmit = async (values) => {
    try {
      setSubmitting(true);
      const res = await request.post({
        entity: 'project/create',
        jsonData: {
          name: values.name,
          client: values.client,
          category: values.category,
          department: values.department,
          projectManager: values.projectManager,
          teamMembers: values.teamMembers || [],
          startDate: values.startDate ? values.startDate.toISOString() : new Date(),
          targetDate: values.targetDate.toISOString(),
          budget: values.budget || 0,
          status: 'In Progress',
          notes: values.notes,
          description: values.description,
        },
      });

      if (res && res.success) {
        message.success('Project created successfully!');
        setCreateModalVisible(false);
        createForm.resetFields();
        fetchProjects();
      } else {
        message.error(res?.message || 'Failed to create project');
      }
    } catch (err) {
      message.error('Error creating project.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered by Search
  const filteredProjects = projects.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.client?.toLowerCase().includes(q) ||
      p.code?.toLowerCase().includes(q) ||
      p.department?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.projectManagerName?.toLowerCase().includes(q)
    );
  });

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'MDS':
        return '#002244';
      case 'B2B':
        return '#1890ff';
      case 'B2G':
        return '#722ed1';
      case 'Consulting':
        return '#52c41a';
      case 'Events':
        return '#eb2f96';
      default:
        return 'blue';
    }
  };

  const columns = [
    {
      title: 'Project Name & Code',
      key: 'name',
      render: (_, r) => (
        <Space size={10} align="start">
          <Avatar style={{ backgroundColor: getCategoryColor(r.category), marginTop: 2 }} icon={<ProjectOutlined />} />
          <div>
            <a
              style={{ fontWeight: 600, color: '#002244', fontSize: 13 }}
              onClick={() => handleOpenWorkspace(r)}
            >
              {r.name}
            </a>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
              <Tag color={getCategoryColor(r.category)} style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                {r.category}
              </Tag>{' '}
              • Code: <strong>{r.code}</strong>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Client',
      dataIndex: 'client',
      key: 'client',
      render: (c) => <span style={{ fontWeight: 500 }}>{c}</span>,
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (d) => <Tag color="geekblue">{d}</Tag>,
    },
    {
      title: 'Project Lead & Team',
      key: 'lead',
      render: (_, r) => (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#002244' }}>
            {r.projectManager?.name} {r.projectManager?.surname || ''}
          </div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
            Team: {r.teamMembers?.length || 0} Members
          </div>
        </div>
      ),
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      key: 'progress',
      width: 140,
      render: (prog) => <Progress percent={prog || 0} size="small" strokeColor="#002244" />,
    },
    {
      title: 'Target Date',
      key: 'targetDate',
      render: (_, r) => {
        const isPast = r.targetDate && new Date(r.targetDate) < new Date() && r.status !== 'Completed';
        return (
          <div>
            <span style={{ fontSize: 12, color: isPast ? '#cf1322' : undefined, fontWeight: isPast ? 600 : 400 }}>
              {r.targetDate ? dayjs(r.targetDate).format('DD MMM YYYY') : '-'}
            </span>
            {isPast && <div style={{ fontSize: 10, color: '#cf1322' }}>Overdue</div>}
          </div>
        );
      },
    },
    {
      title: 'Budget',
      dataIndex: 'budget',
      key: 'budget',
      render: (b) => <span style={{ fontWeight: 600, color: '#002244' }}>{formatCurrency(b)}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => {
        let color = 'processing';
        if (s === 'Completed') color = 'success';
        else if (s === 'Overdue') color = 'error';
        else if (s === 'On Hold') color = 'warning';
        return <Tag color={color} style={{ borderRadius: 12 }}>{s}</Tag>;
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleOpenWorkspace(r)}
          style={{ backgroundColor: '#002244', borderColor: '#002244' }}
        >
          Workspace
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '4px 0 32px 0' }}>
      {/* Hero Header */}
      <Card
        bordered={false}
        style={{
          background: 'linear-gradient(135deg, #001f3f 0%, #003366 100%)',
          borderRadius: 16,
          color: '#fff',
          marginBottom: 24,
          boxShadow: '0 8px 24px rgba(0, 31, 63, 0.15)',
        }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Space align="center" size={16} orientation="horizontal">
              <Avatar
                size={56}
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#d4af37' }}
                icon={<RocketOutlined style={{ fontSize: 28 }} />}
              />
              <div>
                <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
                  TECMOTIV PROJECT WORKSPACES
                </Title>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
                  Cross-functional project roadmap, deliverables, connected tasks, calendar sync & documents.
                </Text>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={8} orientation="horizontal" style={{ textAlign: 'right' }}>
            {canCreate && (
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={() => {
                  createForm.resetFields();
                  createForm.setFieldsValue({
                    category: 'B2B',
                    department: 'Engineering',
                    startDate: dayjs(),
                    targetDate: dayjs().add(90, 'day'),
                  });
                  setCreateModalVisible(true);
                }}
                style={{
                  backgroundColor: '#d4af37',
                  borderColor: '#d4af37',
                  color: '#001f3f',
                  fontWeight: 700,
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(212, 175, 55, 0.35)',
                }}
              >
                Create Project
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      {/* KPI Overview Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title={isEmployee ? 'My Active Projects' : 'Total Company Projects'}
              value={summary?.total || projects.length}
              prefix={<ProjectOutlined style={{ color: '#002244' }} />}
              valueStyle={{ color: '#002244', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title="Active In Progress"
              value={summary?.active || projects.filter((p) => p.status === 'In Progress').length}
              prefix={<RocketOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title="Completed Milestones"
              value={summary?.completed || projects.filter((p) => p.status === 'Completed').length}
              prefix={<CheckCircleOutlined style={{ color: '#237804' }} />}
              valueStyle={{ color: '#237804', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title="Total Portfolio Budget"
              value={summary?.totalBudget || projects.reduce((acc, c) => acc + (c.budget || 0), 0)}
              prefix="₹"
              precision={2}
              valueStyle={{ color: '#002244', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Table Card */}
      <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        {/* Category Filters Bar */}
        <div style={{ marginBottom: 20, padding: '10px 14px', background: '#fafafa', borderRadius: 8 }}>
          <Space wrap size={[8, 8]}>
            <Text type="secondary" style={{ fontSize: 12, marginRight: 6 }}>Categories:</Text>
            <Button
              size="small"
              type={selectedCategory === 'ALL' ? 'primary' : 'default'}
              onClick={() => setSelectedCategory('ALL')}
              style={{ borderRadius: 16 }}
            >
              All Projects ({projects.length})
            </Button>
            {PROJECT_CATEGORIES.map((cat) => {
              const count = summary?.categoryCounts?.[cat] || 0;
              return (
                <Button
                  key={cat}
                  size="small"
                  type={selectedCategory === cat ? 'primary' : 'default'}
                  onClick={() => setSelectedCategory(cat)}
                  style={{ borderRadius: 16 }}
                >
                  {cat} {count > 0 && `(${count})`}
                </Button>
              );
            })}
          </Space>
        </div>

        {/* Search & Status Filters */}
        <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} md={10}>
            <Input
              placeholder="Search by Project Name, Client, Code, or Lead..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </Col>
          <Col xs={24} md={14} style={{ textAlign: 'right' }}>
            <Space>
              <Select
                value={selectedStatus}
                onChange={setSelectedStatus}
                style={{ width: 140 }}
                aria-label="Filter projects by status"
              >
                <Option value="ALL">All Status</Option>
                <Option value="In Progress">In Progress</Option>
                <Option value="Completed">Completed</Option>
                <Option value="Planning">Planning</Option>
                <Option value="On Hold">On Hold</Option>
              </Select>
            </Space>
          </Col>
        </Row>

        {/* Projects Table */}
        <Table
          columns={columns}
          dataSource={filteredProjects}
          rowKey="_id"
          loading={loading}
          // Scopes horizontal scrolling to the table so the page itself does
          // not scroll sideways on tablet/mobile.
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 8 }}
        />
      </Card>

      {/* Connected Project Workspace Modal */}
      <ProjectWorkspaceModal
        visible={workspaceVisible}
        onClose={() => setWorkspaceVisible(false)}
        project={selectedProject}
        onRefresh={() => {
          if (selectedProject) handleOpenWorkspace(selectedProject);
          fetchProjects();
        }}
      />

      {/* Create Project Modal */}
      <Modal
        title={
          <Space>
            <ProjectOutlined style={{ color: '#002244' }} />
            <span>Create New Project Initiative</span>
          </Space>
        }
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={760}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateSubmit}>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="name"
                label="Project Name"
                rules={[{ required: true, message: 'Project Name is required' }]}
              >
                <Input placeholder="e.g. Telematics Stream Ingestion Engine V2" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="client"
                label="Client / Account"
                rules={[{ required: true, message: 'Client is required' }]}
              >
                <Input placeholder="e.g. Apex Automotive / Internal" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="category"
                label="Category"
                rules={[{ required: true, message: 'Please select category' }]}
              >
                <Select>
                  <Option value="MDS">MDS (Master Data Systems)</Option>
                  <Option value="B2B">B2B (Enterprise Accounts)</Option>
                  <Option value="B2G">B2G (Government / Municipal)</Option>
                  <Option value="Consulting">Consulting (Advisory)</Option>
                  <Option value="Events">Events (Conferences & Summits)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="department"
                label="Owning Department"
                rules={[{ required: true, message: 'Department is required' }]}
              >
                <Select>
                  <Option value="Engineering">Engineering</Option>
                  <Option value="Operations">Operations</Option>
                  <Option value="HR">HR</Option>
                  <Option value="Finance">Finance</Option>
                  <Option value="Sales">Sales</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="budget"
                label="Total Budget (₹)"
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="projectManager"
                label="Project Manager (Lead)"
                rules={[{ required: true, message: 'Please assign a Project Manager' }]}
              >
                <Select
                  showSearch
                  placeholder="Select Project Manager"
                  filterOption={(input, option) =>
                    (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {employees.map((emp) => (
                    <Option key={emp._id} value={emp._id}>
                      {emp.name} {emp.surname} ({emp.employeeId || 'ID'}) — {emp.designationName || 'Staff'}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="teamMembers"
                label="Team Members (References)"
              >
                <Select
                  mode="multiple"
                  placeholder="Select team members"
                  filterOption={(input, option) =>
                    (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {employees.map((emp) => (
                    <Option key={emp._id} value={emp._id}>
                      {emp.name} {emp.surname} ({emp.departmentName || 'Dept'})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="startDate"
                label="Start Date"
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="targetDate"
                label="Target Completion Date"
                rules={[{ required: true }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Project Overview / Goals">
            <TextArea rows={2} placeholder="Summary of business goals, technical deliverables..." />
          </Form.Item>

          <Form.Item name="notes" label="Internal Notes & Constraints">
            <TextArea rows={2} placeholder="Notes, risk factors, dependencies..." />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Space>
              <Button onClick={() => setCreateModalVisible(false)}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                style={{ backgroundColor: '#002244', borderColor: '#002244' }}
              >
                Create Project
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

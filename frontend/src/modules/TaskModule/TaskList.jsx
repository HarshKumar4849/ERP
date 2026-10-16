import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Row,
  Col,
  Input,
  Select,
  Button,
  Tag,
  Space,
  Avatar,
  Tooltip,
  Typography,
  Popconfirm,
  Badge,
  Progress,
  message,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  UserOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  ProjectOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CommentOutlined,
  PaperClipOutlined,
  FireOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { Text } = Typography;

const priorityColors = {
  Critical: '#ff4d4f',
  High: '#fa8c16',
  Medium: '#1890ff',
  Low: '#52c41a',
};

const statusColors = {
  'Not Started': 'default',
  'In Progress': 'processing',
  Waiting: 'warning',
  Completed: 'success',
  Overdue: 'error',
  Cancelled: 'default',
};

export default function TaskList({
  scope = 'all', // 'my', 'team', 'all'
  userRole,
  currentAdmin,
  onOpenTaskDetails,
  onOpenCreateModal,
  onOpenEditModal,
  refreshKey = 0,
}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState(null);
  const [isOverdueOnly, setIsOverdueOnly] = useState(false);

  // Filter resource options
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);

  // Fetch filter options
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [deptRes, projRes] = await Promise.all([
          request.list({ entity: 'department', options: { items: 50 } }),
          request.list({ entity: 'project', options: { items: 50 } }),
        ]);
        if (deptRes?.result) setDepartments(deptRes.result);
        if (projRes?.result) setProjects(projRes.result);
      } catch (e) {
        // silent fail
      }
    };
    fetchFilterOptions();
  }, []);

  const fetchTasks = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      const options = {
        page,
        items: limit,
        scope,
      };

      if (searchQuery.trim()) options.q = searchQuery.trim();
      if (selectedDept) options.department = selectedDept;
      if (selectedProject) options.project = selectedProject;
      if (selectedStatus) options.status = selectedStatus;
      if (selectedPriority) options.priority = selectedPriority;
      if (isOverdueOnly) options.overdue = 'true';

      const response = await request.list({ entity: 'task', options });

      if (response && response.result) {
        setData(response.result);
        setPagination({
          current: response.pagination?.page || page,
          pageSize: limit,
          total: response.pagination?.count || response.result.length,
        });
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
      message.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks(pagination.current, pagination.pageSize);
  }, [
    scope,
    selectedDept,
    selectedProject,
    selectedStatus,
    selectedPriority,
    isOverdueOnly,
    refreshKey,
  ]);

  const handleTableChange = (newPagination) => {
    fetchTasks(newPagination.current, newPagination.pageSize);
  };

  const handleSearch = () => {
    fetchTasks(1, pagination.pageSize);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDept(null);
    setSelectedProject(null);
    setSelectedStatus(null);
    setSelectedPriority(null);
    setIsOverdueOnly(false);
    fetchTasks(1, pagination.pageSize);
  };

  // Fast inline status update
  const handleQuickStatusChange = async (taskId, newStatus) => {
    try {
      const response = await request.patch({
        entity: `task/status/${taskId}`,
        jsonData: { status: newStatus },
      });
      if (response && response.success) {
        message.success(`Status updated to ${newStatus}`);
        setData((prev) =>
          prev.map((t) => (t._id === taskId ? { ...t, ...response.result } : t))
        );
      }
    } catch (err) {
      message.error('Failed to update status');
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId) => {
    try {
      const response = await request.delete({ entity: `task/${taskId}` });
      if (response && response.success) {
        message.success('Task deleted successfully');
        fetchTasks(pagination.current, pagination.pageSize);
      }
    } catch (err) {
      message.error('Failed to delete task');
    }
  };

  const columns = [
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority) => (
        <Tag
          color={priorityColors[priority] || 'blue'}
          style={{ fontWeight: 600, borderRadius: 4 }}
        >
          {priority}
        </Tag>
      ),
    },
    {
      title: 'Task & Deliverable',
      key: 'task',
      render: (_, record) => {
        const subtasks = record.subtasks || [];
        const completedSubtasks = subtasks.filter((s) => s.completed).length;
        const isOverdue =
          record.isOverdue ||
          (record.status !== 'Completed' &&
            record.status !== 'Cancelled' &&
            new Date(record.dueDate) < new Date());

        return (
          <div style={{ maxWidth: 360 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Text
                strong
                style={{
                  fontSize: 14,
                  cursor: 'pointer',
                  color: isOverdue ? '#cf1322' : '#262626',
                }}
                onClick={() => onOpenTaskDetails && onOpenTaskDetails(record)}
              >
                {record.task || record.title}
              </Text>
              {isOverdue && (
                <Tag color="error" style={{ fontSize: 10, padding: '0 4px' }}>
                  OVERDUE
                </Tag>
              )}
            </div>

            {record.description && (
              <div
                style={{
                  fontSize: 12,
                  color: '#8c8c8c',
                  marginTop: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {record.description}
              </div>
            )}

            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
              {subtasks.length > 0 && (
                <Space size={4} style={{ fontSize: 11, color: '#595959' }}>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <span>
                    {completedSubtasks}/{subtasks.length} subtasks
                  </span>
                </Space>
              )}
              {record.comments?.length > 0 && (
                <Space size={4} style={{ fontSize: 11, color: '#595959' }}>
                  <CommentOutlined style={{ color: '#722ed1' }} />
                  <span>{record.comments.length}</span>
                </Space>
              )}
              {record.attachments?.length > 0 && (
                <Space size={4} style={{ fontSize: 11, color: '#595959' }}>
                  <PaperClipOutlined style={{ color: '#1890ff' }} />
                  <span>{record.attachments.length}</span>
                </Space>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Department & Project',
      key: 'deptProject',
      width: 180,
      render: (_, record) => (
        <div>
          <div>
            <Tag color="cyan">{record.department || 'General'}</Tag>
          </div>
          {record.projectName && (
            <div style={{ marginTop: 4 }}>
              <Tag color="purple" style={{ fontSize: 11 }}>
                <ProjectOutlined style={{ marginRight: 4 }} />
                {record.projectName}
              </Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Assignee & Reviewer',
      key: 'assignee',
      width: 180,
      render: (_, record) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
            <Text style={{ fontSize: 13 }}>{record.ownerName || 'Unassigned'}</Text>
          </div>
          {record.reviewerName && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 4,
                fontSize: 11,
                color: '#8c8c8c',
              }}
            >
              <span>Review:</span>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {record.reviewerName}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 130,
      render: (dueDate, record) => {
        const isOverdue =
          record.isOverdue ||
          (record.status !== 'Completed' &&
            record.status !== 'Cancelled' &&
            new Date(dueDate) < new Date());
        return (
          <Space>
            <CalendarOutlined style={{ color: isOverdue ? '#ff4d4f' : '#8c8c8c' }} />
            <Text style={{ color: isOverdue ? '#cf1322' : 'inherit', fontWeight: isOverdue ? 600 : 400 }}>
              {dueDate ? dayjs(dueDate).format('MMM DD, YYYY') : '-'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status, record) => (
        <Select
          size="small"
          value={status}
          style={{ width: 130 }}
          onChange={(newVal) => handleQuickStatusChange(record._id, newVal)}
          options={[
            { value: 'Not Started', label: <Tag color="default">Not Started</Tag> },
            { value: 'In Progress', label: <Tag color="processing">In Progress</Tag> },
            { value: 'Waiting', label: <Tag color="warning">Waiting</Tag> },
            { value: 'Completed', label: <Tag color="success">Completed</Tag> },
            { value: 'Overdue', label: <Tag color="error">Overdue</Tag> },
            { value: 'Cancelled', label: <Tag color="default">Cancelled</Tag> },
          ]}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => onOpenTaskDetails && onOpenTaskDetails(record)}
            />
          </Tooltip>
          <Tooltip title="Edit Task">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => onOpenEditModal && onOpenEditModal(record)}
            />
          </Tooltip>
          <Tooltip title="Delete Task">
            <Popconfirm
              title="Delete this task?"
              onConfirm={() => handleDeleteTask(record._id)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Card
      style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
      bodyStyle={{ padding: 20 }}
    >
      {/* Search & Filters Toolbar */}
      <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={8}>
            <Input
              placeholder="Search by task, description, project, owner..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Select
              allowClear
              placeholder="Department"
              style={{ width: '100%' }}
              value={selectedDept}
              onChange={setSelectedDept}
              options={departments.map((d) => ({ value: d.name, label: d.name }))}
            />
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Select
              allowClear
              placeholder="Project"
              style={{ width: '100%' }}
              value={selectedProject}
              onChange={setSelectedProject}
              options={projects.map((p) => ({ value: p._id, label: p.name }))}
            />
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Select
              allowClear
              placeholder="Status"
              style={{ width: '100%' }}
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={[
                { value: 'Not Started', label: 'Not Started' },
                { value: 'In Progress', label: 'In Progress' },
                { value: 'Waiting', label: 'Waiting' },
                { value: 'Completed', label: 'Completed' },
                { value: 'Overdue', label: 'Overdue' },
                { value: 'Cancelled', label: 'Cancelled' },
              ]}
            />
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Select
              allowClear
              placeholder="Priority"
              style={{ width: '100%' }}
              value={selectedPriority}
              onChange={setSelectedPriority}
              options={[
                { value: 'Low', label: 'Low Priority' },
                { value: 'Medium', label: 'Medium Priority' },
                { value: 'High', label: 'High Priority' },
                { value: 'Critical', label: 'Critical Priority' },
              ]}
            />
          </Col>
        </Row>

        {/* Buttons Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <Space wrap>
            <Button
              type={isOverdueOnly ? 'primary' : 'default'}
              danger={isOverdueOnly}
              icon={<AlertOutlined />}
              onClick={() => setIsOverdueOnly(!isOverdueOnly)}
            >
              {isOverdueOnly ? 'Showing Overdue Only' : 'Show Overdue'}
            </Button>
            <Button icon={<SearchOutlined />} onClick={handleSearch}>
              Search
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>
              Reset
            </Button>
          </Space>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ borderRadius: 6, fontWeight: 500 }}
            onClick={onOpenCreateModal}
          >
            Create Task
          </Button>
        </div>
      </div>

      {/* Task Table */}
      <Table
        columns={columns}
        dataSource={data}
        rowKey="_id"
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        scroll={{ x: 1000 }}
        style={{ borderRadius: 8, overflow: 'hidden' }}
      />
    </Card>
  );
}

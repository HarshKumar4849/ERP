import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Progress,
  Tag,
  List,
  Avatar,
  Space,
  Button,
  Spin,
  Tooltip,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  CalendarOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
  FireOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { Title, Text, Paragraph } = Typography;

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

export default function TaskDashboard({ onSelectTask, onNavigateTab }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await request.list({ entity: 'task/dashboard' });
      if (response && response.result) {
        setData(response.result);
      }
    } catch (err) {
      console.error('Failed to load task dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading && !data) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const metrics = data?.metrics || {
    total: 0,
    today: 0,
    pending: 0,
    overdue: 0,
    completed: 0,
  };

  const completionRate =
    metrics.total > 0 ? Math.round((metrics.completed / metrics.total) * 100) : 0;

  const priorityBreakdown = data?.priorityBreakdown || {};
  const statusBreakdown = data?.statusBreakdown || {};
  const todayTasks = data?.todayTasks || [];
  const overdueTasks = data?.overdueTasks || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top 4 KPI Metrics */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              borderRadius: 12,
              background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f7ff 100%)',
              borderColor: '#91d5ff',
            }}
            bodyStyle={{ padding: 20 }}
            onClick={() => onNavigateTab && onNavigateTab('all')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
                  Today's Tasks
                </Text>
                <Title level={2} style={{ margin: '4px 0 0', color: '#096dd9' }}>
                  {metrics.today}
                </Title>
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(24, 144, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CalendarOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 12, color: '#595959' }}>Due before end of day</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              borderRadius: 12,
              background: 'linear-gradient(135deg, #fffbe6 0%, #fff1b8 100%)',
              borderColor: '#ffe58f',
            }}
            bodyStyle={{ padding: 20 }}
            onClick={() => onNavigateTab && onNavigateTab('all')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
                  Active Pending
                </Text>
                <Title level={2} style={{ margin: '4px 0 0', color: '#d48806' }}>
                  {metrics.pending}
                </Title>
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(250, 173, 20, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ClockCircleOutlined style={{ fontSize: 24, color: '#faad14' }} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 12, color: '#595959' }}>In Progress / Waiting</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              borderRadius: 12,
              background: 'linear-gradient(135deg, #fff1f0 0%, #ffccc7 100%)',
              borderColor: '#ffa39e',
            }}
            bodyStyle={{ padding: 20 }}
            onClick={() => onNavigateTab && onNavigateTab('all')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
                  Overdue
                </Text>
                <Title level={2} style={{ margin: '4px 0 0', color: '#cf1322' }}>
                  {metrics.overdue}
                </Title>
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(245, 34, 45, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertOutlined style={{ fontSize: 24, color: '#f5222d' }} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 12, color: '#cf1322', fontWeight: 600 }}>
                Requires urgent attention
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            hoverable
            style={{
              borderRadius: 12,
              background: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)',
              borderColor: '#b7eb8f',
            }}
            bodyStyle={{ padding: 20 }}
            onClick={() => onNavigateTab && onNavigateTab('all')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
                  Completed
                </Text>
                <Title level={2} style={{ margin: '4px 0 0', color: '#389e0d' }}>
                  {metrics.completed}
                </Title>
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(82, 196, 26, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 12, color: '#595959' }}>
                {completionRate}% overall completion rate
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Analytics & Priority Section */}
      <Row gutter={[16, 16]}>
        {/* Progress & Status Breakdown */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ThunderboltOutlined style={{ color: '#1890ff' }} />
                <span>Task Execution & Lifecycle</span>
              </Space>
            }
            style={{ borderRadius: 12, height: '100%' }}
          >
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text strong>Overall Completion Progress</Text>
                <Text strong style={{ color: '#1890ff' }}>
                  {metrics.completed} / {metrics.total} ({completionRate}%)
                </Text>
              </div>
              <Progress
                percent={completionRate}
                status={completionRate === 100 ? 'success' : 'active'}
                aria-label={`Overall task completion: ${completionRate}%`}
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
                strokeWidth={10}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                Status Distribution
              </Text>
              <Row gutter={[12, 12]}>
                {Object.entries(statusBreakdown).map(([status, count]) => (
                  <Col span={12} key={status}>
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: '#fafafa',
                        border: '1px solid #f0f0f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Tag color={statusColors[status] || 'default'} style={{ margin: 0 }}>
                        {status}
                      </Tag>
                      <Text strong style={{ fontSize: 15 }}>
                        {count}
                      </Text>
                    </div>
                  </Col>
                ))}
              </Row>
            </div>
          </Card>
        </Col>

        {/* Priority Breakdown */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <FireOutlined style={{ color: '#ff4d4f' }} />
                <span>Priority Allocation</span>
              </Space>
            }
            style={{ borderRadius: 12, height: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {['Critical', 'High', 'Medium', 'Low'].map((p) => {
                const count = priorityBreakdown[p] || 0;
                const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
                return (
                  <div key={p}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Space>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: priorityColors[p],
                            display: 'inline-block',
                          }}
                        />
                        <Text strong>{p} Priority</Text>
                      </Space>
                      <Text type="secondary">
                        {count} tasks ({pct}%)
                      </Text>
                    </div>
                    <Progress
                      percent={pct}
                      strokeColor={priorityColors[p]}
                      aria-label={`${p} priority tasks: ${pct}%`}
                      showInfo={false}
                      strokeWidth={8}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Focus Lists: Today's Tasks & Overdue Alerts */}
      <Row gutter={[16, 16]}>
        {/* Today's Tasks */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <CalendarOutlined style={{ color: '#1890ff' }} />
                <span>Today's Deliverables ({todayTasks.length})</span>
              </Space>
            }
            extra={
              <Button type="link" onClick={() => onNavigateTab && onNavigateTab('all')}>
                View All <ArrowRightOutlined />
              </Button>
            }
            style={{ borderRadius: 12 }}
          >
            {todayTasks.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: 36, color: '#52c41a', marginBottom: 8 }} />
                <div>
                  <Text type="secondary">No tasks pending for today. You are fully caught up!</Text>
                </div>
              </div>
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={todayTasks}
                renderItem={(item) => (
                  <List.Item
                    style={{
                      cursor: 'pointer',
                      padding: '12px 8px',
                      borderRadius: 8,
                      transition: 'background 0.2s',
                    }}
                    onClick={() => onSelectTask && onSelectTask(item)}
                    extra={
                      <Tag color={statusColors[item.status] || 'default'}>{item.status}</Tag>
                    }
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          style={{
                            backgroundColor: priorityColors[item.priority] || '#1890ff',
                          }}
                        >
                          {item.priority?.[0] || 'T'}
                        </Avatar>
                      }
                      title={
                        <Space>
                          <Text strong>{item.task || item.title}</Text>
                          {item.priority === 'Critical' && (
                            <Tag color="error" style={{ fontSize: 10 }}>
                              CRITICAL
                            </Tag>
                          )}
                        </Space>
                      }
                      description={
                        <Space size="middle" style={{ fontSize: 12 }}>
                          {item.department && (
                            <span>
                              <UserOutlined style={{ marginRight: 4 }} />
                              {item.department}
                            </span>
                          )}
                          {item.projectName && (
                            <span>
                              <ProjectOutlined style={{ marginRight: 4 }} />
                              {item.projectName}
                            </span>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Overdue Alerts */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                <span>Overdue Action Items ({overdueTasks.length})</span>
              </Space>
            }
            extra={
              overdueTasks.length > 0 && (
                <Tag color="error">Requires Immediate Action</Tag>
              )
            }
            style={{ borderRadius: 12 }}
          >
            {overdueTasks.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: 36, color: '#52c41a', marginBottom: 8 }} />
                <div>
                  <Text type="secondary">Awesome! There are zero overdue tasks in the system.</Text>
                </div>
              </div>
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={overdueTasks}
                renderItem={(item) => (
                  <List.Item
                    style={{
                      cursor: 'pointer',
                      padding: '12px 8px',
                      borderRadius: 8,
                      borderLeft: '3px solid #ff4d4f',
                      background: '#fff2f0',
                      marginBottom: 8,
                    }}
                    onClick={() => onSelectTask && onSelectTask(item)}
                    extra={
                      <div style={{ textAlign: 'right' }}>
                        <Tag color="error">Overdue</Tag>
                        <div style={{ fontSize: 11, color: '#cf1322', marginTop: 4 }}>
                          Due {dayjs(item.dueDate).format('MMM DD, YYYY')}
                        </div>
                      </div>
                    }
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          style={{
                            backgroundColor: '#ff4d4f',
                          }}
                        >
                          !
                        </Avatar>
                      }
                      title={
                        <Text strong style={{ color: '#cf1322' }}>
                          {item.task || item.title}
                        </Text>
                      }
                      description={
                        <Space orientation="horizontal" size="middle" style={{ fontSize: 12 }}>
                          <span>Assignee: {item.ownerName || 'Unassigned'}</span>
                          <span>Dept: {item.department}</span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

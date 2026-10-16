import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Typography,
  Tag,
  Button,
  Space,
  List,
  Avatar,
  Badge,
  Spin,
  Alert,
  Empty,
  Tooltip,
  Divider,
} from 'antd';
import {
  TeamOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CoffeeOutlined,
  UserAddOutlined,
  GiftOutlined,
  TrophyOutlined,
  CheckSquareOutlined,
  AlertOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  NotificationOutlined,
  FileDoneOutlined,
  ProjectOutlined,
  VideoCameraOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
  FireOutlined,
  InfoCircleOutlined,
  UserOutlined,
  FileProtectOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { normalizeRole, ROLES } from '@/utils/rbac';
import { request } from '@/request';
import useResponsive from '@/hooks/useResponsive';

const { Title, Text, Paragraph } = Typography;

export default function DashboardModule() {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const currentAdmin = useSelector(selectCurrentAdmin);
  const userRole = normalizeRole(currentAdmin?.role);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  const fetchDashboardOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await request.get({ entity: 'dashboard/overview' });
      if (response && response.success) {
        setDashboardData(response.result);
      } else {
        setError(response?.message || 'Failed to load dashboard data');
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.message || 'Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardOverview();
  }, []);

  if (loading && !dashboardData) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#475569' }}>
          Loading TecMotiv ERP Management Dashboard...
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="Failed to Load Dashboard"
          description={error}
          action={
            <Button size="small" type="primary" onClick={fetchDashboardOverview}>
              Retry
            </Button>
          }
          showIcon
        />
      </div>
    );
  }

  const kpis = dashboardData?.kpis || {};
  const todayOverview = dashboardData?.todayOverview || {};
  const myTasks = dashboardData?.myTasks || {};
  const companyUpdates = dashboardData?.companyUpdates || {};
  const upcoming = dashboardData?.upcoming || {};

  const isEmployee = userRole === ROLES.EMPLOYEE;
  const isHrOrAdmin = userRole === ROLES.ADMIN || userRole === ROLES.HR;

  const employeeQuickActions = [
    {
      title: 'Apply for Leave',
      desc: 'Submit leave request & check balances',
      icon: <CoffeeOutlined style={{ fontSize: 26, color: '#52c41a' }} />,
      badge: 'Self-Service',
      badgeColor: 'green',
      bg: '#f6ffed',
      border: '#b7eb8f',
      link: '/leave',
    },
    {
      title: 'Document Vault',
      desc: 'Upload personal KYC, IDs, & certificates',
      icon: <FileProtectOutlined style={{ fontSize: 26, color: '#1677ff' }} />,
      badge: 'Confidential',
      badgeColor: 'blue',
      bg: '#e6f4ff',
      border: '#91caff',
      link: '/documents',
    },
    {
      title: 'My Salary Slips',
      desc: 'View & download verified payslips',
      icon: <DollarOutlined style={{ fontSize: 26, color: '#faad14' }} />,
      badge: 'Private',
      badgeColor: 'gold',
      bg: '#fffbe6',
      border: '#ffe58f',
      link: '/payroll',
    },
    {
      title: 'My Attendance Logs',
      desc: 'Check punch logs and monthly attendance',
      icon: <ClockCircleOutlined style={{ fontSize: 26, color: '#722ed1' }} />,
      badge: 'Logs',
      badgeColor: 'purple',
      bg: '#f9f0ff',
      border: '#d3adf7',
      link: '/attendance',
    },
  ];

  const employeeKpiCardItems = [
    {
      title: "Today's Tasks",
      value: myTasks.counts?.today || 0,
      icon: <CalendarOutlined style={{ fontSize: 22, color: '#1677ff' }} />,
      bg: '#e6f4ff',
      border: '#91caff',
      textColor: '#0958d9',
      link: '/tasks',
    },
    {
      title: 'Pending Tasks',
      value: myTasks.counts?.pending || 0,
      icon: <ClockCircleOutlined style={{ fontSize: 22, color: '#fa8c16' }} />,
      bg: '#fff7e6',
      border: '#ffd591',
      textColor: '#d46b08',
      link: '/tasks',
    },
    {
      title: 'Overdue Tasks',
      value: myTasks.counts?.overdue || 0,
      icon: <AlertOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />,
      bg: '#fff1f0',
      border: '#ffa39e',
      textColor: '#cf1322',
      link: '/tasks',
    },
    {
      title: 'Completed Tasks',
      value: myTasks.counts?.completed || 0,
      icon: <CheckCircleOutlined style={{ fontSize: 22, color: '#52c41a' }} />,
      bg: '#f6ffed',
      border: '#b7eb8f',
      textColor: '#389e0d',
      link: '/tasks',
    },
    {
      title: 'Upcoming Events',
      value: upcoming.events?.length || 0,
      icon: <CalendarOutlined style={{ fontSize: 22, color: '#2f54eb' }} />,
      bg: '#f0f5ff',
      border: '#adc6ff',
      textColor: '#1d39c4',
      link: '/events',
    },
    {
      title: 'Celebrations',
      value: kpis.birthdaysThisMonth || 0,
      icon: <GiftOutlined style={{ fontSize: 22, color: '#eb2f96' }} />,
      bg: '#fff0f6',
      border: '#ffadd2',
      textColor: '#c41d7f',
      link: '/calendar',
    },
  ];

  const kpiCardItems = [
    {
      title: 'Total Employees',
      value: kpis.totalEmployees || 0,
      icon: <TeamOutlined style={{ fontSize: 22, color: '#1677ff' }} />,
      bg: '#e6f4ff',
      border: '#91caff',
      textColor: '#0958d9',
      link: '/employees',
    },
    {
      title: 'Present Today',
      value: kpis.presentToday || 0,
      icon: <CheckCircleOutlined style={{ fontSize: 22, color: '#52c41a' }} />,
      bg: '#f6ffed',
      border: '#b7eb8f',
      textColor: '#389e0d',
      link: '/attendance',
    },
    {
      title: 'On Leave',
      value: kpis.onLeave || 0,
      icon: <CoffeeOutlined style={{ fontSize: 22, color: '#fa8c16' }} />,
      bg: '#fff7e6',
      border: '#ffd591',
      textColor: '#d46b08',
      link: '/leave',
    },
    {
      title: 'Absent',
      value: kpis.absent || 0,
      icon: <CloseCircleOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />,
      bg: '#fff1f0',
      border: '#ffa39e',
      textColor: '#cf1322',
      link: '/attendance',
    },
    {
      title: 'New Joiners',
      value: kpis.newJoiners || 0,
      icon: <UserAddOutlined style={{ fontSize: 22, color: '#13c2c2' }} />,
      bg: '#e6fffb',
      border: '#87e8de',
      textColor: '#08979c',
      link: '/employees',
    },
    {
      title: 'Birthdays This Month',
      value: kpis.birthdaysThisMonth || 0,
      icon: <GiftOutlined style={{ fontSize: 22, color: '#eb2f96' }} />,
      bg: '#fff0f6',
      border: '#ffadd2',
      textColor: '#c41d7f',
      link: '/calendar',
    },
    {
      title: 'Work Anniversaries',
      value: kpis.workAnniversaries || 0,
      icon: <TrophyOutlined style={{ fontSize: 22, color: '#faad14' }} />,
      bg: '#fffbe6',
      border: '#ffe58f',
      textColor: '#d48806',
      link: '/employees',
    },
    {
      title: 'Open Tasks',
      value: kpis.openTasks || 0,
      icon: <CheckSquareOutlined style={{ fontSize: 22, color: '#722ed1' }} />,
      bg: '#f9f0ff',
      border: '#d3adf7',
      textColor: '#531dab',
      link: '/tasks',
    },
    {
      title: 'Overdue Tasks',
      value: kpis.overdueTasks || 0,
      icon: <AlertOutlined style={{ fontSize: 22, color: '#f5222d' }} />,
      bg: '#fff2f0',
      border: '#ffccc7',
      textColor: '#a8071a',
      link: '/tasks',
    },
    {
      title: 'Upcoming Events',
      value: kpis.upcomingEvents || 0,
      icon: <CalendarOutlined style={{ fontSize: 22, color: '#2f54eb' }} />,
      bg: '#f0f5ff',
      border: '#adc6ff',
      textColor: '#1d39c4',
      link: '/events',
    },
  ];

  return (
    <div style={{ paddingBottom: 36, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #001f3f 0%, #003366 100%)',
          borderRadius: 14,
          padding: '24px 30px',
          color: '#ffffff',
          boxShadow: '0 4px 16px rgba(0, 31, 63, 0.2)',
        }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Space style={{ marginBottom: 6 }} wrap>
              <Tag color="#1677ff" style={{ fontWeight: 600 }}>
                TECMOTIV ERP
              </Tag>
              <Tag color="cyan">Role: {userRole}</Tag>
              {currentAdmin?.department && (
                <Tag color="purple">Dept: {currentAdmin.department}</Tag>
              )}
            </Space>
            <Title level={2} style={{ color: '#ffffff', margin: 0, fontWeight: 700 }}>
              {isEmployee
                ? `Welcome, ${currentAdmin?.name || 'Team Member'}! 👋`
                : 'Management Overview & Operations Hub'}
            </Title>
            <Paragraph style={{ color: 'rgba(255, 255, 255, 0.85)', margin: '6px 0 0', fontSize: 14 }}>
              {isEmployee
                ? 'Your personalized self-service portal to submit leave applications, securely manage compliance documents, and access verified payslips.'
                : 'Real-time enterprise metrics, workforce availability, deliverables, and organization updates.'}
            </Paragraph>
          </Col>

          <Col xs={24} md={8} style={{ textAlign: isMobile ? 'left' : 'right' }}>
            <Space wrap>
              <Button
                icon={<ReloadOutlined />}
                ghost
                style={{ color: '#fff', borderColor: '#fff' }}
                onClick={fetchDashboardOverview}
              >
                Refresh
              </Button>
              <Button
                type="primary"
                style={{ background: '#1677ff', borderColor: '#1677ff' }}
                onClick={() => navigate('/tasks')}
              >
                Go to Tasks
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 2. Employee Quick Actions Grid (Employee role only) */}
      {isEmployee && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text strong style={{ fontSize: 16, color: '#262626' }}>
              Employee Self-Service Actions
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Quick Direct Access
            </Text>
          </div>

          <Row gutter={[16, 16]}>
            {employeeQuickActions.map((action, idx) => (
              <Col xs={24} sm={12} md={6} key={idx}>
                <Card
                  hoverable
                  onClick={() => navigate(action.link)}
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${action.border}`,
                    background: action.bg,
                    transition: 'all 0.25s',
                    height: '100%',
                  }}
                  bodyStyle={{ padding: '18px 20px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                      }}
                    >
                      {action.icon}
                    </div>
                    <Tag color={action.badgeColor} style={{ borderRadius: 10, fontWeight: 600 }}>
                      {action.badge}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#002244', marginBottom: 4 }}>
                    {action.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#595959', lineHeight: 1.4 }}>
                    {action.desc}
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', color: '#1677ff', fontSize: 12, fontWeight: 600 }}>
                    Access Portal <ArrowRightOutlined style={{ marginLeft: 6, fontSize: 10 }} />
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* 3. KPI Cards Grid (Personalized for Employee, Executive for Admin/HR) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text strong style={{ fontSize: 16, color: '#262626' }}>
            {isEmployee ? 'My Work Metrics & Milestones' : 'Key Performance Indicators'}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Live MongoDB Aggregations
          </Text>
        </div>

        <Row gutter={[14, 14]}>
          {(isEmployee ? employeeKpiCardItems : kpiCardItems).map((item, idx) => (
            <Col xs={12} sm={8} md={6} lg={4} xl={4} key={idx}>
              <Card
                hoverable
                onClick={() => navigate(item.link)}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${item.border}`,
                  background: item.bg,
                  transition: 'all 0.2s',
                  height: '100%',
                }}
                bodyStyle={{ padding: '14px 16px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#595959' }}>
                    {item.title}
                  </span>
                  {item.icon}
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 26, fontWeight: 700, color: item.textColor }}>
                    {item.value}
                  </span>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* 4. SECTION: TODAY'S OVERVIEW */}
      <Card
        title={
          <Space>
            <ClockCircleOutlined style={{ color: '#1677ff', fontSize: 18 }} />
            <span style={{ fontWeight: 600 }}>Today's Overview</span>
            <Tag color="blue">{dayjs().format('dddd, MMMM D, YYYY')}</Tag>
          </Space>
        }
        style={{ borderRadius: 12 }}
      >
        <Row gutter={[20, 20]}>
          {!isEmployee && (
            <>
              {/* Attendance Check-ins (Admin/HR Only) */}
              <Col xs={24} md={12} lg={8}>
                <div
                  style={{
                    background: '#fafafa',
                    borderRadius: 8,
                    padding: 16,
                    border: '1px solid #f0f0f0',
                    height: '100%',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text strong style={{ fontSize: 14 }}>
                      <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />
                      Today's Attendance
                    </Text>
                    <Tag color="green">{todayOverview.attendance?.present || 0} Present</Tag>
                  </div>

                  {todayOverview.attendance?.recentCheckIns?.length > 0 ? (
                    <List
                      size="small"
                      dataSource={todayOverview.attendance.recentCheckIns}
                      renderItem={(item) => (
                        <List.Item style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                          <List.Item.Meta
                            avatar={
                              <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>
                                {item.employee?.name?.[0] || 'E'}
                              </Avatar>
                            }
                            title={
                              <span style={{ fontSize: 12, fontWeight: 500 }}>
                                {item.employee?.name} {item.employee?.surname}
                              </span>
                            }
                            description={
                              <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                                {item.loginTime ? dayjs(item.loginTime).format('hh:mm A') : 'Active'} • {item.workMode || 'Office'}
                              </span>
                            }
                          />
                          <Tag color="success" style={{ fontSize: 10 }}>
                            {item.status}
                          </Tag>
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No check-ins yet today" />
                  )}
                </div>
              </Col>

              {/* On Leave Today (Admin/HR Only) */}
              <Col xs={24} md={12} lg={8}>
                <div
                  style={{
                    background: '#fafafa',
                    borderRadius: 8,
                    padding: 16,
                    border: '1px solid #f0f0f0',
                    height: '100%',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text strong style={{ fontSize: 14 }}>
                      <CoffeeOutlined style={{ color: '#fa8c16', marginRight: 6 }} />
                      On Leave Today
                    </Text>
                    <Tag color="orange">{todayOverview.leave?.length || 0} Out</Tag>
                  </div>

                  {todayOverview.leave?.length > 0 ? (
                    <List
                      size="small"
                      dataSource={todayOverview.leave}
                      renderItem={(item) => (
                        <List.Item style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                          <List.Item.Meta
                            avatar={
                              <Avatar size="small" style={{ backgroundColor: '#fa8c16' }}>
                                {item.employee?.name?.[0] || 'L'}
                              </Avatar>
                            }
                            title={
                              <span style={{ fontSize: 12, fontWeight: 500 }}>
                                {item.employee?.name} {item.employee?.surname}
                              </span>
                            }
                            description={
                              <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                                {item.leaveType} • {item.department}
                              </span>
                            }
                          />
                          <Tag color="warning" style={{ fontSize: 10 }}>
                            Approved
                          </Tag>
                        </List.Item>
                      )}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No employees on leave today" />
                  )}
                </div>
              </Col>
            </>
          )}

          {/* Birthdays & Anniversaries Today */}
          <Col xs={24} md={12} lg={isEmployee ? 12 : 8}>
            <div
              style={{
                background: '#fafafa',
                borderRadius: 8,
                padding: 16,
                border: '1px solid #f0f0f0',
                height: '100%',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text strong style={{ fontSize: 14 }}>
                  <GiftOutlined style={{ color: '#eb2f96', marginRight: 6 }} />
                  Celebrations Today
                </Text>
                <Tag color="magenta">Milestones</Tag>
              </div>

              {todayOverview.birthdays?.length > 0 || todayOverview.anniversaries?.length > 0 ? (
                <div>
                  {todayOverview.birthdays?.map((b, i) => (
                    <div
                      key={`b-${i}`}
                      style={{
                        padding: '8px 10px',
                        background: '#fff0f6',
                        borderRadius: 6,
                        marginBottom: 6,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Space>
                        <GiftOutlined style={{ color: '#eb2f96' }} />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                          {b.name} {b.surname}
                        </span>
                      </Space>
                      <Tag color="magenta" style={{ fontSize: 10 }}>
                        {b.isToday ? '🎂 Birthday Today!' : `Birthday on Day ${b.birthdayDay}`}
                      </Tag>
                    </div>
                  ))}

                  {todayOverview.anniversaries?.map((a, i) => (
                    <div
                      key={`a-${i}`}
                      style={{
                        padding: '8px 10px',
                        background: '#fffbe6',
                        borderRadius: 6,
                        marginBottom: 6,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Space>
                        <TrophyOutlined style={{ color: '#faad14' }} />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                          {a.name} {a.surname}
                        </span>
                      </Space>
                      <Tag color="gold" style={{ fontSize: 10 }}>
                        {a.yearsCompleted} Yr Anniversary
                      </Tag>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No birthdays or anniversaries today" />
              )}
            </div>
          </Col>

          {/* Important Meetings Today */}
          <Col xs={24} md={12} lg={12}>
            <div
              style={{
                background: '#fafafa',
                borderRadius: 8,
                padding: 16,
                border: '1px solid #f0f0f0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text strong style={{ fontSize: 14 }}>
                  <VideoCameraOutlined style={{ color: '#722ed1', marginRight: 6 }} />
                  Important Meetings Today
                </Text>
                <Tag color="purple">{todayOverview.importantMeetings?.length || 0} Scheduled</Tag>
              </div>

              {todayOverview.importantMeetings?.length > 0 ? (
                <List
                  size="small"
                  dataSource={todayOverview.importantMeetings}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <List.Item.Meta
                        title={<span style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</span>}
                        description={
                          <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                            {dayjs(item.startDate).format('hh:mm A')} • {item.location}
                          </span>
                        }
                      />
                      {item.isVirtual && item.meetingLink ? (
                        <Button
                          size="small"
                          type="primary"
                          href={item.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Join
                        </Button>
                      ) : (
                        <Tag color="default">In-Person</Tag>
                      )}
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No meetings scheduled for today" />
              )}
            </div>
          </Col>

          {/* Company Events Today */}
          <Col xs={24} md={12} lg={12}>
            <div
              style={{
                background: '#fafafa',
                borderRadius: 8,
                padding: 16,
                border: '1px solid #f0f0f0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text strong style={{ fontSize: 14 }}>
                  <CalendarOutlined style={{ color: '#1890ff', marginRight: 6 }} />
                  Company Events & Sessions
                </Text>
                <Tag color="blue">{todayOverview.companyEvents?.length || 0} Events</Tag>
              </div>

              {todayOverview.companyEvents?.length > 0 ? (
                <List
                  size="small"
                  dataSource={todayOverview.companyEvents}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <List.Item.Meta
                        title={<span style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</span>}
                        description={
                          <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                            {dayjs(item.startDate).format('hh:mm A')} • {item.location}
                          </span>
                        }
                      />
                      <Tag color="cyan">{item.eventType || 'Event'}</Tag>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No company events today" />
              )}
            </div>
          </Col>
        </Row>
      </Card>

      {/* 4. SECTION: MY TASKS */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <CheckSquareOutlined style={{ color: '#52c41a', fontSize: 18 }} />
              <span style={{ fontWeight: 600 }}>My Tasks Workspace</span>
            </Space>
            <Button type="link" size="small" onClick={() => navigate('/tasks')}>
              Open Daily Task Tracker <ArrowRightOutlined />
            </Button>
          </div>
        }
        style={{ borderRadius: 12 }}
      >
        <Row gutter={[16, 16]}>
          {/* Today's Tasks */}
          <Col xs={24} md={12} lg={6}>
            <Card
              size="small"
              title={
                <Space>
                  <CalendarOutlined style={{ color: '#1890ff' }} />
                  <span>Today's Tasks ({myTasks.counts?.today || 0})</span>
                </Space>
              }
              style={{ borderRadius: 8, height: '100%', background: '#f0f7ff', borderColor: '#bae0ff' }}
            >
              {myTasks.todayTasks?.length > 0 ? (
                <List
                  size="small"
                  dataSource={myTasks.todayTasks}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '6px 0', borderBottom: '1px solid #e6f4ff' }}>
                      <Text strong style={{ fontSize: 12, cursor: 'pointer' }} onClick={() => navigate('/tasks')}>
                        {item.task || item.title}
                      </Text>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No tasks due today" />
              )}
            </Card>
          </Col>

          {/* Pending Tasks */}
          <Col xs={24} md={12} lg={6}>
            <Card
              size="small"
              title={
                <Space>
                  <ClockCircleOutlined style={{ color: '#faad14' }} />
                  <span>Pending Tasks ({myTasks.counts?.pending || 0})</span>
                </Space>
              }
              style={{ borderRadius: 8, height: '100%', background: '#fffbe6', borderColor: '#ffe58f' }}
            >
              {myTasks.pending?.length > 0 ? (
                <List
                  size="small"
                  dataSource={myTasks.pending}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '6px 0', borderBottom: '1px solid #fff1b8' }}>
                      <Text strong style={{ fontSize: 12, cursor: 'pointer' }} onClick={() => navigate('/tasks')}>
                        {item.task || item.title}
                      </Text>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No pending tasks" />
              )}
            </Card>
          </Col>

          {/* Overdue Tasks */}
          <Col xs={24} md={12} lg={6}>
            <Card
              size="small"
              title={
                <Space>
                  <AlertOutlined style={{ color: '#f5222d' }} />
                  <span>Overdue ({myTasks.counts?.overdue || 0})</span>
                </Space>
              }
              style={{ borderRadius: 8, height: '100%', background: '#fff1f0', borderColor: '#ffa39e' }}
            >
              {myTasks.overdue?.length > 0 ? (
                <List
                  size="small"
                  dataSource={myTasks.overdue}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '6px 0', borderBottom: '1px solid #ffccc7' }}>
                      <Text strong style={{ fontSize: 12, color: '#cf1322', cursor: 'pointer' }} onClick={() => navigate('/tasks')}>
                        {item.task || item.title}
                      </Text>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Zero overdue tasks!" />
              )}
            </Card>
          </Col>

          {/* Completed Tasks */}
          <Col xs={24} md={12} lg={6}>
            <Card
              size="small"
              title={
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <span>Completed ({myTasks.counts?.completed || 0})</span>
                </Space>
              }
              style={{ borderRadius: 8, height: '100%', background: '#f6ffed', borderColor: '#b7eb8f' }}
            >
              {myTasks.completed?.length > 0 ? (
                <List
                  size="small"
                  dataSource={myTasks.completed}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '6px 0', borderBottom: '1px solid #d9f7be' }}>
                      <Text delete style={{ fontSize: 12, color: '#595959' }}>
                        {item.task || item.title}
                      </Text>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No completed tasks yet" />
              )}
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 5. SECTION: COMPANY UPDATES */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <NotificationOutlined style={{ color: '#fa8c16', fontSize: 18 }} />
              <span style={{ fontWeight: 600 }}>Company Updates & Governance</span>
            </Space>
            <Button type="link" size="small" onClick={() => navigate('/bulletin')}>
              View Bulletin <ArrowRightOutlined />
            </Button>
          </div>
        }
        style={{ borderRadius: 12 }}
      >
        <Row gutter={[20, 20]}>
          {/* Announcements */}
          <Col xs={24} md={12}>
            <div style={{ background: '#fafafa', borderRadius: 8, padding: 16, border: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text strong style={{ fontSize: 14 }}>
                  <NotificationOutlined style={{ color: '#1677ff', marginRight: 6 }} />
                  Executive Announcements
                </Text>
                <Tag color="blue">Official</Tag>
              </div>

              {companyUpdates.announcements?.length > 0 ? (
                <List
                  itemLayout="horizontal"
                  dataSource={companyUpdates.announcements}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <List.Item.Meta
                        title={<span style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</span>}
                        description={
                          <div>
                            <Paragraph
                              ellipsis={{ rows: 2 }}
                              style={{ margin: '4px 0', fontSize: 12, color: '#595959' }}
                            >
                              {item.content}
                            </Paragraph>
                            <Space size="middle" style={{ fontSize: 11, color: '#8c8c8c' }}>
                              <span>{item.authorName}</span>
                              <span>•</span>
                              <span>{dayjs(item.date).format('MMM DD, YYYY')}</span>
                            </Space>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No active announcements" />
              )}
            </div>
          </Col>

          {/* Important Notices & Policies */}
          <Col xs={24} md={12}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Important Notices */}
              <div style={{ background: '#fffbe6', borderRadius: 8, padding: 14, border: '1px solid #ffe58f' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong style={{ color: '#d48806' }}>
                    <FireOutlined style={{ marginRight: 6 }} />
                    Important Notices
                  </Text>
                  <Tag color="gold">Priority</Tag>
                </div>

                {companyUpdates.importantNotices?.length > 0 ? (
                  <List
                    size="small"
                    dataSource={companyUpdates.importantNotices}
                    renderItem={(item) => (
                      <List.Item style={{ padding: '6px 0', borderBottom: '1px solid #fff1b8' }}>
                        <List.Item.Meta
                          title={
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#ad6800' }}>
                              {item.title}
                            </span>
                          }
                          description={
                            <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                              {dayjs(item.date).format('MMM DD')} • {item.authorName}
                            </span>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    No urgent notices at this time.
                  </Text>
                )}
              </div>

              {/* Active Policies */}
              <div style={{ background: '#fafafa', borderRadius: 8, padding: 14, border: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong>
                    <FileDoneOutlined style={{ color: '#52c41a', marginRight: 6 }} />
                    Company Policies & Compliance
                  </Text>
                  <Button type="link" size="small" onClick={() => navigate('/policies')}>
                    View All
                  </Button>
                </div>

                {companyUpdates.policies?.length > 0 ? (
                  <List
                    size="small"
                    dataSource={companyUpdates.policies}
                    renderItem={(item) => (
                      <List.Item style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <List.Item.Meta
                          title={
                            <span style={{ fontSize: 12, fontWeight: 500 }}>
                              {item.title}
                            </span>
                          }
                          description={
                            <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                              v{item.version || '1.0'} • Category: {item.category || 'General'}
                            </span>
                          }
                        />
                        <Tag color={item.isMandatory ? 'red' : 'default'} style={{ fontSize: 10 }}>
                          {item.isMandatory ? 'Mandatory' : 'Optional'}
                        </Tag>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No policies uploaded" />
                )}
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 6. SECTION: UPCOMING */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <CalendarOutlined style={{ color: '#2f54eb', fontSize: 18 }} />
              <span style={{ fontWeight: 600 }}>Upcoming Horizons & Milestones</span>
            </Space>
            <Tag color="geekblue">Next 14 - 30 Days</Tag>
          </div>
        }
        style={{ borderRadius: 12 }}
      >
        <Row gutter={[16, 16]}>
          {/* Upcoming Meetings & Events */}
          <Col xs={24} md={12} lg={8}>
            <div style={{ background: '#fafafa', borderRadius: 8, padding: 14, border: '1px solid #f0f0f0', height: '100%' }}>
              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
                <CalendarOutlined style={{ color: '#1677ff', marginRight: 6 }} />
                Scheduled Meetings & Events
              </Text>
              {upcoming.events?.length > 0 || upcoming.meetings?.length > 0 ? (
                <List
                  size="small"
                  dataSource={[...(upcoming.meetings || []), ...(upcoming.events || [])]}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <List.Item.Meta
                        title={<span style={{ fontSize: 12, fontWeight: 600 }}>{item.title}</span>}
                        description={
                          <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                            {dayjs(item.startDate).format('MMM DD, hh:mm A')} • {item.location}
                          </span>
                        }
                      />
                      <Tag color="blue" style={{ fontSize: 10 }}>
                        {item.eventType}
                      </Tag>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No upcoming events" />
              )}
            </div>
          </Col>

          {/* Upcoming Leave */}
          <Col xs={24} md={12} lg={8}>
            <div style={{ background: '#fafafa', borderRadius: 8, padding: 14, border: '1px solid #f0f0f0', height: '100%' }}>
              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
                <CoffeeOutlined style={{ color: '#fa8c16', marginRight: 6 }} />
                Scheduled Team Leave
              </Text>
              {upcoming.leave?.length > 0 ? (
                <List
                  size="small"
                  dataSource={upcoming.leave}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <List.Item.Meta
                        avatar={
                          <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>
                            {item.employee?.name?.[0] || 'L'}
                          </Avatar>
                        }
                        title={
                          <span style={{ fontSize: 12, fontWeight: 600 }}>
                            {item.employee?.name} {item.employee?.surname}
                          </span>
                        }
                        description={
                          <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                            {dayjs(item.fromDate).format('MMM DD')} - {dayjs(item.toDate).format('MMM DD')} • {item.leaveType}
                          </span>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No scheduled leaves" />
              )}
            </div>
          </Col>

          {/* Project Milestones */}
          <Col xs={24} md={12} lg={8}>
            <div style={{ background: '#fafafa', borderRadius: 8, padding: 14, border: '1px solid #f0f0f0', height: '100%' }}>
              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
                <ProjectOutlined style={{ color: '#722ed1', marginRight: 6 }} />
                Active Project Milestones
              </Text>
              {upcoming.projectMilestones?.length > 0 ? (
                <List
                  size="small"
                  dataSource={upcoming.projectMilestones}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <List.Item.Meta
                        title={<span style={{ fontSize: 12, fontWeight: 600 }}>{item.name}</span>}
                        description={
                          <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                            Code: {item.code || '-'} • Dept: {item.department}
                          </span>
                        }
                      />
                      <Tag color="purple" style={{ fontSize: 10 }}>
                        {item.status?.toUpperCase() || 'ACTIVE'}
                      </Tag>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No active projects" />
              )}
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
}

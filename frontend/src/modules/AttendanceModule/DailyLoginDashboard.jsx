import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Radio,
  Input,
  Tag,
  Statistic,
  Space,
  message,
  Spin,
  Alert,
  Avatar,
  Divider,
  Switch,
  Select,
} from 'antd';
import {
  ClockCircleOutlined,
  LoginOutlined,
  LogoutOutlined,
  HomeOutlined,
  BankOutlined,
  CarOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ReloadOutlined,
  UserOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { request } from '@/request';

const { Title, Text, Paragraph } = Typography;

export default function DailyLoginDashboard({ currentAdmin, userRole, onNavigateToRecords }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [todayData, setTodayData] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock in form state
  const [selectedWorkMode, setSelectedWorkMode] = useState('Office');
  const [remarks, setRemarks] = useState('');

  // Clock out form state
  const [logoutRemarks, setLogoutRemarks] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [earlyReason, setEarlyReason] = useState('Personal Emergency');

  // Live digital clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTodayStatus = async () => {
    setLoading(true);
    try {
      const res = await request.get({ entity: 'attendance/today' });
      const data = res?.result || res;
      setTodayData(data);
    } catch (err) {
      console.error('Failed to fetch today status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayStatus();
  }, []);

  const handleClockIn = async () => {
    setSubmitting(true);
    try {
      const res = await request.post({
        entity: 'attendance/login',
        jsonData: {
          workMode: selectedWorkMode,
          remarks: remarks.trim(),
        },
      });

      if (res?.success) {
        message.success(res.message || 'Clock-in successful!');
        setRemarks('');
        fetchTodayStatus();
      } else {
        message.error(res?.message || 'Failed to clock in');
      }
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || 'Error during clock in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    setSubmitting(true);
    try {
      const res = await request.post({
        entity: 'attendance/logout',
        jsonData: {
          remarks: logoutRemarks.trim(),
          isHalfDayDeclaration: isHalfDay,
          earlyExitReason: isHalfDay || (todayData?.liveHours < 7.5) ? earlyReason : undefined,
        },
      });

      if (res?.success) {
        message.success(
          isHalfDay
            ? 'Clock-out recorded as Half Day. Notification sent to Admin & HR.'
            : res.message || 'Clock-out successful!'
        );
        setLogoutRemarks('');
        setIsHalfDay(false);
        fetchTodayStatus();
      } else {
        message.error(res?.message || 'Failed to clock out');
      }
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || 'Error during clock out');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (dateObj) => {
    if (!dateObj) return '—';
    return new Date(dateObj).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const isCheckedIn = todayData?.hasLoggedIn;
  const isCheckedOut = todayData?.hasLoggedOut;
  const todayRecord = todayData?.record;
  const orgSummary = todayData?.orgSummary;

  return (
    <div style={{ padding: '4px 0' }}>
      <Row gutter={[20, 20]}>
        {/* LEFT COLUMN: HERO CHECK-IN / CHECK-OUT ACTION WIDGET */}
        <Col xs={24} lg={14}>
          <Card
            bordered={false}
            style={{
              borderRadius: 16,
              boxShadow: '0 8px 24px rgba(0, 34, 68, 0.08)',
              overflow: 'hidden',
              background: '#ffffff',
            }}
          >
            {/* Live Clock Header */}
            <div
              style={{
                background: 'linear-gradient(135deg, #002244 0%, #003366 100%)',
                color: '#ffffff',
                margin: '-24px -24px 24px -24px',
                padding: '24px 28px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <Space orientation="horizontal" size={8}>
                  <ClockCircleOutlined style={{ fontSize: 20, color: '#00d2ff' }} />
                  <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85 }}>
                    Live Attendance Console
                  </span>
                </Space>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace', marginTop: 4 }}>
                  {currentTime.toLocaleTimeString([], { hour12: true })}
                </div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  {currentTime.toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <Button
                  icon={<ReloadOutlined />}
                  size="small"
                  onClick={fetchTodayStatus}
                  loading={loading}
                  style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#fff' }}
                >
                  Sync
                </Button>
                <div style={{ marginTop: 8 }}>
                  <Tag color="cyan" style={{ fontSize: 12, fontWeight: 600 }}>
                    {todayData?.employee?.department || currentAdmin?.department || 'Operations'}
                  </Tag>
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <Spin size="large" />
                <div style={{ marginTop: 12, color: '#8c8c8c' }}>Fetching daily attendance state...</div>
              </div>
            ) : (
              <div>
                {/* 1. STATE: NOT CHECKED IN */}
                {!isCheckedIn && (
                  <div>
                    <Alert
                      type="info"
                      showIcon
                      message="You have not clocked in for today yet."
                      description="Select your work location mode and press Clock In to record your attendance."
                      style={{ marginBottom: 20, borderRadius: 8 }}
                    />

                    <div style={{ marginBottom: 20 }}>
                      <Text strong style={{ display: 'block', marginBottom: 10, color: '#002244' }}>
                        Select Work Mode:
                      </Text>
                      <Radio.Group
                        value={selectedWorkMode}
                        onChange={(e) => setSelectedWorkMode(e.target.value)}
                        size="large"
                        buttonStyle="solid"
                        style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 8 }}
                      >
                        <Radio.Button value="Office" style={{ flex: '1 1 45%', height: 46, lineHeight: '44px', textAlign: 'center', borderRadius: 8 }}>
                          <BankOutlined style={{ marginRight: 6 }} /> Office
                        </Radio.Button>
                        <Radio.Button value="Work From Home" style={{ flex: '1 1 45%', height: 46, lineHeight: '44px', textAlign: 'center', borderRadius: 8 }}>
                          <HomeOutlined style={{ marginRight: 6 }} /> Work From Home
                        </Radio.Button>
                        <Radio.Button value="Client Visit" style={{ flex: '1 1 45%', height: 46, lineHeight: '44px', textAlign: 'center', borderRadius: 8 }}>
                          <CarOutlined style={{ marginRight: 6 }} /> Client Visit
                        </Radio.Button>
                        <Radio.Button value="Event" style={{ flex: '1 1 45%', height: 46, lineHeight: '44px', textAlign: 'center', borderRadius: 8 }}>
                          <CalendarOutlined style={{ marginRight: 6 }} /> Event / Offsite
                        </Radio.Button>
                      </Radio.Group>
                    </div>

                    <div style={{ marginBottom: 24 }}>
                      <Text strong style={{ display: 'block', marginBottom: 8, color: '#002244' }}>
                        Remarks / Purpose (Optional):
                      </Text>
                      <Input
                        placeholder="e.g. Working on quarterly sprint goals, client onsite meeting..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        maxLength={200}
                        allowClear
                      />
                    </div>

                    <Button
                      type="primary"
                      icon={<LoginOutlined />}
                      size="large"
                      block
                      loading={submitting}
                      onClick={handleClockIn}
                      style={{
                        backgroundColor: '#10B981',
                        borderColor: '#10B981',
                        height: 50,
                        fontSize: 16,
                        fontWeight: 600,
                        borderRadius: 10,
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                      }}
                    >
                      Clock In Now ({selectedWorkMode})
                    </Button>
                  </div>
                )}

                {/* 2. STATE: ACTIVE LOGGED IN SESSION (NOT LOGGED OUT) */}
                {isCheckedIn && !isCheckedOut && (
                  <div>
                    <div
                      style={{
                        padding: 18,
                        borderRadius: 12,
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        marginBottom: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <Space orientation="horizontal" size={12}>
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: '#10B981',
                            boxShadow: '0 0 10px #10B981',
                            animation: 'pulse 1.5s infinite',
                          }}
                        />
                        <div>
                          <Text strong style={{ fontSize: 16, color: '#065f46' }}>
                            Active Shift in Progress
                          </Text>
                          <div style={{ fontSize: 13, color: '#047857' }}>
                            Clocked in at <strong>{formatTime(todayRecord?.loginTime)}</strong> as{' '}
                            <strong>{todayRecord?.workMode}</strong>
                          </div>
                        </div>
                      </Space>
                      <Tag color="success" style={{ fontSize: 13, padding: '4px 10px', borderRadius: 6 }}>
                        Status: {todayRecord?.status}
                      </Tag>
                    </div>

                    <Row gutter={16} style={{ marginBottom: 20 }}>
                      <Col span={12}>
                        <Card size="small" bordered style={{ background: '#f8fafc', borderRadius: 8 }}>
                          <Statistic
                            title="Logged In Time"
                            value={formatTime(todayRecord?.loginTime)}
                            prefix={<LoginOutlined style={{ color: '#10B981' }} />}
                            valueStyle={{ fontSize: 18, fontWeight: 600 }}
                          />
                        </Card>
                      </Col>
                      <Col span={12}>
                        <Card size="small" bordered style={{ background: '#f8fafc', borderRadius: 8 }}>
                          <Statistic
                            title="Active Duration"
                            value={`${todayData?.liveHours || 0} hrs`}
                            prefix={<ClockCircleOutlined style={{ color: '#002244' }} />}
                            valueStyle={{ fontSize: 18, fontWeight: 600 }}
                          />
                        </Card>
                      </Col>
                    </Row>

                    {todayRecord?.remarks && (
                      <Paragraph style={{ fontStyle: 'italic', color: '#64748b', marginBottom: 16 }}>
                        "{todayRecord.remarks}"
                      </Paragraph>
                    )}

                    {/* Early Exit / Half Day Declaration */}
                    <div
                      style={{
                        padding: '14px 16px',
                        background: isHalfDay ? '#fffbeb' : '#f8fafc',
                        border: isHalfDay ? '1px solid #fde68a' : '1px solid #e2e8f0',
                        borderRadius: 10,
                        marginBottom: 18,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <Text strong style={{ color: isHalfDay ? '#92400e' : '#1e293b', fontSize: 14 }}>
                            Declare Half Day / Early Departure
                          </Text>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            {todayData?.liveHours < 7.5
                              ? `Current active duration (${todayData?.liveHours || 0} hrs) is under 8 hrs. Admins will be notified.`
                              : 'Mark this shift as Half Day. Admin & HR will receive an instant notification.'}
                          </div>
                        </div>
                        <Switch
                          checked={isHalfDay}
                          onChange={(checked) => setIsHalfDay(checked)}
                        />
                      </div>

                      {isHalfDay && (
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed #fde68a' }}>
                          <Text strong style={{ display: 'block', fontSize: 12, color: '#92400e', marginBottom: 6 }}>
                            Reason for Early Departure:
                          </Text>
                          <Select
                            value={earlyReason}
                            onChange={setEarlyReason}
                            style={{ width: '100%' }}
                            options={[
                              { value: 'Personal Emergency', label: 'Personal Emergency' },
                              { value: 'Feeling Unwell / Sick', label: 'Feeling Unwell / Sick' },
                              { value: 'Approved Half Day Permission', label: 'Approved Half Day Permission' },
                              { value: 'Work / Target Completed Early', label: 'Work / Target Completed Early' },
                              { value: 'Other Urgent Commitment', label: 'Other Urgent Commitment' },
                            ]}
                          />
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <Text strong style={{ display: 'block', marginBottom: 8, color: '#002244' }}>
                        End-of-day Remarks / Handover Notes (Optional):
                      </Text>
                      <Input.TextArea
                        rows={2}
                        placeholder="e.g. Completed module PR review, pending testing for tomorrow..."
                        value={logoutRemarks}
                        onChange={(e) => setLogoutRemarks(e.target.value)}
                        maxLength={200}
                      />
                    </div>

                    <Button
                      type="primary"
                      danger
                      icon={<LogoutOutlined />}
                      size="large"
                      block
                      loading={submitting}
                      onClick={handleClockOut}
                      style={{
                        height: 50,
                        fontSize: 16,
                        fontWeight: 600,
                        borderRadius: 10,
                        boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                      }}
                    >
                      Clock Out for Today
                    </Button>
                  </div>
                )}

                {/* 3. STATE: ALREADY LOGGED OUT FOR TODAY */}
                {isCheckedIn && isCheckedOut && (
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: '50%',
                        background: '#e0f2fe',
                        color: '#0284c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 30,
                        margin: '0 auto 16px auto',
                      }}
                    >
                      <CheckCircleOutlined />
                    </div>

                    <Title level={4} style={{ color: '#002244', marginBottom: 4 }}>
                      Shift Completed for Today
                    </Title>
                    <Paragraph type="secondary" style={{ marginBottom: 20 }}>
                      Your attendance has been fully recorded for {todayData?.dateString}.
                    </Paragraph>

                    <Row gutter={16} style={{ marginBottom: 20 }}>
                      <Col span={8}>
                        <Card size="small" bordered style={{ background: '#f8fafc', borderRadius: 8 }}>
                          <Statistic
                            title="Check-in"
                            value={formatTime(todayRecord?.loginTime)}
                            valueStyle={{ fontSize: 15 }}
                          />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" bordered style={{ background: '#f8fafc', borderRadius: 8 }}>
                          <Statistic
                            title="Check-out"
                            value={formatTime(todayRecord?.logoutTime)}
                            valueStyle={{ fontSize: 15 }}
                          />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" bordered style={{ background: '#f0fdf4', borderRadius: 8 }}>
                          <Statistic
                            title="Total Hours"
                            value={`${todayRecord?.totalHours || 0} hrs`}
                            valueStyle={{ fontSize: 16, fontWeight: 700, color: '#10B981' }}
                          />
                        </Card>
                      </Col>
                    </Row>

                    <Space orientation="horizontal" size={8}>
                      <Tag color="blue" style={{ fontSize: 13, padding: '4px 12px', borderRadius: 6 }}>
                        Mode: {todayRecord?.workMode}
                      </Tag>
                      <Tag color="green" style={{ fontSize: 13, padding: '4px 12px', borderRadius: 6 }}>
                        Final Status: {todayRecord?.status}
                      </Tag>
                    </Space>
                  </div>
                )}
              </div>
            )}
          </Card>
        </Col>

        {/* RIGHT COLUMN: USER PROFILE SUMMARY & ORG PULSE */}
        <Col xs={24} lg={10}>
          {/* User Profile Card */}
          <Card
            bordered={false}
            style={{
              borderRadius: 16,
              boxShadow: '0 8px 24px rgba(0, 34, 68, 0.08)',
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar
                size={64}
                src={todayData?.employee?.photo}
                icon={<UserOutlined />}
                style={{ backgroundColor: '#002244', fontSize: 24 }}
              />
              <div>
                <Title level={4} style={{ margin: 0, color: '#002244' }}>
                  {todayData?.employee?.fullName || `${currentAdmin?.name || ''} ${currentAdmin?.surname || ''}`.trim() || currentAdmin?.email}
                </Title>
                <Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
                  ID: {todayData?.employee?.employeeId || 'EMP-MASTER'} • {todayData?.employee?.designation || currentAdmin?.role}
                </Text>
                <div style={{ marginTop: 6 }}>
                  <Tag color="geekblue" style={{ borderRadius: 4 }}>
                    Role: {userRole}
                  </Tag>
                  <Tag color="purple" style={{ borderRadius: 4 }}>
                    Dept: {todayData?.employee?.department || currentAdmin?.department || 'Operations'}
                  </Tag>
                </div>
              </div>
            </div>
          </Card>

          {/* Org Pulse / Team Overview (Visible to HR, Management, Dept Head) */}
          {orgSummary ? (
            <Card
              title={
                <Space orientation="horizontal" size={8}>
                  <TeamOutlined style={{ color: '#002244' }} />
                  <span>Today's Organization Pulse</span>
                </Space>
              }
              extra={
                <Button type="link" size="small" onClick={onNavigateToRecords}>
                  View Logs
                </Button>
              }
              bordered={false}
              style={{
                borderRadius: 16,
                boxShadow: '0 8px 24px rgba(0, 34, 68, 0.08)',
              }}
            >
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Total Clocked-In</Text>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#002244' }}>
                      {orgSummary.totalLogged || 0}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ padding: '12px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>In Office</Text>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>
                      {orgSummary.officeCount || 0}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ padding: '12px 14px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Work From Home</Text>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#2563eb' }}>
                      {orgSummary.wfhCount || 0}
                    </div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ padding: '12px 14px', background: '#fef3c7', borderRadius: 8, border: '1px solid #fde68a' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Late Logins</Text>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#d97706' }}>
                      {orgSummary.lateCount || 0}
                    </div>
                  </div>
                </Col>
              </Row>

              <Divider style={{ margin: '14px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b' }}>
                <span>Client Visits: <strong>{orgSummary.clientCount || 0}</strong></span>
                <span>Half Days: <strong>{orgSummary.halfDayCount || 0}</strong></span>
                <span>On Leave: <strong>{orgSummary.leaveCount || 0}</strong></span>
              </div>
            </Card>
          ) : (
            <Card
              bordered={false}
              style={{
                borderRadius: 16,
                boxShadow: '0 8px 24px rgba(0, 34, 68, 0.08)',
                background: 'linear-gradient(145deg, #f8fafc 0%, #edf2f7 100%)',
              }}
            >
              <Space orientation="vertical" size={12}>
                <Title level={5} style={{ margin: 0, color: '#002244' }}>
                  Attendance Guidelines
                </Title>
                <Paragraph style={{ fontSize: 13, color: '#475569', marginBottom: 0 }}>
                  • Standard core office hours are <strong>9:00 AM – 6:00 PM</strong>.
                </Paragraph>
                <Paragraph style={{ fontSize: 13, color: '#475569', marginBottom: 0 }}>
                  • Check-ins after <strong>10:00 AM</strong> will automatically register as <em>Late Login</em>.
                </Paragraph>
                <Paragraph style={{ fontSize: 13, color: '#475569', marginBottom: 0 }}>
                  • A minimum of <strong>4 hours</strong> must be logged for half-day credit, and <strong>7.5 hours</strong> for full day.
                </Paragraph>
              </Space>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}

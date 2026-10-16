import React, { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Card,
  Button,
  Tag,
  Typography,
  Space,
  Row,
  Col,
  Radio,
  Alert,
  Table,
  Form,
  Input,
  DatePicker,
  notification,
  Spin,
  Divider,
  Popconfirm,
  Badge,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  DisconnectOutlined,
  CalendarOutlined,
  HistoryOutlined,
  PlusOutlined,
  LinkOutlined,
  SafetyCertificateOutlined,
  VideoCameraOutlined,
  GoogleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { Title, Text, Paragraph } = Typography;

export default function GoogleCalendarSyncModal({ visible, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [activeTab, setActiveTab] = useState('status');

  // Sync settings state
  const [syncDirection, setSyncDirection] = useState('two-way');
  const [sourceOfTruth, setSourceOfTruth] = useState('TECMOTIV');

  // Quick Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [creatingEvent, setCreatingEvent] = useState(false);

  // Fetch status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await request.get({ entity: 'google/status' });
      if (res && res.success) {
        setStatusData(res.result);
        if (res.result.syncDirection) setSyncDirection(res.result.syncDirection);
        if (res.result.sourceOfTruth) setSourceOfTruth(res.result.sourceOfTruth);
      }
    } catch (err) {
      console.error('Failed to fetch Google status:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch live Google Calendar events
  const fetchGoogleEvents = async () => {
    try {
      setLoadingEvents(true);
      const res = await request.get({ entity: 'google/events' });
      if (res && res.success) {
        setGoogleEvents(res.result || []);
      }
    } catch (err) {
      console.error('Failed to fetch Google events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchStatus();
    }
  }, [visible]);

  useEffect(() => {
    if (visible && activeTab === 'events' && statusData?.isConnected) {
      fetchGoogleEvents();
    }
  }, [visible, activeTab, statusData?.isConnected]);

  // Handle Sync
  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      const res = await request.post({
        entity: 'google/sync',
        jsonData: { syncDirection, sourceOfTruth },
      });

      if (res && res.success) {
        notification.success({
          message: 'Google Calendar Synchronized!',
          description: `Successfully processed ${res.result?.syncedCount || 0} events.`,
        });
        fetchStatus();
        if (activeTab === 'events') fetchGoogleEvents();
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      notification.error({
        message: 'Sync Failed',
        description: err.message || 'Could not sync with Google Calendar.',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Handle Connect
  const handleConnect = async () => {
    try {
      setLoading(true);
      const res = await request.post({
        entity: 'google/connect',
        jsonData: { isSandbox: true },
      });
      if (res && res.success) {
        notification.success({
          message: 'Connected to Google Calendar',
          description: 'Calendar synchronization and Google Meet link generator are active.',
        });
        fetchStatus();
      }
    } catch (err) {
      notification.error({ message: 'Connection Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Handle Disconnect
  const handleDisconnect = async () => {
    try {
      setLoading(true);
      const res = await request.post({ entity: 'google/disconnect' });
      if (res && res.success) {
        notification.info({
          message: 'Disconnected',
          description: 'Google Calendar integration paused.',
        });
        fetchStatus();
      }
    } catch (err) {
      notification.error({ message: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Quick Event Creation with Google Meet
  const handleCreateGoogleEvent = async (values) => {
    try {
      setCreatingEvent(true);
      const res = await request.post({
        entity: 'google/event',
        jsonData: {
          title: values.title,
          description: values.description,
          startDate: values.dateRange[0].toISOString(),
          endDate: values.dateRange[1].toISOString(),
          isVirtual: true,
        },
      });

      if (res && res.success) {
        notification.success({
          message: 'Meeting Created!',
          description: 'Meeting added to Google Calendar with auto-generated Google Meet link.',
        });
        setIsCreateModalOpen(false);
        createForm.resetFields();
        fetchGoogleEvents();
        fetchStatus();
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      notification.error({ message: 'Failed to create event', description: err.message });
    } finally {
      setCreatingEvent(false);
    }
  };

  const isConnected = statusData?.isConnected;

  return (
    <>
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: '#4285F4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              G
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Google Calendar & Google Meet Integration</div>
              <div style={{ fontSize: 12, fontWeight: 400, color: '#888' }}>
                Two-Way Sync with Google Workspace & Automatic Google Meet Conferencing
              </div>
            </div>
          </div>
        }
        open={visible}
        onCancel={onClose}
        width={920}
        footer={null}
        destroyOnClose
      >
        <Spin spinning={loading}>
          {/* Connection Status Bar */}
          <Card
            style={{
              marginBottom: 16,
              marginTop: 8,
              borderRadius: 10,
              border: isConnected ? '1px solid #b7eb8f' : '1px solid #ffd591',
              background: isConnected ? '#f6ffed' : '#fffbe6',
            }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <Row align="middle" justify="space-between">
              <Col>
                <Space size="middle" align="center">
                  <Text strong style={{ fontSize: 14 }}>Connection State:</Text>
                  {isConnected ? (
                    <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 13, padding: '3px 10px' }}>
                      Connected to Google Calendar
                    </Tag>
                  ) : (
                    <Tag icon={<CloseCircleOutlined />} color="warning" style={{ fontSize: 13, padding: '3px 10px' }}>
                      Not Connected
                    </Tag>
                  )}
                  {isConnected && (
                    <Tag color="blue" icon={<VideoCameraOutlined />}>
                      Google Meet Enabled
                    </Tag>
                  )}
                  {statusData?.googleEmail && (
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Account: <strong>{statusData.googleEmail}</strong>
                    </Text>
                  )}
                </Space>
              </Col>
              <Col>
                <Space>
                  {isConnected ? (
                    <>
                      <Button
                        type="primary"
                        icon={<SyncOutlined spin={syncing} />}
                        onClick={handleSyncNow}
                        loading={syncing}
                        style={{ background: '#4285F4', borderColor: '#4285F4' }}
                      >
                        Sync Now
                      </Button>
                      <Popconfirm
                        title="Disconnect Google Calendar?"
                        description="Automatic synchronization and Meet link generation will pause."
                        onConfirm={handleDisconnect}
                        okText="Disconnect"
                        cancelText="Cancel"
                      >
                        <Button danger icon={<DisconnectOutlined />}>
                          Disconnect
                        </Button>
                      </Popconfirm>
                    </>
                  ) : (
                    <Button
                      type="primary"
                      icon={<GoogleOutlined />}
                      onClick={handleConnect}
                      style={{ background: '#4285F4', borderColor: '#4285F4' }}
                    >
                      Connect Google Calendar
                    </Button>
                  )}
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Security Compliance Banner */}
          <Alert
            message="Google OAuth 2.0 Security & Privacy Compliance"
            description="TecMotiv strictly never stores Google account passwords. Authorization is handled safely via OAuth 2.0 access & refresh tokens issued by the Google Identity Platform."
            type="info"
            showIcon
            icon={<SafetyCertificateOutlined style={{ color: '#4285F4' }} />}
            style={{ marginBottom: 16, borderRadius: 8, background: '#f0f5ff', border: '1px solid #adc6ff' }}
          />

          {/* Main Tabs */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'status',
                label: (
                  <span>
                    <SyncOutlined style={{ marginRight: 6 }} /> Sync Dashboard & Config
                  </span>
                ),
                children: (
                  <Row gutter={16}>
                    <Col span={14}>
                      <Card title="Synchronization Policy" size="small" style={{ borderRadius: 8 }}>
                        <div style={{ marginBottom: 16 }}>
                          <Text strong>Sync Direction:</Text>
                          <Radio.Group
                            value={syncDirection}
                            onChange={(e) => setSyncDirection(e.target.value)}
                            style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}
                          >
                            <Radio value="two-way">
                              <strong>Two-Way Synchronization</strong>
                              <div style={{ fontSize: 12, color: '#888' }}>
                                Sync events in both directions (TecMotiv ERP ⟷ Google Calendar).
                              </div>
                            </Radio>
                            <Radio value="push-only">
                              <strong>Push Only (TecMotiv ⟶ Google Calendar)</strong>
                              <div style={{ fontSize: 12, color: '#888' }}>
                                Export internal company events, holidays & milestones to Google.
                              </div>
                            </Radio>
                            <Radio value="pull-only">
                              <strong>Pull Only (Google Calendar ⟶ TecMotiv)</strong>
                              <div style={{ fontSize: 12, color: '#888' }}>
                                Import Google Calendar meetings into the TecMotiv calendar.
                              </div>
                            </Radio>
                          </Radio.Group>
                        </div>

                        <Divider style={{ margin: '12px 0' }} />

                        <div>
                          <Text strong>Master Source of Truth:</Text>
                          <Radio.Group
                            value={sourceOfTruth}
                            onChange={(e) => setSourceOfTruth(e.target.value)}
                            style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}
                          >
                            <Radio value="TECMOTIV">
                              <Tag color="green">Recommended</Tag> <strong>TECMOTIV Internal Calendar</strong>
                              <div style={{ fontSize: 12, color: '#888' }}>
                                ERP remains master source; internal event updates override Google Calendar.
                              </div>
                            </Radio>
                            <Radio value="GOOGLE">
                              <strong>Google Calendar</strong>
                              <div style={{ fontSize: 12, color: '#888' }}>
                                Edits on Google Calendar take precedence over ERP records.
                              </div>
                            </Radio>
                          </Radio.Group>
                        </div>
                      </Card>
                    </Col>

                    <Col span={10}>
                      <Card title="Sync Metrics & Health" size="small" style={{ borderRadius: 8 }}>
                        <div style={{ marginBottom: 14 }}>
                          <Text type="secondary">Last Sync Time:</Text>
                          <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>
                            {statusData?.lastSyncAt ? dayjs(statusData.lastSyncAt).format('YYYY-MM-DD HH:mm:ss') : 'Never'}
                          </div>
                        </div>

                        <div style={{ marginBottom: 14 }}>
                          <Text type="secondary">Last Sync Outcome:</Text>
                          <div style={{ marginTop: 2 }}>
                            {statusData?.lastSyncStatus === 'success' ? (
                              <Tag color="success">Success</Tag>
                            ) : (
                              <Tag color="default">Idle</Tag>
                            )}
                          </div>
                        </div>

                        <div style={{ marginBottom: 14 }}>
                          <Text type="secondary">Total Processed Events:</Text>
                          <div style={{ fontSize: 24, fontWeight: 700, color: '#4285F4' }}>
                            {statusData?.syncedCount || 0}
                          </div>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                          <Text type="secondary">Video Meeting Provider:</Text>
                          <div style={{ marginTop: 4 }}>
                            <Tag color="cyan" icon={<VideoCameraOutlined />}>
                              Google Meet (Auto Generated)
                            </Tag>
                          </div>
                        </div>

                        <Button
                          type="primary"
                          block
                          icon={<SyncOutlined spin={syncing} />}
                          onClick={handleSyncNow}
                          loading={syncing}
                          disabled={!isConnected}
                          style={{ background: '#4285F4', borderColor: '#4285F4' }}
                        >
                          Synchronize Now
                        </Button>
                      </Card>
                    </Col>
                  </Row>
                ),
              },
              {
                key: 'events',
                label: (
                  <span>
                    <CalendarOutlined style={{ marginRight: 6 }} /> Google Calendar Events ({googleEvents.length})
                  </span>
                ),
                children: (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text strong>Events Synced with Google Calendar</Text>
                      <Space>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => setIsCreateModalOpen(true)}
                          disabled={!isConnected}
                          style={{ background: '#4285F4', borderColor: '#4285F4' }}
                        >
                          New Google Meeting
                        </Button>
                        <Button icon={<SyncOutlined />} onClick={fetchGoogleEvents} loading={loadingEvents}>
                          Refresh
                        </Button>
                      </Space>
                    </div>

                    <Table
                      dataSource={googleEvents}
                      rowKey="id"
                      loading={loadingEvents}
                      pagination={{ pageSize: 5 }}
                      scroll={{ x: 600 }}
                      columns={[
                        {
                          title: 'Summary / Title',
                          dataIndex: 'summary',
                          key: 'summary',
                          render: (text, r) => (
                            <div>
                              <strong>{text}</strong>
                              {r.hangoutLink && (
                                <div style={{ marginTop: 4 }}>
                                  <a href={r.hangoutLink} target="_blank" rel="noopener noreferrer">
                                    <Tag color="green" icon={<VideoCameraOutlined />}>
                                      Join Google Meet
                                    </Tag>
                                  </a>
                                </div>
                              )}
                            </div>
                          ),
                        },
                        {
                          title: 'Start Time',
                          dataIndex: 'start',
                          key: 'start',
                          render: (start) =>
                            start?.dateTime ? dayjs(start.dateTime).format('YYYY-MM-DD HH:mm') : start?.date || '-',
                        },
                        {
                          title: 'End Time',
                          dataIndex: 'end',
                          key: 'end',
                          render: (end) =>
                            end?.dateTime ? dayjs(end.dateTime).format('YYYY-MM-DD HH:mm') : end?.date || '-',
                        },
                        {
                          title: 'Status',
                          dataIndex: 'status',
                          key: 'status',
                          render: (s) => <Tag color={s === 'confirmed' ? 'green' : 'orange'}>{s || 'Confirmed'}</Tag>,
                        },
                      ]}
                    />
                  </div>
                ),
              },
              {
                key: 'logs',
                label: (
                  <span>
                    <HistoryOutlined style={{ marginRight: 6 }} /> Sync Activity Logs
                  </span>
                ),
                children: (
                  <Table
                    dataSource={statusData?.recentLogs || []}
                    rowKey={(r, idx) => idx}
                    pagination={{ pageSize: 5 }}
                    scroll={{ x: 600 }}
                    columns={[
                      {
                        title: 'Timestamp',
                        dataIndex: 'timestamp',
                        key: 'timestamp',
                        render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
                      },
                      {
                        title: 'Action',
                        dataIndex: 'action',
                        key: 'action',
                        render: (a) => <Tag color={a === 'PUSH' ? 'blue' : 'purple'}>{a}</Tag>,
                      },
                      {
                        title: 'Title',
                        dataIndex: 'title',
                        key: 'title',
                        render: (t) => <strong>{t}</strong>,
                      },
                      {
                        title: 'Details',
                        dataIndex: 'details',
                        key: 'details',
                      },
                      {
                        title: 'Status',
                        dataIndex: 'status',
                        key: 'status',
                        render: (s) => <Tag color="green">{s}</Tag>,
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
        </Spin>
      </Modal>

      {/* Quick Google Event Creator Modal */}
      <Modal
        title="Schedule Google Calendar Meeting with Meet Link"
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={creatingEvent}
        okText="Create on Google Calendar"
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateGoogleEvent}>
          <Form.Item name="title" label="Meeting / Event Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. TecMotiv Client Review" />
          </Form.Item>
          <Form.Item name="description" label="Agenda / Description">
            <Input.TextArea rows={3} placeholder="Meeting agenda and topics..." />
          </Form.Item>
          <Form.Item name="dateRange" label="Schedule Date & Time Range" rules={[{ required: true }]}>
            <DatePicker.RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

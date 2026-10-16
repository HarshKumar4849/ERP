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
  CloudSyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  DisconnectOutlined,
  CalendarOutlined,
  HistoryOutlined,
  PlusOutlined,
  LinkOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { Title, Text, Paragraph } = Typography;

export default function OutlookSyncModal({ visible, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [outlookEvents, setOutlookEvents] = useState([]);
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
      const res = await request.get({ entity: 'outlook/status' });
      if (res && res.success) {
        setStatusData(res.result);
        if (res.result.syncDirection) setSyncDirection(res.result.syncDirection);
        if (res.result.sourceOfTruth) setSourceOfTruth(res.result.sourceOfTruth);
      }
    } catch (err) {
      console.error('Failed to fetch Outlook status:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch live Outlook events
  const fetchOutlookEvents = async () => {
    try {
      setLoadingEvents(true);
      const res = await request.get({ entity: 'outlook/events' });
      if (res && res.success) {
        setOutlookEvents(res.result || []);
      }
    } catch (err) {
      console.error('Failed to fetch Outlook events:', err);
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
      fetchOutlookEvents();
    }
  }, [visible, activeTab, statusData?.isConnected]);

  // Handle Connect (Sandbox or Live Code)
  const handleConnect = async (isSandbox = true) => {
    try {
      setLoading(true);
      const res = await request.post({
        entity: 'outlook/connect',
        jsonData: { isSandbox },
      });
      if (res && res.success) {
        notification.success({
          message: 'Connected to Microsoft 365',
          description: `Successfully connected ${res.result.outlookEmail} via secure OAuth tokens.`,
        });
        await fetchStatus();
        if (onSuccess) onSuccess();
      } else {
        notification.error({
          message: 'Connection Failed',
          description: res?.message || 'Could not connect to Microsoft 365.',
        });
      }
    } catch (err) {
      notification.error({ message: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Handle Reconnect
  const handleReconnect = async () => {
    try {
      setLoading(true);
      const res = await request.post({
        entity: 'outlook/reconnect',
        jsonData: {},
      });
      if (res && res.success) {
        notification.success({
          message: 'Session Refreshed',
          description: 'Microsoft 365 access token refreshed and reconnected successfully.',
        });
        await fetchStatus();
      } else {
        notification.error({
          message: 'Reconnect Failed',
          description: res?.message || 'Failed to refresh Microsoft token.',
        });
      }
    } catch (err) {
      notification.error({ message: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Handle Disconnect
  const handleDisconnect = async () => {
    try {
      setLoading(true);
      const res = await request.post({
        entity: 'outlook/disconnect',
        jsonData: {},
      });
      if (res && res.success) {
        notification.info({
          message: 'Disconnected',
          description: 'Microsoft 365 / Outlook tokens removed and session disconnected.',
        });
        await fetchStatus();
        setOutlookEvents([]);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      notification.error({ message: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Handle Sync Now
  const handleSyncNow = async () => {
    try {
      setSyncing(true);
      const res = await request.post({
        entity: 'outlook/sync',
        jsonData: {
          direction: syncDirection,
          sourceOfTruth,
        },
      });
      if (res && res.success) {
        const stats = res.result?.stats || {};
        notification.success({
          message: 'Synchronization Completed',
          description: `Pushed: ${stats.pushedToOutlook || 0}, Updated: ${stats.updatedInOutlook || 0}, Pulled: ${stats.pulledFromOutlook || 0}, Deduplicated: ${stats.skippedDuplicates || 0}`,
        });
        await fetchStatus();
        if (activeTab === 'events') {
          await fetchOutlookEvents();
        }
        if (onSuccess) onSuccess();
      } else {
        notification.error({
          message: 'Sync Failed',
          description: res?.message || 'Failed to synchronize with Outlook.',
        });
      }
    } catch (err) {
      notification.error({ message: 'Sync Error', description: err.message });
    } finally {
      setSyncing(false);
    }
  };

  // Handle Quick Create Event in Outlook
  const handleCreateOutlookEvent = async (values) => {
    try {
      setCreatingEvent(true);
      const payload = {
        title: values.title,
        description: values.description || '',
        startDate: values.dateRange[0].toISOString(),
        endDate: values.dateRange[1].toISOString(),
        location: values.location || 'TecMotiv Corporate Auditorium',
        isVirtual: Boolean(values.meetingLink),
        meetingLink: values.meetingLink || '',
      };

      const res = await request.post({
        entity: 'outlook/event',
        jsonData: payload,
      });

      if (res && res.success) {
        notification.success({
          message: 'Event Created in Outlook',
          description: `Successfully added "${values.title}" to Microsoft 365 calendar.`,
        });
        setIsCreateModalOpen(false);
        createForm.resetFields();
        await fetchOutlookEvents();
        await fetchStatus();
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      notification.error({ message: 'Creation Failed', description: err.message });
    } finally {
      setCreatingEvent(false);
    }
  };

  // Handle Delete Event in Outlook
  const handleDeleteOutlookEvent = async (id) => {
    try {
      const res = await request.delete({
        entity: 'outlook/event',
        id,
      });
      if (res && res.success) {
        notification.success({ message: 'Event Deleted from Outlook' });
        await fetchOutlookEvents();
      }
    } catch (err) {
      notification.error({ message: 'Failed to Delete', description: err.message });
    }
  };

  // Helper status badge
  const renderStatusBadge = () => {
    if (!statusData) return <Badge status="default" text="Checking status..." />;
    if (statusData.isConnected) {
      return (
        <Tag color="green" style={{ fontSize: 13, padding: '4px 10px', borderRadius: 6 }}>
          <CheckCircleOutlined style={{ marginRight: 6 }} />
          Connected to Microsoft 365 {statusData.isSandbox ? '(Dev Sandbox)' : ''}
        </Tag>
      );
    }
    if (statusData.status === 'token_expired') {
      return (
        <Tag color="orange" style={{ fontSize: 13, padding: '4px 10px', borderRadius: 6 }}>
          <SyncOutlined style={{ marginRight: 6 }} /> Token Expired (Reconnect Required)
        </Tag>
      );
    }
    return (
      <Tag color="default" style={{ fontSize: 13, padding: '4px 10px', borderRadius: 6 }}>
        <CloseCircleOutlined style={{ marginRight: 6 }} /> Disconnected
      </Tag>
    );
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CloudSyncOutlined style={{ fontSize: 24, color: '#0078D4' }} />
          <div>
            <Title level={4} style={{ margin: 0, color: '#1f1f1f' }}>
              Microsoft 365 / Outlook Calendar Integration
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Bidirectional Calendar Sync with Microsoft Graph API & Identity Platform
            </Text>
          </div>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {/* Top Header Card */}
        <Card
          size="small"
          style={{
            marginBottom: 16,
            background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f4ff 100%)',
            border: '1px solid #bae0ff',
            borderRadius: 8,
          }}
        >
          <Row justify="space-between" align="middle" gutter={[16, 8]}>
            <Col>
              <Space orientation="vertical" size={2}>
                <Text style={{ fontWeight: 600, fontSize: 14 }}>Connection State:</Text>
                <div>{renderStatusBadge()}</div>
                {statusData?.outlookEmail && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Account: <strong>{statusData.outlookEmail}</strong>
                  </Text>
                )}
              </Space>
            </Col>
            <Col>
              <Space>
                {statusData?.isConnected ? (
                  <>
                    <Button
                      type="primary"
                      icon={<SyncOutlined spin={syncing} />}
                      loading={syncing}
                      onClick={handleSyncNow}
                      style={{ background: '#0078D4', borderColor: '#0078D4', fontWeight: 600 }}
                    >
                      {syncing ? 'Syncing...' : 'Sync Now'}
                    </Button>
                    <Button icon={<SyncOutlined />} onClick={handleReconnect}>
                      Reconnect
                    </Button>
                    <Popconfirm
                      title="Disconnect Microsoft 365?"
                      description="This will revoke active tokens and halt automatic calendar synchronization."
                      onConfirm={handleDisconnect}
                      okText="Disconnect"
                      cancelText="Cancel"
                      okButtonProps={{ danger: true }}
                    >
                      <Button danger icon={<DisconnectOutlined />}>
                        Disconnect
                      </Button>
                    </Popconfirm>
                  </>
                ) : (
                  <>
                    <Button
                      type="primary"
                      icon={<LinkOutlined />}
                      onClick={() => handleConnect(true)}
                      style={{ background: '#0078D4', borderColor: '#0078D4', fontWeight: 600 }}
                    >
                      Connect Outlook (OAuth 2.0)
                    </Button>
                  </>
                )}
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Security Rule Alert */}
        <Alert
          message={
            <span>
              <SafetyCertificateOutlined style={{ marginRight: 6, color: '#52c41a' }} />
              <strong>Enterprise OAuth 2.0 Security Compliance</strong>
            </span>
          }
          description="TecMotiv strictly never stores Microsoft account passwords. Authorization is handled exclusively via ephemeral OAuth 2.0 access & refresh tokens issued by the Microsoft identity platform."
          type="success"
          showIcon={false}
          style={{ marginBottom: 16, borderRadius: 6 }}
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
                  <CloudSyncOutlined style={{ marginRight: 6 }} /> Sync Dashboard & Config
                </span>
              ),
              children: (
                <div>
                  <Row gutter={[16, 16]}>
                    {/* Synchronization Configuration */}
                    <Col xs={24} md={14}>
                      <Card title="Synchronization Policy" size="small" style={{ borderRadius: 8 }}>
                        <div style={{ marginBottom: 16 }}>
                          <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            Sync Direction:
                          </Text>
                          <Radio.Group
                            value={syncDirection}
                            onChange={(e) => setSyncDirection(e.target.value)}
                          >
                            <Space direction="vertical">
                              <Radio value="two-way">
                                <strong>Two-Way Synchronization</strong>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  Sync events in both directions (TecMotiv ↔ Outlook).
                                </Text>
                              </Radio>
                              <Radio value="to-outlook">
                                <strong>Push Only (TecMotiv → Outlook)</strong>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  Export internal company events to Microsoft Outlook.
                                </Text>
                              </Radio>
                              <Radio value="from-outlook">
                                <strong>Pull Only (Outlook → TecMotiv)</strong>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  Import Outlook events into TecMotiv calendar.
                                </Text>
                              </Radio>
                            </Space>
                          </Radio.Group>
                        </div>

                        <Divider style={{ margin: '12px 0' }} />

                        <div>
                          <Text style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
                            Conflict Resolution / Source of Truth:
                          </Text>
                          <Radio.Group
                            value={sourceOfTruth}
                            onChange={(e) => setSourceOfTruth(e.target.value)}
                          >
                            <Space direction="vertical">
                              <Radio value="TECMOTIV">
                                <Tag color="blue">Recommended</Tag>
                                <strong>TECMOTIV Internal Calendar</strong>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  ERP remains master source; internal event updates override Outlook.
                                </Text>
                              </Radio>
                              <Radio value="OUTLOOK">
                                <strong>Microsoft Outlook Calendar</strong>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  Outlook edits take precedence over internal ERP event fields.
                                </Text>
                              </Radio>
                            </Space>
                          </Radio.Group>
                        </div>

                        <Divider orientation="left" style={{ margin: '16px 0 8px', fontSize: 12 }}>
                          Deduplication Engine
                        </Divider>
                        <Alert
                          message="Active Deduplication Protocol"
                          description="Prevents double-booking and duplicate events by tracking Graph IDs (`outlookEventId`) and normalized title/start-time fingerprints."
                          type="info"
                          showIcon
                          style={{ fontSize: 12 }}
                        />
                      </Card>
                    </Col>

                    {/* Sync Status & Metrics */}
                    <Col xs={24} md={10}>
                      <Card title="Sync Metrics & Health" size="small" style={{ borderRadius: 8 }}>
                        <Space direction="vertical" style={{ width: '100%' }} size={10}>
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Last Sync Time:
                            </Text>
                            <div>
                              <strong>
                                {statusData?.lastSyncAt
                                  ? dayjs(statusData.lastSyncAt).format('YYYY-MM-DD HH:mm:ss')
                                  : 'Never synced'}
                              </strong>
                            </div>
                          </div>

                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Last Sync Outcome:
                            </Text>
                            <div>
                              {statusData?.lastSyncStatus === 'success' ? (
                                <Tag color="green">Success</Tag>
                              ) : statusData?.lastSyncStatus === 'partial' ? (
                                <Tag color="orange">Partial</Tag>
                              ) : statusData?.lastSyncStatus === 'failed' ? (
                                <Tag color="red">Failed</Tag>
                              ) : (
                                <Tag>Never</Tag>
                              )}
                            </div>
                          </div>

                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Total Processed Events:
                            </Text>
                            <div>
                              <Text style={{ fontSize: 18, fontWeight: 700, color: '#0078D4' }}>
                                {statusData?.syncedCount || 0}
                              </Text>
                            </div>
                          </div>

                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              Token Scope:
                            </Text>
                            <div>
                              <Text code style={{ fontSize: 11 }}>
                                {statusData?.tokenScope || 'Calendars.ReadWrite offline_access'}
                              </Text>
                            </div>
                          </div>

                          {statusData?.lastError && (
                            <Alert
                              message="Last Error"
                              description={statusData.lastError}
                              type="warning"
                              showIcon
                              style={{ fontSize: 12, marginTop: 8 }}
                            />
                          )}

                          <Button
                            type="primary"
                            block
                            icon={<SyncOutlined spin={syncing} />}
                            disabled={!statusData?.isConnected}
                            loading={syncing}
                            onClick={handleSyncNow}
                            style={{ marginTop: 12, background: '#0078D4', borderColor: '#0078D4' }}
                          >
                            Synchronize Now
                          </Button>
                        </Space>
                      </Card>
                    </Col>
                  </Row>
                </div>
              ),
            },
            {
              key: 'events',
              label: (
                <span>
                  <CalendarOutlined style={{ marginRight: 6 }} /> Outlook Events Feed (
                  {outlookEvents.length})
                </span>
              ),
              children: (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text type="secondary">
                      Live events retrieved directly from connected Microsoft Outlook Calendar via
                      Graph API:
                    </Text>
                    <Space>
                      <Button
                        icon={<SyncOutlined spin={loadingEvents} />}
                        onClick={fetchOutlookEvents}
                        size="small"
                      >
                        Refresh
                      </Button>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setIsCreateModalOpen(true)}
                        size="small"
                        disabled={!statusData?.isConnected}
                        style={{ background: '#0078D4', borderColor: '#0078D4' }}
                      >
                        Add to Outlook
                      </Button>
                    </Space>
                  </div>

                  <Table
                    size="small"
                    loading={loadingEvents}
                    dataSource={outlookEvents}
                    rowKey="id"
                    pagination={{ pageSize: 5 }}
                    scroll={{ x: 600 }}
                    columns={[
                      {
                        title: 'Subject / Title',
                        dataIndex: 'subject',
                        key: 'subject',
                        render: (text) => <strong>{text || 'Event'}</strong>,
                      },
                      {
                        title: 'Start',
                        dataIndex: ['start', 'dateTime'],
                        key: 'start',
                        render: (val) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
                      },
                      {
                        title: 'End',
                        dataIndex: ['end', 'dateTime'],
                        key: 'end',
                        render: (val) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
                      },
                      {
                        title: 'Location',
                        dataIndex: ['location', 'displayName'],
                        key: 'location',
                        render: (loc) => loc || 'Online / Auditorium',
                      },
                      {
                        title: 'Actions',
                        key: 'actions',
                        width: 90,
                        render: (_, record) => (
                          <Popconfirm
                            title="Delete this event from Outlook?"
                            onConfirm={() => handleDeleteOutlookEvent(record.id)}
                            okText="Delete"
                            cancelText="Cancel"
                            okButtonProps={{ danger: true }}
                          >
                            <Button danger type="text" icon={<DeleteOutlined />} size="small" />
                          </Popconfirm>
                        ),
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
                <div>
                  <Table
                    size="small"
                    dataSource={statusData?.recentLogs || []}
                    rowKey={(rec, i) => `${rec.timestamp}-${i}`}
                    pagination={{ pageSize: 6 }}
                    scroll={{ x: 600 }}
                    columns={[
                      {
                        title: 'Time',
                        dataIndex: 'timestamp',
                        key: 'timestamp',
                        width: 170,
                        render: (val) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-'),
                      },
                      {
                        title: 'Action',
                        dataIndex: 'action',
                        key: 'action',
                        width: 200,
                        render: (act) => <Tag color="blue">{act}</Tag>,
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
                        width: 100,
                        render: (st) =>
                          st === 'success' ? (
                            <Tag color="green">Success</Tag>
                          ) : (
                            <Tag color="red">{st}</Tag>
                          ),
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
      </Spin>

      {/* Quick Add Event in Outlook Modal */}
      <Modal
        title="Schedule Event in Microsoft Outlook"
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateOutlookEvent}>
          <Form.Item
            name="title"
            label="Event Title / Subject"
            rules={[{ required: true, message: 'Please enter event title' }]}
          >
            <Input placeholder="e.g. TECMOTIV Quarterly Strategy Briefing" />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="Event Schedule (Start & End)"
            rules={[{ required: true, message: 'Please select start and end time' }]}
          >
            <DatePicker.RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="location" label="Location / Venue">
            <Input placeholder="e.g. Conference Room A / Virtual Teams" />
          </Form.Item>

          <Form.Item name="meetingLink" label="Microsoft Teams / Online Link">
            <Input placeholder="https://teams.microsoft.com/meet/..." />
          </Form.Item>

          <Form.Item name="description" label="Agenda / Description">
            <Input.TextArea rows={3} placeholder="Event agenda notes..." />
          </Form.Item>

          <Row justify="end" gutter={8}>
            <Col>
              <Button onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            </Col>
            <Col>
              <Button
                type="primary"
                htmlType="submit"
                loading={creatingEvent}
                style={{ background: '#0078D4', borderColor: '#0078D4' }}
              >
                Create in Outlook
              </Button>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Modal>
  );
}

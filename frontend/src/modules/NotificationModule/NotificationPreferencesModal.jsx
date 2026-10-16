import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Switch,
  Input,
  TimePicker,
  Card,
  Table,
  Button,
  Typography,
  Space,
  Row,
  Col,
  Alert,
  Divider,
  Tag,
  notification,
  Spin,
} from 'antd';
import {
  SettingOutlined,
  BellOutlined,
  MailOutlined,
  WhatsAppOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { Title, Text, Paragraph } = Typography;

const EVENT_CATEGORIES = [
  { key: 'leaveSubmitted', label: 'Leave Applications Submitted', desc: 'When employees apply for leaves' },
  { key: 'leaveApproved', label: 'Leave Application Approved', desc: 'When manager approves a leave request' },
  { key: 'leaveRejected', label: 'Leave Application Declined', desc: 'When manager declines a leave request' },
  { key: 'taskAssigned', label: 'Task Assigned', desc: 'When a new project/department task is assigned' },
  { key: 'taskDue', label: 'Task Due Reminder', desc: 'Approaching task deadlines' },
  { key: 'taskOverdue', label: 'Task Overdue Alert', desc: 'Immediate warning for past-due tasks' },
  { key: 'birthday', label: 'Colleague Birthday Celebrations', desc: 'Daily birthday greetings & reminders' },
  { key: 'anniversary', label: 'Work Anniversary Milestones', desc: 'Tenure milestones for colleagues' },
  { key: 'policyAcknowledgement', label: 'Policy Acknowledgement Required', desc: 'Mandatory company policy updates' },
  { key: 'documentExpiry', label: 'Document Expiration Warnings', desc: 'Passport, visa, and credential expiries' },
  { key: 'probationEnding', label: 'Probation Completion Notice', desc: 'Impending probation review conclusion' },
  { key: 'eventReminder', label: 'Company Event & Townhall Reminders', desc: 'Webinars, conferences, and CSR activity' },
  { key: 'recognitionNomination', label: 'Star Employee Recognitions', desc: 'Nomination & awards announcements' },
  { key: 'salarySlipAvailable', label: 'Salary Slip Release', desc: 'Monthly payslip published to self-service' },
  { key: 'saasRenewal', label: 'IT & Digital SaaS Renewals', desc: 'Domain, cloud, and subscription expiries' },
];

export default function NotificationPreferencesModal({ visible, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [typePrefs, setTypePrefs] = useState({});

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const res = await request.get({ entity: 'notification/preferences' });
      if (res && res.success && res.result) {
        const p = res.result;
        form.setFieldsValue({
          inApp: p.channels?.inApp !== false,
          email: p.channels?.email !== false,
          whatsapp: Boolean(p.channels?.whatsapp),
          whatsappPhone: p.whatsappPhone || '',
          dndEnabled: Boolean(p.dndEnabled),
          dndRange: [
            dayjs(p.dndStart || '22:00', 'HH:mm'),
            dayjs(p.dndEnd || '08:00', 'HH:mm'),
          ],
        });
        setTypePrefs(p.typePreferences || {});
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchPreferences();
    }
  }, [visible]);

  const handleToggleTypeChannel = (eventKey, channel) => {
    setTypePrefs((prev) => {
      const current = prev[eventKey] || { inApp: true, email: true, whatsapp: false };
      return {
        ...prev,
        [eventKey]: {
          ...current,
          [channel]: !current[channel],
        },
      };
    });
  };

  const handleSave = async (values) => {
    try {
      setSaving(true);
      const dndRange = values.dndRange || [];
      const payload = {
        channels: {
          inApp: values.inApp,
          email: values.email,
          whatsapp: values.whatsapp,
        },
        whatsappPhone: values.whatsappPhone || '',
        dndEnabled: Boolean(values.dndEnabled),
        dndStart: dndRange[0] ? dndRange[0].format('HH:mm') : '22:00',
        dndEnd: dndRange[1] ? dndRange[1].format('HH:mm') : '08:00',
        typePreferences: typePrefs,
      };

      const res = await request.patch({
        entity: 'notification/preferences',
        jsonData: payload,
      });

      if (res && res.success) {
        notification.success({
          message: 'Preferences Saved',
          description: 'Your notification channels and category settings have been updated.',
        });
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      notification.error({ message: 'Save Failed', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Event Category',
      dataIndex: 'label',
      key: 'label',
      render: (text, record) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{text}</Text>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{record.desc}</div>
        </div>
      ),
    },
    {
      title: (
        <span style={{ fontSize: 12 }}>
          <BellOutlined style={{ marginRight: 4, color: '#1677ff' }} /> In-App
        </span>
      ),
      key: 'inApp',
      width: 80,
      align: 'center',
      render: (_, record) => {
        const val = typePrefs[record.key]?.inApp !== false;
        return (
          <Switch
            size="small"
            checked={val}
            onChange={() => handleToggleTypeChannel(record.key, 'inApp')}
          />
        );
      },
    },
    {
      title: (
        <span style={{ fontSize: 12 }}>
          <MailOutlined style={{ marginRight: 4, color: '#52c41a' }} /> Email
        </span>
      ),
      key: 'email',
      width: 80,
      align: 'center',
      render: (_, record) => {
        const val = typePrefs[record.key]?.email !== false;
        return (
          <Switch
            size="small"
            checked={val}
            onChange={() => handleToggleTypeChannel(record.key, 'email')}
          />
        );
      },
    },
    {
      title: (
        <span style={{ fontSize: 12 }}>
          <WhatsAppOutlined style={{ marginRight: 4, color: '#25D366' }} /> WhatsApp
        </span>
      ),
      key: 'whatsapp',
      width: 90,
      align: 'center',
      render: (_, record) => {
        const val = Boolean(typePrefs[record.key]?.whatsapp);
        return (
          <Switch
            size="small"
            checked={val}
            onChange={() => handleToggleTypeChannel(record.key, 'whatsapp')}
          />
        );
      },
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <SettingOutlined style={{ color: '#002244', fontSize: 20 }} />
          <span>Notification Channels & Preferences</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={780}
      footer={null}
      destroyOnClose
    >
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          {/* Master Delivery Channels */}
          <Card
            size="small"
            title="Master Delivery Channels"
            style={{ marginBottom: 16, borderRadius: 8, background: '#fafafa' }}
          >
            <Row gutter={[16, 12]}>
              <Col xs={24} sm={8}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong><BellOutlined style={{ color: '#1677ff', marginRight: 6 }} />In-App</Text>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>Notification center feed</div>
                  </div>
                  <Form.Item name="inApp" valuePropName="checked" noStyle>
                    <Switch />
                  </Form.Item>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong><MailOutlined style={{ color: '#52c41a', marginRight: 6 }} />Email</Text>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>Registered company email</div>
                  </div>
                  <Form.Item name="email" valuePropName="checked" noStyle>
                    <Switch />
                  </Form.Item>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong><WhatsAppOutlined style={{ color: '#25D366', marginRight: 6 }} />WhatsApp</Text>
                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>Direct mobile alerts</div>
                  </div>
                  <Form.Item name="whatsapp" valuePropName="checked" noStyle>
                    <Switch />
                  </Form.Item>
                </div>
              </Col>
            </Row>

            <Divider style={{ margin: '12px 0' }} />

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="whatsappPhone"
                  label="WhatsApp Mobile Number"
                  extra="Include country code (e.g. +91 98765 43210)"
                  style={{ marginBottom: 0 }}
                >
                  <Input placeholder="+91 98765 43210" prefix={<WhatsAppOutlined style={{ color: '#25D366' }} />} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="dndEnabled"
                  valuePropName="checked"
                  label="Do Not Disturb (DND) Mode"
                  style={{ marginBottom: 4 }}
                >
                  <Switch checkedChildren="DND Active" unCheckedChildren="Off" />
                </Form.Item>
                <Form.Item name="dndRange" label="Quiet Hours Window" style={{ marginBottom: 0 }}>
                  <TimePicker.RangePicker format="HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Granular Category Toggles */}
          <Card
            size="small"
            title="Granular Event Subscriptions (15 Categories)"
            style={{ marginBottom: 16, borderRadius: 8 }}
          >
            <Table
              size="small"
              dataSource={EVENT_CATEGORIES}
              columns={columns}
              rowKey="key"
              pagination={false}
              scroll={{ y: 260, x: 450 }}
            />
          </Card>

          <Row justify="end" gutter={8}>
            <Col>
              <Button onClick={onClose}>Cancel</Button>
            </Col>
            <Col>
              <Button
                type="primary"
                htmlType="submit"
                loading={saving}
                style={{ background: '#002244', borderColor: '#002244', fontWeight: 600 }}
              >
                Save Preferences
              </Button>
            </Col>
          </Row>
        </Form>
      </Spin>
    </Modal>
  );
}

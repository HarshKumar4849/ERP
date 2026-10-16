import React from 'react';
import {
  Drawer,
  Typography,
  Space,
  Tag,
  Button,
  Descriptions,
  Card,
  Row,
  Col,
  Statistic,
  Alert,
  Avatar,
  Divider,
} from 'antd';
import {
  CloudOutlined,
  CalendarOutlined,
  DollarOutlined,
  MailOutlined,
  UserOutlined,
  LinkOutlined,
  LockOutlined,
  ReloadOutlined,
  EditOutlined,
  CreditCardOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { SERVICE_TYPES } from './DigitalServiceFormModal';

const { Title, Text, Paragraph } = Typography;

export default function DigitalServiceDetailsDrawer({
  visible,
  onClose,
  service,
  onEdit,
  onRenew,
}) {
  if (!service) return null;

  const serviceTypeObj = SERVICE_TYPES.find((s) => s.value === service.serviceType);
  const themeColor = serviceTypeObj ? serviceTypeObj.color : '#1890ff';

  const renewalDateObj = dayjs(service.renewalDate);
  const now = dayjs();
  const daysRemaining = renewalDateObj.diff(now, 'day');

  const owner = service.accountOwner;
  const ownerName = owner?.name ? `${owner.name} ${owner.surname || ''}` : service.accountOwnerName || 'IT Admin';

  const isExpired = daysRemaining < 0 || service.status === 'Expired';
  const isExpiringSoon = (daysRemaining >= 0 && daysRemaining <= (service.reminderDaysBefore || 15)) || service.status === 'Expiring Soon';

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 }}>
          <Space>
            <Tag color={themeColor} style={{ fontWeight: 600, fontSize: 13, borderRadius: 4 }}>
              {service.serviceType}
            </Tag>
            <Tag
              color={isExpired ? 'red' : isExpiringSoon ? 'orange' : 'green'}
              style={{ fontWeight: 600, borderRadius: 4 }}
            >
              {service.status || 'Active'}
            </Tag>
          </Space>
        </div>
      }
      open={visible}
      onClose={onClose}
      width={680}
      extra={
        <Space>
          <Button icon={<EditOutlined />} onClick={() => onEdit(service)}>
            Edit
          </Button>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            style={{ background: '#52c41a', borderColor: '#52c41a', fontWeight: 600 }}
            onClick={() => onRenew(service)}
          >
            Renew Service
          </Button>
        </Space>
      }
    >
      {/* Title */}
      <Title level={3} style={{ margin: '0 0 16px', color: '#002244' }}>
        {service.serviceName}
      </Title>

      {/* Renewal Status Banner */}
      <Card
        size="small"
        style={{
          borderRadius: 8,
          marginBottom: 20,
          background: isExpired ? '#fff2f0' : isExpiringSoon ? '#fffbe6' : '#f6ffed',
          border: `1px solid ${isExpired ? '#ffccc7' : isExpiringSoon ? '#ffe58f' : '#b7eb8f'}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isExpired ? (
                <WarningOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
              ) : isExpiringSoon ? (
                <ClockCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />
              ) : (
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
              )}
              <Text strong style={{ fontSize: 14, color: isExpired ? '#cf1322' : isExpiringSoon ? '#d48806' : '#389e0d' }}>
                {isExpired
                  ? `Subscription Expired (${Math.abs(daysRemaining)} days ago)`
                  : isExpiringSoon
                  ? `Renews in ${daysRemaining} Days (${renewalDateObj.format('MMM D, YYYY')})`
                  : `Active Subscription (Renews on ${renewalDateObj.format('MMMM D, YYYY')})`}
              </Text>
            </div>
            <div style={{ fontSize: 12, color: '#595959', marginTop: 4 }}>
              Billing cycle: {service.billingCycle} • Alert triggered {service.reminderDaysBefore || 15} days prior
            </div>
          </div>

          <Button
            type={isExpiringSoon || isExpired ? 'primary' : 'default'}
            danger={isExpired}
            size="middle"
            onClick={() => onRenew(service)}
          >
            Renew Now
          </Button>
        </div>
      </Card>

      {/* Financial Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col span={12}>
          <Card size="small" style={{ borderRadius: 8, background: '#fafafa' }}>
            <Statistic
              title="Subscription Cost"
              value={service.cost || 0}
              prefix={service.currency === 'USD' ? '$' : '₹'}
              suffix={`/ ${service.billingCycle}`}
              valueStyle={{ color: '#002244', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" style={{ borderRadius: 8, background: '#fafafa' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>PAYMENT METHOD</Text>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#262626', marginTop: 4 }}>
              <CreditCardOutlined style={{ marginRight: 6, color: '#1890ff' }} />
              {service.paymentMethod || 'Corporate Card'}
            </div>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
              {service.paymentMethodDetails || 'Default auto-charge account'}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Account Reference (Strictly Credential-Free) */}
      <Card
        size="small"
        title={
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            <LockOutlined style={{ marginRight: 6, color: '#1890ff' }} />
            Administrative Account Reference (No Passwords)
          </span>
        }
        style={{ borderRadius: 8, marginBottom: 20, border: '1px solid #e8e8e8' }}
      >
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Administrative Login Email">
            <Space>
              <MailOutlined style={{ color: '#1890ff' }} />
              <Text copyable strong>{service.loginEmail}</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Designated Account Owner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar size="small" src={owner?.photo} icon={<UserOutlined />} style={{ background: '#002244' }} />
              <Text strong>{ownerName}</Text>
              {owner?.departmentName && <Tag color="blue">{owner.departmentName}</Tag>}
            </div>
          </Descriptions.Item>
          {service.serviceUrl && (
            <Descriptions.Item label="Admin Console Link">
              <Button
                type="link"
                icon={<LinkOutlined />}
                href={service.serviceUrl}
                target="_blank"
                style={{ padding: 0 }}
              >
                Open Admin Portal
              </Button>
            </Descriptions.Item>
          )}
        </Descriptions>

        <div style={{ marginTop: 10, fontSize: 11, color: '#8c8c8c', fontStyle: 'italic' }}>
          🔒 Security Governance: Passwords, tokens, and secrets are strictly NEVER stored in the ERP database.
        </div>
      </Card>

      {/* Notes & License Details */}
      {service.notes && (
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ fontSize: 13 }}>Service Notes, Plan Tier & Seat Counts</Text>
          <Paragraph style={{ marginTop: 6, background: '#fafafa', padding: 12, borderRadius: 6, border: '1px solid #f0f0f0', fontSize: 13, color: '#434343' }}>
            {service.notes}
          </Paragraph>
        </div>
      )}

      {/* Audit Timestamps */}
      <Descriptions size="small" column={2} style={{ marginTop: 16 }}>
        <Descriptions.Item label="Added On">
          {service.created ? dayjs(service.created).format('MMM D, YYYY') : 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="Last Renewed">
          {service.lastRenewedDate ? dayjs(service.lastRenewedDate).format('MMM D, YYYY') : 'Initial Term'}
        </Descriptions.Item>
      </Descriptions>
    </Drawer>
  );
}

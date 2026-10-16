import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Input,
  Select,
  Button,
  Tag,
  Space,
  Typography,
  Avatar,
  Badge,
  Tooltip,
  Dropdown,
  Popconfirm,
  Empty,
  Spin,
  Radio,
  Table,
  Statistic,
  Alert,
  message,
} from 'antd';
import {
  SearchOutlined,
  CloudOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  MoreOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  LockOutlined,
  AppstoreOutlined,
  BarsOutlined,
  LinkOutlined,
  DollarOutlined,
  UserOutlined,
  CreditCardOutlined,
  MailOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';
import DigitalServiceFormModal, { SERVICE_TYPES } from './DigitalServiceFormModal';
import DigitalServiceDetailsDrawer from './DigitalServiceDetailsDrawer';
import RenewServiceModal from './RenewServiceModal';

const { Title, Text, Paragraph } = Typography;

export default function DigitalAdminDashboard({ userRole, currentAdmin }) {
  const [services, setServices] = useState([]);
  const [counts, setCounts] = useState({
    total: 0,
    active: 0,
    expiringSoon: 0,
    expired: 0,
    totalAnnualSpend: 0,
    totalMonthlySpend: 0,
  });
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activeScope, setActiveScope] = useState('all'); // 'all', 'upcoming_renewals', 'expired'
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'

  // Modals & Drawers
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [selectedServiceForDetails, setSelectedServiceForDetails] = useState(null);
  const [renewingService, setRenewingService] = useState(null);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const queryParams = {
        scope: activeScope,
        items: 100,
      };
      if (selectedType !== 'All') queryParams.serviceType = selectedType;
      if (selectedStatus !== 'All') queryParams.status = selectedStatus;
      if (searchText.trim()) queryParams.search = searchText.trim();

      const res = await request.list({
        entity: 'digitalservice',
        options: queryParams,
      });

      if (res && res.result) {
        setServices(res.result);
        if (res.counts) setCounts(res.counts);
      } else {
        setServices([]);
      }
    } catch (err) {
      console.error('Error fetching digital services:', err);
      message.error('Failed to load IT & digital services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [selectedType, selectedStatus, activeScope]);

  const handleDelete = async (id) => {
    try {
      const res = await request.delete({ entity: `digitalservice/delete/${id}` });
      if (res && res.success) {
        message.success('Service record removed successfully');
        fetchServices();
        if (selectedServiceForDetails?._id === id) {
          setSelectedServiceForDetails(null);
        }
      } else {
        message.error(res?.message || 'Delete failed');
      }
    } catch (e) {
      message.error('Error removing service');
    }
  };

  // Urgent expiring soon items for the top banner
  const urgentServices = services.filter(
    (s) => s.status === 'Expiring Soon' || s.status === 'Expired'
  );

  const columns = [
    {
      title: 'Service Name',
      dataIndex: 'serviceName',
      key: 'serviceName',
      render: (text, record) => {
        const typeObj = SERVICE_TYPES.find((s) => s.value === record.serviceType);
        return (
          <Space>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                background: `${typeObj?.color || '#1890ff'}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: typeObj?.color || '#1890ff',
                fontSize: 18,
              }}
            >
              <CloudOutlined />
            </div>
            <div>
              <div
                style={{ fontWeight: 600, color: '#002244', cursor: 'pointer' }}
                onClick={() => setSelectedServiceForDetails(record)}
              >
                {record.serviceName}
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.loginEmail}</div>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Category',
      dataIndex: 'serviceType',
      key: 'serviceType',
      render: (type) => {
        const typeObj = SERVICE_TYPES.find((s) => s.value === type);
        return (
          <Tag color={typeObj?.color || 'blue'} style={{ borderRadius: 4, fontWeight: 600 }}>
            {type}
          </Tag>
        );
      },
    },
    {
      title: 'Account Owner',
      key: 'accountOwner',
      render: (_, r) => {
        const owner = r.accountOwner;
        const name = owner?.name ? `${owner.name} ${owner.surname || ''}` : r.accountOwnerName || 'IT Admin';
        return (
          <Space size="small">
            <Avatar size="small" src={owner?.photo} icon={<UserOutlined />} style={{ background: '#002244' }} />
            <Text style={{ fontSize: 13 }}>{name}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Renewal Date',
      dataIndex: 'renewalDate',
      key: 'renewalDate',
      sorter: (a, b) => new Date(a.renewalDate) - new Date(b.renewalDate),
      render: (date, r) => {
        const daysRemaining = dayjs(date).diff(dayjs(), 'day');
        const isExp = daysRemaining < 0 || r.status === 'Expired';
        const isSoon = daysRemaining >= 0 && daysRemaining <= (r.reminderDaysBefore || 15);

        return (
          <div>
            <div style={{ fontWeight: 600, color: isExp ? '#cf1322' : isSoon ? '#d48806' : '#262626' }}>
              {dayjs(date).format('MMM D, YYYY')}
            </div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
              {isExp ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d remaining`}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Cost & Billing',
      key: 'cost',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {r.currency === 'USD' ? '$' : '₹'} {Number(r.cost || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{r.billingCycle}</div>
        </div>
      ),
    },
    {
      title: 'Payment Method',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (pm) => <span style={{ fontSize: 13 }}>{pm || 'Corporate Card'}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const color = status === 'Active' ? 'green' : status === 'Expiring Soon' ? 'orange' : status === 'Expired' ? 'red' : 'default';
        return <Badge status={color === 'green' ? 'success' : color === 'orange' ? 'warning' : 'error'} text={status || 'Active'} />;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space size="small">
          <Button size="small" onClick={() => setSelectedServiceForDetails(r)}>
            Details
          </Button>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => setRenewingService(r)}
            style={{ color: '#52c41a', borderColor: '#b7eb8f' }}
          >
            Renew
          </Button>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'edit',
                  label: 'Edit Record',
                  icon: <EditOutlined />,
                  onClick: () => {
                    setEditingService(r);
                    setIsFormModalOpen(true);
                  },
                },
                ...(r.serviceUrl
                  ? [
                      {
                        key: 'portal',
                        label: 'Open Admin Portal',
                        icon: <LinkOutlined />,
                        onClick: () => window.open(r.serviceUrl, '_blank'),
                      },
                    ]
                  : []),
                { type: 'divider' },
                {
                  key: 'delete',
                  label: 'Delete Record',
                  danger: true,
                  icon: <DeleteOutlined />,
                  onClick: () => handleDelete(r._id),
                },
              ],
            }}
          >
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header & New Service Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, color: '#002244' }}>
            IT & Digital Admin Workspace
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Track SaaS subscriptions, cloud infrastructure, domain assets, renewals, and corporate spend.
          </Text>
        </div>

        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            style={{ borderRadius: 8, fontWeight: 600, background: '#002244', borderColor: '#002244' }}
            onClick={() => {
              setEditingService(null);
              setIsFormModalOpen(true);
            }}
          >
            Register Service
          </Button>
        </Space>
      </div>

      {/* KPI Cards Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #1890ff' }}>
            <Statistic
              title="Total Services"
              value={counts.total}
              prefix={<CloudOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #52c41a' }}>
            <Statistic
              title="Active Licenses"
              value={counts.active}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #faad14' }}>
            <Statistic
              title="Expiring Soon"
              value={counts.expiringSoon}
              valueStyle={{ color: counts.expiringSoon > 0 ? '#faad14' : undefined, fontWeight: 700 }}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #ff4d4f' }}>
            <Statistic
              title="Expired Services"
              value={counts.expired}
              valueStyle={{ color: counts.expired > 0 ? '#ff4d4f' : undefined, fontWeight: 700 }}
              prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #722ed1' }}>
            <Statistic
              title="Est. Monthly Spend"
              value={counts.totalMonthlySpend}
              prefix="₹"
              valueStyle={{ fontSize: 18, color: '#722ed1', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #002244' }}>
            <Statistic
              title="Annualized Spend"
              value={counts.totalAnnualSpend}
              prefix="₹"
              valueStyle={{ fontSize: 18, color: '#002244', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Urgent Renewals Alert Banner */}
      {urgentServices.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 20, borderRadius: 8 }}
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>
                <strong>Action Required:</strong> {urgentServices.length} digital services require immediate renewal attention.
              </span>
              <Space wrap size={[6, 6]}>
                {urgentServices.slice(0, 3).map((u) => (
                  <Button
                    key={u._id}
                    size="small"
                    type="primary"
                    ghost
                    onClick={() => setRenewingService(u)}
                  >
                    Renew {u.serviceName}
                  </Button>
                ))}
              </Space>
            </div>
          }
        />
      )}

      {/* Filter and Search Controls Bar */}
      <Card
        size="small"
        style={{
          borderRadius: 8,
          marginBottom: 20,
          background: '#fafafa',
          border: '1px solid #f0f0f0',
        }}
      >
        <Row gutter={[12, 12]} align="middle" justify="space-between">
          <Col xs={24} md={10}>
            <Radio.Group
              value={activeScope}
              onChange={(e) => setActiveScope(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="all">All Services</Radio.Button>
              <Radio.Button value="upcoming_renewals">Expiring Soon (30d)</Radio.Button>
              <Radio.Button value="expired">Expired</Radio.Button>
            </Radio.Group>
          </Col>

          <Col xs={24} md={14} style={{ textAlign: 'right' }}>
            <Space wrap>
              <Select
                value={selectedType}
                onChange={setSelectedType}
                style={{ width: 180, textAlign: 'left' }}
                options={[
                  { value: 'All', label: 'All Service Types' },
                  ...SERVICE_TYPES.map((t) => ({ value: t.value, label: t.value })),
                ]}
              />

              <Select
                value={selectedStatus}
                onChange={setSelectedStatus}
                style={{ width: 140, textAlign: 'left' }}
                options={[
                  { value: 'All', label: 'All Statuses' },
                  { value: 'Active', label: 'Active' },
                  { value: 'Expiring Soon', label: 'Expiring Soon' },
                  { value: 'Expired', label: 'Expired' },
                  { value: 'Cancelled', label: 'Cancelled' },
                ]}
              />

              <Input
                placeholder="Search service, email, owner..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onPressEnter={fetchServices}
                style={{ width: 220 }}
                allowClear
              />

              <Radio.Group
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                buttonStyle="solid"
              >
                <Radio.Button value="grid">
                  <AppstoreOutlined />
                </Radio.Button>
                <Radio.Button value="table">
                  <BarsOutlined />
                </Radio.Button>
              </Radio.Group>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="Loading IT & digital services..." />
        </div>
      ) : services.length === 0 ? (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '40px 0' }}>
          <Empty description="No digital services found matching your criteria." />
        </Card>
      ) : viewMode === 'table' ? (
        <Card style={{ borderRadius: 8 }}>
          <Table
            columns={columns}
            dataSource={services}
            rowKey="_id"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 900 }}
          />
        </Card>
      ) : (
        /* Grid Cards View */
        <Row gutter={[20, 20]}>
          {services.map((s) => {
            const typeObj = SERVICE_TYPES.find((t) => t.value === s.serviceType);
            const themeColor = typeObj ? typeObj.color : '#1890ff';

            const daysRemaining = dayjs(s.renewalDate).diff(dayjs(), 'day');
            const isExp = daysRemaining < 0 || s.status === 'Expired';
            const isSoon = daysRemaining >= 0 && daysRemaining <= (s.reminderDaysBefore || 15);

            const owner = s.accountOwner;
            const ownerName = owner?.name ? `${owner.name} ${owner.surname || ''}` : s.accountOwnerName || 'IT Admin';

            return (
              <Col xs={24} sm={12} lg={8} key={s._id}>
                <Card
                  hoverable
                  style={{
                    borderRadius: 10,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid #e8e8e8',
                    borderTop: `4px solid ${themeColor}`,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  }}
                  bodyStyle={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{ flex: 1 }}>
                    {/* Header: Service Type & Status Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Tag color={themeColor} style={{ fontWeight: 600, borderRadius: 4 }}>
                        {s.serviceType}
                      </Tag>
                      <Badge
                        status={isExp ? 'error' : isSoon ? 'warning' : 'success'}
                        text={<span style={{ fontWeight: 600 }}>{s.status || 'Active'}</span>}
                      />
                    </div>

                    {/* Title */}
                    <Title
                      level={5}
                      style={{
                        margin: '0 0 6px',
                        color: '#002244',
                        cursor: 'pointer',
                        fontSize: 15,
                        lineHeight: 1.3,
                      }}
                      onClick={() => setSelectedServiceForDetails(s)}
                    >
                      {s.serviceName}
                    </Title>

                    {/* Login Email */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#595959', fontSize: 13, marginBottom: 10 }}>
                      <MailOutlined style={{ color: '#1890ff' }} />
                      <Text copyable style={{ fontSize: 12, color: '#595959' }}>
                        {s.loginEmail}
                      </Text>
                    </div>

                    {/* Cost & Cycle Banner */}
                    <div
                      style={{
                        background: '#fafafa',
                        padding: '8px 12px',
                        borderRadius: 6,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 12,
                        border: '1px solid #f0f0f0',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>COST / BILLING</div>
                        <div style={{ fontWeight: 700, color: '#002244', fontSize: 14 }}>
                          {s.currency === 'USD' ? '$' : '₹'} {Number(s.cost || 0).toLocaleString()}
                        </div>
                      </div>
                      <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                        {s.billingCycle}
                      </Tag>
                    </div>

                    {/* Renewal Countdown */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                        <span style={{ color: '#8c8c8c' }}>Next Renewal:</span>
                        <strong style={{ color: isExp ? '#cf1322' : isSoon ? '#d48806' : '#262626' }}>
                          {dayjs(s.renewalDate).format('MMM D, YYYY')}
                        </strong>
                      </div>
                      <div style={{ fontSize: 11, color: isExp ? '#cf1322' : isSoon ? '#d48806' : '#52c41a', textAlign: 'right' }}>
                        {isExp ? `Expired ${Math.abs(daysRemaining)} days ago` : `Renews in ${daysRemaining} days`}
                      </div>
                    </div>

                    {/* Account Owner */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid #f0f0f0' }}>
                      <Avatar size="small" src={owner?.photo} icon={<UserOutlined />} style={{ background: '#002244' }} />
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: '#8c8c8c' }}>Owner: </span>
                        <strong>{ownerName}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      paddingTop: 12,
                      borderTop: '1px solid #f0f0f0',
                    }}
                  >
                    <Button
                      type="primary"
                      icon={<EyeOutlined />}
                      style={{ flex: 1, background: '#002244', borderColor: '#002244', fontWeight: 600 }}
                      onClick={() => setSelectedServiceForDetails(s)}
                    >
                      Details
                    </Button>

                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => setRenewingService(s)}
                      style={{ color: '#52c41a', borderColor: '#b7eb8f' }}
                    >
                      Renew
                    </Button>

                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: 'edit',
                            label: 'Edit Service',
                            icon: <EditOutlined />,
                            onClick: () => {
                              setEditingService(s);
                              setIsFormModalOpen(true);
                            },
                          },
                          ...(s.serviceUrl
                            ? [
                                {
                                  key: 'portal',
                                  label: 'Open Console',
                                  icon: <LinkOutlined />,
                                  onClick: () => window.open(s.serviceUrl, '_blank'),
                                },
                              ]
                            : []),
                          { type: 'divider' },
                          {
                            key: 'delete',
                            label: 'Delete Record',
                            danger: true,
                            icon: <DeleteOutlined />,
                            onClick: () => handleDelete(s._id),
                          },
                        ],
                      }}
                    >
                      <Button icon={<MoreOutlined />} />
                    </Dropdown>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Form Modal */}
      <DigitalServiceFormModal
        visible={isFormModalOpen}
        serviceData={editingService}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingService(null);
        }}
        onSuccess={fetchServices}
      />

      {/* Details Slide-out Drawer */}
      <DigitalServiceDetailsDrawer
        visible={Boolean(selectedServiceForDetails)}
        service={selectedServiceForDetails}
        onClose={() => setSelectedServiceForDetails(null)}
        onEdit={(srv) => {
          setSelectedServiceForDetails(null);
          setEditingService(srv);
          setIsFormModalOpen(true);
        }}
        onRenew={(srv) => setRenewingService(srv)}
      />

      {/* Quick Renew Modal */}
      <RenewServiceModal
        visible={Boolean(renewingService)}
        service={renewingService}
        onClose={() => setRenewingService(null)}
        onSuccess={fetchServices}
      />
    </div>
  );
}

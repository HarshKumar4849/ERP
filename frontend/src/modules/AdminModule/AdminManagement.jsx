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
  Tabs,
  Avatar,
  Typography,
  Tooltip,
  Divider,
  Statistic,
  Badge,
  Empty,
  Popconfirm,
  message,
} from 'antd';
import {
  DesktopOutlined,
  ToolOutlined,
  UserOutlined,
  RollbackOutlined,
  HistoryOutlined,
  PlusOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  BankOutlined,
  LaptopOutlined,
  SafetyCertificateOutlined,
  DeleteOutlined,
  ShopOutlined,
  CloudOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';
import { ROLES, normalizeRole } from '@/utils/rbac';
import AssetHistoryDrawer from './components/AssetHistoryDrawer';
import {
  AssetAssignmentModal,
  AssetReturnModal,
  AssetMaintenanceModal,
} from './components/AssetActionModals';
import OfficeManagementTab from './components/OfficeManagementTab';
import { DigitalAdminDashboard } from '@/modules/DigitalAdminModule';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export default function AdminManagement({ userRole, currentAdmin }) {
  const [loading, setLoading] = useState(false);
  const [assetList, setAssetList] = useState([]);
  const [counts, setCounts] = useState({ total: 0, available: 0, issued: 0, returned: 0, maintenance: 0 });
  const [employees, setEmployees] = useState([]);

  // Active top-level tab (For Admin: 'assets' or 'office')
  const [activeTab, setActiveTab] = useState('assets');

  // Filters for assets
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Asset Modals State
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [maintModalVisible, setMaintModalVisible] = useState(false);
  const [isCompleteMaintMode, setIsCompleteMaintMode] = useState(false);

  // Create Asset Modal
  const [createAssetModalVisible, setCreateAssetModalVisible] = useState(false);
  const [submittingAsset, setSubmittingAsset] = useState(false);
  const [createForm] = Form.useForm();

  const role = normalizeRole(userRole || currentAdmin?.role);
  const isEmployee = role === ROLES.EMPLOYEE;
  const isAdminOrManagement = role === ROLES.ADMIN;

  // Fetch Assets
  const fetchAssets = async () => {
    try {
      setLoading(true);
      const queryParams = [];
      if (!isEmployee) {
        if (statusFilter && statusFilter !== 'ALL') queryParams.push(`status=${statusFilter}`);
        if (categoryFilter && categoryFilter !== 'ALL') queryParams.push(`category=${categoryFilter}`);
      }

      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const res = await request.list({ entity: `asset/list${queryString}` });

      if (res && res.success) {
        setAssetList(res.result || []);
        if (res.counts) setCounts(res.counts);
      }
    } catch (err) {
      console.error('Failed to load assets:', err);
      message.error('Unable to fetch assets.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Employees for assignment dropdown
  const fetchEmployees = async () => {
    if (isEmployee) return;
    try {
      const res = await request.list({ entity: 'employee' });
      if (res && res.success) {
        setEmployees(res.result || []);
      }
    } catch (err) {
      console.error('Failed to fetch employees list:', err);
    }
  };

  useEffect(() => {
    fetchAssets();
    if (!isEmployee) {
      fetchEmployees();
    }
  }, [statusFilter, categoryFilter]);

  // Handle Create Asset
  const handleCreateAssetSubmit = async (values) => {
    try {
      setSubmittingAsset(true);
      const res = await request.post({
        entity: 'asset/create',
        jsonData: values,
      });
      if (res && res.success) {
        message.success('New asset cataloged successfully.');
        setCreateAssetModalVisible(false);
        createForm.resetFields();
        fetchAssets();
      } else {
        message.error(res?.message || 'Failed to create asset');
      }
    } catch (err) {
      message.error('Error creating asset.');
    } finally {
      setSubmittingAsset(false);
    }
  };

  // Handle Delete Asset
  const handleDeleteAsset = async (id) => {
    try {
      const res = await request.delete({ entity: `asset/delete/${id}` });
      if (res && res.success) {
        message.success('Asset removed from inventory.');
        fetchAssets();
      }
    } catch (err) {
      message.error('Failed to remove asset.');
    }
  };

  // Filtered Assets by Search
  const filteredAssets = assetList.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.name?.toLowerCase().includes(q) ||
      item.assetId?.toLowerCase().includes(q) ||
      item.serialNumber?.toLowerCase().includes(q) ||
      item.employeeName?.toLowerCase().includes(q)
    );
  });

  // Table Columns
  const columns = [
    {
      title: 'Asset / Device',
      key: 'name',
      render: (_, r) => (
        <Space size={10}>
          <Avatar style={{ backgroundColor: '#002244' }} icon={<LaptopOutlined />} />
          <div>
            <div style={{ fontWeight: 600, color: '#002244', fontSize: 13 }}>{r.name}</div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
              <Tag color="geekblue" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                {r.assetId}
              </Tag>{' '}
              • {r.brand || ''} {r.model || ''}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (cat) => <Tag color="blue">{cat}</Tag>,
    },
    {
      title: 'Lifecycle Status',
      key: 'status',
      render: (_, r) => {
        let color = 'default';
        if (r.status === 'Available') color = 'cyan';
        else if (r.status === 'Issued') color = 'green';
        else if (r.status === 'Returned') color = 'orange';
        else if (r.status === 'Maintenance') color = 'error';

        return (
          <Tag color={color} style={{ borderRadius: 12, fontWeight: 600 }}>
            {r.status}
          </Tag>
        );
      },
    },
    {
      title: 'Condition',
      key: 'condition',
      render: (_, r) => {
        let color = 'blue';
        if (r.condition === 'New') color = 'green';
        else if (r.condition === 'Fair') color = 'orange';
        else if (r.condition === 'Damaged') color = 'red';
        return <Tag color={color}>{r.condition || 'Good'}</Tag>;
      },
    },
    {
      title: isEmployee ? 'Date Issued' : 'Assigned Employee',
      key: 'assignment',
      render: (_, r) => {
        if (r.status === 'Issued') {
          return (
            <div>
              <div style={{ fontWeight: 600, color: '#002244' }}>{r.employeeName || 'Staff Member'}</div>
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                Issued: {r.dateIssued ? dayjs(r.dateIssued).format('DD MMM YYYY') : 'Recent'}
              </div>
            </div>
          );
        }
        if (r.status === 'Maintenance') {
          return (
            <div style={{ color: '#cf1322', fontSize: 11 }}>
              <div>Issue: {r.maintenanceIssue || 'Repair'}</div>
              <div>Vendor: {r.maintenanceVendor}</div>
            </div>
          );
        }
        if (r.status === 'Returned') {
          return (
            <div style={{ color: '#d46b08', fontSize: 11 }}>
              Returned: {r.returnDate ? dayjs(r.returnDate).format('DD MMM YYYY') : 'Past'}
            </div>
          );
        }
        return <Text type="secondary" style={{ fontSize: 12 }}>In Storage ({r.location})</Text>;
      },
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true,
      render: (t) => <span style={{ fontSize: 12, color: '#595959' }}>{t || '-'}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space size={6} wrap>
          {/* History Timeline */}
          <Tooltip title="View Lifecycle History">
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => {
                setSelectedAsset(r);
                setHistoryDrawerVisible(true);
              }}
            />
          </Tooltip>

          {isAdminOrManagement && (
            <>
              {/* Assign Action (Available -> Issued) */}
              {r.status === 'Available' && (
                <Button
                  size="small"
                  type="primary"
                  icon={<UserOutlined />}
                  onClick={() => {
                    setSelectedAsset(r);
                    setAssignModalVisible(true);
                  }}
                  style={{ backgroundColor: '#237804', borderColor: '#237804' }}
                >
                  Assign
                </Button>
              )}

              {/* Return Action (Issued -> Returned) */}
              {r.status === 'Issued' && (
                <Button
                  size="small"
                  icon={<RollbackOutlined />}
                  onClick={() => {
                    setSelectedAsset(r);
                    setReturnModalVisible(true);
                  }}
                  style={{ borderColor: '#fa8c16', color: '#fa8c16' }}
                >
                  Return
                </Button>
              )}

              {/* Maintenance Action (Returned or Available -> Maintenance) */}
              {(r.status === 'Returned' || r.status === 'Available') && (
                <Button
                  size="small"
                  icon={<ToolOutlined />}
                  onClick={() => {
                    setSelectedAsset(r);
                    setIsCompleteMaintMode(false);
                    setMaintModalVisible(true);
                  }}
                  danger
                >
                  Maintenance
                </Button>
              )}

              {/* Complete Maintenance Action (Maintenance -> Available) */}
              {r.status === 'Maintenance' && (
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => {
                    setSelectedAsset(r);
                    setIsCompleteMaintMode(true);
                    setMaintModalVisible(true);
                  }}
                  style={{ backgroundColor: '#13c2c2', borderColor: '#13c2c2' }}
                >
                  Complete
                </Button>
              )}

              <Popconfirm
                title="Remove this asset from inventory?"
                onConfirm={() => handleDeleteAsset(r._id)}
                okText="Yes"
                cancelText="No"
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
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
                icon={<DesktopOutlined style={{ fontSize: 28 }} />}
              />
              <div>
                <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
                  {isEmployee ? 'MY ASSIGNED ASSETS' : 'TECMOTIV ADMINISTRATION & OPERATIONS'}
                </Title>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
                  {isEmployee
                    ? 'Workstations, hardware devices, and peripherals officially issued to your profile.'
                    : 'Manage IT hardware inventory, lifecycle transitions, and 9 office operations.'}
                </Text>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={8} orientation="horizontal" style={{ textAlign: 'right' }}>
            {isAdminOrManagement && (
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={() => {
                  createForm.resetFields();
                  createForm.setFieldsValue({
                    category: 'Laptop',
                    condition: 'New',
                    location: 'HQ - Bangalore',
                  });
                  setCreateAssetModalVisible(true);
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
                Catalog New Asset
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      {/* Top KPI Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title={isEmployee ? 'My Active Assets' : 'Total Asset Inventory'}
              value={isEmployee ? assetList.length : counts.total}
              prefix={<DesktopOutlined style={{ color: '#002244' }} />}
              valueStyle={{ color: '#002244', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title="Issued to Staff"
              value={isEmployee ? assetList.length : counts.issued}
              prefix={<UserOutlined style={{ color: '#237804' }} />}
              valueStyle={{ color: '#237804', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title="Available in Stock"
              value={isEmployee ? 0 : counts.available}
              prefix={<CheckCircleOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title="In Maintenance / Returned"
              value={isEmployee ? 0 : counts.maintenance + counts.returned}
              prefix={<ToolOutlined style={{ color: '#cf1322' }} />}
              valueStyle={{ color: '#cf1322', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content Area */}
      {isAdminOrManagement ? (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          items={[
            {
              key: 'assets',
              label: (
                <Space size={8}>
                  <DesktopOutlined />
                  <span>Employee Assets & Inventory</span>
                </Space>
              ),
              children: (
                <Card bordered={false} style={{ borderRadius: 16 }}>
                  {/* Controls */}
                  <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 20 }}>
                    <Col xs={24} md={10}>
                      <Input
                        placeholder="Search by asset name, asset ID, serial, or employee..."
                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        allowClear
                        style={{ borderRadius: 8 }}
                      />
                    </Col>
                    <Col xs={24} md={14} style={{ textAlign: 'right' }}>
                      <Space wrap>
                        <Select
                          value={statusFilter}
                          onChange={setStatusFilter}
                          style={{ width: 140 }}
                        >
                          <Option value="ALL">All Status</Option>
                          <Option value="Available">Available ({counts.available})</Option>
                          <Option value="Issued">Issued ({counts.issued})</Option>
                          <Option value="Returned">Returned ({counts.returned})</Option>
                          <Option value="Maintenance">Maintenance ({counts.maintenance})</Option>
                        </Select>

                        <Select
                          value={categoryFilter}
                          onChange={setCategoryFilter}
                          style={{ width: 130 }}
                        >
                          <Option value="ALL">All Categories</Option>
                          <Option value="Laptop">Laptop</Option>
                          <Option value="Monitor">Monitor</Option>
                          <Option value="Equipment">Equipment</Option>
                          <Option value="Furniture">Furniture</Option>
                        </Select>
                      </Space>
                    </Col>
                  </Row>

                  <Table
                    columns={columns}
                    dataSource={filteredAssets}
                    rowKey="_id"
                    loading={loading}
                    pagination={{ pageSize: 8 }}
                    scroll={{ x: 850 }}
                  />
                </Card>
              ),
            },
            {
              key: 'office',
              label: (
                <Space size={8}>
                  <ShopOutlined />
                  <span>Office Management (9 Operations)</span>
                </Space>
              ),
              children: <OfficeManagementTab />,
            },
            {
              key: 'digitalServices',
              label: (
                <Space size={8}>
                  <CloudOutlined />
                  <span>IT & Digital Admin (SaaS & Cloud)</span>
                </Space>
              ),
              children: <DigitalAdminDashboard userRole={userRole} currentAdmin={currentAdmin} />,
            },
          ]}
        />
      ) : (
        /* Employee Self-Service Asset View */
        <Card bordered={false} style={{ borderRadius: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0, color: '#002244' }}>
              My Assigned Hardware & Peripherals
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Assets officially assigned to you. For issues or returns, please notify your system administrator.
            </Text>
          </div>

          <Table
            columns={columns}
            dataSource={filteredAssets}
            rowKey="_id"
            loading={loading}
            pagination={{ pageSize: 6 }}
            scroll={{ x: 850 }}
          />
        </Card>
      )}

      {/* Action Modals */}
      <AssetHistoryDrawer
        visible={historyDrawerVisible}
        onClose={() => setHistoryDrawerVisible(false)}
        asset={selectedAsset}
      />

      <AssetAssignmentModal
        visible={assignModalVisible}
        onClose={() => setAssignModalVisible(false)}
        asset={selectedAsset}
        employees={employees}
        onSuccess={fetchAssets}
      />

      <AssetReturnModal
        visible={returnModalVisible}
        onClose={() => setReturnModalVisible(false)}
        asset={selectedAsset}
        onSuccess={fetchAssets}
      />

      <AssetMaintenanceModal
        visible={maintModalVisible}
        onClose={() => setMaintModalVisible(false)}
        asset={selectedAsset}
        isCompleteMode={isCompleteMaintMode}
        onSuccess={fetchAssets}
      />

      {/* Catalog New Asset Modal */}
      <Modal
        title={
          <Space>
            <DesktopOutlined style={{ color: '#002244' }} />
            <span>Catalog New Asset in Inventory</span>
          </Space>
        }
        open={createAssetModalVisible}
        onCancel={() => setCreateAssetModalVisible(false)}
        footer={null}
        width={680}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateAssetSubmit}>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="name"
                label="Asset Name"
                rules={[{ required: true, message: 'Asset name is required' }]}
              >
                <Input placeholder="e.g. Apple MacBook Pro 14 (M3 Pro, 18GB)" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="assetId" label="Asset ID (Leave blank to auto-generate)">
                <Input placeholder="e.g. TM-AST-1040" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select>
                  <Option value="Laptop">Laptop</Option>
                  <Option value="Monitor">Monitor</Option>
                  <Option value="Equipment">Equipment</Option>
                  <Option value="Furniture">Furniture</Option>
                  <Option value="Mobile">Mobile</Option>
                  <Option value="Other">Other</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="brand" label="Brand">
                <Input placeholder="e.g. Apple, Dell, Lenovo" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="model" label="Model Number">
                <Input placeholder="e.g. A2992, U2723QE" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="serialNumber" label="Serial Number">
                <Input placeholder="e.g. C02G8792MD6R" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cost" label="Procurement Cost (₹)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="condition" label="Initial Condition">
                <Select>
                  <Option value="New">New</Option>
                  <Option value="Good">Good</Option>
                  <Option value="Fair">Fair</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="location" label="Storage / Office Location">
                <Input placeholder="e.g. IT Storage Vault - Floor 3" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remarks" label="Remarks / Specifications">
            <TextArea rows={3} placeholder="Charger type, installed OS, warranty expiry notes..." />
          </Form.Item>

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateAssetModalVisible(false)}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submittingAsset}
                style={{ backgroundColor: '#002244', borderColor: '#002244' }}
              >
                Catalog Asset
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

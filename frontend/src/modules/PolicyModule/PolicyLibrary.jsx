import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Tabs,
  Typography,
  Tag,
  Button,
  Space,
  Input,
  Drawer,
  Modal,
  Checkbox,
  List,
  Avatar,
  Progress,
  Spin,
  Alert,
  Empty,
  Tooltip,
  Divider,
  message,
} from 'antd';
import {
  FileDoneOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  LaptopOutlined,
  BankOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  UserOutlined,
  CalendarOutlined,
  EyeOutlined,
  AuditOutlined,
  FileProtectOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';
import { ROLES } from '@/utils/rbac';

const { Title, Text, Paragraph } = Typography;

export default function PolicyLibrary({ userRole, currentAdmin }) {
  const [loading, setLoading] = useState(false);
  const [policyData, setPolicyData] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reader Drawer State
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [readerDrawerVisible, setReaderDrawerVisible] = useState(false);
  const [ackConfirmed, setAckConfirmed] = useState(false);
  const [signingOff, setSigningOff] = useState(false);

  // HR Compliance Audit Modal State
  const [auditPolicy, setAuditPolicy] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [auditModalVisible, setAuditModalVisible] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const isMgmtOrHr = userRole === ROLES.HR || userRole === ROLES.ADMIN;

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const response = await request.list({ entity: 'policy/list' });
      if (response && response.success) {
        setPolicyData(response.result);
      }
    } catch (err) {
      console.error('Failed to load policies:', err);
      message.error('Failed to load policy library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleOpenReader = (policy) => {
    setSelectedPolicy(policy);
    setAckConfirmed(Boolean(policy.isAcknowledged));
    setReaderDrawerVisible(true);
  };

  const handleSignOff = async () => {
    if (!selectedPolicy || !ackConfirmed) return;
    setSigningOff(true);
    try {
      const response = await request.post({
        entity: `policy/acknowledge/${selectedPolicy._id}`,
        jsonData: {
          statement: 'I have read and understood this policy.',
        },
      });

      if (response && response.success) {
        message.success('Policy acknowledged successfully!');
        setReaderDrawerVisible(false);
        fetchPolicies();
      } else {
        message.error(response?.message || 'Failed to record acknowledgement');
      }
    } catch (err) {
      message.error('Error signing off policy');
    } finally {
      setSigningOff(false);
    }
  };

  const handleOpenAuditModal = async (policy) => {
    setAuditPolicy(policy);
    setAuditModalVisible(true);
    setLoadingAudit(true);
    try {
      const response = await request.list({
        entity: `policy/acknowledgements/${policy._id}`,
      });
      if (response && response.success) {
        setAuditData(response.result);
      }
    } catch (err) {
      message.error('Failed to load compliance audit trail');
    } finally {
      setLoadingAudit(false);
    }
  };

  if (loading && !policyData) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const allList = policyData?.all || [];
  const hrList = policyData?.hr || [];
  const itList = policyData?.it || [];
  const companyList = policyData?.company || [];

  const getFilteredList = (list) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.subType?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q)
    );
  };

  const renderPolicyGrid = (policies) => {
    const listToRender = getFilteredList(policies);
    if (listToRender.length === 0) {
      return <Empty description="No matching policies found" style={{ padding: 40 }} />;
    }

    return (
      <Row gutter={[16, 16]}>
        {listToRender.map((policy) => {
          const isAck = Boolean(policy.isAcknowledged);
          const categoryColor =
            policy.category === 'HR' ? 'blue' : policy.category === 'IT' ? 'purple' : 'cyan';

          return (
            <Col xs={24} md={12} lg={8} key={policy._id}>
              <Card
                hoverable
                style={{
                  borderRadius: 10,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: isAck ? '1px solid #d9f7be' : '1px solid #f0f0f0',
                  background: isAck ? '#fcfefc' : '#fff',
                }}
                bodyStyle={{ padding: 18 }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Tag color={categoryColor} style={{ fontWeight: 600 }}>
                      {policy.category} • {policy.subType}
                    </Tag>
                    <Tag color="default">v{policy.version || '1.0'}</Tag>
                  </div>

                  <Title level={5} style={{ margin: '8px 0 6px', color: '#1f1f1f' }}>
                    {policy.name || policy.title}
                  </Title>

                  <Paragraph
                    ellipsis={{ rows: 2 }}
                    style={{ color: '#595959', fontSize: 13, marginBottom: 12 }}
                  >
                    {policy.content || 'Standard corporate guidelines and procedures.'}
                  </Paragraph>

                  <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 12 }}>
                    <div>Owner: {policy.ownerName || 'Compliance Office'}</div>
                    <div>Effective: {dayjs(policy.effectiveDate).format('MMM DD, YYYY')}</div>
                  </div>
                </div>

                <div>
                  <Divider style={{ margin: '10px 0 12px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      {policy.acknowledgementRequired ? (
                        isAck ? (
                          <Tag color="success" style={{ padding: '2px 8px' }}>
                            <CheckCircleOutlined /> Acknowledged
                          </Tag>
                        ) : (
                          <Tag color="warning" style={{ padding: '2px 8px' }}>
                            <ClockCircleOutlined /> Pending Sign-off
                          </Tag>
                        )
                      ) : (
                        <Tag color="default">Advisory</Tag>
                      )}
                    </div>

                    <Space>
                      {isMgmtOrHr && (
                        <Tooltip title="View Compliance Audit Trail">
                          <Button
                            size="small"
                            icon={<AuditOutlined />}
                            onClick={() => handleOpenAuditModal(policy)}
                          />
                        </Tooltip>
                      )}
                      <Button
                        type={isAck ? 'default' : 'primary'}
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleOpenReader(policy)}
                      >
                        {isAck ? 'View Policy' : 'Read & Sign'}
                      </Button>
                    </Space>
                  </div>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #09203f 0%, #537895 100%)',
          borderRadius: 14,
          padding: '24px 30px',
          color: '#ffffff',
          boxShadow: '0 4px 16px rgba(9, 32, 63, 0.2)',
        }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={16}>
            {/* wrap keeps the governance tags inside the header on mobile */}
            <Space style={{ marginBottom: 6 }} wrap>
              <Tag color="#1677ff" style={{ fontWeight: 600 }}>
                TECMOTIV GOVERNANCE
              </Tag>
              <Tag color="cyan">Compliance & Legal Library</Tag>
            </Space>
            <Title level={2} style={{ color: '#ffffff', margin: 0, fontWeight: 700 }}>
              Company Policy Library & Digital Sign-off
            </Title>
            <Paragraph style={{ color: 'rgba(255, 255, 255, 0.85)', margin: '6px 0 0', fontSize: 14 }}>
              Mandatory standards across HR Operations, IT Security, and Corporate Governance.
            </Paragraph>
          </Col>

          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Input
              placeholder="Search policies..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', maxWidth: 280, borderRadius: 8 }}
              allowClear
            />
          </Col>
        </Row>
      </div>

      {/* Tabs Layout */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="large"
        items={[
          {
            key: 'all',
            label: (
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                <FileDoneOutlined style={{ marginRight: 6 }} /> All Policies ({allList.length})
              </span>
            ),
            children: renderPolicyGrid(allList),
          },
          {
            key: 'hr',
            label: (
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                <TeamOutlined style={{ marginRight: 6 }} /> HR Operations ({hrList.length})
              </span>
            ),
            children: renderPolicyGrid(hrList),
          },
          {
            key: 'it',
            label: (
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                <LaptopOutlined style={{ marginRight: 6 }} /> IT & Cybersecurity ({itList.length})
              </span>
            ),
            children: renderPolicyGrid(itList),
          },
          {
            key: 'company',
            label: (
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                <BankOutlined style={{ marginRight: 6 }} /> Corporate Governance ({companyList.length})
              </span>
            ),
            children: renderPolicyGrid(companyList),
          },
        ]}
      />

      {/* Policy Reader & Sign-off Drawer */}
      <Drawer
        title={
          selectedPolicy && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <FileProtectOutlined style={{ color: '#1677ff' }} />
                <span>{selectedPolicy.name || selectedPolicy.title}</span>
              </Space>
              <Tag color="blue">v{selectedPolicy.version}</Tag>
            </div>
          )
        }
        placement="right"
        width={680}
        onClose={() => setReaderDrawerVisible(false)}
        open={readerDrawerVisible}
      >
        {selectedPolicy && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Metadata Summary */}
            <div
              style={{
                padding: 16,
                borderRadius: 8,
                background: '#fafafa',
                border: '1px solid #f0f0f0',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
              }}
            >
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Category:</Text>
                <div><Tag color="cyan">{selectedPolicy.category} • {selectedPolicy.subType}</Tag></div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Owner:</Text>
                <div style={{ fontWeight: 500 }}>{selectedPolicy.ownerName || 'Compliance Office'}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Effective Date:</Text>
                <div>{dayjs(selectedPolicy.effectiveDate).format('MMMM D, YYYY')}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Document Version:</Text>
                <div style={{ fontWeight: 600 }}>Version {selectedPolicy.version}</div>
              </div>
            </div>

            {/* Policy Content Body */}
            <div>
              <Title level={5}>Policy Directives & Compliance Scope</Title>
              <Paragraph
                style={{
                  padding: 16,
                  borderRadius: 8,
                  background: '#fff',
                  border: '1px solid #f0f0f0',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-line',
                  fontSize: 14,
                  color: '#262626',
                }}
              >
                {selectedPolicy.content || 'Standard corporate guidelines and procedures.'}
              </Paragraph>
            </div>

            {/* Digital Sign-off Section */}
            {selectedPolicy.acknowledgementRequired && (
              <div
                style={{
                  padding: 18,
                  borderRadius: 10,
                  background: selectedPolicy.isAcknowledged ? '#f6ffed' : '#e6f4ff',
                  border: `1px solid ${selectedPolicy.isAcknowledged ? '#b7eb8f' : '#91caff'}`,
                }}
              >
                {selectedPolicy.isAcknowledged ? (
                  <div>
                    <Space style={{ marginBottom: 6 }}>
                      <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                      <Text strong style={{ color: '#389e0d' }}>
                        Digitally Signed & Acknowledged
                      </Text>
                    </Space>
                    <div style={{ fontSize: 12, color: '#595959' }}>
                      Statement: "I have read and understood this policy."
                    </div>
                    {selectedPolicy.acknowledgementDetails?.timestamp && (
                      <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
                        Recorded on {dayjs(selectedPolicy.acknowledgementDetails.timestamp).format('MMMM D, YYYY hh:mm A')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <Text strong style={{ fontSize: 14, color: '#0958d9' }}>
                      Mandatory Employee Acknowledgment Required
                    </Text>
                    <Paragraph style={{ fontSize: 12, color: '#595959', margin: '4px 0 12px' }}>
                      As part of TecMotiv compliance governance, all employees must review and digitally sign off on this document.
                    </Paragraph>

                    <div style={{ marginBottom: 14 }}>
                      <Checkbox
                        checked={ackConfirmed}
                        onChange={(e) => setAckConfirmed(e.target.checked)}
                      >
                        <span style={{ fontWeight: 600 }}>
                          "I have read and understood this policy."
                        </span>
                      </Checkbox>
                    </div>

                    <Button
                      type="primary"
                      icon={<SafetyCertificateOutlined />}
                      loading={signingOff}
                      disabled={!ackConfirmed}
                      onClick={handleSignOff}
                    >
                      Confirm Digital Acknowledgment
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Compliance Audit Trail Modal (HR / Management) */}
      <Modal
        title={
          auditPolicy && (
            <Space>
              <AuditOutlined style={{ color: '#1677ff' }} />
              <span>Compliance Audit Trail: {auditPolicy.name}</span>
            </Space>
          )
        }
        open={auditModalVisible}
        onCancel={() => setAuditModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setAuditModalVisible(false)}>
            Close
          </Button>,
        ]}
        width={680}
      >
        {loadingAudit ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin />
          </div>
        ) : auditData ? (
          <div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text strong>Workforce Compliance Rate</Text>
                <Text strong style={{ color: '#1677ff' }}>
                  {auditData.totalAcknowledged} / {auditData.totalEmployees} ({auditData.complianceRate}%)
                </Text>
              </div>
              <Progress
                percent={auditData.complianceRate}
                status={auditData.complianceRate === 100 ? 'success' : 'active'}
                strokeColor="#52c41a"
              />
            </div>

            <Title level={5} style={{ margin: '14px 0 8px' }}>
              Employee Digital Sign-off Log ({auditData.acknowledgements?.length || 0})
            </Title>

            <List
              size="small"
              dataSource={auditData.acknowledgements}
              renderItem={(ack) => (
                <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <List.Item.Meta
                    avatar={
                      <Avatar style={{ backgroundColor: '#1890ff' }}>
                        {ack.employee?.name?.[0] || 'E'}
                      </Avatar>
                    }
                    title={
                      <Space>
                        <Text strong style={{ fontSize: 13 }}>
                          {ack.employeeName}
                        </Text>
                        <Tag color="cyan" style={{ fontSize: 10 }}>
                          v{ack.version}
                        </Tag>
                        <Tag color="blue" style={{ fontSize: 10 }}>
                          {ack.department}
                        </Tag>
                      </Space>
                    }
                    description={
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                        "{ack.statement}" • {dayjs(ack.timestamp).format('MMM D, YYYY hh:mm A')}
                      </div>
                    }
                  />
                  <Tag color="success">Verified</Tag>
                </List.Item>
              )}
            />
          </div>
        ) : (
          <Empty description="No audit data found" />
        )}
      </Modal>
    </div>
  );
}

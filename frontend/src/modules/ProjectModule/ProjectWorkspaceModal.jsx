import React, { useState } from 'react';
import {
  Drawer,
  Tabs,
  Row,
  Col,
  Card,
  Tag,
  Typography,
  Progress,
  Button,
  Space,
  Avatar,
  List,
  Table,
  Badge,
  Divider,
  Input,
  Modal,
  Form,
  DatePicker,
  Select,
  Tooltip,
  message,
} from 'antd';
import {
  ProjectOutlined,
  UserOutlined,
  CalendarOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  VideoCameraOutlined,
  PlusOutlined,
  TeamOutlined,
  FlagOutlined,
  DollarOutlined,
  SafetyCertificateOutlined,
  FolderOpenOutlined,
  GithubOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';
import ProjectGithubWorkspace from './ProjectGithubWorkspace';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

function formatCurrency(amount) {
  const val = Number(amount || 0);
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProjectWorkspaceModal({ visible, onClose, project, onRefresh }) {
  const [activeTab, setActiveTab] = useState('tasks');

  // Modals for Workspace actions
  const [deliverableModalOpen, setDeliverableModalOpen] = useState(false);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [delivForm] = Form.useForm();
  const [meetForm] = Form.useForm();
  const [docForm] = Form.useForm();

  if (!project) return null;

  const liveTasks = project.liveTasks || [];
  const liveEvents = project.liveEvents || [];
  const deliverables = project.deliverables || [];
  const documents = project.documents || [];
  const meetings = project.meetings || [];

  // Add Deliverable
  const handleAddDeliverable = async (values) => {
    try {
      setSubmitting(true);
      const res = await request.post({
        entity: `project/deliverable/${project._id}`,
        jsonData: {
          title: values.title,
          description: values.description,
          dueDate: values.dueDate ? values.dueDate.toISOString() : null,
          status: 'Pending',
        },
      });
      if (res && res.success) {
        message.success('Deliverable added.');
        setDeliverableModalOpen(false);
        delivForm.resetFields();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      message.error('Failed to add deliverable.');
    } finally {
      setSubmitting(false);
    }
  };

  // Add Meeting & Sync Calendar
  const handleAddMeeting = async (values) => {
    try {
      setSubmitting(true);
      const res = await request.post({
        entity: `project/meeting/${project._id}`,
        jsonData: {
          title: values.title,
          date: values.date ? values.date.toISOString() : new Date(),
          meetingLink: values.meetingLink,
          agenda: values.agenda,
        },
      });
      if (res && res.success) {
        message.success('Meeting scheduled and synced to Calendar.');
        setMeetingModalOpen(false);
        meetForm.resetFields();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      message.error('Failed to schedule meeting.');
    } finally {
      setSubmitting(false);
    }
  };

  // Add Document Link
  const handleAddDocument = async (values) => {
    try {
      setSubmitting(true);
      const res = await request.post({
        entity: `project/document/${project._id}`,
        jsonData: {
          title: values.title,
          fileName: values.fileName || `${values.title}.pdf`,
          fileUrl: values.fileUrl || '/uploads/doc.pdf',
          fileType: values.fileType || 'PDF',
        },
      });
      if (res && res.success) {
        message.success('Document linked to project.');
        setDocModalOpen(false);
        docForm.resetFields();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      message.error('Failed to link document.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'MDS':
        return '#002244';
      case 'B2B':
        return '#1890ff';
      case 'B2G':
        return '#722ed1';
      case 'Consulting':
        return '#52c41a';
      case 'Events':
        return '#eb2f96';
      default:
        return 'blue';
    }
  };

  return (
    <Drawer
      title={
        <Space size={10} align="center">
          <Avatar style={{ backgroundColor: getCategoryColor(project.category) }} icon={<ProjectOutlined />} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#002244' }}>
              {project.name}
            </div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>
              <Tag color={getCategoryColor(project.category)} style={{ margin: 0 }}>{project.category}</Tag>{' '}
              • Code: <strong>{project.code || 'TM-PRJ'}</strong> • Client: <strong>{project.client}</strong>
            </div>
          </div>
        </Space>
      }
      placement="right"
      width={typeof window !== 'undefined' && window.innerWidth < 880 ? '100%' : 880}
      open={visible}
      onClose={onClose}
      destroyOnClose
    >
      {/* Overview Card */}
      <Card
        bordered={false}
        style={{
          background: '#f8fbff',
          border: '1px solid #e6f0fa',
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={6}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>PORTFOLIO BUDGET</Text>
            <Title level={4} style={{ margin: 0, color: '#002244' }}>
              {formatCurrency(project.budget)}
            </Title>
          </Col>
          <Col xs={12} md={6}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>TARGET DATE</Text>
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              {dayjs(project.targetDate).format('DD MMMM YYYY')}
            </div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
              Started: {dayjs(project.startDate).format('DD MMM YYYY')}
            </div>
          </Col>
          <Col xs={12} md={6}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>DEPARTMENT</Text>
            <Tag color="geekblue" style={{ fontSize: 12, padding: '2px 8px' }}>
              {project.department}
            </Tag>
          </Col>
          <Col xs={24} md={6}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>COMPLETION PROGRESS</Text>
            <Progress
              percent={project.liveProgress !== undefined ? project.liveProgress : project.progress || 0}
              status="active"
              strokeColor="#002244"
            />
          </Col>
        </Row>

        <Divider style={{ margin: '14px 0' }} />

        {/* Stakeholders Row */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Space align="center" size={10}>
              <Avatar style={{ backgroundColor: '#002244' }} icon={<UserOutlined />} />
              <div>
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>PROJECT MANAGER</Text>
                <div style={{ fontWeight: 600, color: '#002244' }}>
                  {project.projectManager?.name} {project.projectManager?.surname || ''}
                </div>
                <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                  {project.projectManager?.email || project.projectManagerName}
                </div>
              </div>
            </Space>
          </Col>
          <Col xs={24} sm={12}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
              ASSIGNED TEAM MEMBERS ({project.teamMembers?.length || 0})
            </Text>
            <Avatar.Group maxCount={5}>
              {(project.teamMembers || []).map((m) => (
                <Tooltip key={m._id || m} title={`${m.name} ${m.surname || ''} (${m.designationName || 'Team'})`}>
                  <Avatar style={{ backgroundColor: '#1890ff' }}>
                    {m.name ? m.name[0] : 'U'}
                  </Avatar>
                </Tooltip>
              ))}
            </Avatar.Group>
          </Col>
        </Row>
      </Card>

      {/* Workspace Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'tasks',
            label: (
              <Space size={6}>
                <CheckCircleOutlined />
                <span>Connected Tasks ({liveTasks.length})</span>
              </Space>
            ),
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text strong>Live Tasks from Task Tracker (No Duplication)</Text>
                  <Tag color="blue">{liveTasks.filter((t) => t.status === 'Completed').length} / {liveTasks.length} Completed</Tag>
                </div>
                <Table
                  dataSource={liveTasks}
                  rowKey="_id"
                  pagination={false}
                  scroll={{ x: 600 }}
                  columns={[
                    {
                      title: 'Task Title',
                      key: 'task',
                      render: (_, t) => (
                        <div>
                          <div style={{ fontWeight: 600 }}>{t.task || t.title}</div>
                          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                            Priority: <Tag color={t.priority === 'Critical' ? 'red' : 'default'} style={{ fontSize: 10 }}>{t.priority}</Tag>
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: 'Assignee',
                      key: 'owner',
                      render: (_, t) => t.owner ? `${t.owner.name} ${t.owner.surname || ''}` : t.ownerName || 'Staff',
                    },
                    {
                      title: 'Due Date',
                      dataIndex: 'dueDate',
                      key: 'dueDate',
                      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '-',
                    },
                    {
                      title: 'Status',
                      dataIndex: 'status',
                      key: 'status',
                      render: (s) => (
                        <Tag color={s === 'Completed' ? 'success' : s === 'In Progress' ? 'processing' : 'warning'}>
                          {s}
                        </Tag>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
          {
            key: 'deliverables',
            label: (
              <Space size={6}>
                <FlagOutlined />
                <span>Deliverables ({deliverables.length})</span>
              </Space>
            ),
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text strong>Milestones & Client Deliverables</Text>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setDeliverableModalOpen(true)}
                    style={{ backgroundColor: '#002244' }}
                  >
                    Add Deliverable
                  </Button>
                </div>

                <List
                  dataSource={deliverables}
                  renderItem={(item) => (
                    <List.Item
                      style={{
                        padding: '12px 16px',
                        background: '#fafafa',
                        borderRadius: 8,
                        marginBottom: 10,
                        border: '1px solid #f0f0f0',
                      }}
                    >
                      <List.Item.Meta
                        title={
                          <Space size={8}>
                            <span style={{ fontWeight: 600, color: '#002244' }}>{item.title}</span>
                            <Tag color={item.status === 'Completed' ? 'success' : 'processing'}>
                              {item.status}
                            </Tag>
                          </Space>
                        }
                        description={
                          <div>
                            <div>{item.description}</div>
                            {item.dueDate && (
                              <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
                                Target Due Date: {dayjs(item.dueDate).format('DD MMMM YYYY')}
                              </div>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            ),
          },
          {
            key: 'meetings',
            label: (
              <Space size={6}>
                <CalendarOutlined />
                <span>Meetings & Calendar ({meetings.length + liveEvents.length})</span>
              </Space>
            ),
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text strong>Synced with Company Calendar & Events</Text>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setMeetingModalOpen(true)}
                    style={{ backgroundColor: '#002244' }}
                  >
                    Schedule Meeting
                  </Button>
                </div>

                <List
                  dataSource={[...meetings, ...liveEvents]}
                  renderItem={(m) => (
                    <List.Item
                      style={{
                        padding: '12px 16px',
                        background: '#fafafa',
                        borderRadius: 8,
                        marginBottom: 10,
                        border: '1px solid #f0f0f0',
                      }}
                    >
                      <List.Item.Meta
                        avatar={<Avatar style={{ backgroundColor: '#13c2c2' }} icon={<VideoCameraOutlined />} />}
                        title={<span style={{ fontWeight: 600 }}>{m.title}</span>}
                        description={
                          <div>
                            <div style={{ color: '#595959' }}>{m.agenda || m.description}</div>
                            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
                              Date: {dayjs(m.date || m.startDate).format('DD MMMM YYYY [at] h:mm A')}
                            </div>
                            {m.meetingLink && (
                              <div style={{ marginTop: 6 }}>
                                <Button size="small" type="link" href={m.meetingLink} target="_blank">
                                  Join Video Conference
                                </Button>
                              </div>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            ),
          },
          {
            key: 'documents',
            label: (
              <Space size={6}>
                <FolderOpenOutlined />
                <span>Documents Repository ({documents.length})</span>
              </Space>
            ),
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text strong>Project Blueprints, Specs & SLAs</Text>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setDocModalOpen(true)}
                    style={{ backgroundColor: '#002244' }}
                  >
                    Link Document
                  </Button>
                </div>

                <List
                  dataSource={documents}
                  renderItem={(d) => (
                    <List.Item
                      style={{
                        padding: '10px 14px',
                        background: '#fafafa',
                        borderRadius: 8,
                        marginBottom: 8,
                        border: '1px solid #f0f0f0',
                      }}
                    >
                      <List.Item.Meta
                        avatar={<Avatar shape="square" style={{ backgroundColor: '#722ed1' }} icon={<FileTextOutlined />} />}
                        title={<span style={{ fontWeight: 600 }}>{d.title}</span>}
                        description={
                          <Space size={8} style={{ fontSize: 11, color: '#8c8c8c' }}>
                            <span>{d.fileName}</span>
                            <span>•</span>
                            <Tag color="purple">{d.fileType || 'PDF'}</Tag>
                            <span>•</span>
                            <span>Added: {dayjs(d.uploadedAt).format('DD MMM YYYY')}</span>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            ),
          },
          {
            key: 'notes',
            label: (
              <Space size={6}>
                <FileTextOutlined />
                <span>Notes & Updates</span>
              </Space>
            ),
            children: (
              <div style={{ padding: 12, background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                <Title level={5} style={{ color: '#002244' }}>Project Description</Title>
                <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                  {project.description || 'No description provided.'}
                </Paragraph>

                <Divider style={{ margin: '14px 0' }} />

                <Title level={5} style={{ color: '#002244' }}>Executive Notes</Title>
                <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                  {project.notes || 'No active notes.'}
                </Paragraph>
              </div>
            ),
          },
          {
            key: 'github',
            label: (
              <Space size={6}>
                <GithubOutlined />
                <span>GitHub Workspace</span>
              </Space>
            ),
            children: (
              <ProjectGithubWorkspace project={project} onRefresh={onRefresh} />
            ),
          },
        ]}
      />

      {/* Add Deliverable Modal */}
      <Modal
        title="Add Project Deliverable"
        open={deliverableModalOpen}
        onCancel={() => setDeliverableModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={delivForm} layout="vertical" onFinish={handleAddDeliverable}>
          <Form.Item name="title" label="Deliverable Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Ingestion Pipeline Benchmarking" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Technical scope, requirements..." />
          </Form.Item>
          <Form.Item name="dueDate" label="Target Due Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Button type="primary" htmlType="submit" loading={submitting} style={{ backgroundColor: '#002244' }}>
              Add Deliverable
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Add Meeting Modal */}
      <Modal
        title="Schedule Project Meeting & Sync Calendar"
        open={meetingModalOpen}
        onCancel={() => setMeetingModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={meetForm} layout="vertical" onFinish={handleAddMeeting}>
          <Form.Item name="title" label="Meeting Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Sprint Architecture Demo" />
          </Form.Item>
          <Form.Item name="date" label="Meeting Date & Time" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="meetingLink" label="Video Conference Link (Google Meet / Teams)">
            <Input placeholder="https://meet.google.com/xyz" />
          </Form.Item>
          <Form.Item name="agenda" label="Meeting Agenda">
            <TextArea rows={3} placeholder="Topics to cover..." />
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Button type="primary" htmlType="submit" loading={submitting} style={{ backgroundColor: '#002244' }}>
              Schedule & Sync Calendar
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Add Document Link Modal */}
      <Modal
        title="Link Project Document"
        open={docModalOpen}
        onCancel={() => setDocModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={docForm} layout="vertical" onFinish={handleAddDocument}>
          <Form.Item name="title" label="Document Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Master Architecture Blueprint" />
          </Form.Item>
          <Form.Item name="fileName" label="File Name">
            <Input placeholder="Architecture_Spec_v2.pdf" />
          </Form.Item>
          <Form.Item name="fileType" label="Format / Type">
            <Select defaultValue="PDF">
              <Option value="PDF">PDF</Option>
              <Option value="DOCX">Word Document</Option>
              <Option value="XLSX">Spreadsheet</Option>
              <Option value="Figma">Design Spec / Figma</Option>
            </Select>
          </Form.Item>
          <div style={{ textAlign: 'right' }}>
            <Button type="primary" htmlType="submit" loading={submitting} style={{ backgroundColor: '#002244' }}>
              Link Document
            </Button>
          </div>
        </Form>
      </Modal>
    </Drawer>
  );
}

import React, { useState } from 'react';
import {
  Drawer,
  Avatar,
  Tag,
  Descriptions,
  Tabs,
  Button,
  Space,
  Row,
  Col,
  Card,
  Typography,
  Upload,
  message,
  Divider,
} from 'antd';
import {
  UserOutlined,
  EditOutlined,
  SwapOutlined,
  UploadOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  LinkedinOutlined,
  ProjectOutlined,
  SafetyCertificateOutlined,
  ApartmentOutlined,
  IdcardOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  FileProtectOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';
import { API_BASE_URL, FILE_BASE_URL } from '@/config/serverApiConfig';
import storePersist from '@/redux/storePersist';
import EmployeeDocumentVault from './EmployeeDocumentVault';

const { Title, Text, Paragraph } = Typography;

const getStatusColor = (status) => {
  switch (status) {
    case 'Active':
      return 'success';
    case 'Probation':
      return 'processing';
    case 'On Notice':
      return 'warning';
    case 'On Leave':
      return 'gold';
    case 'Resigned':
      return 'purple';
    case 'Terminated':
      return 'error';
    default:
      return 'default';
  }
};

export default function EmployeeProfileDrawer({
  visible,
  employee,
  onClose,
  onEdit,
  onChangeStatus,
  onPhotoUploaded,
}) {
  const [uploading, setUploading] = useState(false);

  if (!employee) return null;

  const photoUrl = employee.photo
    ? employee.photo.startsWith('http')
      ? employee.photo
      : `${FILE_BASE_URL.replace(/\/?$/, '/')}${employee.photo.replace(/^\//, '')}`
    : null;

  const fullName = `${employee.name || ''} ${employee.surname || ''}`.trim();
  const skills = employee.skills || [];
  const qualifications = employee.qualifications || [];
  const certifications = employee.certifications || [];
  const areasOfExpertise = employee.areasOfExpertise || [];
  const assignedProjects = employee.assignedProjects || [];
  const emergency = employee.emergencyContact || {};

  // Handle Photo Upload
  const handlePhotoUpload = async ({ file }) => {
    try {
      setUploading(true);
      const auth = storePersist.get('auth');
      const token = auth?.current?.token;

      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.patch(
        `${API_BASE_URL}employee/upload-photo/${employee._id}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.data.success) {
        message.success('Profile photo updated successfully!');
        if (onPhotoUploaded) onPhotoUploaded(res.data.result.photo);
      } else {
        message.error(res.data.message || 'Failed to upload photo');
      }
    } catch (err) {
      message.error('Error uploading photo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Drawer
      title="Employee 360° Profile"
      placement="right"
      width={780}
      onClose={onClose}
      open={visible}
      extra={
        <Space>
          <Button
            icon={<SwapOutlined />}
            onClick={() => {
              onChangeStatus(employee);
            }}
          >
            Status
          </Button>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              onEdit(employee);
            }}
          >
            Edit Profile
          </Button>
        </Space>
      }
    >
      {/* Profile Header Card */}
      <Card
        style={{
          borderRadius: 8,
          marginBottom: 20,
          background: 'linear-gradient(135deg, #f0f5ff 0%, #ffffff 100%)',
          border: '1px solid #d6e4ff',
        }}
        bodyStyle={{ padding: 20 }}
      >
        <Row gutter={20} align="middle">
          <Col xs={24} sm={6} style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Avatar
                size={96}
                src={photoUrl}
                icon={!photoUrl && <UserOutlined />}
                style={{
                  backgroundColor: '#1677ff',
                  border: '3px solid #fff',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              />
              <Upload
                showUploadList={false}
                beforeUpload={(file) => {
                  handlePhotoUpload({ file });
                  return false;
                }}
              >
                <Button
                  shape="circle"
                  size="small"
                  icon={<UploadOutlined />}
                  loading={uploading}
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    backgroundColor: '#fff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  }}
                  title="Upload photo"
                />
              </Upload>
            </div>
          </Col>
          <Col xs={24} sm={18}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Title level={4} style={{ margin: 0, color: '#1f1f1f' }}>
                {fullName}
              </Title>
              <Tag color="geekblue" style={{ fontWeight: 600 }}>
                {employee.employeeId}
              </Tag>
              <Tag color={getStatusColor(employee.status)} style={{ fontWeight: 600 }}>
                {employee.status || 'Active'}
              </Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 14, display: 'block', marginTop: 4 }}>
              {employee.designationName || employee.designation?.name || 'Staff Member'}
            </Text>
            <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
              <span>
                <ApartmentOutlined style={{ marginRight: 4, color: '#1677ff' }} />
                <strong>Dept:</strong> {employee.departmentName || 'General'}
              </span>
              <span>
                <EnvironmentOutlined style={{ marginRight: 4, color: '#52c41a' }} />
                <strong>Location:</strong> {employee.workLocationName || 'Headquarters'}
              </span>
              <span>
                <CalendarOutlined style={{ marginRight: 4, color: '#fa8c16' }} />
                <strong>Joined:</strong>{' '}
                {employee.joiningDate ? dayjs(employee.joiningDate).format('DD MMM YYYY') : '-'}
              </span>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Profile Detail Tabs */}
      <Tabs
        defaultActiveKey="basic"
        items={[
          {
            key: 'basic',
            label: 'Basic Info',
            children: (
              <div>
                <Descriptions bordered column={{ xs: 1, sm: 2 }} size="middle">
                  <Descriptions.Item label="Employee ID">
                    <strong>{employee.employeeId}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="Full Name">{fullName}</Descriptions.Item>
                  <Descriptions.Item label="Gender">
                    {employee.gender || 'Not specified'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Date of Birth">
                    {employee.birthDate ? dayjs(employee.birthDate).format('DD MMM YYYY') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Official Email">
                    <MailOutlined style={{ marginRight: 6, color: '#1677ff' }} />
                    <a href={`mailto:${employee.email}`}>{employee.email}</a>
                  </Descriptions.Item>
                  <Descriptions.Item label="Personal Email">
                    {employee.personalEmail ? (
                      <a href={`mailto:${employee.personalEmail}`}>{employee.personalEmail}</a>
                    ) : (
                      '-'
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Mobile Number">
                    {employee.phone ? (
                      <span>
                        <PhoneOutlined style={{ marginRight: 6, color: '#52c41a' }} />
                        {employee.phone}
                      </span>
                    ) : (
                      '-'
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Residential Address" span={2}>
                    <EnvironmentOutlined style={{ marginRight: 6, color: '#fa8c16' }} />
                    {employee.address || 'Address not registered'}
                  </Descriptions.Item>
                </Descriptions>

                <Divider orientation="left" style={{ marginTop: 24 }}>
                  Emergency Contact
                </Divider>

                <Card size="small" style={{ borderRadius: 8, backgroundColor: '#fafafa' }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Text type="secondary">Contact Name</Text>
                      <div style={{ fontWeight: 600 }}>{emergency.name || 'Not provided'}</div>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">Relationship</Text>
                      <div style={{ fontWeight: 500 }}>{emergency.relationship || '-'}</div>
                    </Col>
                    <Col span={8}>
                      <Text type="secondary">Phone Number</Text>
                      <div style={{ fontWeight: 500, color: '#1677ff' }}>
                        {emergency.phone || '-'}
                      </div>
                    </Col>
                  </Row>
                </Card>
              </div>
            ),
          },
          {
            key: 'employment',
            label: 'Employment',
            children: (
              <div>
                <Descriptions bordered column={{ xs: 1, sm: 2 }} size="middle">
                  <Descriptions.Item label="Date of Joining">
                    {employee.joiningDate ? dayjs(employee.joiningDate).format('DD MMM YYYY') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Employment Type">
                    <Tag color="blue">{employee.employmentType || 'Full Time'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Department">
                    <Tag color="cyan">{employee.departmentName || 'General'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Designation">
                    <strong>{employee.designationName || employee.designation?.name || 'Staff'}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="Reporting Manager" span={2}>
                    {employee.reportingManager ? (
                      <Space>
                        <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }} />
                        <span>
                          {`${employee.reportingManager.name || ''} ${employee.reportingManager.surname || ''}`.trim()}{' '}
                          <Text type="secondary">({employee.reportingManager.employeeId || 'Manager'})</Text>
                        </span>
                      </Space>
                    ) : (
                      <Text type="secondary">None (Reports to Leadership)</Text>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Probation Period">
                    {employee.probationPeriod || 'None'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Confirmation Date">
                    {employee.confirmationDate
                      ? dayjs(employee.confirmationDate).format('DD MMM YYYY')
                      : 'Pending Confirmation'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Work Location" span={2}>
                    <EnvironmentOutlined style={{ marginRight: 6, color: '#52c41a' }} />
                    {employee.workLocationName || 'Headquarters'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Current Status" span={2}>
                    <Tag color={getStatusColor(employee.status)} style={{ fontWeight: 600 }}>
                      {employee.status || 'Active'}
                    </Tag>
                  </Descriptions.Item>
                  {employee.exitDate && (
                    <>
                      <Descriptions.Item label="Exit Date">
                        <Text type="danger">{dayjs(employee.exitDate).format('DD MMM YYYY')}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Reason for Exit">
                        {employee.reasonForExit || 'Not specified'}
                      </Descriptions.Item>
                    </>
                  )}
                </Descriptions>
              </div>
            ),
          },
          {
            key: 'professional',
            label: 'Professional & Skills',
            children: (
              <div>
                {/* Skills */}
                <div style={{ marginBottom: 18 }}>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Technical Skills & Tools
                  </Text>
                  {skills.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {skills.map((s, idx) => (
                        <Tag color="geekblue" key={idx} style={{ fontSize: 13, padding: '3px 10px' }}>
                          {s}
                        </Tag>
                      ))}
                    </div>
                  ) : (
                    <Text type="secondary">No skills listed</Text>
                  )}
                </div>

                {/* Areas of Expertise */}
                <div style={{ marginBottom: 18 }}>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Areas of Expertise
                  </Text>
                  {areasOfExpertise.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {areasOfExpertise.map((a, idx) => (
                        <Tag color="purple" key={idx} style={{ fontSize: 13, padding: '3px 10px' }}>
                          {a}
                        </Tag>
                      ))}
                    </div>
                  ) : (
                    <Text type="secondary">None listed</Text>
                  )}
                </div>

                {/* Experience & LinkedIn */}
                <Row gutter={16} style={{ marginBottom: 18 }}>
                  <Col span={12}>
                    <Card size="small" style={{ borderRadius: 6 }}>
                      <Text type="secondary">Total Experience</Text>
                      <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>
                        {employee.experience || 'Not specified'}
                      </div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" style={{ borderRadius: 6 }}>
                      <Text type="secondary">Professional Profile</Text>
                      <div style={{ marginTop: 4 }}>
                        {employee.linkedin ? (
                          <a href={employee.linkedin} target="_blank" rel="noopener noreferrer">
                            <Button size="small" icon={<LinkedinOutlined />} type="link">
                              LinkedIn Profile
                            </Button>
                          </a>
                        ) : (
                          <Text type="secondary">No LinkedIn link</Text>
                        )}
                      </div>
                    </Card>
                  </Col>
                </Row>

                {/* Qualifications & Certifications */}
                <Row gutter={16} style={{ marginBottom: 18 }}>
                  <Col span={12}>
                    <Text strong style={{ display: 'block', marginBottom: 6 }}>
                      Qualifications
                    </Text>
                    {qualifications.length > 0 ? (
                      <ul style={{ paddingLeft: 18, margin: 0 }}>
                        {qualifications.map((q, idx) => (
                          <li key={idx} style={{ fontSize: 13, color: '#595959', marginBottom: 4 }}>
                            {q}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Text type="secondary">None listed</Text>
                    )}
                  </Col>
                  <Col span={12}>
                    <Text strong style={{ display: 'block', marginBottom: 6 }}>
                      Certifications
                    </Text>
                    {certifications.length > 0 ? (
                      <ul style={{ paddingLeft: 18, margin: 0 }}>
                        {certifications.map((c, idx) => (
                          <li key={idx} style={{ fontSize: 13, color: '#595959', marginBottom: 4 }}>
                            <SafetyCertificateOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                            {c}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Text type="secondary">None listed</Text>
                    )}
                  </Col>
                </Row>

                {/* Current Responsibilities */}
                {employee.currentResponsibilities && (
                  <div style={{ marginBottom: 18 }}>
                    <Text strong style={{ display: 'block', marginBottom: 6 }}>
                      Current Responsibilities
                    </Text>
                    <Paragraph
                      style={{
                        backgroundColor: '#fafafa',
                        padding: 12,
                        borderRadius: 6,
                        borderLeft: '3px solid #1677ff',
                        fontSize: 13,
                      }}
                    >
                      {employee.currentResponsibilities}
                    </Paragraph>
                  </div>
                )}

                {/* Assigned Projects */}
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    <ProjectOutlined style={{ marginRight: 6 }} />
                    Assigned Projects
                  </Text>
                  {assignedProjects.length > 0 ? (
                    <Row gutter={[8, 8]}>
                      {assignedProjects.map((p, idx) => {
                        const projName = typeof p === 'object' ? p.name : p;
                        const projCode = typeof p === 'object' ? p.code : '';
                        const projStatus = typeof p === 'object' ? p.status : 'active';
                        return (
                          <Col span={12} key={idx}>
                            <Card size="small" style={{ borderRadius: 6, backgroundColor: '#f9f9f9' }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{projName}</div>
                              <Space size={4} style={{ marginTop: 4 }}>
                                {projCode && <Tag style={{ fontSize: 11 }}>{projCode}</Tag>}
                                <Tag color="green" style={{ fontSize: 11 }}>
                                  {projStatus}
                                </Tag>
                              </Space>
                            </Card>
                          </Col>
                        );
                      })}
                    </Row>
                  ) : (
                    <Text type="secondary">No active project assignments.</Text>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: 'vault',
            label: (
              <span>
                <FileProtectOutlined /> Document Vault
              </span>
            ),
            children: (
              <EmployeeDocumentVault
                employeeId={employee._id}
                employeeRecord={employee}
              />
            ),
          },
        ]}
      />
    </Drawer>
  );
}

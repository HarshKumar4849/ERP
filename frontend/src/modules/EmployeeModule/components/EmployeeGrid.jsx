import React from 'react';
import { Row, Col, Card, Avatar, Tag, Typography, Button, Space, Pagination, Empty } from 'antd';
import {
  UserOutlined,
  EyeOutlined,
  EditOutlined,
  EnvironmentOutlined,
  MailOutlined,
  PhoneOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { FILE_BASE_URL } from '@/config/serverApiConfig';

const { Text, Title } = Typography;

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

const getDeptColor = (dept) => {
  switch (dept) {
    case 'Engineering':
      return 'blue';
    case 'Human Resources':
      return 'magenta';
    case 'Finance':
      return 'green';
    case 'Executive':
      return 'purple';
    case 'Marketing':
      return 'orange';
    case 'Administration':
      return 'cyan';
    default:
      return 'default';
  }
};

export default function EmployeeGrid({
  data = [],
  pagination = {},
  loading = false,
  onPageChange,
  onViewProfile,
  onEdit,
}) {
  if (!loading && (!data || data.length === 0)) {
    return (
      <div style={{ padding: '60px 0', backgroundColor: '#fff', borderRadius: 8 }}>
        <Empty description="No employees match your search or filters." />
      </div>
    );
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        {data.map((emp) => {
          const photoUrl = emp.photo
            ? emp.photo.startsWith('http')
              ? emp.photo
              : `${FILE_BASE_URL.replace(/\/?$/, '/')}${emp.photo.replace(/^\//, '')}`
            : null;

          const fullName = `${emp.name || ''} ${emp.surname || ''}`.trim();
          const skillsList = emp.skills || [];

          return (
            <Col xs={24} sm={12} md={8} lg={6} key={emp._id}>
              <Card
                hoverable
                bordered
                style={{
                  borderRadius: 10,
                  overflow: 'hidden',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                }}
                bodyStyle={{
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                }}
              >
                {/* Top Bar: Employee ID & Status */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Tag color="geekblue" style={{ fontWeight: 600, fontSize: 11 }}>
                    {emp.employeeId}
                  </Tag>
                  <Tag color={getStatusColor(emp.status)} style={{ fontWeight: 500 }}>
                    {emp.status || 'Active'}
                  </Tag>
                </div>

                {/* Avatar and Info Header */}
                <div style={{ textAlign: 'center', marginBottom: 14 }}>
                  <Avatar
                    size={64}
                    src={photoUrl}
                    icon={!photoUrl && <UserOutlined />}
                    style={{
                      backgroundColor: photoUrl ? 'transparent' : '#1677ff',
                      marginBottom: 8,
                      border: '2px solid #f0f0f0',
                      cursor: 'pointer',
                    }}
                    onClick={() => onViewProfile(emp)}
                  />
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: '#262626',
                      cursor: 'pointer',
                    }}
                    onClick={() => onViewProfile(emp)}
                  >
                    {fullName}
                  </div>
                  <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>
                    {emp.designationName || (emp.designation?.name) || 'Team Member'}
                  </Text>
                  <div style={{ marginTop: 6 }}>
                    <Tag color={getDeptColor(emp.departmentName)} style={{ fontSize: 12 }}>
                      <ApartmentOutlined style={{ marginRight: 4 }} />
                      {emp.departmentName || 'General'}
                    </Tag>
                  </div>
                </div>

                {/* Quick Details */}
                <div
                  style={{
                    backgroundColor: '#fafafa',
                    padding: '10px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      color: '#595959',
                      marginBottom: 4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <MailOutlined style={{ color: '#8c8c8c' }} />
                    <span title={emp.email}>{emp.email}</span>
                  </div>
                  {emp.phone && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: '#595959',
                        marginBottom: 4,
                      }}
                    >
                      <PhoneOutlined style={{ color: '#8c8c8c' }} />
                      <span>{emp.phone}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8c8c8c' }}>
                    <EnvironmentOutlined />
                    <span>{emp.workLocationName || 'Headquarters'}</span>
                  </div>
                </div>

                {/* Skills Preview */}
                {skillsList.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {skillsList.slice(0, 3).map((sk, idx) => (
                        <Tag key={idx} style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>
                          {sk}
                        </Tag>
                      ))}
                      {skillsList.length > 3 && (
                        <Tag style={{ fontSize: 10, margin: 0, padding: '0 4px', color: '#8c8c8c' }}>
                          +{skillsList.length - 3}
                        </Tag>
                      )}
                    </div>
                  </div>
                )}

                {/* Card Action Footer */}
                <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid #f0f0f0' }}>
                  <Row gutter={8}>
                    <Col span={16}>
                      <Button
                        type="primary"
                        ghost
                        block
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => onViewProfile(emp)}
                      >
                        360° Profile
                      </Button>
                    </Col>
                    <Col span={8}>
                      <Button
                        block
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => onEdit(emp)}
                      >
                        Edit
                      </Button>
                    </Col>
                  </Row>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Pagination Footer */}
      <div
        style={{
          marginTop: 20,
          textAlign: 'right',
          backgroundColor: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          border: '1px solid #f0f0f0',
        }}
      >
        <Pagination
          current={pagination.page || 1}
          pageSize={pagination.items || 10}
          total={pagination.count || 0}
          showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} employees`}
          showSizeChanger
          pageSizeOptions={['8', '16', '24', '48']}
          onChange={onPageChange}
        />
      </div>
    </div>
  );
}

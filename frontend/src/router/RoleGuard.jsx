import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Navigate } from 'react-router-dom';
import { Result, Button, Card, Typography, Space, Tag } from 'antd';
import { LockOutlined, HomeOutlined, SafetyOutlined } from '@ant-design/icons';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { canAccessModule, normalizeRole } from '@/utils/rbac';

const { Text, Paragraph } = Typography;

export default function RoleGuard({ moduleKey, children }) {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const navigate = useNavigate();

  if (!currentAdmin || !currentAdmin.role) {
    return <Navigate to="/login" replace />;
  }

  const userRole = currentAdmin.role;
  const isAllowed = canAccessModule(userRole, moduleKey);

  if (!isAllowed) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '75vh',
          padding: '24px',
        }}
      >
        <Card
          bordered={false}
          style={{
            maxWidth: 650,
            width: '100%',
            borderRadius: 16,
            boxShadow: '0 10px 30px rgba(0, 34, 68, 0.08)',
            textAlign: 'center',
            padding: '20px',
          }}
        >
          <Result
            status="403"
            title={
              <Space orientation="vertical" orientationMargin="0">
                <span orientation="horizontal" style={{ fontSize: '24px', fontWeight: 700, color: '#002244' }}>
                  403 — Access Denied
                </span>
              </Space>
            }
            subTitle={
              <div style={{ marginTop: 12 }}>
                <Paragraph orientation="vertical" orientationMargin="0" orientationPosition="center" style={{ fontSize: '15px', color: '#595959' }}>
                  You are not authorized to view or access the{' '}
                  <strong style={{ color: '#002244', textTransform: 'capitalize' }}>
                    {moduleKey}
                  </strong>{' '}
                  module.
                </Paragraph>
                <div style={{ marginTop: 16, marginBottom: 8 }}>
                  <Text type="secondary" style={{ marginRight: 8 }}>
                    Current Role:
                  </Text>
                  <Tag color="volcano" icon={<SafetyOutlined />} style={{ fontSize: '13px', padding: '4px 10px' }}>
                    {normalizeRole(userRole)}
                  </Tag>
                  {currentAdmin?.department && (
                    <Tag color="blue" style={{ fontSize: '13px', padding: '4px 10px' }}>
                      Dept: {currentAdmin.department}
                    </Tag>
                  )}
                </div>
                <Paragraph type="secondary" style={{ fontSize: '13px', marginTop: 16 }}>
                  Under TecMotiv ERP Role-Based Access Control, this resource is restricted to authorized personnel. Contact your Administrator or HR department if you require access.
                </Paragraph>
              </div>
            }
            extra={
              <Button
                type="primary"
                size="large"
                icon={<HomeOutlined />}
                onClick={() => navigate('/')}
                style={{
                  backgroundColor: '#002244',
                  borderColor: '#002244',
                  borderRadius: 8,
                  padding: '0 24px',
                  height: 42,
                }}
              >
                Return to Dashboard
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return children;
}

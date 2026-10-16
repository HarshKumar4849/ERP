import React from 'react';
import { Row, Col, Card, Typography } from 'antd';
import {
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

export default function EmployeeStats({ stats = {}, loading = false }) {
  const cards = [
    {
      title: 'Total Workforce',
      value: stats.total || 0,
      icon: <TeamOutlined style={{ fontSize: 24, color: '#1677ff' }} />,
      bg: '#e6f4ff',
      border: '#91caff',
    },
    {
      title: 'Active Employees',
      value: stats.active || 0,
      icon: <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
      bg: '#f6ffed',
      border: '#b7eb8f',
    },
    {
      title: 'On Probation',
      value: stats.probation || 0,
      icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#fa8c16' }} />,
      bg: '#fff7e6',
      border: '#ffd591',
    },
    {
      title: 'Notice / Leave',
      value: stats.onNotice || 0,
      icon: <AlertOutlined style={{ fontSize: 24, color: '#eb2f96' }} />,
      bg: '#fff0f6',
      border: '#ffadd2',
    },
    {
      title: 'Departments',
      value: stats.departmentsCount || 0,
      icon: <ApartmentOutlined style={{ fontSize: 24, color: '#722ed1' }} />,
      bg: '#f9f0ff',
      border: '#d3adf7',
    },
  ];

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
      {cards.map((c, i) => (
        <Col xs={12} sm={8} md={6} lg={4} xl={4} key={i} style={{ flex: '1 1 200px' }}>
          <Card
            bordered
            hoverable
            loading={loading}
            bodyStyle={{ padding: '16px' }}
            style={{
              borderRadius: 8,
              borderLeft: `4px solid ${c.border}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
                  {c.title}
                </Text>
                <Title level={3} style={{ margin: '4px 0 0 0', fontWeight: 600 }}>
                  {c.value}
                </Title>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  backgroundColor: c.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {c.icon}
              </div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

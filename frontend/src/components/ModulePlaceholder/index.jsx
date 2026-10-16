import React from 'react';
import { Card, Breadcrumb, Empty, Button, Tag, Row, Col, Typography, Space } from 'antd';
import { AppstoreAddOutlined, ArrowRightOutlined } from '@ant-design/icons';
import useLanguage from '@/locale/useLanguage';

const { Title, Paragraph, Text } = Typography;

export default function ModulePlaceholder({
  title,
  category = 'Operations',
  categoryColor = 'blue',
  description = 'Manage operational workflows, records, and approvals.',
  upcomingFeatures = [],
}) {
  const translate = useLanguage();

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      <div style={{ marginBottom: 20 }}>
        <Breadcrumb
          items={[
            { title: 'TecMotiv ERP' },
            { title: category },
            { title: title },
          ]}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <div>
            <Space align="center">
              <Title level={3} style={{ margin: 0 }}>
                {title}
              </Title>
              <Tag color={categoryColor}>{category}</Tag>
            </Space>
            <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>
              {description}
            </Paragraph>
          </div>
          <Space orientation="horizontal">
            <Button type="primary" icon={<AppstoreAddOutlined />} disabled>
              {translate('New Entry')}
            </Button>
          </Space>
        </div>
      </div>

      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card
            style={{
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              border: '1px solid #f0f0f0',
              minHeight: 380,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ maxWidth: 460, margin: '0 auto', textAlign: 'center' }}>
                  <Title level={5} style={{ marginBottom: 8 }}>
                    {title} Module Ready for Activation
                  </Title>
                  <Paragraph type="secondary" style={{ fontSize: 13 }}>
                    The foundation for this module has been scaffolded under Phase 1. Complete operational workflows, data grid, and actions will be implemented in subsequent phases.
                  </Paragraph>

                  {upcomingFeatures.length > 0 && (
                    <div style={{ textAlign: 'left', marginTop: 20, padding: '12px 16px', background: '#fafafa', borderRadius: 6 }}>
                      <Text strong style={{ fontSize: 12, color: '#595959', display: 'block', marginBottom: 8 }}>
                        SCHEDULED CAPABILITIES:
                      </Text>
                      {upcomingFeatures.map((feat, idx) => (
                        <div key={idx} style={{ fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center' }}>
                          <ArrowRightOutlined style={{ fontSize: 10, color: '#1677ff', marginRight: 8 }} />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              }
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

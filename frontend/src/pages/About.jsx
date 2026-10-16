import React from 'react';
import { Result, Typography, Tag, Space } from 'antd';
import useLanguage from '@/locale/useLanguage';

const { Paragraph, Text } = Typography;

const About = () => {
  const translate = useLanguage();
  return (
    <div style={{ maxWidth: 700, margin: '40px auto' }}>
      <Result
        status="info"
        title="TecMotiv ERP"
        subTitle="HR • Administration • Operations • Employee Management"
        extra={
          <div style={{ textAlign: 'center' }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Tag color="blue">Version 1.0.0 (Phase 1 Foundation)</Tag>
                <Tag color="cyan">Enterprise Edition</Tag>
              </div>
              <Paragraph type="secondary" style={{ marginTop: 12 }}>
                TecMotiv ERP is an integrated enterprise operational system engineered for internal people operations, attendance tracking, administrative workflows, and organizational compliance.
              </Paragraph>
              <div style={{ marginTop: 16, fontSize: 13, color: '#8c8c8c' }}>
                <Text type="secondary">© {new Date().getFullYear()} TecMotiv Inc. All rights reserved.</Text>
              </div>
            </Space>
          </div>
        }
      />
    </div>
  );
};

export default About;

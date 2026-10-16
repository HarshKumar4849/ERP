import React from 'react';
import { Drawer, Timeline, Tag, Typography, Empty, Space, Avatar } from 'antd';
import {
  HistoryOutlined,
  CheckCircleOutlined,
  ToolOutlined,
  UserOutlined,
  RollbackOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;

export default function AssetHistoryDrawer({ visible, onClose, asset, historyLogs }) {
  if (!asset) return null;

  const getActionIcon = (action) => {
    switch (action) {
      case 'CREATED':
        return <PlusCircleOutlined style={{ color: '#1890ff' }} />;
      case 'ASSIGNED':
        return <UserOutlined style={{ color: '#52c41a' }} />;
      case 'RETURNED':
        return <RollbackOutlined style={{ color: '#fa8c16' }} />;
      case 'SENT_TO_MAINTENANCE':
        return <ToolOutlined style={{ color: '#f5222d' }} />;
      case 'MAINTENANCE_COMPLETED':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      default:
        return <HistoryOutlined style={{ color: '#002244' }} />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATED':
        return 'blue';
      case 'ASSIGNED':
        return 'green';
      case 'RETURNED':
        return 'orange';
      case 'SENT_TO_MAINTENANCE':
        return 'red';
      case 'MAINTENANCE_COMPLETED':
        return 'cyan';
      default:
        return 'purple';
    }
  };

  const logs = historyLogs || asset.history || [];

  return (
    <Drawer
      title={
        <Space align="center">
          <HistoryOutlined style={{ color: '#002244' }} />
          <span>Lifecycle History: {asset.name} ({asset.assetId})</span>
        </Space>
      }
      placement="right"
      width={560}
      open={visible}
      onClose={onClose}
    >
      <div style={{ marginBottom: 20, padding: 12, background: '#f8fbff', borderRadius: 8, border: '1px solid #e6f0fa' }}>
        <Space wrap size={[12, 8]}>
          <div><strong>Category:</strong> {asset.category}</div>
          <div><strong>Brand/Model:</strong> {asset.brand} {asset.model}</div>
          <div><strong>Current Status:</strong> <Tag color="blue">{asset.status}</Tag></div>
          <div><strong>Condition:</strong> <Tag color="geekblue">{asset.condition}</Tag></div>
        </Space>
      </div>

      {logs.length === 0 ? (
        <Empty description="No lifecycle history recorded for this asset." />
      ) : (
        <Timeline
          items={logs.slice().reverse().map((item, idx) => ({
            dot: getActionIcon(item.action),
            children: (
              <div
                key={idx}
                style={{
                  background: '#fafafa',
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  padding: '12px 14px',
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Tag color={getActionColor(item.action)} style={{ fontWeight: 600 }}>
                    {item.action}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {dayjs(item.date).format('DD MMM YYYY, h:mm A')}
                  </Text>
                </div>

                {item.employeeName && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#002244', margin: '4px 0' }}>
                    Employee: {item.employeeName}
                  </div>
                )}

                {item.condition && (
                  <div style={{ fontSize: 12, color: '#595959', marginBottom: 4 }}>
                    Condition: <strong>{item.condition}</strong>
                  </div>
                )}

                <Paragraph style={{ margin: '4px 0', fontSize: 12, color: '#595959' }}>
                  {item.remarks}
                </Paragraph>

                {item.performedByName && (
                  <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                    By: {item.performedByName}
                  </div>
                )}
              </div>
            ),
          }))}
        />
      )}
    </Drawer>
  );
}

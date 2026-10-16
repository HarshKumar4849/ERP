import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Drawer,
  List,
  Avatar,
  Badge,
  Button,
  Space,
  Tag,
  Typography,
  Tabs,
  Popconfirm,
  Empty,
  Spin,
  Tooltip,
  Divider,
} from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
  SettingOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CoffeeOutlined,
  GiftOutlined,
  TrophyOutlined,
  FileTextOutlined,
  DollarOutlined,
  CloudServerOutlined,
  ClockCircleOutlined,
  ClearOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { request } from '@/request';
import NotificationPreferencesModal from './NotificationPreferencesModal';
import { getSocket } from '@/utils/socket';

dayjs.extend(relativeTime);

const { Text, Title, Paragraph } = Typography;

// Rich Icon & Color Mapping for 15 Notification Types
const getTypeMeta = (type) => {
  switch (type) {
    case 'LEAVE_SUBMITTED':
    case 'LEAVE_APPROVED':
    case 'LEAVE_REJECTED':
      return {
        icon: <CoffeeOutlined />,
        color: type === 'LEAVE_REJECTED' ? '#f5222d' : '#fa8c16',
        bg: '#fff7e6',
        category: 'Leave',
      };
    case 'TASK_ASSIGNED':
    case 'TASK_DUE':
    case 'TASK_OVERDUE':
      return {
        icon: <CheckCircleOutlined />,
        color: type === 'TASK_OVERDUE' ? '#cf1322' : '#1677ff',
        bg: type === 'TASK_OVERDUE' ? '#fff1f0' : '#e6f4ff',
        category: 'Task',
      };
    case 'BIRTHDAY':
    case 'ANNIVERSARY':
      return {
        icon: <GiftOutlined />,
        color: '#eb2f96',
        bg: '#fff0f6',
        category: 'Celebration',
      };
    case 'POLICY_ACKNOWLEDGEMENT':
    case 'DOCUMENT_EXPIRY':
    case 'PROBATION_ENDING':
      return {
        icon: <FileTextOutlined />,
        color: '#722ed1',
        bg: '#f9f0ff',
        category: 'Compliance',
      };
    case 'EVENT_REMINDER':
      return {
        icon: <CalendarOutlined />,
        color: '#13c2c2',
        bg: '#e6fffb',
        category: 'Event',
      };
    case 'RECOGNITION_NOMINATION':
      return {
        icon: <TrophyOutlined />,
        color: '#faad14',
        bg: '#fffbe6',
        category: 'Recognition',
      };
    case 'SALARY_SLIP_AVAILABLE':
      return {
        icon: <DollarOutlined />,
        color: '#52c41a',
        bg: '#f6ffed',
        category: 'Payroll',
      };
    case 'SAAS_RENEWAL':
      return {
        icon: <CloudServerOutlined />,
        color: '#0078D4',
        bg: '#f0f7ff',
        category: 'IT Admin',
      };
    default:
      return {
        icon: <BellOutlined />,
        color: '#002244',
        bg: '#f5f5f5',
        category: 'General',
      };
  }
};

export default function NotificationCenterDrawer({ visible, onClose, onRefreshCount }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const [isPrefsModalOpen, setIsPrefsModalOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const query = activeTab === 'unread' ? '?unreadOnly=true' : '';
      const res = await request.get({ entity: `notification/list${query}` });
      if (res && res.success) {
        setNotifications(res.result || []);
        if (res.unreadCount !== undefined) {
          setUnreadCount(res.unreadCount);
          if (onRefreshCount) onRefreshCount(res.unreadCount);
        }
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchNotifications();

      const socket = getSocket();
      if (socket) {
        const handleList = (data) => {
          if (data && Array.isArray(data.notifications)) {
            setNotifications(data.notifications);
            if (typeof data.unreadCount === 'number') {
              setUnreadCount(data.unreadCount);
              if (onRefreshCount) onRefreshCount(data.unreadCount);
            }
          }
        };

        socket.on('notification-list', handleList);
        socket.on('initial-notifications', handleList);

        return () => {
          socket.off('notification-list', handleList);
          socket.off('initial-notifications', handleList);
        };
      }
    }
  }, [visible, activeTab]);

  const handleMarkRead = async (id, link) => {
    try {
      await request.patch({ entity: `notification/read/${id}`, jsonData: {} });
      // Update local item
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true, readAt: new Date() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (onRefreshCount) onRefreshCount(Math.max(0, unreadCount - 1));

      // Navigate to target module if link exists
      if (link) {
        onClose();
        navigate(link);
      }
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await request.patch({ entity: 'notification/read-all', jsonData: {} });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true, readAt: new Date() })));
      setUnreadCount(0);
      if (onRefreshCount) onRefreshCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleClearAll = async () => {
    try {
      await request.delete({ entity: 'notification/clear-all' });
      setNotifications((prev) => prev.filter((n) => !n.read));
    } catch (err) {
      console.error('Failed to clear read notifications:', err);
    }
  };

  const handleDeleteOne = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await request.delete({ entity: 'notification/delete', id });
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      fetchNotifications();
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const filteredList =
    activeTab === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  return (
    <>
      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <BellOutlined style={{ fontSize: 18, color: '#002244' }} />
              <Title level={5} style={{ margin: 0 }}>
                Notification Center
              </Title>
              {unreadCount > 0 && <Badge count={unreadCount} overflowCount={99} />}
            </Space>
            <Space>
              <Tooltip title="Notification Preferences">
                <Button
                  type="text"
                  icon={<SettingOutlined />}
                  onClick={() => setIsPrefsModalOpen(true)}
                />
              </Tooltip>
              <Tooltip title="Refresh">
                <Button
                  type="text"
                  icon={<SyncOutlined spin={loading} />}
                  onClick={fetchNotifications}
                />
              </Tooltip>
            </Space>
          </div>
        }
        placement="right"
        width={typeof window !== 'undefined' && window.innerWidth < 450 ? '100%' : 420}
        onClose={onClose}
        open={visible}
        styles={{ body: { padding: '12px 16px' } }}
      >
        {/* Action Controls Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Tabs
            size="small"
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              { key: 'all', label: `All (${notifications.length})` },
              { key: 'unread', label: `Unread (${unreadCount})` },
            ]}
            style={{ marginBottom: 0 }}
          />

          <Space size={4}>
            {unreadCount > 0 && (
              <Button size="small" type="link" onClick={handleMarkAllRead} style={{ padding: 0 }}>
                Mark all read
              </Button>
            )}
            {notifications.some((n) => n.read) && (
              <>
                <Divider type="vertical" />
                <Button size="small" type="link" onClick={handleClearAll} style={{ padding: 0, color: '#8c8c8c' }}>
                  Clear read
                </Button>
              </>
            )}
          </Space>
        </div>

        {/* Notifications List */}
        <Spin spinning={loading}>
          {filteredList.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                activeTab === 'unread'
                  ? 'No unread notifications. You are all caught up!'
                  : 'No notifications in your feed.'
              }
              style={{ marginTop: 60 }}
            />
          ) : (
            <List
              itemLayout="horizontal"
              dataSource={filteredList}
              renderItem={(item) => {
                const meta = getTypeMeta(item.type);
                const isUnread = !item.read;

                return (
                  <List.Item
                    onClick={() => handleMarkRead(item._id, item.link)}
                    style={{
                      padding: '12px',
                      marginBottom: 8,
                      borderRadius: 8,
                      background: isUnread ? '#f0f7ff' : '#ffffff',
                      border: isUnread ? '1px solid #bae0ff' : '1px solid #f0f0f0',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    actions={[
                      <Tooltip title="Dismiss">
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={(e) => handleDeleteOne(item._id, e)}
                        />
                      </Tooltip>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Badge dot={isUnread} offset={[-2, 2]} color="#1677ff">
                          <Avatar
                            style={{
                              backgroundColor: meta.bg,
                              color: meta.color,
                              border: `1px solid ${meta.color}33`,
                            }}
                            icon={meta.icon}
                          />
                        </Badge>
                      }
                      title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                          <Text
                            strong={isUnread}
                            style={{
                              fontSize: 13,
                              color: isUnread ? '#002244' : '#595959',
                              lineHeight: 1.3,
                            }}
                          >
                            {item.title}
                          </Text>
                          {item.priority === 'urgent' && (
                            <Tag color="red" style={{ margin: 0, fontSize: 10, padding: '0 4px' }}>
                              Urgent
                            </Tag>
                          )}
                          {item.priority === 'high' && (
                            <Tag color="orange" style={{ margin: 0, fontSize: 10, padding: '0 4px' }}>
                              High
                            </Tag>
                          )}
                        </div>
                      }
                      description={
                        <div>
                          <Paragraph
                            ellipsis={{ rows: 2 }}
                            style={{ margin: '4px 0 6px', fontSize: 12, color: '#595959' }}
                          >
                            {item.message}
                          </Paragraph>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Tag
                              style={{
                                fontSize: 10,
                                padding: '0 6px',
                                borderRadius: 4,
                                color: meta.color,
                                borderColor: `${meta.color}44`,
                                background: meta.bg,
                              }}
                            >
                              {meta.category}
                            </Tag>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {dayjs(item.created).fromNow()}
                            </Text>
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </Spin>
      </Drawer>

      {/* Preferences Modal */}
      <NotificationPreferencesModal
        visible={isPrefsModalOpen}
        onClose={() => setIsPrefsModalOpen(false)}
        onSuccess={fetchNotifications}
      />
    </>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Tag,
  Button,
  Space,
  List,
  Avatar,
  Badge,
  Modal,
  Input,
  Spin,
  Empty,
  Tooltip,
  Divider,
  message,
} from 'antd';
import {
  GiftOutlined,
  TrophyOutlined,
  HeartOutlined,
  SendOutlined,
  BellOutlined,
  CalendarOutlined,
  SmileOutlined,
  FireOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function CelebrationsManager({ userRole, currentAdmin }) {
  const [loading, setLoading] = useState(false);
  const [celebrationData, setCelebrationData] = useState(null);

  // Send Wish Modal State
  const [wishModalVisible, setWishModalVisible] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [wishText, setWishText] = useState('');
  const [submittingWish, setSubmittingWish] = useState(false);

  const fetchCelebrations = async () => {
    setLoading(true);
    try {
      const response = await request.list({ entity: 'calendar/celebrations' });
      if (response && response.success) {
        setCelebrationData(response.result);
      }
    } catch (err) {
      console.error('Failed to load celebrations:', err);
      message.error('Failed to load celebrations data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCelebrations();
  }, []);

  const handleOpenWishModal = (person) => {
    setSelectedPerson(person);
    setWishText(
      person.type === 'Birthday'
        ? `Happy Birthday ${person.name}! Wishing you a wonderful year ahead from all of us at TecMotiv! 🎉🎂`
        : `Happy ${person.yearsCompleted} Year Work Anniversary ${person.name}! Thank you for your continued dedication and leadership at TecMotiv! 🏆🌟`
    );
    setWishModalVisible(true);
  };

  const handleSendWish = async () => {
    if (!wishText.trim() || !selectedPerson) return;
    setSubmittingWish(true);
    try {
      const response = await request.post({
        entity: 'calendar/celebration/wish',
        jsonData: {
          employeeId: selectedPerson.employeeId,
          employeeName: selectedPerson.name,
          type: selectedPerson.type,
          title: `${selectedPerson.name}'s ${selectedPerson.type}`,
          occasionDate: selectedPerson.occasionDate,
          yearsCompleted: selectedPerson.yearsCompleted || 0,
          message: wishText.trim(),
        },
      });

      if (response && response.success) {
        message.success(`Your wish for ${selectedPerson.name} has been shared!`);
        setWishModalVisible(false);
        setWishText('');
        fetchCelebrations();
      } else {
        message.error(response?.message || 'Failed to post wish');
      }
    } catch (err) {
      message.error('Error posting wish');
    } finally {
      setSubmittingWish(false);
    }
  };

  if (loading && !celebrationData) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const upcomingBirthdays = celebrationData?.upcomingBirthdays || [];
  const upcomingAnniversaries = celebrationData?.upcomingAnniversaries || [];
  const savedCelebrations = celebrationData?.savedCelebrations || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Banner / Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #780206 0%, #061161 100%)',
          borderRadius: 14,
          padding: '24px 30px',
          color: '#ffffff',
          boxShadow: '0 4px 16px rgba(120, 2, 6, 0.25)',
        }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Space style={{ marginBottom: 6 }}>
              <Tag color="#eb2f96" style={{ fontWeight: 600 }}>
                PEOPLE & CULTURE
              </Tag>
              <Tag color="gold">Celebrations Hub</Tag>
            </Space>
            <Title level={2} style={{ color: '#ffffff', margin: 0, fontWeight: 700 }}>
              Birthdays & Work Anniversaries Management
            </Title>
            <Paragraph style={{ color: 'rgba(255, 255, 255, 0.85)', margin: '6px 0 0', fontSize: 14 }}>
              Automatic milestone calculations, 7-day scheduled reminders, and team recognition wishes.
            </Paragraph>
          </Col>

          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                borderRadius: 10,
                padding: '12px 18px',
                display: 'inline-block',
                textAlign: 'center',
              }}
            >
              <BellOutlined style={{ fontSize: 20, color: '#ffd591', marginBottom: 4 }} />
              <div style={{ fontSize: 12, fontWeight: 600 }}>
                Default Reminders: <strong>7 Days Before</strong>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                Automated Notifications Active
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Main Celebrations Split Grid */}
      <Row gutter={[20, 20]}>
        {/* 1. Upcoming Birthdays */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <GiftOutlined style={{ color: '#eb2f96', fontSize: 18 }} />
                <span style={{ fontWeight: 600 }}>Upcoming Birthdays ({upcomingBirthdays.length})</span>
              </Space>
            }
            extra={<Tag color="magenta">Next 90 Days</Tag>}
            style={{ borderRadius: 12, height: '100%' }}
          >
            {upcomingBirthdays.length === 0 ? (
              <Empty description="No upcoming birthdays in the next 90 days" />
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={upcomingBirthdays}
                renderItem={(item) => (
                  <List.Item
                    style={{
                      padding: '14px 12px',
                      borderRadius: 8,
                      marginBottom: 10,
                      background: item.isToday ? '#fff0f6' : '#fafafa',
                      border: `1px solid ${item.isToday ? '#ffadd2' : '#f0f0f0'}`,
                    }}
                    actions={[
                      <Button
                        type={item.isToday ? 'primary' : 'default'}
                        danger={item.isToday}
                        icon={<HeartOutlined />}
                        size="small"
                        onClick={() => handleOpenWishModal(item)}
                      >
                        Wish
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Badge count={item.isToday ? '🎂' : ''}>
                          <Avatar
                            size={44}
                            style={{
                              backgroundColor: '#eb2f96',
                              fontSize: 16,
                            }}
                          >
                            {item.name?.[0] || 'U'}
                          </Avatar>
                        </Badge>
                      }
                      title={
                        <Space>
                          <Text strong style={{ fontSize: 14 }}>
                            {item.name}
                          </Text>
                          {item.isToday ? (
                            <Tag color="magenta">Today!</Tag>
                          ) : (
                            <Tag color="default">In {item.daysLeft} days</Tag>
                          )}
                        </Space>
                      }
                      description={
                        <div>
                          <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>
                            {item.designation || 'Team Member'} • {item.department || 'General'}
                          </div>
                          <Space size="middle" style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
                            <span>
                              <CalendarOutlined style={{ marginRight: 4 }} />
                              {dayjs(item.occasionDate).format('MMMM D')}
                            </span>
                            <span>
                              <BellOutlined style={{ marginRight: 4, color: item.reminderActive ? '#faad14' : '#8c8c8c' }} />
                              {item.reminderActive ? 'Reminder Active' : 'Reminder scheduled (7d prior)'}
                            </span>
                          </Space>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* 2. Upcoming Work Anniversaries */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <TrophyOutlined style={{ color: '#faad14', fontSize: 18 }} />
                <span style={{ fontWeight: 600 }}>Work Anniversaries ({upcomingAnniversaries.length})</span>
              </Space>
            }
            extra={<Tag color="gold">Milestone Loyalty</Tag>}
            style={{ borderRadius: 12, height: '100%' }}
          >
            {upcomingAnniversaries.length === 0 ? (
              <Empty description="No upcoming work anniversaries in the next 90 days" />
            ) : (
              <List
                itemLayout="horizontal"
                dataSource={upcomingAnniversaries}
                renderItem={(item) => (
                  <List.Item
                    style={{
                      padding: '14px 12px',
                      borderRadius: 8,
                      marginBottom: 10,
                      background: item.isToday ? '#fffbe6' : '#fafafa',
                      border: `1px solid ${item.isToday ? '#ffe58f' : '#f0f0f0'}`,
                    }}
                    actions={[
                      <Button
                        type={item.isToday ? 'primary' : 'default'}
                        style={{
                          backgroundColor: item.isToday ? '#faad14' : undefined,
                          borderColor: item.isToday ? '#faad14' : undefined,
                          color: item.isToday ? '#fff' : undefined,
                        }}
                        icon={<TrophyOutlined />}
                        size="small"
                        onClick={() => handleOpenWishModal(item)}
                      >
                        Congratulate
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Badge count={`${item.yearsCompleted}y`} style={{ backgroundColor: '#faad14' }}>
                          <Avatar
                            size={44}
                            style={{
                              backgroundColor: '#fa8c16',
                              fontSize: 16,
                            }}
                          >
                            {item.name?.[0] || 'U'}
                          </Avatar>
                        </Badge>
                      }
                      title={
                        <Space>
                          <Text strong style={{ fontSize: 14 }}>
                            {item.name}
                          </Text>
                          <Tag color="gold">{item.yearsCompleted} Year Milestone</Tag>
                          {item.isToday && <Tag color="warning">Today!</Tag>}
                        </Space>
                      }
                      description={
                        <div>
                          <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>
                            {item.designation || 'Team Member'} • {item.department || 'General'}
                          </div>
                          <Space size="middle" style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
                            <span>
                              <CalendarOutlined style={{ marginRight: 4 }} />
                              {dayjs(item.occasionDate).format('MMMM D')}
                            </span>
                            <span>
                              <BellOutlined style={{ marginRight: 4, color: item.reminderActive ? '#faad14' : '#8c8c8c' }} />
                              {item.reminderActive ? 'Reminder Active' : 'Reminder scheduled (7d prior)'}
                            </span>
                          </Space>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 3. Reusable Celebration Records & Colleague Wishes Feed */}
      <Card
        title={
          <Space>
            <SmileOutlined style={{ color: '#722ed1', fontSize: 18 }} />
            <span style={{ fontWeight: 600 }}>Recognition & Wishes Feed</span>
          </Space>
        }
        style={{ borderRadius: 12 }}
      >
        {savedCelebrations.length === 0 ? (
          <Empty description="No wishes posted yet. Be the first to congratulate a colleague!" />
        ) : (
          <List
            itemLayout="vertical"
            dataSource={savedCelebrations}
            renderItem={(celebration) => (
              <List.Item
                key={celebration._id}
                style={{
                  padding: 16,
                  borderRadius: 8,
                  background: '#fafafa',
                  marginBottom: 14,
                  border: '1px solid #f0f0f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Space>
                    <Avatar
                      style={{
                        backgroundColor:
                          celebration.type === 'Birthday' ? '#eb2f96' : '#faad14',
                      }}
                      icon={
                        celebration.type === 'Birthday' ? (
                          <GiftOutlined />
                        ) : (
                          <TrophyOutlined />
                        )
                      }
                    />
                    <div>
                      <Text strong style={{ fontSize: 14 }}>
                        {celebration.title}
                      </Text>
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                        {dayjs(celebration.occasionDate).format('MMMM D, YYYY')}
                      </div>
                    </div>
                  </Space>
                  <Tag color={celebration.type === 'Birthday' ? 'magenta' : 'gold'}>
                    {celebration.type}
                  </Tag>
                </div>

                {/* Wishes posted on this celebration */}
                <div style={{ paddingLeft: 46 }}>
                  {celebration.wishes && celebration.wishes.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {celebration.wishes.map((w, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '8px 12px',
                            background: '#fff',
                            borderRadius: 6,
                            border: '1px solid #f0f0f0',
                          }}
                        >
                          <Space style={{ marginBottom: 4 }}>
                            <Text strong style={{ fontSize: 12 }}>
                              {w.authorName}
                            </Text>
                            <Tag color="blue" style={{ fontSize: 10 }}>
                              {w.authorRole}
                            </Tag>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {dayjs(w.createdAt).format('MMM D, hh:mm A')}
                            </Text>
                          </Space>
                          <div style={{ fontSize: 13, color: '#262626' }}>
                            {w.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
                      No wishes posted yet.
                    </Text>
                  )}
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* Send Wish Modal */}
      <Modal
        title={
          selectedPerson && (
            <Space>
              {selectedPerson.type === 'Birthday' ? (
                <GiftOutlined style={{ color: '#eb2f96' }} />
              ) : (
                <TrophyOutlined style={{ color: '#faad14' }} />
              )}
              <span>Send Wishes to {selectedPerson.name}</span>
            </Space>
          )
        }
        open={wishModalVisible}
        onCancel={() => setWishModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setWishModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="send"
            type="primary"
            icon={<SendOutlined />}
            loading={submittingWish}
            onClick={handleSendWish}
          >
            Post Wish
          </Button>,
        ]}
      >
        {selectedPerson && (
          <div>
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: selectedPerson.type === 'Birthday' ? '#fff0f6' : '#fffbe6',
                marginBottom: 16,
              }}
            >
              <Text strong>
                {selectedPerson.type === 'Birthday'
                  ? `🎂 Celebrating ${selectedPerson.name}'s Birthday`
                  : `🏆 Celebrating ${selectedPerson.name}'s ${selectedPerson.yearsCompleted} Year Anniversary`}
              </Text>
              <div style={{ fontSize: 12, color: '#595959', marginTop: 4 }}>
                Occasion Date: {dayjs(selectedPerson.occasionDate).format('MMMM D, YYYY')}
              </div>
            </div>

            <Text style={{ fontSize: 13, fontWeight: 500 }}>Your Message / Wish:</Text>
            <TextArea
              rows={4}
              style={{ marginTop: 8 }}
              value={wishText}
              onChange={(e) => setWishText(e.target.value)}
              placeholder="Write a congratulatory note..."
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

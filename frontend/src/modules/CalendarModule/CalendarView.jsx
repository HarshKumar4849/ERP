import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Badge,
  Card,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Select,
  Typography,
  Tooltip,
  Modal,
  List,
  Avatar,
  Divider,
  Spin,
  message,
} from 'antd';
import {
  CalendarOutlined,
  PlusOutlined,
  ReloadOutlined,
  FilterOutlined,
  VideoCameraOutlined,
  GiftOutlined,
  TrophyOutlined,
  CoffeeOutlined,
  AlertOutlined,
  CarOutlined,
  ProjectOutlined,
  UserOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { Title, Text, Paragraph } = Typography;

const categoryColors = {
  Birthday: '#eb2f96',
  Anniversary: '#fa8c16',
  Recognition: '#faad14',
  Festival: '#722ed1',
  'Company Event': '#1890ff',
  Webinar: '#13c2c2',
  'Client Event': '#52c41a',
  Training: '#2f54eb',
  'CSR Activity': '#389e0d',
  Meeting: '#1677ff',
  Event: '#722ed1',
  'Company Activity': '#722ed1',
  Holiday: '#13c2c2',
  Leave: '#fa8c16',
  Deadline: '#ff4d4f',
  'Project Milestone': '#13c2c2',
};

const categoryIcons = {
  Birthday: <GiftOutlined />,
  Anniversary: <TrophyOutlined />,
  Recognition: <TrophyOutlined />,
  Festival: <CalendarOutlined />,
  'Company Event': <CalendarOutlined />,
  Webinar: <VideoCameraOutlined />,
  'Client Event': <CarOutlined />,
  Training: <CalendarOutlined />,
  'CSR Activity': <CalendarOutlined />,
  Meeting: <VideoCameraOutlined />,
  Event: <CalendarOutlined />,
  'Company Activity': <CalendarOutlined />,
  Holiday: <CalendarOutlined />,
  Leave: <CoffeeOutlined />,
  Deadline: <AlertOutlined />,
  'Project Milestone': <ProjectOutlined />,
};

export default function CalendarView({
  scope = 'company', // 'my' or 'company'
  userRole,
  onOpenCreateEvent,
  refreshKey = 0,
}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [activeCategories, setActiveCategories] = useState([
    'Birthday',
    'Anniversary',
    'Recognition',
    'Festival',
    'Company Event',
    'Webinar',
    'Client Event',
    'Training',
    'CSR Activity',
    'Meeting',
    'Event',
    'Leave',
    'Deadline',
    'Project Milestone',
  ]);

  // Modal for inspecting all events on a clicked date
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateModalVisible, setDateModalVisible] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await request.list({
        entity: 'calendar/events',
        options: {
          scope,
          year: selectedYear,
        },
      });

      if (response && response.result) {
        setEvents(response.result);
      }
    } catch (err) {
      console.error('Failed to load calendar events:', err);
      message.error('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [scope, selectedYear, refreshKey]);

  const toggleCategory = (cat) => {
    if (activeCategories.includes(cat)) {
      setActiveCategories(activeCategories.filter((c) => c !== cat));
    } else {
      setActiveCategories([...activeCategories, cat]);
    }
  };

  // Filter events based on active category checkboxes
  const filteredEvents = events.filter((e) =>
    activeCategories.includes(e.eventType)
  );

  // Map events to date strings (YYYY-MM-DD)
  const getEventsForDate = (date) => {
    const targetStr = date.format('YYYY-MM-DD');
    return filteredEvents.filter((e) => {
      const startStr = dayjs(e.startDate).format('YYYY-MM-DD');
      const endStr = e.endDate ? dayjs(e.endDate).format('YYYY-MM-DD') : startStr;
      return targetStr >= startStr && targetStr <= endStr;
    });
  };

  // Render events inside cell
  const dateCellRender = (value) => {
    const dayEvents = getEventsForDate(value);
    if (!dayEvents || dayEvents.length === 0) return null;

    return (
      <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {dayEvents.slice(0, 3).map((item) => (
          <Tooltip
            key={item.id}
            title={`${item.title} (${item.eventType})`}
            placement="topLeft"
          >
            <div
              style={{
                fontSize: 11,
                padding: '1px 4px',
                borderRadius: 4,
                background: `${categoryColors[item.eventType] || '#1890ff'}15`,
                color: categoryColors[item.eventType] || '#1890ff',
                borderLeft: `3px solid ${categoryColors[item.eventType] || '#1890ff'}`,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {item.title}
            </div>
          </Tooltip>
        ))}
        {dayEvents.length > 3 && (
          <div style={{ fontSize: 10, color: '#8c8c8c', paddingLeft: 4 }}>
            +{dayEvents.length - 3} more
          </div>
        )}
      </div>
    );
  };

  const handleSelectDate = (date) => {
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length > 0) {
      setSelectedDate(date);
      setDateModalVisible(true);
    }
  };

  return (
    <Card
      style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
      bodyStyle={{ padding: 20 }}
    >
      {/* Category Filter Chips Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 18,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Space wrap>
          <Text strong style={{ fontSize: 13, marginRight: 4 }}>
            <FilterOutlined style={{ marginRight: 4 }} /> Filter Types:
          </Text>
          {Object.keys(categoryColors).map((cat) => {
            const isActive = activeCategories.includes(cat);
            return (
              <Tag.CheckableTag
                key={cat}
                checked={isActive}
                onChange={() => toggleCategory(cat)}
                style={{
                  borderRadius: 14,
                  padding: '2px 10px',
                  border: `1px solid ${isActive ? categoryColors[cat] : '#d9d9d9'}`,
                  background: isActive ? `${categoryColors[cat]}15` : '#fff',
                  color: isActive ? categoryColors[cat] : '#595959',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {categoryIcons[cat]} {cat}
              </Tag.CheckableTag>
            );
          })}
        </Space>

        {/* wrap keeps these actions inside the card on tablet/mobile */}
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={fetchEvents}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onOpenCreateEvent}
          >
            Create Event
          </Button>
        </Space>
      </div>

      {/* Main Calendar View */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      ) : (
        <Calendar
          dateCellRender={dateCellRender}
          onSelect={handleSelectDate}
          headerRender={({ value, onChange }) => {
            const current = value.clone();
            return (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0 16px',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <Title level={4} style={{ margin: 0 }}>
                  <CalendarOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                  {current.format('MMMM YYYY')}
                </Title>
                {/* wrap keeps the month navigation inside the calendar header on mobile */}
                <Space wrap>
                  <Button
                    size="small"
                    onClick={() => onChange(current.subtract(1, 'month'))}
                  >
                    Previous Month
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    onClick={() => onChange(dayjs())}
                  >
                    Today
                  </Button>
                  <Button
                    size="small"
                    onClick={() => onChange(current.add(1, 'month'))}
                  >
                    Next Month
                  </Button>
                </Space>
              </div>
            );
          }}
        />
      )}

      {/* Date Inspection Modal */}
      <Modal
        title={
          selectedDate && (
            <Space>
              <CalendarOutlined style={{ color: '#1677ff' }} />
              <span>Events on {selectedDate.format('dddd, MMMM D, YYYY')}</span>
            </Space>
          )
        }
        open={dateModalVisible}
        onCancel={() => setDateModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDateModalVisible(false)}>
            Close
          </Button>,
        ]}
        width={580}
      >
        {selectedDate && (
          <List
            itemLayout="horizontal"
            dataSource={getEventsForDate(selectedDate)}
            renderItem={(item) => (
              <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                <List.Item.Meta
                  avatar={
                    <Avatar
                      style={{
                        backgroundColor: categoryColors[item.eventType] || '#1890ff',
                      }}
                      icon={categoryIcons[item.eventType] || <CalendarOutlined />}
                    />
                  }
                  title={
                    <Space>
                      <Text strong style={{ fontSize: 14 }}>
                        {item.title}
                      </Text>
                      <Tag
                        color={categoryColors[item.eventType]}
                        style={{ fontSize: 11 }}
                      >
                        {item.eventType}
                      </Tag>
                    </Space>
                  }
                  description={
                    <div style={{ marginTop: 4 }}>
                      {item.description && (
                        <div style={{ color: '#595959', marginBottom: 4 }}>
                          {item.description}
                        </div>
                      )}
                      <Space size="middle" style={{ fontSize: 12, color: '#8c8c8c' }}>
                        {item.startDate && (
                          <span>
                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                            {dayjs(item.startDate).format('hh:mm A')}
                          </span>
                        )}
                        {item.location && (
                          <span>
                            <EnvironmentOutlined style={{ marginRight: 4 }} />
                            {item.location}
                          </span>
                        )}
                        {item.department && <span>Dept: {item.department}</span>}
                      </Space>
                      {item.isVirtual && item.meetingLink && (
                        <div style={{ marginTop: 6 }}>
                          <Button
                            size="small"
                            type="primary"
                            href={item.meetingLink}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Join Video Meeting
                          </Button>
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </Card>
  );
}

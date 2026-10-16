import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Input,
  Select,
  Button,
  Tag,
  Space,
  Typography,
  Avatar,
  Badge,
  Tooltip,
  Dropdown,
  Popconfirm,
  Empty,
  Spin,
  Radio,
  Table,
  message,
} from 'antd';
import {
  SearchOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  VideoCameraOutlined,
  TeamOutlined,
  MailOutlined,
  PictureOutlined,
  FileTextOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  AppstoreOutlined,
  BarsOutlined,
  SendOutlined,
  UserOutlined,
  CheckCircleOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';
import { EVENT_TYPES } from './EventFormModal';

const { Title, Text, Paragraph } = Typography;

const TYPE_COLORS = {
  Birthday: '#eb2f96',
  Anniversary: '#fa8c16',
  Recognition: '#faad14',
  Festival: '#722ed1',
  'Company Event': '#1890ff',
  Webinar: '#13c2c2',
  'Client Event': '#52c41a',
  Training: '#2f54eb',
  'CSR Activity': '#389e0d',
};

export default function EventsList({
  scope = 'upcoming', // 'upcoming', 'history', 'all'
  userRole,
  onOpenCreate,
  onSelectEvent,
  onEditEvent,
  onOpenInvitation,
  onOpenMedia,
  onOpenReport,
  refreshKey = 0,
}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeScope, setActiveScope] = useState(scope);
  const [selectedType, setSelectedType] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const queryParams = {
        scope: activeScope,
        items: 100,
      };
      if (selectedType !== 'All') {
        queryParams.eventType = selectedType;
      }
      if (searchText.trim()) {
        queryParams.search = searchText.trim();
      }

      const res = await request.list({
        entity: 'event',
        options: queryParams,
      });

      if (res && res.result) {
        setEvents(res.result);
      } else {
        setEvents([]);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
      message.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [activeScope, selectedType, refreshKey]);

  const handleSearch = () => {
    fetchEvents();
  };

  const handleDelete = async (id) => {
    try {
      const res = await request.delete({ entity: 'event', id });
      if (res && res.success) {
        message.success('Event deleted successfully');
        fetchEvents();
      } else {
        message.error(res?.message || 'Delete failed');
      }
    } catch (e) {
      message.error('Error deleting event');
    }
  };

  // KPI Calculations
  const now = new Date();
  const upcomingCount = events.filter((e) => new Date(e.startDate) >= now || e.status === 'Scheduled').length;
  const completedCount = events.filter((e) => e.status === 'Completed' || new Date(e.endDate) < now).length;
  const totalParticipantsCount = events.reduce((acc, ev) => acc + (ev.participants?.length || 0), 0);

  const columns = [
    {
      title: 'Event',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => {
        const themeColor = TYPE_COLORS[record.eventType] || '#1890ff';
        return (
          <Space>
            {record.poster ? (
              <img
                src={record.poster}
                alt="poster"
                style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 6,
                  background: `${themeColor}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: themeColor,
                  fontWeight: 'bold',
                }}
              >
                <CalendarOutlined style={{ fontSize: 18 }} />
              </div>
            )}
            <div>
              <div
                style={{ fontWeight: 600, color: '#002244', cursor: 'pointer' }}
                onClick={() => onSelectEvent(record)}
              >
                {record.title || record.eventName}
              </div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.organizerName}</div>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Category',
      dataIndex: 'eventType',
      key: 'eventType',
      render: (type) => (
        <Tag color={TYPE_COLORS[type] || 'blue'} style={{ borderRadius: 4, fontWeight: 600 }}>
          {type}
        </Tag>
      ),
    },
    {
      title: 'Date & Time',
      key: 'dateTime',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {r.startDate ? dayjs(r.startDate).format('MMM D, YYYY') : 'TBD'}
          </div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {r.time || r.startTime || '10:00 AM'}
          </div>
        </div>
      ),
    },
    {
      title: 'Venue / Link',
      dataIndex: 'venue',
      key: 'venue',
      render: (v, r) => (
        <div>
          <div>{v || r.location || 'Auditorium'}</div>
          {r.isVirtual && (
            <Tag color="cyan" style={{ fontSize: 11, marginTop: 2 }}>
              <VideoCameraOutlined /> Stream
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Participants',
      key: 'participants',
      render: (_, r) => (
        <Space>
          <TeamOutlined style={{ color: '#1890ff' }} />
          <span>{r.participants?.length || 0}</span>
        </Space>
      ),
    },
    {
      title: 'Invitations',
      key: 'invitations',
      render: (_, r) => (
        r.invitation?.sent ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>Sent</Tag>
        ) : (
          <Tag color="default">Draft</Tag>
        )
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Badge
          status={status === 'Completed' ? 'success' : status === 'In Progress' ? 'processing' : 'default'}
          text={status || 'Scheduled'}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space size="small">
          <Button size="small" onClick={() => onSelectEvent(r)}>
            Details
          </Button>
          <Button size="small" icon={<SendOutlined />} onClick={() => onOpenInvitation(r)}>
            Invite
          </Button>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'media',
                  label: 'Media Gallery',
                  icon: <PictureOutlined />,
                  onClick: () => onOpenMedia(r),
                },
                {
                  key: 'report',
                  label: 'Event Report',
                  icon: <FileTextOutlined />,
                  onClick: () => onOpenReport(r),
                },
                {
                  key: 'edit',
                  label: 'Edit Event',
                  icon: <EditOutlined />,
                  onClick: () => onEditEvent(r),
                },
                {
                  type: 'divider',
                },
                {
                  key: 'delete',
                  label: 'Delete Event',
                  danger: true,
                  icon: <DeleteOutlined />,
                  onClick: () => handleDelete(r._id),
                },
              ],
            }}
          >
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Top Filter and Controls Bar */}
      <Card
        size="small"
        style={{
          borderRadius: 10,
          marginBottom: 20,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        }}
      >
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} md={10}>
            <Space wrap>
              <Radio.Group
                value={activeScope}
                onChange={(e) => setActiveScope(e.target.value)}
                buttonStyle="solid"
              >
                <Radio.Button value="upcoming">Upcoming & Live</Radio.Button>
                <Radio.Button value="all">All Events</Radio.Button>
                <Radio.Button value="history">History & Completed</Radio.Button>
              </Radio.Group>
            </Space>
          </Col>

          <Col xs={24} md={14} style={{ textAlign: 'right' }}>
            <Space wrap>
              {/* Event Type Filter */}
              <Select
                value={selectedType}
                onChange={setSelectedType}
                style={{ width: 180, textAlign: 'left' }}
                options={[
                  { value: 'All', label: 'All Event Types' },
                  ...EVENT_TYPES,
                ]}
              />

              {/* Search input */}
              <Input
                placeholder="Search event, venue, host..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onPressEnter={handleSearch}
                style={{ width: 220 }}
                allowClear
              />

              {/* View Switch */}
              <Radio.Group
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                buttonStyle="solid"
              >
                <Radio.Button value="grid">
                  <AppstoreOutlined />
                </Radio.Button>
                <Radio.Button value="table">
                  <BarsOutlined />
                </Radio.Button>
              </Radio.Group>

              {onOpenCreate && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={onOpenCreate}
                  style={{ background: '#002244', borderColor: '#002244', fontWeight: 600 }}
                >
                  Create Event
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="Loading events & celebrations..." />
        </div>
      ) : events.length === 0 ? (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '40px 0' }}>
          <Empty
            description={
              <span>
                No events found matching your criteria.
                <br />
                Schedule a new team celebration, webinar, or company town hall!
              </span>
            }
          >
            {onOpenCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={onOpenCreate} style={{ marginTop: 12 }}>
                Schedule First Event
              </Button>
            )}
          </Empty>
        </Card>
      ) : viewMode === 'table' ? (
        <Card style={{ borderRadius: 10 }}>
          <Table
            columns={columns}
            dataSource={events}
            rowKey="_id"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 800 }}
          />
        </Card>
      ) : (
        /* Grid Cards View */
        <Row gutter={[20, 20]}>
          {events.map((ev) => {
            const eventType = ev.eventType || 'Company Event';
            const themeColor = TYPE_COLORS[eventType] || '#1890ff';
            const participants = ev.participants || [];
            const formattedDate = ev.startDate
              ? dayjs(ev.startDate).format('ddd, MMM D, YYYY')
              : 'TBD';

            return (
              <Col xs={24} sm={12} lg={8} key={ev._id}>
                <Card
                  hoverable
                  style={{
                    borderRadius: 12,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    border: '1px solid #ebebeb',
                  }}
                  bodyStyle={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column' }}
                  cover={
                    ev.poster ? (
                      <div
                        style={{ height: 160, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}
                        onClick={() => onSelectEvent(ev)}
                      >
                        <img
                          src={ev.poster}
                          alt={ev.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: 12,
                            left: 12,
                          }}
                        >
                          <Tag
                            color={themeColor}
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 4,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            }}
                          >
                            {eventType}
                          </Tag>
                        </div>
                        <div
                          style={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                          }}
                        >
                          <Tag
                            color={ev.status === 'Completed' ? 'green' : 'blue'}
                            style={{ fontWeight: 600, borderRadius: 4 }}
                          >
                            {ev.status || 'Scheduled'}
                          </Tag>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          height: 120,
                          background: `linear-gradient(135deg, ${themeColor}20, #00224415)`,
                          padding: 16,
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                        onClick={() => onSelectEvent(ev)}
                      >
                        <Tag color={themeColor} style={{ fontSize: 12, fontWeight: 600, borderRadius: 4 }}>
                          {eventType}
                        </Tag>
                        <Tag color={ev.status === 'Completed' ? 'green' : 'blue'}>
                          {ev.status || 'Scheduled'}
                        </Tag>
                      </div>
                    )
                  }
                >
                  {/* Title */}
                  <div style={{ flex: 1 }}>
                    <Title
                      level={5}
                      style={{
                        margin: '0 0 8px',
                        color: '#002244',
                        cursor: 'pointer',
                        fontSize: 16,
                        lineHeight: 1.3,
                      }}
                      onClick={() => onSelectEvent(ev)}
                    >
                      {ev.title || ev.eventName}
                    </Title>

                    {/* Date & Time */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#262626', marginBottom: 6, fontSize: 13 }}>
                      <CalendarOutlined style={{ color: themeColor }} />
                      <span style={{ fontWeight: 600 }}>{formattedDate}</span>
                      <span style={{ color: '#8c8c8c' }}>•</span>
                      <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
                      <span style={{ color: '#595959' }}>{ev.time || ev.startTime || '10:00 AM'}</span>
                    </div>

                    {/* Venue / Link */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#595959', fontSize: 13, marginBottom: 12 }}>
                      <EnvironmentOutlined style={{ color: '#fa541c' }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ev.venue || ev.location || 'TecMotiv Auditorium'}
                      </span>
                      {ev.isVirtual && (
                        <Tag color="cyan" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                          Virtual
                        </Tag>
                      )}
                    </div>

                    {/* Participants stack & Invitation status */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 0',
                        borderTop: '1px solid #f0f0f0',
                        marginBottom: 12,
                      }}
                    >
                      <Space>
                        <Avatar.Group maxCount={3} size="small">
                          {participants.map((p, pIdx) => {
                            const emp = p.employee || p;
                            return (
                              <Tooltip key={pIdx} title={emp.name || 'Participant'}>
                                <Avatar src={emp.photo} icon={<UserOutlined />} style={{ background: '#002244' }} />
                              </Tooltip>
                            );
                          })}
                        </Avatar.Group>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {participants.length} Invited
                        </Text>
                      </Space>

                      {ev.invitation?.sent ? (
                        <Tag color="green" icon={<CheckCircleOutlined />} style={{ margin: 0, fontSize: 11 }}>
                          Invited
                        </Tag>
                      ) : (
                        <Tag color="default" style={{ margin: 0, fontSize: 11 }}>
                          Draft
                        </Tag>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 10, borderTop: '1px solid #f0f0f0' }}>
                    <Button
                      type="primary"
                      size="middle"
                      style={{ flex: 1, background: '#002244', borderColor: '#002244', fontWeight: 600 }}
                      onClick={() => onSelectEvent(ev)}
                    >
                      View Details
                    </Button>
                    <Tooltip title="Dispatch Invitations">
                      <Button icon={<SendOutlined />} onClick={() => onOpenInvitation(ev)} />
                    </Tooltip>
                    <Tooltip title="Media Attachments">
                      <Button icon={<PictureOutlined />} onClick={() => onOpenMedia(ev)} />
                    </Tooltip>
                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: 'report',
                            label: 'Submit Event Report',
                            icon: <FileTextOutlined />,
                            onClick: () => onOpenReport(ev),
                          },
                          {
                            key: 'edit',
                            label: 'Edit Event',
                            icon: <EditOutlined />,
                            onClick: () => onEditEvent(ev),
                          },
                          {
                            type: 'divider',
                          },
                          {
                            key: 'delete',
                            label: 'Delete Event',
                            danger: true,
                            icon: <DeleteOutlined />,
                            onClick: () => handleDelete(ev._id),
                          },
                        ],
                      }}
                    >
                      <Button icon={<MoreOutlined />} />
                    </Dropdown>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}

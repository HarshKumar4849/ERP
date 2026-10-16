import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Tabs,
  Typography,
  Tag,
  Button,
  Space,
  Input,
  Modal,
  Form,
  Select,
  Drawer,
  Avatar,
  Badge,
  Spin,
  Alert,
  Empty,
  Tooltip,
  Divider,
  message,
} from 'antd';
import {
  NotificationOutlined,
  GlobalOutlined,
  CalendarOutlined,
  TrophyOutlined,
  LikeOutlined,
  PlusOutlined,
  SearchOutlined,
  PushpinOutlined,
  UserOutlined,
  ClockCircleOutlined,
  ShareAltOutlined,
  CheckCircleOutlined,
  FireOutlined,
  RocketOutlined,
  TeamOutlined,
  CoffeeOutlined,
  SmileOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { request } from '@/request';
import { ROLES, normalizeRole } from '@/utils/rbac';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Section Configuration & Metadata
const SECTION_CONFIG = {
  'COMPANY NEWS': {
    key: 'COMPANY NEWS',
    label: 'Company News',
    icon: <GlobalOutlined />,
    color: '#002244',
    subTypes: ['New employee', 'New client', 'New partnership', 'Company milestone'],
    bannerColor: 'linear-gradient(135deg, #002244 0%, #004080 100%)',
    subTypeColors: {
      'New employee': 'cyan',
      'New client': 'green',
      'New partnership': 'purple',
      'Company milestone': 'gold',
    },
  },
  'ANNOUNCEMENTS': {
    key: 'ANNOUNCEMENTS',
    label: 'Announcements',
    icon: <NotificationOutlined />,
    color: '#fa8c16',
    subTypes: ['Holidays', 'Office updates', 'Policy changes', 'Important deadlines'],
    bannerColor: 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)',
    subTypeColors: {
      'Holidays': 'orange',
      'Office updates': 'blue',
      'Policy changes': 'volcano',
      'Important deadlines': 'red',
    },
  },
  'EVENTS': {
    key: 'EVENTS',
    label: 'Events & Activities',
    icon: <CalendarOutlined />,
    color: '#13c2c2',
    subTypes: ['Webinars', 'Conferences', 'Internal activities'],
    bannerColor: 'linear-gradient(135deg, #08979c 0%, #006d75 100%)',
    subTypeColors: {
      'Webinars': 'geekblue',
      'Conferences': 'purple',
      'Internal activities': 'cyan',
    },
  },
  'RECOGNITION': {
    key: 'RECOGNITION',
    label: 'Recognition & Awards',
    icon: <TrophyOutlined />,
    color: '#eb2f96',
    subTypes: ['Employee of the Month', 'Team achievements', 'Project achievements'],
    bannerColor: 'linear-gradient(135deg, #eb2f96 0%, #722ed1 100%)',
    subTypeColors: {
      'Employee of the Month': 'gold',
      'Team achievements': 'magenta',
      'Project achievements': 'blue',
    },
  },
};

export default function BulletinFeed({ initialSection = 'ALL', userRole, currentAdmin }) {
  const [loading, setLoading] = useState(false);
  const [feedData, setFeedData] = useState(null);
  const [activeTab, setActiveTab] = useState(initialSection);
  const [subTypeFilter, setSubTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Drawer state for reading full item
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // Create post modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Likes tracking
  const [likedPosts, setLikedPosts] = useState({});

  const role = normalizeRole(userRole || currentAdmin?.role);
  const canPublish = [ROLES.ADMIN, ROLES.HR].includes(role);

  const fetchFeed = async () => {
    try {
      setLoading(true);
      const res = await request.list({ entity: 'bulletin/feed' });
      if (res && res.success) {
        setFeedData(res.result);
      }
    } catch (err) {
      console.error('Failed to load bulletin feed:', err);
      message.error('Unable to fetch company bulletin. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  const handleLike = async (itemId, e) => {
    if (e) e.stopPropagation();
    try {
      // Optimistic update
      setFeedData((prev) => {
        if (!prev) return prev;
        const updateList = (list) =>
          list.map((item) =>
            item._id === itemId ? { ...item, likes: (item.likes || 0) + 1 } : item
          );
        return {
          ...prev,
          all: updateList(prev.all || []),
          companyNews: updateList(prev.companyNews || []),
          announcements: updateList(prev.announcements || []),
          events: updateList(prev.events || []),
          recognition: updateList(prev.recognition || []),
        };
      });

      setLikedPosts((prev) => ({ ...prev, [itemId]: true }));

      if (selectedItem && selectedItem._id === itemId) {
        setSelectedItem((prev) => ({ ...prev, likes: (prev.likes || 0) + 1 }));
      }

      await request.post({ entity: `bulletin/like/${itemId}` });
    } catch (err) {
      console.error('Failed to like post:', err);
    }
  };

  const handleCreateSubmit = async (values) => {
    try {
      setSubmitting(true);
      const payload = {
        title: values.title,
        content: values.content,
        summary: values.summary || values.content.slice(0, 150),
        section: values.section,
        subType: values.subType,
        priority: values.priority || 'Normal',
        pinned: Boolean(values.pinned),
        department: values.department || 'All',
        tags: values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      };

      const res = await request.post({ entity: 'bulletin/create', jsonData: payload });
      if (res && res.success) {
        message.success('Bulletin post published successfully!');
        setCreateModalVisible(false);
        form.resetFields();
        fetchFeed();
      } else {
        message.error(res?.message || 'Failed to publish post');
      }
    } catch (err) {
      message.error('Error publishing bulletin item.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter items based on activeTab, subTypeFilter, and searchQuery
  const getFilteredItems = () => {
    if (!feedData || !feedData.all) return [];

    let list = [];
    if (activeTab === 'ALL') {
      list = feedData.all;
    } else if (activeTab === 'COMPANY NEWS') {
      list = feedData.companyNews || [];
    } else if (activeTab === 'ANNOUNCEMENTS') {
      list = feedData.announcements || [];
    } else if (activeTab === 'EVENTS') {
      list = feedData.events || [];
    } else if (activeTab === 'RECOGNITION') {
      list = feedData.recognition || [];
    }

    if (subTypeFilter !== 'ALL') {
      list = list.filter((item) => item.subType === subTypeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.content?.toLowerCase().includes(q) ||
          item.subType?.toLowerCase().includes(q) ||
          item.authorName?.toLowerCase().includes(q)
      );
    }

    return list;
  };

  const filteredItems = getFilteredItems();
  const counts = feedData?.counts || { total: 0, companyNews: 0, announcements: 0, events: 0, recognition: 0 };

  // Current subTypes available for the selected section tab
  const currentSubTypes =
    activeTab !== 'ALL' && SECTION_CONFIG[activeTab]
      ? SECTION_CONFIG[activeTab].subTypes
      : [];

  return (
    <div style={{ padding: '4px 0 32px 0' }}>
      {/* Hero Header */}
      <Card
        bordered={false}
        style={{
          background: 'linear-gradient(135deg, #001f3f 0%, #003366 100%)',
          borderRadius: 16,
          color: '#fff',
          marginBottom: 24,
          boxShadow: '0 8px 24px rgba(0, 31, 63, 0.15)',
        }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          {/* Stack to full width below lg: the publish button is wider than a
              third of the tablet content area. */}
          <Col xs={24} lg={16}>
            {/* wrap lets the heading/description reflow so this column does not
                force the publish button past the viewport on tablet */}
            <Space align="center" size={16} orientation="horizontal" wrap>
              <Avatar
                size={56}
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#d4af37' }}
                icon={<NotificationOutlined style={{ fontSize: 28 }} />}
              />
              <div>
                <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
                  TECMOTIV BULLETIN
                </Title>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
                  Official Corporate Broadcasts, Company News, Events & Recognition
                </Text>
              </div>
            </Space>
          </Col>
          <Col xs={24} lg={8} orientation="horizontal" style={{ textAlign: 'right' }}>
            {canPublish && (
              <Button
                 orientation="horizontal"
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
                style={{
                  backgroundColor: '#d4af37',
                  borderColor: '#d4af37',
                  color: '#001f3f',
                  fontWeight: 600,
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(212, 175, 55, 0.35)',
                }}
              >
                Publish Bulletin Post
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      {/* KPI Stats Bar */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card
            bordered={false}
            hoverable
            onClick={() => { setActiveTab('COMPANY NEWS'); setSubTypeFilter('ALL'); }}
            style={{
              borderRadius: 12,
              background: activeTab === 'COMPANY NEWS' ? '#e6f7ff' : '#fff',
              border: activeTab === 'COMPANY NEWS' ? '2px solid #1890ff' : '1px solid #f0f0f0',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          >
            <Space align="center" size={12}>
              <Avatar shape="square" size={44} style={{ backgroundColor: '#e6f7ff', color: '#002244' }} icon={<GlobalOutlined />} />
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>COMPANY NEWS</Text>
                <Title level={3} style={{ margin: 0, color: '#002244' }}>{counts.companyNews}</Title>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card
            bordered={false}
            hoverable
            onClick={() => { setActiveTab('ANNOUNCEMENTS'); setSubTypeFilter('ALL'); }}
            style={{
              borderRadius: 12,
              background: activeTab === 'ANNOUNCEMENTS' ? '#fff7e6' : '#fff',
              border: activeTab === 'ANNOUNCEMENTS' ? '2px solid #fa8c16' : '1px solid #f0f0f0',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          >
            <Space align="center" size={12}>
              <Avatar shape="square" size={44} style={{ backgroundColor: '#fff7e6', color: '#fa8c16' }} icon={<NotificationOutlined />} />
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>ANNOUNCEMENTS</Text>
                <Title level={3} style={{ margin: 0, color: '#fa8c16' }}>{counts.announcements}</Title>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card
            bordered={false}
            hoverable
            onClick={() => { setActiveTab('EVENTS'); setSubTypeFilter('ALL'); }}
            style={{
              borderRadius: 12,
              background: activeTab === 'EVENTS' ? '#e6fffb' : '#fff',
              border: activeTab === 'EVENTS' ? '2px solid #13c2c2' : '1px solid #f0f0f0',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          >
            <Space align="center" size={12}>
              <Avatar shape="square" size={44} style={{ backgroundColor: '#e6fffb', color: '#13c2c2' }} icon={<CalendarOutlined />} />
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>EVENTS</Text>
                <Title level={3} style={{ margin: 0, color: '#13c2c2' }}>{counts.events}</Title>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card
            bordered={false}
            hoverable
            onClick={() => { setActiveTab('RECOGNITION'); setSubTypeFilter('ALL'); }}
            style={{
              borderRadius: 12,
              background: activeTab === 'RECOGNITION' ? '#fff0f6' : '#fff',
              border: activeTab === 'RECOGNITION' ? '2px solid #eb2f96' : '1px solid #f0f0f0',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          >
            <Space align="center" size={12}>
              <Avatar shape="square" size={44} style={{ backgroundColor: '#fff0f6', color: '#eb2f96' }} icon={<TrophyOutlined />} />
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>RECOGNITION</Text>
                <Title level={3} style={{ margin: 0, color: '#eb2f96' }}>{counts.recognition}</Title>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Main Content Area */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        }}
      >
        {/* Navigation & Controls */}
        <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ orientationMargin: '0 0 20px 0' }}>
          <Col xs={24} lg={14}>
            <Tabs
              activeKey={activeTab}
              onChange={(key) => {
                setActiveTab(key);
                setSubTypeFilter('ALL');
              }}
              items={[
                { key: 'ALL', label: `All Updates (${counts.total})` },
                { key: 'COMPANY NEWS', label: `Company News (${counts.companyNews})`, icon: <GlobalOutlined /> },
                { key: 'ANNOUNCEMENTS', label: `Announcements (${counts.announcements})`, icon: <NotificationOutlined /> },
                { key: 'EVENTS', label: `Events (${counts.events})`, icon: <CalendarOutlined /> },
                { key: 'RECOGNITION', label: `Recognition (${counts.recognition})`, icon: <TrophyOutlined /> },
              ]}
            />
          </Col>
          <Col xs={24} lg={10}>
            <Input
              placeholder="Search bulletins, authors, or topics..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              size="middle"
              style={{ borderRadius: 8 }}
            />
          </Col>
        </Row>

        {/* SubType Filter Chips (When inside a specific section) */}
        {currentSubTypes.length > 0 && (
          <div style={{ marginBottom: 20, padding: '10px 14px', background: '#fafafa', borderRadius: 8 }}>
            <Space wrap size={[8, 8]}>
              <Text orientation="vertical" orientationPosition="left" type="secondary" style={{ fontSize: 12, marginRight: 6 }}>
                Filter by Type:
              </Text>
              <Button
                size="small"
                type={subTypeFilter === 'ALL' ? 'primary' : 'default'}
                onClick={() => setSubTypeFilter('ALL')}
                style={{ borderRadius: 16 }}
              >
                All {SECTION_CONFIG[activeTab]?.label}
              </Button>
              {currentSubTypes.map((st) => (
                <Button
                  key={st}
                  size="small"
                  type={subTypeFilter === st ? 'primary' : 'default'}
                  onClick={() => setSubTypeFilter(st)}
                  style={{
                    borderRadius: 16,
                    borderColor: subTypeFilter === st ? undefined : '#d9d9d9',
                  }}
                >
                  {st}
                </Button>
              ))}
            </Space>
          </div>
        )}

        {/* Bulletin Items Grid / Feed */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: '#8c8c8c' }}>Loading TecMotiv Bulletin...</div>
          </div>
        ) : filteredItems.length === 0 ? (
          <Empty
            description={
              searchQuery
                ? `No posts matching "${searchQuery}"`
                : 'No bulletin posts found in this section.'
            }
            style={{ padding: '40px 0' }}
          />
        ) : (
          <Row gutter={[20, 20]}>
            {filteredItems.map((item) => {
              const secConf = SECTION_CONFIG[item.section] || SECTION_CONFIG['ANNOUNCEMENTS'];
              const subColor = secConf.subTypeColors[item.subType] || 'blue';
              const isLiked = likedPosts[item._id];

              return (
                <Col xs={24} md={12} lg={8} key={item._id}>
                  <Card
                    hoverable
                    style={{
                      borderRadius: 12,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      border: item.pinned ? '1.5px solid #faad14' : '1px solid #f0f0f0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      transition: 'all 0.25s ease',
                      position: 'relative',
                    }}
                    bodyStyle={{
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      padding: 20,
                    }}
                    onClick={() => {
                      setSelectedItem(item);
                      setDetailVisible(true);
                    }}
                  >
                    {/* Pinned Ribbon */}
                    {item.pinned && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                        }}
                      >
                        <Tag color="gold" icon={<PushpinOutlined />}>
                          PINNED
                        </Tag>
                      </div>
                    )}

                    {/* Section & SubType Badge */}
                    <div style={{ marginBottom: 12 }}>
                      <Space size={6} wrap>
                        <Tag
                          color={secConf.color}
                          style={{
                            borderRadius: 4,
                            fontWeight: 600,
                            padding: '1px 8px',
                          }}
                        >
                          {secConf.icon} {item.section}
                        </Tag>
                        <Tag color={subColor} style={{ borderRadius: 4 }}>
                          {item.subType}
                        </Tag>
                        {item.priority === 'High' && (
                          <Tag color="error" style={{ borderRadius: 4 }}>
                            URGENT
                          </Tag>
                        )}
                      </Space>
                    </div>

                    {/* Title */}
                    <Title
                      level={4}
                      style={{
                        margin: '0 0 10px 0',
                        fontSize: 16,
                        color: '#002244',
                        fontWeight: 600,
                        lineHeight: 1.35,
                      }}
                      ellipsis={{ rows: 2 }}
                    >
                      {item.title}
                    </Title>

                    {/* Content Preview */}
                    <Paragraph
                      type="secondary"
                      style={{
                        fontSize: 13,
                        lineHeight: 1.55,
                        flex: 1,
                        marginBottom: 16,
                      }}
                      ellipsis={{ rows: 3 }}
                    >
                      {item.summary || item.content}
                    </Paragraph>

                    <Divider style={{ margin: '8px 0 12px 0' }} />

                    {/* Footer: Author, Date, and Like */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Space size={8}>
                        <Avatar
                          size={24}
                          icon={<UserOutlined />}
                          style={{ backgroundColor: '#002244' }}
                        />
                        <div>
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: '#262626',
                              display: 'block',
                              maxWidth: 120,
                            }}
                            ellipsis
                          >
                            {item.authorName || 'TecMotiv Team'}
                          </Text>
                          <Text
                            type="secondary"
                            style={{ fontSize: 11, display: 'block' }}
                          >
                            {dayjs(item.date).fromNow()}
                          </Text>
                        </div>
                      </Space>

                      {/* Like Button */}
                      <Button
                        type={isLiked ? 'primary' : 'default'}
                        shape="round"
                        size="small"
                        icon={<LikeOutlined />}
                        onClick={(e) => handleLike(item._id, e)}
                        style={{
                          backgroundColor: isLiked ? '#eb2f96' : undefined,
                          borderColor: isLiked ? '#eb2f96' : undefined,
                          fontSize: 12,
                        }}
                      >
                        {item.likes || 0}
                      </Button>
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Card>

      {/* Reader Drawer (Detail View) */}
      <Drawer
        title={
          selectedItem ? (
            <Space align="center" size={10}>
              <Avatar
                style={{ backgroundColor: SECTION_CONFIG[selectedItem.section]?.color || '#002244' }}
                icon={SECTION_CONFIG[selectedItem.section]?.icon || <NotificationOutlined />}
              />
              <div>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#002244' }}>
                  {selectedItem.section}
                </span>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                  {selectedItem.subType}
                </div>
              </div>
            </Space>
          ) : (
            'Bulletin Details'
          )
        }
        placement="right"
        width={620}
        onClose={() => setDetailVisible(false)}
        open={detailVisible}
        extra={
          selectedItem && (
            <Button
              type="primary"
              shape="round"
              icon={<LikeOutlined />}
              onClick={() => handleLike(selectedItem._id)}
              style={{ backgroundColor: '#eb2f96', borderColor: '#eb2f96' }}
            >
              {selectedItem.likes || 0} Applauds
            </Button>
          )
        }
      >
        {selectedItem && (
          <div>
            {/* Meta Tags */}
            <div style={{ marginBottom: 16 }}>
              <Space wrap size={[6, 6]}>
                <Tag color={SECTION_CONFIG[selectedItem.section]?.color || 'blue'}>
                  {selectedItem.section}
                </Tag>
                <Tag color="cyan">{selectedItem.subType}</Tag>
                <Tag color={selectedItem.priority === 'High' ? 'error' : 'default'}>
                  Priority: {selectedItem.priority}
                </Tag>
                <Tag color="purple">Audience: {selectedItem.department || 'All Company'}</Tag>
              </Space>
            </div>

            {/* Post Title */}
            <Title level={3} style={{ color: '#001f3f', marginTop: 0, marginBottom: 14 }}>
              {selectedItem.title}
            </Title>

            {/* Author bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#f9fbfd',
                borderRadius: 8,
                border: '1px solid #eaedf1',
                marginBottom: 20,
              }}
            >
              <Avatar size={40} icon={<UserOutlined />} style={{ backgroundColor: '#002244', marginRight: 12 }} />
              <div style={{ flex: 1 }}>
                <Text style={{ fontWeight: 600, color: '#002244', display: 'block' }}>
                  {selectedItem.authorName || 'Corporate Communications'}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Published {dayjs(selectedItem.date).format('MMMM D, YYYY [at] h:mm A')} ({dayjs(selectedItem.date).fromNow()})
                </Text>
              </div>
            </div>

            {/* Full Content */}
            <div
              style={{
                fontSize: 15,
                lineHeight: 1.8,
                color: '#262626',
                whiteSpace: 'pre-wrap',
                background: '#fff',
                padding: '8px 0',
              }}
            >
              {selectedItem.content}
            </div>

            {/* Tags */}
            {selectedItem.tags && selectedItem.tags.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <Divider style={{ margin: '16px 0' }} />
                <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
                  Tags:
                </Text>
                {selectedItem.tags.map((tag) => (
                  <Tag key={tag} style={{ borderRadius: 12 }}>
                    #{tag}
                  </Tag>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Create Bulletin Post Modal */}
      <Modal
        title={
          <Space>
            <NotificationOutlined style={{ color: '#002244' }} />
            <span>Publish Corporate Bulletin Post</span>
          </Space>
        }
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={680}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateSubmit}
          initialValues={{
            section: activeTab !== 'ALL' ? activeTab : 'COMPANY NEWS',
            subType: 'New employee',
            priority: 'Normal',
            department: 'All',
            pinned: false,
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="section"
                label="Bulletin Section"
                rules={[{ required: true, message: 'Please select a section' }]}
              >
                <Select
                  onChange={(sec) => {
                    const availableSubs = SECTION_CONFIG[sec]?.subTypes || [];
                    if (availableSubs.length > 0) {
                      form.setFieldsValue({ subType: availableSubs[0] });
                    }
                  }}
                >
                  <Option value="COMPANY NEWS">COMPANY NEWS</Option>
                  <Option value="ANNOUNCEMENTS">ANNOUNCEMENTS</Option>
                  <Option value="EVENTS">EVENTS</Option>
                  <Option value="RECOGNITION">RECOGNITION</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                noStyle
                shouldUpdate={(prev, curr) => prev.section !== curr.section}
              >
                {({ getFieldValue }) => {
                  const sec = getFieldValue('section') || 'COMPANY NEWS';
                  const availableSubs = SECTION_CONFIG[sec]?.subTypes || [];
                  return (
                    <Form.Item
                      name="subType"
                      label="Category / Sub-Type"
                      rules={[{ required: true, message: 'Please select a sub-type' }]}
                    >
                      <Select>
                        {availableSubs.map((st) => (
                          <Option key={st} value={st}>
                            {st}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="title"
            label="Post Title"
            rules={[{ required: true, message: 'Title is required' }]}
          >
            <Input placeholder="e.g. Welcome Jane Doe to the Engineering Team!" orientation="horizontal" orientationPosition="left" />
          </Form.Item>

          <Form.Item
            name="summary"
            label="Brief Summary (Optional)"
          >
            <Input placeholder="One-line summary for preview cards" />
          </Form.Item>

          <Form.Item
            name="content"
            label="Full Content / Body"
            rules={[{ required: true, message: 'Content is required' }]}
          >
            <TextArea rows={6} placeholder="Write the full communication details..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="priority" label="Priority">
                <Select>
                  <Option value="Low">Low</Option>
                  <Option value="Normal">Normal</Option>
                  <Option value="High">High (Urgent)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="department" label="Target Department">
                <Select>
                  <Option value="All">All Company</Option>
                  <Option value="Engineering">Engineering</Option>
                  <Option value="Operations">Operations</Option>
                  <Option value="HR">HR</Option>
                  <Option value="Finance">Finance</Option>
                  <Option value="Sales">Sales</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tags" label="Tags (comma-separated)">
                <Input placeholder="milestone, hr, q3" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => setCreateModalVisible(false)}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                style={{ backgroundColor: '#002244', borderColor: '#002244' }}
              >
                Publish Now
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

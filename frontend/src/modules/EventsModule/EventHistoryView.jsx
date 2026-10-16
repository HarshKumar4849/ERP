import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Tag,
  Typography,
  Space,
  Button,
  Image,
  Empty,
  Spin,
  Divider,
  Statistic,
} from 'antd';
import {
  TrophyOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

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

export default function EventHistoryView({ onSelectEvent, refreshKey = 0 }) {
  const [historyEvents, setHistoryEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await request.get({ entity: 'event/history' });
      if (res && res.result) {
        setHistoryEvents(res.result);
      } else {
        setHistoryEvents([]);
      }
    } catch (e) {
      console.error('Error fetching event history:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [refreshKey]);

  const totalAttendees = historyEvents.reduce(
    (acc, ev) => acc + (ev.eventReport?.attendanceCount || ev.participants?.length || 0),
    0
  );
  const totalPhotos = historyEvents.reduce((acc, ev) => acc + (ev.photos?.length || 0), 0);

  return (
    <div>
      {/* Top Overview Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #52c41a' }}>
            <Statistic
              title="Archived Completed Events"
              value={historyEvents.length}
              prefix={<TrophyOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #1890ff' }}>
            <Statistic
              title="Total Attendance Recorded"
              value={totalAttendees}
              prefix={<TeamOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 10, borderLeft: '4px solid #fa8c16' }}>
            <Statistic
              title="Photo Memories Preserved"
              value={totalPhotos}
              prefix={<PictureOutlined style={{ color: '#fa8c16' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* History Items List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="Loading past event archives..." />
        </div>
      ) : historyEvents.length === 0 ? (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: '40px 0' }}>
          <Empty description="No completed events archived yet. As upcoming events conclude and submit reports, their history will appear here." />
        </Card>
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {historyEvents.map((ev) => {
            const themeColor = TYPE_COLORS[ev.eventType] || '#1890ff';
            const report = ev.eventReport;
            const photos = ev.photos || [];
            const videos = ev.videos || [];

            return (
              <Card
                key={ev._id}
                hoverable
                style={{
                  borderRadius: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  border: '1px solid #e8e8e8',
                }}
              >
                <Row gutter={[20, 20]} align="top">
                  {/* Left Column: Poster / Photo Banner */}
                  <Col xs={24} md={7}>
                    {ev.poster ? (
                      <div style={{ borderRadius: 8, overflow: 'hidden', maxHeight: 180, border: '1px solid #f0f0f0' }}>
                        <img
                          src={ev.poster}
                          alt={ev.title}
                          style={{ width: '100%', height: 180, objectFit: 'cover' }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          height: 180,
                          borderRadius: 8,
                          background: `linear-gradient(135deg, ${themeColor}20, #00224410)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'column',
                          color: themeColor,
                        }}
                      >
                        <TrophyOutlined style={{ fontSize: 36, marginBottom: 8 }} />
                        <Text strong style={{ color: themeColor }}>{ev.eventType}</Text>
                      </div>
                    )}
                  </Col>

                  {/* Middle Column: Details & Report Highlights */}
                  <Col xs={24} md={17}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <Space>
                          <Tag color={themeColor} style={{ fontWeight: 600 }}>{ev.eventType}</Tag>
                          <Tag color="green" icon={<CheckCircleOutlined />}>Completed</Tag>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            <CalendarOutlined style={{ marginRight: 4 }} />
                            {ev.startDate ? dayjs(ev.startDate).format('MMMM D, YYYY') : 'Past Event'}
                          </Text>
                        </Space>
                        <Title level={4} style={{ margin: '8px 0 4px', color: '#002244' }}>
                          {ev.title || ev.eventName}
                        </Title>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          Hosted by {ev.organizerName} • Venue: {ev.venue || ev.location}
                        </Text>
                      </div>

                      <Button
                        type="primary"
                        ghost
                        icon={<EyeOutlined />}
                        onClick={() => onSelectEvent(ev)}
                      >
                        View Full Details
                      </Button>
                    </div>

                    <Divider style={{ margin: '12px 0' }} />

                    {/* Report Summary */}
                    {report ? (
                      <div style={{ background: '#fafafa', padding: 12, borderRadius: 8, border: '1px solid #f0f0f0', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                          <Tag color="green" icon={<TeamOutlined />} style={{ fontWeight: 600 }}>
                            {report.attendanceCount} Attendees
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Reported by {report.submittedBy || 'HR Committee'} on{' '}
                            {report.submittedAt ? dayjs(report.submittedAt).format('MMM D, YYYY') : ''}
                          </Text>
                        </div>
                        <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: 13, color: '#434343' }}>
                          {report.summary}
                        </Paragraph>
                        {report.outcomes && (
                          <div style={{ marginTop: 6, fontSize: 12, color: '#389e0d' }}>
                            <strong>Key Outcome:</strong> {report.outcomes}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Paragraph ellipsis={{ rows: 2 }} style={{ color: '#595959', fontSize: 13, marginBottom: 12 }}>
                        {ev.description || 'Completed event archive without executive report notes.'}
                      </Paragraph>
                    )}

                    {/* Media Previews (Photos & Videos) */}
                    {(photos.length > 0 || videos.length > 0) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {photos.slice(0, 4).map((p, pIdx) => (
                          <Image
                            key={pIdx}
                            width={54}
                            height={54}
                            src={p.url}
                            style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid #d9d9d9' }}
                          />
                        ))}
                        {photos.length > 4 && (
                          <Tag style={{ padding: '6px 10px', borderRadius: 6 }}>+{photos.length - 4} more photos</Tag>
                        )}
                        {videos.length > 0 && (
                          <Tag color="red" icon={<PlayCircleOutlined />} style={{ padding: '4px 8px', borderRadius: 6 }}>
                            {videos.length} Video Highlights
                          </Tag>
                        )}
                      </div>
                    )}
                  </Col>
                </Row>
              </Card>
            );
          })}
        </Space>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import {
  Drawer,
  Typography,
  Tag,
  Space,
  Button,
  Descriptions,
  Avatar,
  Divider,
  Row,
  Col,
  Card,
  Image,
  Badge,
  Empty,
  Tooltip,
} from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  VideoCameraOutlined,
  TeamOutlined,
  MailOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  EditOutlined,
  SendOutlined,
  UserOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

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

export default function EventDetailsDrawer({
  visible,
  onClose,
  event,
  onEdit,
  onOpenInvitation,
  onOpenMedia,
  onOpenReport,
}) {
  if (!event) return null;

  const eventType = event.eventType || 'Company Event';
  const themeColor = TYPE_COLORS[eventType] || '#1890ff';

  const participants = event.participants || [];
  const photos = event.photos || [];
  const videos = event.videos || [];
  const report = event.eventReport;
  const invitation = event.invitation;

  const dateStr = event.startDate
    ? dayjs(event.startDate).format('dddd, MMMM D, YYYY')
    : dayjs(event.date).format('dddd, MMMM D, YYYY');

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <Tag color={themeColor} style={{ fontSize: 13, padding: '2px 10px', borderRadius: 4, fontWeight: 600 }}>
              {eventType}
            </Tag>
            <Badge
              status={event.status === 'Completed' ? 'success' : event.status === 'In Progress' ? 'processing' : 'default'}
              text={<span style={{ fontWeight: 600 }}>{event.status || 'Scheduled'}</span>}
            />
          </Space>
        </div>
      }
      open={visible}
      onClose={onClose}
      width={720}
      extra={
        <Space>
          <Button icon={<EditOutlined />} onClick={() => onEdit(event)}>
            Edit
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            style={{ background: '#002244', borderColor: '#002244' }}
            onClick={() => onOpenInvitation(event)}
          >
            Invitations
          </Button>
        </Space>
      }
    >
      {/* Poster Banner */}
      {event.poster ? (
        <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 20, maxHeight: 260, border: '1px solid #f0f0f0' }}>
          <img
            src={event.poster}
            alt={event.title}
            style={{ width: '100%', height: '100%', maxHeight: 260, objectFit: 'cover' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
      ) : (
        <div
          style={{
            background: `linear-gradient(135deg, ${themeColor}15, #00224415)`,
            borderRadius: 12,
            padding: '24px 20px',
            marginBottom: 20,
            border: `1px dashed ${themeColor}40`,
          }}
        >
          <Text style={{ fontSize: 13, color: '#8c8c8c' }}>TecMotiv Official Event</Text>
          <Title level={3} style={{ margin: '4px 0 0', color: '#002244' }}>
            {event.title || event.eventName}
          </Title>
        </div>
      )}

      {/* Main Title if poster was shown */}
      {event.poster && (
        <Title level={3} style={{ margin: '0 0 16px', color: '#002244' }}>
          {event.title || event.eventName}
        </Title>
      )}

      {/* Key Details Cards Grid */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col span={12}>
          <Card size="small" style={{ borderRadius: 8, background: '#fafafa', border: '1px solid #f0f0f0' }}>
            <Space align="start">
              <CalendarOutlined style={{ fontSize: 18, color: themeColor, marginTop: 4 }} />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>WHEN</Text>
                <div style={{ fontWeight: 600, color: '#262626' }}>{dateStr}</div>
                <div style={{ fontSize: 13, color: '#595959' }}>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {event.time || event.startTime || '10:00 AM'}
                  {event.endTime ? ` – ${event.endTime}` : ''}
                </div>
              </div>
            </Space>
          </Card>
        </Col>

        <Col span={12}>
          <Card size="small" style={{ borderRadius: 8, background: '#fafafa', border: '1px solid #f0f0f0' }}>
            <Space align="start">
              <EnvironmentOutlined style={{ fontSize: 18, color: '#fa541c', marginTop: 4 }} />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>VENUE</Text>
                <div style={{ fontWeight: 600, color: '#262626' }}>
                  {event.venue || event.location || 'TecMotiv Auditorium'}
                </div>
                {event.isVirtual && (
                  <Tag color="cyan" style={{ marginTop: 4 }}>
                    <GlobalOutlined /> Virtual Stream
                  </Tag>
                )}
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Virtual Meeting Join Link */}
      {event.isVirtual && event.meetingLink && (
        <Card
          size="small"
          style={{
            background: '#e6f7ff',
            border: '1px solid #91d5ff',
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <VideoCameraOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <div>
                <div style={{ fontWeight: 600, color: '#002244' }}>Virtual Meeting Room</div>
                <Text type="secondary" style={{ fontSize: 12 }}>Click to join live interactive session</Text>
              </div>
            </Space>
            <Button
              type="primary"
              size="middle"
              href={event.meetingLink}
              target="_blank"
              style={{ borderRadius: 6 }}
            >
              Join Online
            </Button>
          </div>
        </Card>
      )}

      {/* Description / Agenda */}
      {event.description && (
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ fontSize: 14 }}>Event Agenda & Highlights</Text>
          <Paragraph style={{ marginTop: 6, color: '#595959', fontSize: 14, lineHeight: 1.6 }}>
            {event.description}
          </Paragraph>
        </div>
      )}

      {/* Host & Department */}
      <Descriptions size="small" column={2} bordered style={{ marginBottom: 20 }}>
        <Descriptions.Item label="Organizer">
          <Text strong>{event.organizerName || 'TecMotiv Events Team'}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Department">
          <Tag color="blue">{event.department || 'All Departments'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Reminder Notice">
          {event.reminderDaysBefore || 7} days prior
        </Descriptions.Item>
        <Descriptions.Item label="Created On">
          {event.created ? dayjs(event.created).format('YYYY-MM-DD') : 'N/A'}
        </Descriptions.Item>
      </Descriptions>

      {/* Invitations Status */}
      <Card
        size="small"
        style={{
          borderRadius: 8,
          marginBottom: 20,
          border: '1px solid #e8e8e8',
          background: invitation?.sent ? '#f6ffed' : '#fffbe6',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MailOutlined style={{ color: invitation?.sent ? '#52c41a' : '#faad14' }} />
              <Text strong style={{ color: invitation?.sent ? '#237804' : '#d48806' }}>
                {invitation?.sent ? 'Invitations Dispatched' : 'Invitation Notice (Pending)'}
              </Text>
            </div>
            <div style={{ fontSize: 13, color: '#595959', marginTop: 4 }}>
              {invitation?.sent
                ? `Sent on ${dayjs(invitation.sentAt).format('MMM D, YYYY h:mm A')} to ${invitation.recipientCount || participants.length} participants by ${invitation.sentBy || 'Organizer'}`
                : 'Invitations have not been sent out yet.'}
            </div>
          </div>
          <Button size="small" onClick={() => onOpenInvitation(event)}>
            {invitation?.sent ? 'Resend / Update' : 'Dispatch Now'}
          </Button>
        </div>
      </Card>

      {/* Participants */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Space>
            <TeamOutlined style={{ color: '#1890ff' }} />
            <Text strong style={{ fontSize: 14 }}>
              Participants & Attendees ({participants.length})
            </Text>
          </Space>
        </div>

        {participants.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No participants specified yet" />
        ) : (
          <div
            style={{
              maxHeight: 180,
              overflowY: 'auto',
              border: '1px solid #f0f0f0',
              borderRadius: 8,
              padding: 10,
              background: '#fafafa',
            }}
          >
            <Row gutter={[10, 10]}>
              {participants.map((p, idx) => {
                const emp = p.employee || p;
                const empName = emp.name ? `${emp.name} ${emp.surname || ''}` : p.name || 'Team Colleague';
                const empDept = emp.departmentName || 'Employee';

                return (
                  <Col span={12} key={idx}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#fff',
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid #e8e8e8',
                      }}
                    >
                      <Avatar
                        size="small"
                        src={emp.photo}
                        icon={<UserOutlined />}
                        style={{ background: '#002244' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {empName}
                        </div>
                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>{empDept}</div>
                      </div>
                      <Tag color={p.status === 'Accepted' || p.status === 'Attended' ? 'green' : 'default'} style={{ fontSize: 10, marginRight: 0 }}>
                        {p.status || 'Invited'}
                      </Tag>
                    </div>
                  </Col>
                );
              })}
            </Row>
          </div>
        )}
      </div>

      {/* Media & Attachments (Poster, Photos, Videos) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Space>
            <PictureOutlined style={{ color: '#fa8c16' }} />
            <Text strong style={{ fontSize: 14 }}>
              Media Gallery & Video Memories ({photos.length} photos, {videos.length} videos)
            </Text>
          </Space>
          <Button size="small" icon={<PictureOutlined />} onClick={() => onOpenMedia(event)}>
            Manage Media
          </Button>
        </div>

        {photos.length === 0 && videos.length === 0 ? (
          <Card size="small" style={{ textAlign: 'center', borderRadius: 8, border: '1px dashed #d9d9d9', padding: '12px 0' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>No photos or video memories attached yet.</Text>
            <div style={{ marginTop: 8 }}>
              <Button size="small" type="link" onClick={() => onOpenMedia(event)}>
                Upload Photos / Add Video Links
              </Button>
            </div>
          </Card>
        ) : (
          <div>
            {photos.length > 0 && (
              <Image.PreviewGroup>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  {photos.map((ph, idx) => (
                    <div key={idx} style={{ textAlign: 'center' }}>
                      <Image
                        width={90}
                        height={90}
                        src={ph.url}
                        style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #e8e8e8' }}
                      />
                      {ph.caption && (
                        <div style={{ fontSize: 10, color: '#8c8c8c', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ph.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Image.PreviewGroup>
            )}

            {videos.length > 0 && (
              <Space direction="vertical" style={{ width: '100%' }}>
                {videos.map((vid, idx) => (
                  <Card key={idx} size="small" style={{ borderRadius: 6, background: '#fafafa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space orientation="horizontal">
                        <PlayCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
                        <Text strong style={{ fontSize: 13 }}>{vid.title || `Video Highlight #${idx + 1}`}</Text>
                      </Space>
                      <Button size="small" type="primary" ghost href={vid.url} target="_blank">
                        Watch Video
                      </Button>
                    </div>
                  </Card>
                ))}
              </Space>
            )}
          </div>
        )}
      </div>

      {/* Post-Event Report */}
      <Divider style={{ margin: '16px 0' }} />
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Space>
            <FileTextOutlined style={{ color: '#52c41a' }} />
            <Text strong style={{ fontSize: 14 }}>
              Post-Event Report & Executive Summary
            </Text>
          </Space>
          <Button
            size="small"
            type={report ? 'default' : 'primary'}
            style={!report ? { background: '#52c41a', borderColor: '#52c41a' } : {}}
            onClick={() => onOpenReport(event)}
          >
            {report ? 'Update Report' : 'Submit Report'}
          </Button>
        </div>

        {report ? (
          <Card
            size="small"
            style={{
              borderRadius: 8,
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
            }}
          >
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="Actual Attendance">
                <Tag color="green" style={{ fontWeight: 600 }}>{report.attendanceCount} Attendees</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Reported By">
                {report.submittedBy || 'TecMotiv HR'}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 10 }}>
              <Text strong style={{ fontSize: 12, color: '#389e0d' }}>EXECUTIVE SUMMARY</Text>
              <Paragraph style={{ margin: '4px 0 10px', fontSize: 13, color: '#262626' }}>
                {report.summary}
              </Paragraph>

              {report.highlights && (
                <>
                  <Text strong style={{ fontSize: 12, color: '#389e0d' }}>KEY HIGHLIGHTS</Text>
                  <Paragraph style={{ margin: '4px 0 10px', fontSize: 13, color: '#262626' }}>
                    {report.highlights}
                  </Paragraph>
                </>
              )}

              {report.outcomes && (
                <>
                  <Text strong style={{ fontSize: 12, color: '#389e0d' }}>BUSINESS & CULTURAL OUTCOMES</Text>
                  <Paragraph style={{ margin: '4px 0 0', fontSize: 13, color: '#262626' }}>
                    {report.outcomes}
                  </Paragraph>
                </>
              )}
            </div>
          </Card>
        ) : (
          <Card size="small" style={{ borderRadius: 8, textAlign: 'center', background: '#fafafa', border: '1px dashed #d9d9d9' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              No event report submitted yet. Complete the event and record attendance outcomes.
            </Text>
          </Card>
        )}
      </div>
    </Drawer>
  );
}

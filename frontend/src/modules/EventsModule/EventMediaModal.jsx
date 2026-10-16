import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Tabs,
  Space,
  Card,
  Image,
  Typography,
  message,
  Popconfirm,
  Row,
  Col,
} from 'antd';
import {
  PictureOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { request } from '@/request';

const { Text } = Typography;

export default function EventMediaModal({ visible, onClose, event, onSuccess }) {
  const [activeTab, setActiveTab] = useState('photos');
  const [loading, setLoading] = useState(false);

  // Local state for media arrays
  const [posterUrl, setPosterUrl] = useState('');
  const [photosList, setPhotosList] = useState([]);
  const [videosList, setVideosList] = useState([]);

  // Form for adding single new photo or video
  const [photoForm] = Form.useForm();
  const [videoForm] = Form.useForm();

  useEffect(() => {
    if (visible && event) {
      setPosterUrl(event.poster || '');
      setPhotosList(Array.isArray(event.photos) ? [...event.photos] : []);
      setVideosList(Array.isArray(event.videos) ? [...event.videos] : []);
      photoForm.resetFields();
      videoForm.resetFields();
    }
  }, [visible, event, photoForm, videoForm]);

  const handleAddPhoto = async () => {
    try {
      const values = await photoForm.validateFields();
      setPhotosList([
        ...photosList,
        {
          url: values.url.trim(),
          caption: values.caption ? values.caption.trim() : '',
          uploadedAt: new Date(),
        },
      ]);
      photoForm.resetFields();
    } catch (e) {}
  };

  const handleRemovePhoto = (index) => {
    setPhotosList(photosList.filter((_, i) => i !== index));
  };

  const handleAddVideo = async () => {
    try {
      const values = await videoForm.validateFields();
      setVideosList([
        ...videosList,
        {
          url: values.url.trim(),
          title: values.title ? values.title.trim() : 'Event Video Highlights',
          platform: 'YouTube',
        },
      ]);
      videoForm.resetFields();
    } catch (e) {}
  };

  const handleRemoveVideo = (index) => {
    setVideosList(videosList.filter((_, i) => i !== index));
  };

  const handleSaveAll = async () => {
    try {
      setLoading(true);
      const response = await request.patch({
        entity: `event/update/${event._id}`,
        jsonData: {
          poster: posterUrl.trim(),
          photos: photosList,
          videos: videosList,
        },
      });

      if (response && response.success) {
        message.success('Media attachments updated successfully!');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        message.error(response?.message || 'Failed to save attachments');
      }
    } catch (err) {
      message.error(err.message || 'Error updating media');
    } finally {
      setLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'photos',
      label: (
        <span>
          <PictureOutlined style={{ marginRight: 6 }} /> Photo Memories ({photosList.length})
        </span>
      ),
      children: (
        <div>
          {/* Add photo card */}
          <Card size="small" style={{ marginBottom: 16, background: '#fafafa', borderRadius: 8 }}>
            <Form form={photoForm} layout="inline" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Form.Item
                name="url"
                rules={[{ required: true, message: 'Enter image URL' }]}
                style={{ flex: 2, margin: 0 }}
              >
                <Input placeholder="https://images.unsplash.com/... (Image URL)" />
              </Form.Item>
              <Form.Item name="caption" style={{ flex: 1, margin: 0 }}>
                <Input placeholder="Caption (e.g. Cake cutting ceremony)" />
              </Form.Item>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPhoto}>
                Add Photo
              </Button>
            </Form>
          </Card>

          {/* Photo Gallery Grid */}
          {photosList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#8c8c8c' }}>
              No photos added to this celebration yet. Add some moments!
            </div>
          ) : (
            <Row gutter={[12, 12]}>
              {photosList.map((ph, idx) => (
                <Col span={8} key={idx}>
                  <Card
                    size="small"
                    cover={
                      <Image
                        height={130}
                        src={ph.url}
                        style={{ objectFit: 'cover' }}
                        fallback="https://via.placeholder.com/150?text=Image+Unavailable"
                      />
                    }
                    actions={[
                      <Popconfirm title="Remove this photo?" onConfirm={() => handleRemovePhoto(idx)}>
                        <Button type="text" danger icon={<DeleteOutlined />} size="small">
                          Remove
                        </Button>
                      </Popconfirm>,
                    ]}
                  >
                    <Card.Meta description={ph.caption || 'No caption'} />
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </div>
      ),
    },
    {
      key: 'videos',
      label: (
        <span>
          <PlayCircleOutlined style={{ marginRight: 6 }} /> Video Highlights ({videosList.length})
        </span>
      ),
      children: (
        <div>
          {/* Add video card */}
          <Card size="small" style={{ marginBottom: 16, background: '#fafafa', borderRadius: 8 }}>
            <Form form={videoForm} layout="inline" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Form.Item
                name="url"
                rules={[{ required: true, message: 'Enter video URL' }]}
                style={{ flex: 2, margin: 0 }}
              >
                <Input prefix={<LinkOutlined />} placeholder="https://youtube.com/watch?v=... (Video Link)" />
              </Form.Item>
              <Form.Item name="title" style={{ flex: 1, margin: 0 }}>
                <Input placeholder="Video Title (e.g. Keynote Highlights)" />
              </Form.Item>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddVideo}>
                Add Video
              </Button>
            </Form>
          </Card>

          {/* Video List */}
          {videosList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#8c8c8c' }}>
              No videos added yet. Link YouTube, Vimeo, or internal streams!
            </div>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              {videosList.map((vid, idx) => (
                <Card key={idx} size="small" style={{ borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <PlayCircleOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />
                      <div>
                        <div style={{ fontWeight: 600 }}>{vid.title}</div>
                        <a href={vid.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                          {vid.url}
                        </a>
                      </div>
                    </Space>
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveVideo(idx)}>
                      Remove
                    </Button>
                  </div>
                </Card>
              ))}
            </Space>
          )}
        </div>
      ),
    },
    {
      key: 'poster',
      label: (
        <span>
          <PictureOutlined style={{ marginRight: 6 }} /> Event Poster
        </span>
      ),
      children: (
        <div>
          <Text style={{ fontSize: 13, color: '#595959' }}>
            Set or update the primary banner poster for this event:
          </Text>
          <div style={{ margin: '12px 0' }}>
            <Input
              value={posterUrl}
              onChange={(e) => setPosterUrl(e.target.value)}
              placeholder="https://images.unsplash.com/... (Poster image URL)"
            />
          </div>
          {posterUrl && (
            <div style={{ borderRadius: 8, overflow: 'hidden', maxHeight: 220, border: '1px solid #f0f0f0' }}>
              <img
                src={posterUrl}
                alt="Poster preview"
                style={{ width: '100%', maxHeight: 220, objectFit: 'cover' }}
              />
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, color: '#002244' }}>
          <PictureOutlined style={{ color: '#fa8c16' }} />
          <span>Manage Attachments & Memories: {event?.title}</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={720}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={loading}
          onClick={handleSaveAll}
          style={{ background: '#002244', borderColor: '#002244', fontWeight: 600 }}
        >
          Save All Attachments
        </Button>,
      ]}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </Modal>
  );
}

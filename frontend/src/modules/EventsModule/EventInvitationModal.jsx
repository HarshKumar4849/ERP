import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Typography, Alert, message, Tag } from 'antd';
import { SendOutlined, MailOutlined, TeamOutlined } from '@ant-design/icons';
import { request } from '@/request';

const { TextArea } = Input;
const { Text } = Typography;

export default function EventInvitationModal({ visible, onClose, event, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && event) {
      form.setFieldsValue({
        subject: event.invitation?.subject || `Official Invitation: ${event.title || event.eventName}`,
        message:
          event.invitation?.message ||
          `Dear Colleague,\n\nYou are cordially invited to attend the "${event.title || event.eventName}" organized by ${event.organizerName || 'TecMotiv People & Culture'}.\n\nDate: ${event.startDate ? new Date(event.startDate).toDateString() : ''}\nTime: ${event.time || event.startTime || '10:00 AM'}\nVenue: ${event.venue || event.location || 'TecMotiv Corporate Auditorium'}\n\nWe look forward to your participation!\n\nWarm regards,\nTecMotiv Team`,
      });
    }
  }, [visible, event, form]);

  const handleSend = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await request.post({
        entity: `event/invite/${event._id}`,
        jsonData: {
          subject: values.subject.trim(),
          message: values.message.trim(),
        },
      });

      if (response && response.success) {
        message.success(response.message || 'Invitations dispatched successfully!');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        message.error(response?.message || 'Failed to dispatch invitations');
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Error sending invitations');
    } finally {
      setLoading(false);
    }
  };

  const participantCount = event?.participants?.length || event?.attendees?.length || 0;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, color: '#002244' }}>
          <MailOutlined style={{ color: '#1890ff' }} />
          <span>Dispatch Event Invitations</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<SendOutlined />}
          loading={loading}
          onClick={handleSend}
          style={{ background: '#002244', borderColor: '#002244', fontWeight: 600 }}
        >
          Send Invitations Now
        </Button>,
      ]}
    >
      <Alert
        message={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              Target Audience: <Text strong>{event?.title}</Text>
            </span>
            <Tag color="blue" icon={<TeamOutlined />}>
              {participantCount} Selected Participants
            </Tag>
          </div>
        }
        description="Invitations will be dispatched to each participant's notifications and registered email."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical">
        <Form.Item
          name="subject"
          label="Email & Notification Subject"
          rules={[{ required: true, message: 'Please provide subject line' }]}
        >
          <Input placeholder="Invitation subject" />
        </Form.Item>

        <Form.Item
          name="message"
          label="Personalized Invitation Letter / Message"
          rules={[{ required: true, message: 'Please provide invitation message' }]}
        >
          <TextArea rows={7} placeholder="Write invitation message..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}

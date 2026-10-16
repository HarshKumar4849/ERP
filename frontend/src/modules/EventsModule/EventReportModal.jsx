import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Button, Typography, Alert, message } from 'antd';
import { FileTextOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { request } from '@/request';

const { TextArea } = Input;
const { Text } = Typography;

export default function EventReportModal({ visible, onClose, event, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && event) {
      const existing = event.eventReport || {};
      form.setFieldsValue({
        summary: existing.summary || '',
        attendanceCount: existing.attendanceCount !== undefined ? existing.attendanceCount : (event.participants?.length || 0),
        highlights: existing.highlights || '',
        outcomes: existing.outcomes || '',
      });
    }
  }, [visible, event, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await request.post({
        entity: `event/report/${event._id}`,
        jsonData: {
          summary: values.summary.trim(),
          attendanceCount: Number(values.attendanceCount) || 0,
          highlights: values.highlights ? values.highlights.trim() : '',
          outcomes: values.outcomes ? values.outcomes.trim() : '',
        },
      });

      if (response && response.success) {
        message.success('Event report submitted successfully! Event status updated to Completed.');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        message.error(response?.message || 'Failed to submit report');
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Error submitting event report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, color: '#002244' }}>
          <FileTextOutlined style={{ color: '#52c41a' }} />
          <span>Submit Post-Event Report: {event?.title}</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={640}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={loading}
          onClick={handleSubmit}
          style={{ background: '#52c41a', borderColor: '#52c41a', fontWeight: 600 }}
        >
          Submit Report & Mark Completed
        </Button>,
      ]}
    >
      <Alert
        message="Finalizing Event Outcomes"
        description="Submitting this report records official executive summaries, actual attendance counts, and automatically moves the event to Event History."
        type="success"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical">
        <Form.Item
          name="attendanceCount"
          label="Actual Total Attendees Count"
          rules={[{ required: true, message: 'Please provide attendance count' }]}
        >
          <InputNumber min={0} max={10000} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="summary"
          label="Executive Summary of the Event"
          rules={[{ required: true, message: 'Please provide an event summary' }]}
        >
          <TextArea rows={3} placeholder="Provide an overview of how the celebration or event unfolded..." />
        </Form.Item>

        <Form.Item name="highlights" label="Key Highlights & Memorable Moments">
          <TextArea rows={2} placeholder="Awards distributed, keynote speaker reception, team activities, etc." />
        </Form.Item>

        <Form.Item name="outcomes" label="Concrete Outcomes, Feedback & Action Items">
          <TextArea rows={2} placeholder="Employee feedback received, cross-team collaboration results, future improvements..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}

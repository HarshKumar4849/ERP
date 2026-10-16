import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Row,
  Col,
  Switch,
  InputNumber,
  message,
} from 'antd';
import {
  CalendarOutlined,
  VideoCameraOutlined,
  EnvironmentOutlined,
  BellOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { TextArea } = Input;

export default function EventFormModal({
  visible,
  onClose,
  onSuccess,
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isVirtual, setIsVirtual] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [empRes, deptRes] = await Promise.all([
          request.list({ entity: 'employee', options: { items: 100 } }),
          request.list({ entity: 'department', options: { items: 50 } }),
        ]);
        if (empRes?.result) setEmployees(empRes.result);
        if (deptRes?.result) setDepartments(deptRes.result);
      } catch (e) {}
    };

    if (visible) {
      fetchOptions();
      form.resetFields();
      form.setFieldsValue({
        eventType: 'Meeting',
        department: 'All',
        startDate: dayjs().add(1, 'day').set('hour', 10).set('minute', 0),
        endDate: dayjs().add(1, 'day').set('hour', 11).set('minute', 0),
        reminderDaysBefore: 7, // Default reminder: 7 days before
        location: 'Headquarters / Main Conference Room',
      });
      setIsVirtual(false);
    }
  }, [visible, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        title: values.title.trim(),
        description: values.description ? values.description.trim() : '',
        eventType: values.eventType,
        startDate: values.startDate.toISOString(),
        endDate: values.endDate ? values.endDate.toISOString() : undefined,
        location: values.location,
        department: values.department,
        isVirtual: Boolean(values.isVirtual),
        meetingLink: values.meetingLink || '',
        reminderDaysBefore: values.reminderDaysBefore !== undefined ? values.reminderDaysBefore : 7,
        attendees: values.attendees || [],
      };

      const response = await request.post({
        entity: 'calendar/event',
        jsonData: payload,
      });

      if (response && response.success) {
        message.success('Calendar event created successfully!');
        form.resetFields();
        onClose();
        if (onSuccess) onSuccess();
      } else {
        message.error(response?.message || 'Failed to create event');
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Error submitting event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <span>
          <CalendarOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          Create Calendar Event / Meeting
        </span>
      }
      open={visible}
      onCancel={onClose}
      width={640}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          Schedule Event
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item
          name="title"
          label="Event / Meeting Title"
          rules={[{ required: true, message: 'Please enter event title' }]}
        >
          <Input placeholder="e.g. Q4 Executive Operations Review" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="eventType" label="Event Category">
              <Select
                options={[
                  { value: 'Meeting', label: '🤝 Meeting' },
                  { value: 'Event', label: '🎪 Company Event' },
                  { value: 'Company Activity', label: '🎯 Company Activity' },
                  { value: 'Client Visit', label: '🚗 Client Visit' },
                  { value: 'Project Milestone', label: '🚀 Project Milestone' },
                  { value: 'Deadline', label: '📌 Deadline' },
                  { value: 'Webinar', label: '💻 Webinar' },
                  { value: 'Holiday', label: '🏖️ Official Holiday' },
                ]}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="department" label="Target Department">
              <Select
                options={[
                  { value: 'All', label: 'All Departments (Company-wide)' },
                  ...departments.map((d) => ({ value: d.name, label: d.name })),
                  { value: 'Engineering', label: 'Engineering' },
                  { value: 'Human Resources', label: 'Human Resources' },
                  { value: 'Marketing', label: 'Marketing' },
                  { value: 'Finance', label: 'Finance' },
                  { value: 'Operations', label: 'Operations' },
                  { value: 'Administration', label: 'Administration' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="startDate"
              label="Start Date & Time"
              rules={[{ required: true, message: 'Start date is required' }]}
            >
              <DatePicker
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="endDate" label="End Date & Time">
              <DatePicker
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={14}>
            <Form.Item name="location" label="Location / Venue">
              <Input
                prefix={<EnvironmentOutlined style={{ color: '#8c8c8c' }} />}
                placeholder="e.g. Boardroom A / Remote"
              />
            </Form.Item>
          </Col>

          <Col span={10}>
            <Form.Item
              name="reminderDaysBefore"
              label="Reminder Notice (Days)"
              tooltip="Default reminder trigger is 7 days prior"
            >
              <InputNumber min={0} max={30} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="isVirtual" label="Virtual Meeting (Zoom / Teams / Meet)" valuePropName="checked">
          <Switch
            checked={isVirtual}
            onChange={(checked) => {
              setIsVirtual(checked);
              form.setFieldsValue({ isVirtual: checked });
            }}
          />
        </Form.Item>

        {isVirtual && (
          <Form.Item name="meetingLink" label="Video Conference URL">
            <Input
              prefix={<VideoCameraOutlined style={{ color: '#1677ff' }} />}
              placeholder="https://zoom.us/j/... or https://meet.google.com/..."
            />
          </Form.Item>
        )}

        <Form.Item name="attendees" label="Invited Attendees (Optional)">
          <Select
            mode="multiple"
            showSearch
            allowClear
            placeholder="Select colleagues..."
            optionFilterProp="children"
            options={employees.map((e) => ({
              value: e._id,
              label: `${e.name} ${e.surname || ''} (${e.departmentName || 'Employee'})`,
            }))}
          />
        </Form.Item>

        <Form.Item name="description" label="Agenda / Notes">
          <TextArea rows={3} placeholder="Meeting objectives, topics, or instructions..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}

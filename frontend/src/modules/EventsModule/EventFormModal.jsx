import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  TimePicker,
  Button,
  Row,
  Col,
  Switch,
  InputNumber,
  message,
  Divider,
} from 'antd';
import {
  CalendarOutlined,
  EnvironmentOutlined,
  VideoCameraOutlined,
  PictureOutlined,
  TeamOutlined,
  MailOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { TextArea } = Input;

export const EVENT_TYPES = [
  { value: 'Birthday', label: '🎂 Birthday', color: '#eb2f96' },
  { value: 'Anniversary', label: '🏆 Anniversary / Milestone', color: '#fa8c16' },
  { value: 'Recognition', label: '⭐ Recognition & Awards', color: '#faad14' },
  { value: 'Festival', label: '🪔 Festival Celebration', color: '#722ed1' },
  { value: 'Company Event', label: '🎪 Company Event / Town Hall', color: '#1890ff' },
  { value: 'Webinar', label: '💻 Webinar / Virtual Summit', color: '#13c2c2' },
  { value: 'Client Event', label: '🤝 Client Event / Showcase', color: '#52c41a' },
  { value: 'Training', label: '📚 Training & Workshop', color: '#2f54eb' },
  { value: 'CSR Activity', label: '🌱 CSR Activity / Giving Back', color: '#389e0d' },
];

export default function EventFormModal({
  visible,
  onClose,
  onSuccess,
  eventData = null, // If provided, edit mode
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isVirtual, setIsVirtual] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  const isEditMode = Boolean(eventData && eventData._id);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [empRes, deptRes] = await Promise.all([
          request.list({ entity: 'employee', options: { items: 100 } }),
          request.list({ entity: 'department', options: { items: 50 } }),
        ]);
        if (empRes?.result) setEmployees(empRes.result);
        if (deptRes?.result) setDepartments(deptRes.result);
      } catch (e) {
        console.error('Error fetching options:', e);
      }
    };

    if (visible) {
      fetchOptions();
      form.resetFields();

      if (eventData) {
        const start = eventData.startDate ? dayjs(eventData.startDate) : dayjs();
        const end = eventData.endDate ? dayjs(eventData.endDate) : start.add(2, 'hour');

        // Extract participant IDs
        let initialParticipants = [];
        if (Array.isArray(eventData.participants)) {
          initialParticipants = eventData.participants.map((p) => p.employee?._id || p.employee || p);
        } else if (Array.isArray(eventData.attendees)) {
          initialParticipants = eventData.attendees.map((a) => a._id || a);
        }

        form.setFieldsValue({
          title: eventData.title || eventData.eventName || '',
          eventType: eventData.eventType || 'Company Event',
          date: start,
          startTime: eventData.startTime ? dayjs(eventData.startTime, 'hh:mm A') : start,
          endTime: eventData.endTime ? dayjs(eventData.endTime, 'hh:mm A') : end,
          venue: eventData.venue || eventData.location || '',
          department: eventData.department || 'All',
          organizerName: eventData.organizerName || 'TecMotiv Events Team',
          isVirtual: Boolean(eventData.isVirtual),
          meetingLink: eventData.meetingLink || '',
          poster: eventData.poster || '',
          participants: initialParticipants,
          description: eventData.description || '',
          reminderDaysBefore: eventData.reminderDaysBefore !== undefined ? eventData.reminderDaysBefore : 7,
          status: eventData.status || 'Scheduled',
          invitationSubject: eventData.invitation?.subject || '',
          invitationMessage: eventData.invitation?.message || '',
        });
        setIsVirtual(Boolean(eventData.isVirtual));
      } else {
        const defaultDate = dayjs().add(2, 'day');
        form.setFieldsValue({
          title: '',
          eventType: 'Company Event',
          date: defaultDate,
          startTime: dayjs().set('hour', 10).set('minute', 0),
          endTime: dayjs().set('hour', 12).set('minute', 0),
          venue: 'TecMotiv Corporate Auditorium',
          department: 'All',
          organizerName: 'TecMotiv People & Culture Committee',
          isVirtual: false,
          meetingLink: '',
          poster: '',
          participants: [],
          reminderDaysBefore: 7,
          status: 'Scheduled',
          invitationSubject: '',
          invitationMessage: '',
        });
        setIsVirtual(false);
      }
    }
  }, [visible, eventData, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const dateObj = values.date ? values.date : dayjs();
      let startTimeStr = '10:00 AM';
      let endTimeStr = '12:00 PM';

      if (values.startTime && dayjs.isDayjs(values.startTime)) {
        startTimeStr = values.startTime.format('hh:mm A');
      }
      if (values.endTime && dayjs.isDayjs(values.endTime)) {
        endTimeStr = values.endTime.format('hh:mm A');
      }

      // Compute precise start and end Date objects
      const startHour = values.startTime ? values.startTime.hour() : 10;
      const startMinute = values.startTime ? values.startTime.minute() : 0;
      const endHour = values.endTime ? values.endTime.hour() : 12;
      const endMinute = values.endTime ? values.endTime.minute() : 0;

      const startDate = dateObj.clone().set('hour', startHour).set('minute', startMinute).toISOString();
      const endDate = dateObj.clone().set('hour', endHour).set('minute', endMinute).toISOString();

      const payload = {
        title: values.title.trim(),
        eventName: values.title.trim(),
        eventType: values.eventType,
        date: startDate,
        startDate: startDate,
        endDate: endDate,
        time: startTimeStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        venue: values.venue || 'TecMotiv Corporate Auditorium',
        location: values.venue || 'TecMotiv Corporate Auditorium',
        department: values.department || 'All',
        organizerName: values.organizerName || 'TecMotiv Events Team',
        isVirtual: Boolean(values.isVirtual),
        meetingLink: values.meetingLink || '',
        poster: values.poster || '',
        description: values.description ? values.description.trim() : '',
        participants: values.participants || [],
        reminderDaysBefore: values.reminderDaysBefore !== undefined ? values.reminderDaysBefore : 7,
      };

      if (values.invitationSubject || values.invitationMessage) {
        payload.invitation = {
          subject: values.invitationSubject || `Invitation: ${values.title.trim()}`,
          message: values.invitationMessage || '',
          sent: false,
        };
      }

      if (values.status) {
        payload.status = values.status;
      }

      let response;
      if (isEditMode) {
        response = await request.patch({
          entity: `event/update/${eventData._id}`,
          jsonData: payload,
        });
      } else {
        response = await request.post({
          entity: 'event/create',
          jsonData: payload,
        });
      }

      if (response && response.success) {
        message.success(isEditMode ? 'Event updated successfully!' : 'Event created successfully!');
        form.resetFields();
        onClose();
        if (onSuccess) onSuccess();
      } else {
        message.error(response?.message || 'Operation failed');
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Error saving event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, color: '#002244' }}>
          {isEditMode ? <EditOutlined style={{ color: '#1890ff' }} /> : <PlusOutlined style={{ color: '#52c41a' }} />}
          <span>{isEditMode ? 'Edit Event & Celebration' : 'Schedule New Event & Celebration'}</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={780}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleSubmit}
          style={{ background: '#002244', borderColor: '#002244', fontWeight: 600 }}
        >
          {isEditMode ? 'Save Changes' : 'Create & Schedule Event'}
        </Button>,
      ]}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        {/* Event Name & Type */}
        <Row gutter={16}>
          <Col span={14}>
            <Form.Item
              name="title"
              label="Event Name"
              rules={[{ required: true, message: 'Please enter the event name' }]}
            >
              <Input placeholder="e.g. Annual Star Excellence Awards 2026" />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item
              name="eventType"
              label="Event Type"
              rules={[{ required: true, message: 'Select an event type' }]}
            >
              <Select options={EVENT_TYPES} placeholder="Select event category" />
            </Form.Item>
          </Col>
        </Row>

        {/* Date & Times */}
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="date"
              label="Event Date"
              rules={[{ required: true, message: 'Select event date' }]}
            >
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="startTime" label="Start Time">
              <TimePicker format="hh:mm A" use12Hours style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="endTime" label="End Time">
              <TimePicker format="hh:mm A" use12Hours style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        {/* Venue / Location & Virtual Switch */}
        <Row gutter={16}>
          <Col span={16}>
            <Form.Item name="venue" label="Venue / Physical Location">
              <Input
                prefix={<EnvironmentOutlined style={{ color: '#8c8c8c' }} />}
                placeholder="e.g. TecMotiv Grand Auditorium or Banquet Hall"
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="isVirtual" label="Online / Hybrid Stream" valuePropName="checked">
              <Switch
                checked={isVirtual}
                onChange={(checked) => {
                  setIsVirtual(checked);
                  form.setFieldsValue({ isVirtual: checked });
                }}
              />
            </Form.Item>
          </Col>
        </Row>

        {isVirtual && (
          <Form.Item
            name="meetingLink"
            label="Online Video Conference / Stream Link"
            rules={[{ required: isVirtual, message: 'Provide meeting link' }]}
          >
            <Input
              prefix={<VideoCameraOutlined style={{ color: '#1890ff' }} />}
              placeholder="https://meet.google.com/... or https://zoom.us/..."
            />
          </Form.Item>
        )}

        {/* Organizer & Department */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="organizerName" label="Organizer / Host Committee">
              <Input placeholder="e.g. TecMotiv People & Culture Board" />
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
                  { value: 'Consulting', label: 'Consulting' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Participants Selector */}
        <Form.Item
          name="participants"
          label={
            <span>
              <TeamOutlined style={{ marginRight: 6, color: '#1890ff' }} />
              Participants / Invited Colleagues ({employees.length} available)
            </span>
          }
        >
          <Select
            mode="multiple"
            showSearch
            allowClear
            placeholder="Select employees to invite or track attendance..."
            optionFilterProp="label"
            maxTagCount="responsive"
            options={employees.map((e) => ({
              value: e._id,
              label: `${e.name} ${e.surname || ''} (${e.departmentName || 'Employee'})`,
            }))}
          />
        </Form.Item>

        {/* Poster Image URL */}
        <Form.Item
          name="poster"
          label={
            <span>
              <PictureOutlined style={{ marginRight: 6, color: '#fa8c16' }} />
              Event Poster / Cover Banner Image (URL)
            </span>
          }
        >
          <Input placeholder="https://images.unsplash.com/... or uploaded image URL" />
        </Form.Item>

        {/* Description / Agenda */}
        <Form.Item name="description" label="Event Agenda / Details / Special Instructions">
          <TextArea rows={3} placeholder="Event highlights, dress code, catering schedule, or instructions..." />
        </Form.Item>

        <Divider style={{ margin: '12px 0' }}>
          <span style={{ fontSize: 13, color: '#8c8c8c' }}>
            <MailOutlined style={{ marginRight: 6 }} /> Invitation Setup (Optional)
          </span>
        </Divider>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="invitationSubject" label="Invitation Subject Line">
              <Input placeholder="e.g. Official Invitation: TecMotiv Festival Gala" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="reminderDaysBefore" label="Automated Reminder (Days Prior)">
              <InputNumber min={0} max={30} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="invitationMessage" label="Personalized Invitation Message">
          <TextArea rows={2} placeholder="We warmly invite you to celebrate with us. Refreshments and dinner will be served." />
        </Form.Item>
      </Form>
    </Modal>
  );
}

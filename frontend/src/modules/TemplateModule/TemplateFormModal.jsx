import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Row,
  Col,
  Space,
  Tag,
  Divider,
  message,
} from 'antd';
import {
  FileTextOutlined,
  PlusOutlined,
  EditOutlined,
  TagOutlined,
} from '@ant-design/icons';
import { request } from '@/request';

const { TextArea } = Input;

export const TEMPLATE_CATEGORIES = {
  'HR Templates': [
    'Joining Letter',
    'Appointment Letter',
    'NDA',
    'Internship Letter',
    'Experience Letter',
    'Relieving Letter',
    'Salary Slip',
    'Leave Approval',
    'Warning/Notice',
    'Performance Review',
  ],
  Communication: [
    'Birthday Wishes',
    'Anniversary Wishes',
    'Welcome Message',
    'New Employee Announcement',
    'Employee Recognition',
    'Promotion Announcement',
    'Festival Greeting',
    'Event Invitation',
    'Event Thank-you',
  ],
  'Marketing/Event': [
    'LinkedIn Announcement',
    'Email Invitation',
    'Event Reminder',
    'Speaker Announcement',
    'Partner Announcement',
    'Event Follow-up',
  ],
};

export const COMMON_VARIABLES = [
  { tag: '{{employeeName}}', label: 'Employee Name' },
  { tag: '{{employeeId}}', label: 'Employee ID' },
  { tag: '{{department}}', label: 'Department' },
  { tag: '{{designation}}', label: 'Designation' },
  { tag: '{{joiningDate}}', label: 'Joining Date' },
  { tag: '{{effectiveDate}}', label: 'Effective Date' },
  { tag: '{{salary}}', label: 'Salary / Package' },
  { tag: '{{companyName}}', label: 'Company Name' },
  { tag: '{{managerName}}', label: 'Manager Name' },
  { tag: '{{eventName}}', label: 'Event Name' },
  { tag: '{{eventDate}}', label: 'Event Date' },
  { tag: '{{venue}}', label: 'Venue' },
  { tag: '{{currentDate}}', label: 'Current Date' },
];

export default function TemplateFormModal({
  visible,
  onClose,
  templateData = null,
  onSuccess,
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('HR Templates');

  const isEditMode = Boolean(templateData && templateData._id);

  useEffect(() => {
    if (visible) {
      form.resetFields();
      if (templateData) {
        setSelectedCategory(templateData.category || 'HR Templates');
        form.setFieldsValue({
          title: templateData.title,
          category: templateData.category || 'HR Templates',
          type: templateData.type || '',
          description: templateData.description || '',
          subject: templateData.subject || '',
          content: templateData.content || '',
        });
      } else {
        setSelectedCategory('HR Templates');
        form.setFieldsValue({
          title: '',
          category: 'HR Templates',
          type: 'Joining Letter',
          description: '',
          subject: '',
          content: '',
        });
      }
    }
  }, [visible, templateData, form]);

  const insertVariable = (variableTag) => {
    const currentContent = form.getFieldValue('content') || '';
    form.setFieldsValue({
      content: currentContent + ' ' + variableTag + ' ',
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        title: values.title.trim(),
        category: values.category,
        type: values.type,
        description: (values.description || '').trim(),
        subject: (values.subject || '').trim(),
        content: values.content.trim(),
      };

      let res;
      if (isEditMode) {
        res = await request.patch({
          entity: `template/update/${templateData._id}`,
          jsonData: payload,
        });
      } else {
        res = await request.post({
          entity: 'template/create',
          jsonData: payload,
        });
      }

      if (res && res.success) {
        message.success(isEditMode ? 'Template updated successfully!' : 'Template created successfully!');
        form.resetFields();
        onClose();
        if (onSuccess) onSuccess();
      } else {
        message.error(res?.message || 'Operation failed');
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Error saving template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, color: '#002244' }}>
          {isEditMode ? <EditOutlined style={{ color: '#1890ff' }} /> : <PlusOutlined style={{ color: '#52c41a' }} />}
          <span>{isEditMode ? 'Edit Template' : 'Create New Document / Message Template'}</span>
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
          {isEditMode ? 'Save Changes' : 'Create Template'}
        </Button>,
      ]}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        <Row gutter={16}>
          <Col span={14}>
            <Form.Item
              name="title"
              label="Template Name"
              rules={[{ required: true, message: 'Please provide template name' }]}
            >
              <Input placeholder="e.g. Standard Appointment Letter" />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item
              name="category"
              label="Category"
              rules={[{ required: true, message: 'Select template category' }]}
            >
              <Select
                options={[
                  { value: 'HR Templates', label: 'HR Templates' },
                  { value: 'Communication', label: 'Communication' },
                  { value: 'Marketing/Event', label: 'Marketing/Event' },
                ]}
                onChange={(cat) => {
                  setSelectedCategory(cat);
                  const firstType = TEMPLATE_CATEGORIES[cat]?.[0] || '';
                  form.setFieldsValue({ type: firstType });
                }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="type"
              label="Template Type"
              rules={[{ required: true, message: 'Select specific type' }]}
            >
              <Select
                options={(TEMPLATE_CATEGORIES[selectedCategory] || []).map((t) => ({
                  value: t,
                  label: t,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="subject" label="Default Subject Line (Optional)">
              <Input placeholder="e.g. Welcome to TecMotiv — Joining Letter" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="description" label="Short Description / Purpose">
          <Input placeholder="Brief explanation of when to issue this document or message" />
        </Form.Item>

        {/* Dynamic Variable Insertion Pills */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#595959', marginBottom: 6 }}>
            <TagOutlined style={{ marginRight: 6, color: '#1890ff' }} />
            Click to Insert Dynamic Placeholder Variables:
          </div>
          <Space wrap size={[6, 6]}>
            {COMMON_VARIABLES.map((v) => (
              <Tag
                key={v.tag}
                color="blue"
                style={{ cursor: 'pointer', padding: '2px 8px', borderRadius: 4 }}
                onClick={() => insertVariable(v.tag)}
              >
                + {v.tag}
              </Tag>
            ))}
          </Space>
        </div>

        <Form.Item
          name="content"
          label="Template Body / Document Content"
          rules={[{ required: true, message: 'Please provide template content' }]}
        >
          <TextArea
            rows={10}
            placeholder="Type your template text here. Use {{variableName}} anywhere inside the text..."
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

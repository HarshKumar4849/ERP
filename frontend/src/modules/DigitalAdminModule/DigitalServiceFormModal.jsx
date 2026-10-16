import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Button,
  Row,
  Col,
  Alert,
  Space,
  Tag,
  message,
} from 'antd';
import {
  CloudOutlined,
  MailOutlined,
  LockOutlined,
  DollarOutlined,
  CreditCardOutlined,
  CalendarOutlined,
  LinkOutlined,
  UserOutlined,
  PlusOutlined,
  EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { TextArea } = Input;

export const SERVICE_TYPES = [
  { value: 'Microsoft 365', label: 'Microsoft 365 (Office, Teams, Exchange)', color: '#0078d4' },
  { value: 'Email Accounts', label: 'Email Accounts (Google Workspace, MX)', color: '#ea4335' },
  { value: 'Domain', label: 'Domain (GoDaddy, Namecheap, Route53)', color: '#13c2c2' },
  { value: 'Hostinger', label: 'Hostinger (Web/VPS Hosting)', color: '#673ab7' },
  { value: 'AWS', label: 'AWS (Amazon Web Services)', color: '#ff9900' },
  { value: 'Claude', label: 'Claude (Anthropic AI Enterprise)', color: '#d97706' },
  { value: 'Google Cloud', label: 'Google Cloud Platform (GCP)', color: '#4285f4' },
  { value: 'Canva', label: 'Canva (Design & Brand Assets)', color: '#00c4cc' },
  { value: 'CRM', label: 'CRM (HubSpot, Salesforce, Pipedrive)', color: '#ff7a45' },
  { value: 'Other SaaS', label: 'Other SaaS Subscription', color: '#722ed1' },
];

export const PAYMENT_METHODS = [
  'Corporate Credit Card',
  'Bank Wire / NEFT',
  'Auto-Debit / Standing Instruction',
  'PayPal',
  'UPI / Net Banking',
  'Corporate Debit Card',
  'Vendor Invoice / PO',
  'Other',
];

export default function DigitalServiceFormModal({
  visible,
  onClose,
  serviceData = null,
  onSuccess,
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedServiceType, setSelectedServiceType] = useState('Microsoft 365');

  const isEditMode = Boolean(serviceData && serviceData._id);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await request.list({ entity: 'employee', options: { items: 100 } });
        if (res?.result) setEmployees(res.result);
      } catch (e) {
        console.error('Error fetching employees:', e);
      }
    };

    if (visible) {
      fetchEmployees();
      form.resetFields();

      if (serviceData) {
        setSelectedServiceType(serviceData.serviceType || 'Microsoft 365');
        form.setFieldsValue({
          serviceName: serviceData.serviceName,
          serviceType: serviceData.serviceType || 'Microsoft 365',
          customServiceName: serviceData.customServiceName || '',
          accountOwner: serviceData.accountOwner?._id || serviceData.accountOwner || undefined,
          accountOwnerName: serviceData.accountOwnerName || '',
          loginEmail: serviceData.loginEmail,
          renewalDate: serviceData.renewalDate ? dayjs(serviceData.renewalDate) : dayjs().add(1, 'year'),
          billingCycle: serviceData.billingCycle || 'Yearly',
          cost: serviceData.cost !== undefined ? serviceData.cost : 0,
          currency: serviceData.currency || 'INR',
          paymentMethod: serviceData.paymentMethod || 'Corporate Credit Card',
          paymentMethodDetails: serviceData.paymentMethodDetails || '',
          status: serviceData.status || 'Active',
          reminderDaysBefore: serviceData.reminderDaysBefore !== undefined ? serviceData.reminderDaysBefore : 15,
          serviceUrl: serviceData.serviceUrl || '',
          notes: serviceData.notes || '',
        });
      } else {
        setSelectedServiceType('Microsoft 365');
        form.setFieldsValue({
          serviceName: '',
          serviceType: 'Microsoft 365',
          customServiceName: '',
          accountOwner: undefined,
          accountOwnerName: 'IT Operations Lead',
          loginEmail: 'admin@tecmotiv.com',
          renewalDate: dayjs().add(1, 'year'),
          billingCycle: 'Yearly',
          cost: 50000,
          currency: 'INR',
          paymentMethod: 'Corporate Credit Card',
          paymentMethodDetails: '',
          status: 'Active',
          reminderDaysBefore: 15,
          serviceUrl: '',
          notes: '',
        });
      }
    }
  }, [visible, serviceData, form]);

  const handleOwnerChange = (empId) => {
    const emp = employees.find((e) => e._id === empId);
    if (emp) {
      form.setFieldsValue({
        accountOwnerName: `${emp.name} ${emp.surname || ''}`.trim(),
      });
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        serviceName: values.serviceName.trim(),
        serviceType: values.serviceType,
        customServiceName: (values.customServiceName || '').trim(),
        accountOwner: values.accountOwner,
        accountOwnerName: (values.accountOwnerName || 'IT Operations Lead').trim(),
        loginEmail: values.loginEmail.trim().toLowerCase(),
        renewalDate: values.renewalDate.toISOString(),
        billingCycle: values.billingCycle,
        cost: Number(values.cost) || 0,
        currency: values.currency,
        paymentMethod: values.paymentMethod,
        paymentMethodDetails: (values.paymentMethodDetails || '').trim(),
        status: values.status,
        reminderDaysBefore: Number(values.reminderDaysBefore) || 15,
        serviceUrl: (values.serviceUrl || '').trim(),
        notes: (values.notes || '').trim(),
      };

      let res;
      if (isEditMode) {
        res = await request.patch({
          entity: `digitalservice/update/${serviceData._id}`,
          jsonData: payload,
        });
      } else {
        res = await request.post({
          entity: 'digitalservice/create',
          jsonData: payload,
        });
      }

      if (res && res.success) {
        message.success(isEditMode ? 'Digital Service updated successfully!' : 'Digital Service registered successfully!');
        form.resetFields();
        onClose();
        if (onSuccess) onSuccess();
      } else {
        message.error(res?.message || 'Operation failed');
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Error saving digital service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, color: '#002244' }}>
          {isEditMode ? <EditOutlined style={{ color: '#1890ff' }} /> : <PlusOutlined style={{ color: '#52c41a' }} />}
          <span>{isEditMode ? 'Edit Digital Service Record' : 'Register New IT / Digital Service'}</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={760}
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
          {isEditMode ? 'Save Changes' : 'Register Service'}
        </Button>,
      ]}
      destroyOnClose
    >
      {/* Strict Security Alert */}
      <Alert
        message="Strict Security Governance Rule"
        description="NEVER store passwords, API secrets, or credentials in the ERP. Only store the administrative login reference, account owner, cost, and renewal schedule."
        type="warning"
        showIcon
        icon={<LockOutlined />}
        style={{ marginBottom: 18 }}
      />

      <Form form={form} layout="vertical" requiredMark="optional">
        {/* Service Type & Service Name */}
        <Row gutter={16}>
          <Col span={10}>
            <Form.Item
              name="serviceType"
              label="Service Category"
              rules={[{ required: true, message: 'Please select a service type' }]}
            >
              <Select
                options={SERVICE_TYPES}
                onChange={(val) => {
                  setSelectedServiceType(val);
                  if (val !== 'Other SaaS' && !form.getFieldValue('serviceName')) {
                    form.setFieldsValue({ serviceName: val });
                  }
                }}
              />
            </Form.Item>
          </Col>
          <Col span={14}>
            <Form.Item
              name="serviceName"
              label="Service / Subscription Name"
              rules={[{ required: true, message: 'Please enter service name' }]}
            >
              <Input placeholder="e.g. Microsoft 365 Business Premium, AWS Prod Infra" />
            </Form.Item>
          </Col>
        </Row>

        {selectedServiceType === 'Other SaaS' && (
          <Form.Item
            name="customServiceName"
            label="Specific SaaS Brand / Provider"
            rules={[{ required: true, message: 'Specify SaaS Provider name' }]}
          >
            <Input placeholder="e.g. Figma, Datadog, Slack, Notion" />
          </Form.Item>
        )}

        {/* Account Owner & Login Email */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="accountOwner" label="Internal Account Owner (Employee)">
              <Select
                showSearch
                allowClear
                placeholder="Select responsible colleague..."
                optionFilterProp="label"
                onChange={handleOwnerChange}
                options={employees.map((e) => ({
                  value: e._id,
                  label: `${e.name} ${e.surname || ''} (${e.departmentName || 'Employee'})`,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="loginEmail"
              label="Administrative Login Email"
              rules={[
                { required: true, message: 'Login email is required' },
                { type: 'email', message: 'Enter a valid email address' },
              ]}
            >
              <Input
                prefix={<MailOutlined style={{ color: '#8c8c8c' }} />}
                placeholder="e.g. admin@tecmotiv.com"
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Renewal Date, Billing Cycle & Status */}
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="renewalDate"
              label="Next Renewal Date"
              rules={[{ required: true, message: 'Select renewal date' }]}
            >
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="billingCycle" label="Billing Frequency">
              <Select
                options={[
                  { value: 'Monthly', label: 'Monthly' },
                  { value: 'Quarterly', label: 'Quarterly' },
                  { value: 'Half-Yearly', label: 'Half-Yearly (6 Mo)' },
                  { value: 'Yearly', label: 'Yearly (Annual)' },
                  { value: 'Multi-Year', label: 'Multi-Year' },
                  { value: 'One-Time', label: 'One-Time Perpetual' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="status" label="Current Status">
              <Select
                options={[
                  { value: 'Active', label: '🟢 Active' },
                  { value: 'Expiring Soon', label: '🟡 Expiring Soon' },
                  { value: 'Expired', label: '🔴 Expired' },
                  { value: 'Cancelled', label: '⚪ Cancelled' },
                  { value: 'Under Review', label: '🔵 Under Review' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Cost, Currency & Payment Method */}
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="cost"
              label="Subscription Cost"
              rules={[{ required: true, message: 'Provide subscription cost' }]}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="currency" label="Currency">
              <Select
                options={[
                  { value: 'INR', label: '₹ INR' },
                  { value: 'USD', label: '$ USD' },
                  { value: 'EUR', label: '€ EUR' },
                  { value: 'GBP', label: '£ GBP' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item name="paymentMethod" label="Payment Method">
              <Select
                options={PAYMENT_METHODS.map((m) => ({
                  value: m,
                  label: m,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={14}>
            <Form.Item name="paymentMethodDetails" label="Card / Bank Reference (Optional)">
              <Input
                prefix={<CreditCardOutlined style={{ color: '#8c8c8c' }} />}
                placeholder="e.g. HDFC Corporate Card ending 4092"
              />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item
              name="reminderDaysBefore"
              label="Renewal Alert Trigger (Days)"
              tooltip="How many days before renewal should alerts trigger"
            >
              <InputNumber min={1} max={90} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="serviceUrl" label="Admin Portal / Console Link (URL)">
          <Input
            prefix={<LinkOutlined style={{ color: '#1890ff' }} />}
            placeholder="e.g. https://admin.microsoft.com or https://console.aws.amazon.com"
          />
        </Form.Item>

        <Form.Item name="notes" label="Service Notes, Plan Tier & Seat Counts">
          <TextArea
            rows={3}
            placeholder="e.g. 50 Business Premium seats, includes Exchange Online & Azure AD. Invoice billed to Finance PO-2045."
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

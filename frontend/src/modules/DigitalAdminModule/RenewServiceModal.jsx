import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  DatePicker,
  InputNumber,
  Button,
  Typography,
  Space,
  Tag,
  Alert,
  message,
} from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { Text } = Typography;

export default function RenewServiceModal({ visible, onClose, service, onSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && service) {
      // Calculate suggested next renewal date
      const currentRenewal = service.renewalDate ? dayjs(service.renewalDate) : dayjs();
      const base = currentRenewal.isAfter(dayjs()) ? currentRenewal : dayjs();

      let nextDate = base.add(1, 'year');
      if (service.billingCycle === 'Monthly') {
        nextDate = base.add(1, 'month');
      } else if (service.billingCycle === 'Quarterly') {
        nextDate = base.add(3, 'month');
      } else if (service.billingCycle === 'Half-Yearly') {
        nextDate = base.add(6, 'month');
      } else if (service.billingCycle === 'Multi-Year') {
        nextDate = base.add(2, 'year');
      }

      form.setFieldsValue({
        nextRenewalDate: nextDate,
        cost: service.cost || 0,
      });
    }
  }, [visible, service, form]);

  const handleRenew = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await request.post({
        entity: `digitalservice/renew/${service._id}`,
        jsonData: {
          newRenewalDate: values.nextRenewalDate.toISOString(),
          cost: Number(values.cost) || service.cost,
        },
      });

      if (response && response.success) {
        message.success(response.message || 'Service renewed successfully!');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        message.error(response?.message || 'Failed to renew service');
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Error renewing service');
    } finally {
      setLoading(false);
    }
  };

  if (!service) return null;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, color: '#002244' }}>
          <ReloadOutlined style={{ color: '#52c41a' }} />
          <span>Confirm Service Renewal: {service.serviceName}</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={520}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={loading}
          onClick={handleRenew}
          style={{ background: '#52c41a', borderColor: '#52c41a', fontWeight: 600 }}
        >
          Confirm Renewal
        </Button>,
      ]}
      destroyOnClose
    >
      <Alert
        message={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Billing: <Text strong>{service.billingCycle}</Text></span>
            <Tag color="blue">{service.serviceType}</Tag>
          </div>
        }
        description={`Current renewal date was ${dayjs(service.renewalDate).format('MMMM D, YYYY')}. Renewing will reset status to Active.`}
        type="info"
        showIcon
        style={{ marginBottom: 18 }}
      />

      <Form form={form} layout="vertical">
        <Form.Item
          name="nextRenewalDate"
          label="New Renewal Date"
          rules={[{ required: true, message: 'Please select next renewal date' }]}
        >
          <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
        </Form.Item>

        <Form.Item
          name="cost"
          label={`Renewal Cost Amount (${service.currency || 'INR'})`}
          rules={[{ required: true, message: 'Provide renewal cost' }]}
        >
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

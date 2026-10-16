import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  DatePicker,
  InputNumber,
  Input,
  Button,
  Row,
  Col,
  Alert,
  message,
  Space,
} from 'antd';
import {
  CoffeeOutlined,
  CalendarOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

const LEAVE_TYPES = [
  'Casual Leave',
  'Sick Leave',
  'Earned/Privilege Leave',
  'Compensatory Off',
  'Half Day',
  'Work From Home',
  'Unpaid Leave',
  'Other',
];

export default function LeaveApplicationModal({ open, onCancel, onSuccess, currentAdmin, userRole }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState('Casual Leave');
  const [calculatedDays, setCalculatedDays] = useState(1);
  const [balanceInfo, setBalanceInfo] = useState(null);

  // Fetch current user's balance for immediate quota feedback
  useEffect(() => {
    if (open) {
      const fetchBal = async () => {
        try {
          const res = await request.get({ entity: 'leave/balance' });
          if (res?.success) {
            setBalanceInfo(res.result?.balances || {});
          }
        } catch (err) {
          console.error('Failed to load balance preview', err);
        }
      };
      fetchBal();
    }
  }, [open]);

  const handleDateChange = (dates) => {
    if (dates && dates[0] && dates[1]) {
      const diffDays = dates[1].diff(dates[0], 'day') + 1;
      const days = selectedType === 'Half Day' ? 0.5 : Math.max(1, diffDays);
      setCalculatedDays(days);
      form.setFieldsValue({ daysCount: days });
    }
  };

  const handleTypeChange = (val) => {
    setSelectedType(val);
    if (val === 'Half Day') {
      setCalculatedDays(0.5);
      form.setFieldsValue({ daysCount: 0.5 });
    } else {
      const dates = form.getFieldValue('dateRange');
      if (dates && dates[0] && dates[1]) {
        const diffDays = dates[1].diff(dates[0], 'day') + 1;
        setCalculatedDays(diffDays);
        form.setFieldsValue({ daysCount: diffDays });
      }
    }
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      const dates = values.dateRange;
      const fromDate = dates[0].format('YYYY-MM-DD');
      const toDate = dates[1].format('YYYY-MM-DD');

      const payload = {
        leaveType: values.leaveType,
        fromDate,
        toDate,
        daysCount: values.daysCount || calculatedDays,
        reason: values.reason.trim(),
      };

      const res = await request.post({
        entity: 'leave/apply',
        jsonData: payload,
      });

      if (res?.success) {
        message.success(res.message || 'Leave application submitted successfully!');
        form.resetFields();
        onSuccess();
      } else {
        message.error(res?.message || 'Failed to submit leave application');
      }
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || 'Submission error');
    } finally {
      setSubmitting(false);
    }
  };

  const currentQuota = balanceInfo ? balanceInfo[selectedType] : null;

  return (
    <Modal
      title={
        <Space orientation="horizontal" size={8}>
          <CalendarOutlined style={{ color: '#002244' }} />
          <span>Apply for Leave</span>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
      width={560}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          leaveType: 'Casual Leave',
          dateRange: [dayjs().add(1, 'day'), dayjs().add(1, 'day')],
          daysCount: 1,
        }}
        style={{ marginTop: 16 }}
      >
        {currentQuota && selectedType !== 'Unpaid Leave' && (
          <Alert
            type={currentQuota.remaining > 0 ? 'info' : 'warning'}
            showIcon
            message={
              <span>
                Available <strong>{selectedType}</strong> Balance:{' '}
                <strong>{currentQuota.remaining} days</strong> (Used: {currentQuota.used}d, Pending: {currentQuota.pending}d)
              </span>
            }
            style={{ marginBottom: 16, borderRadius: 8 }}
          />
        )}

        <Form.Item
          name="leaveType"
          label="Leave Type"
          rules={[{ required: true, message: 'Please select leave type' }]}
        >
          <Select onChange={handleTypeChange} size="large">
            {LEAVE_TYPES.map((t) => (
              <Select.Option key={t} value={t}>
                {t}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Row gutter={16}>
          <Col span={16}>
            <Form.Item
              name="dateRange"
              label="Leave Duration (From — To)"
              rules={[{ required: true, message: 'Please select date range' }]}
            >
              <RangePicker
                style={{ width: '100%' }}
                size="large"
                onChange={handleDateChange}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="daysCount"
              label="Number of Days"
              rules={[{ required: true, message: 'Days count is required' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                size="large"
                min={0.5}
                step={0.5}
                value={calculatedDays}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="reason"
          label="Reason for Leave"
          rules={[{ required: true, message: 'Please provide a justification reason' }]}
        >
          <TextArea
            rows={3}
            placeholder="Provide context or details for reporting manager and HR approval..."
            maxLength={300}
            showCount
          />
        </Form.Item>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
            style={{
              backgroundColor: '#002244',
              borderColor: '#002244',
              fontWeight: 600,
              padding: '0 24px',
            }}
          >
            Submit Application
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

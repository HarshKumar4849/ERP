import React, { useState } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  DatePicker,
  InputNumber,
  Button,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  UserOutlined,
  RollbackOutlined,
  ToolOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

// 1. ASSIGN MODAL (Available -> Issued)
export function AssetAssignmentModal({ visible, onClose, asset, employees, onSuccess }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  if (!asset) return null;

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      const res = await request.post({
        entity: `asset/assign/${asset._id}`,
        jsonData: {
          employee: values.employee,
          dateIssued: values.dateIssued ? values.dateIssued.toISOString() : new Date(),
          expectedReturnDate: values.expectedReturnDate ? values.expectedReturnDate.toISOString() : null,
          condition: values.condition || 'Good',
          remarks: values.remarks,
        },
      });
      if (res && res.success) {
        message.success(`Asset issued to employee successfully.`);
        onClose();
        if (onSuccess) onSuccess();
      } else {
        message.error(res?.message || 'Failed to assign asset.');
      }
    } catch (err) {
      message.error('Error assigning asset.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <UserOutlined style={{ color: '#52c41a' }} />
          <span>Assign Asset: {asset.name} ({asset.assetId})</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          dateIssued: dayjs(),
          condition: asset.condition || 'Good',
        }}
      >
        <Form.Item
          name="employee"
          label="Select Employee"
          rules={[{ required: true, message: 'Please select employee' }]}
        >
          <Select
            showSearch
            placeholder="Search employee by name"
            filterOption={(input, option) =>
              (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
            }
          >
            {employees.map((emp) => (
              <Option key={emp._id} value={emp._id}>
                {emp.name} {emp.surname} ({emp.employeeId || 'ID'}) — {emp.departmentName || 'Dept'}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="condition" label="Issuance Condition">
          <Select>
            <Option value="New">New</Option>
            <Option value="Good">Good</Option>
            <Option value="Fair">Fair</Option>
          </Select>
        </Form.Item>

        <Form.Item name="dateIssued" label="Date Issued">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="expectedReturnDate" label="Expected Return Date (Optional)">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="remarks" label="Remarks / Specifications Issued">
          <TextArea rows={3} placeholder="Issued with charger, bag, mouse, etc." />
        </Form.Item>

        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              style={{ backgroundColor: '#002244', borderColor: '#002244' }}
            >
              Confirm Issuance
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
}

// 2. RETURN MODAL (Issued -> Returned)
export function AssetReturnModal({ visible, onClose, asset, onSuccess }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  if (!asset) return null;

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      const res = await request.post({
        entity: `asset/return/${asset._id}`,
        jsonData: {
          returnDate: values.returnDate ? values.returnDate.toISOString() : new Date(),
          condition: values.condition,
          remarks: values.remarks,
        },
      });
      if (res && res.success) {
        message.success('Asset marked as returned.');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        message.error(res?.message || 'Failed to return asset.');
      }
    } catch (err) {
      message.error('Error recording asset return.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <RollbackOutlined style={{ color: '#fa8c16' }} />
          <span>Record Asset Return: {asset.name}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          returnDate: dayjs(),
          condition: asset.condition || 'Good',
        }}
      >
        <div style={{ marginBottom: 16, padding: 10, background: '#fafafa', borderRadius: 6 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Currently Issued to:</Text>
          <div style={{ fontWeight: 600, color: '#002244' }}>{asset.employeeName}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>Issued On: {dayjs(asset.dateIssued).format('DD MMM YYYY')}</div>
        </div>

        <Form.Item name="condition" label="Return Condition" rules={[{ required: true }]}>
          <Select>
            <Option value="New">New</Option>
            <Option value="Good">Good</Option>
            <Option value="Fair">Fair (Minor Wear)</Option>
            <Option value="Damaged">Damaged (Requires Maintenance)</Option>
          </Select>
        </Form.Item>

        <Form.Item name="returnDate" label="Return Date" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="remarks" label="Return Inspection Remarks">
          <TextArea rows={3} placeholder="Inspected physical state, accessories returned, data wiped..." />
        </Form.Item>

        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              style={{ backgroundColor: '#002244', borderColor: '#002244' }}
            >
              Confirm Return
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
}

// 3. MAINTENANCE MODAL (Send or Complete Maintenance)
export function AssetMaintenanceModal({ visible, onClose, asset, isCompleteMode, onSuccess }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  if (!asset) return null;

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      if (isCompleteMode) {
        // Complete Maintenance (Maintenance -> Available)
        const res = await request.post({
          entity: `asset/complete-maintenance/${asset._id}`,
          jsonData: {
            condition: values.condition || 'Good',
            actualCost: values.cost,
            remarks: values.remarks,
          },
        });
        if (res && res.success) {
          message.success('Maintenance completed. Asset is now Available.');
          onClose();
          if (onSuccess) onSuccess();
        } else {
          message.error(res?.message || 'Failed to complete maintenance.');
        }
      } else {
        // Send to Maintenance (Returned/Available -> Maintenance)
        const res = await request.post({
          entity: `asset/maintenance/${asset._id}`,
          jsonData: {
            issue: values.issue,
            vendor: values.vendor,
            cost: values.cost,
            remarks: values.remarks,
          },
        });
        if (res && res.success) {
          message.success('Asset sent to maintenance queue.');
          onClose();
          if (onSuccess) onSuccess();
        } else {
          message.error(res?.message || 'Failed to send to maintenance.');
        }
      }
    } catch (err) {
      message.error('Error during maintenance operation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <ToolOutlined style={{ color: isCompleteMode ? '#52c41a' : '#f5222d' }} />
          <span>
            {isCompleteMode ? 'Complete Asset Maintenance' : 'Send Asset to Maintenance'}
          </span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          condition: 'Good',
          cost: asset.maintenanceCost || 0,
          vendor: asset.maintenanceVendor || 'Authorized Service Hub',
          issue: asset.maintenanceIssue || '',
        }}
      >
        {!isCompleteMode ? (
          <>
            <Form.Item name="issue" label="Fault / Maintenance Issue" rules={[{ required: true }]}>
              <Input placeholder="e.g. Battery replacement, cracked screen, calibration" />
            </Form.Item>
            <Form.Item name="vendor" label="Maintenance Vendor / Service Center" rules={[{ required: true }]}>
              <Input placeholder="e.g. Apple Genius Bar / Local IT AMC Partner" />
            </Form.Item>
            <Form.Item name="cost" label="Estimated Cost (₹)">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="remarks" label="Service Remarks">
              <TextArea rows={3} placeholder="Expected turnaround date, ticket number..." />
            </Form.Item>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 16, padding: 10, background: '#fafafa', borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>Reported Issue: {asset.maintenanceIssue}</div>
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>Service Vendor: {asset.maintenanceVendor}</div>
            </div>
            <Form.Item name="condition" label="Certified Condition After Repair" rules={[{ required: true }]}>
              <Select>
                <Option value="New">Like New</Option>
                <Option value="Good">Good (Fully Operational)</Option>
                <Option value="Fair">Fair</Option>
              </Select>
            </Form.Item>
            <Form.Item name="cost" label="Final Invoice Cost (₹)">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="remarks" label="Completion Notes">
              <TextArea rows={3} placeholder="Parts replaced, QA test passed, ready for reuse." />
            </Form.Item>
          </>
        )}

        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              style={{
                backgroundColor: isCompleteMode ? '#237804' : '#002244',
                borderColor: isCompleteMode ? '#237804' : '#002244',
              }}
            >
              {isCompleteMode ? 'Mark Maintenance Completed' : 'Send to Maintenance'}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
}

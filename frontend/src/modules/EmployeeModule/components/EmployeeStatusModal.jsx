import React, { useEffect } from 'react';
import { Modal, Form, Select, DatePicker, Input, Alert } from 'antd';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

export default function EmployeeStatusModal({
  visible,
  employee,
  onClose,
  onSubmit,
  loading = false,
}) {
  const [form] = Form.useForm();
  const currentStatus = Form.useWatch('status', form);

  useEffect(() => {
    if (visible && employee) {
      form.setFieldsValue({
        status: employee.status || 'Active',
        exitDate: employee.exitDate ? dayjs(employee.exitDate) : null,
        reasonForExit: employee.reasonForExit || '',
      });
    }
  }, [visible, employee, form]);

  const handleFinish = (values) => {
    const payload = {
      status: values.status,
      exitDate: values.exitDate ? values.exitDate.toISOString() : null,
      reasonForExit: values.reasonForExit || '',
    };
    onSubmit(employee._id, payload);
  };

  const isExiting = ['On Notice', 'Terminated', 'Resigned'].includes(currentStatus);

  return (
    <Modal
      title={`Update Status: ${employee?.name || ''} ${employee?.surname || ''} (${employee?.employeeId || ''})`}
      open={visible}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText="Update Status"
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} style={{ marginTop: 16 }}>
        <Form.Item
          name="status"
          label="Employment Status"
          rules={[{ required: true, message: 'Status is required' }]}
        >
          <Select placeholder="Select Status">
            <Option value="Active">Active</Option>
            <Option value="Probation">Probation</Option>
            <Option value="On Leave">On Leave</Option>
            <Option value="On Notice">On Notice</Option>
            <Option value="Resigned">Resigned</Option>
            <Option value="Terminated">Terminated</Option>
          </Select>
        </Form.Item>

        {isExiting && (
          <>
            <Alert
              message="Offboarding / Exit Notice"
              description="Record exit date and separation rationale for HR compliance records."
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form.Item name="exitDate" label="Exit / Relieving Date">
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
            <Form.Item name="reasonForExit" label="Reason for Exit / Notes">
              <TextArea rows={3} placeholder="e.g. Relocating, career opportunity, completion of term..." />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Radio,
  Row,
  Col,
  Divider,
  message,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  UserOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';

const { TextArea } = Input;

export default function TaskFormModal({
  visible,
  onClose,
  initialData,
  onSuccess,
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Dropdown data options
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);

  // Subtasks list in creation mode
  const [subtaskList, setSubtaskList] = useState([]);

  // Load dropdown resources
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [empRes, deptRes, projRes] = await Promise.all([
          request.list({ entity: 'employee', options: { items: 100 } }),
          request.list({ entity: 'department', options: { items: 50 } }),
          request.list({ entity: 'project', options: { items: 50 } }),
        ]);

        if (empRes?.result) setEmployees(empRes.result);
        if (deptRes?.result) setDepartments(deptRes.result);
        if (projRes?.result) setProjects(projRes.result);
      } catch (err) {
        console.error('Failed to load form options:', err);
      }
    };

    if (visible) {
      fetchOptions();
    }
  }, [visible]);

  // Set initial form values when opening
  useEffect(() => {
    if (visible) {
      if (initialData) {
        form.setFieldsValue({
          task: initialData.task || initialData.title,
          description: initialData.description || '',
          owner: initialData.owner?._id || initialData.owner,
          reviewer: initialData.reviewer?._id || initialData.reviewer,
          department: initialData.department,
          project: initialData.project?._id || initialData.project,
          priority: initialData.priority || 'Medium',
          dueDate: initialData.dueDate ? dayjs(initialData.dueDate) : null,
          status: initialData.status || 'Not Started',
        });
        setSubtaskList(initialData.subtasks || []);
      } else {
        form.resetFields();
        form.setFieldsValue({
          priority: 'Medium',
          status: 'Not Started',
          dueDate: dayjs().add(1, 'day'),
        });
        setSubtaskList([]);
      }
    }
  }, [visible, initialData, form]);

  const handleAddSubtaskItem = () => {
    setSubtaskList([...subtaskList, { title: '', completed: false }]);
  };

  const handleSubtaskChange = (index, val) => {
    const updated = [...subtaskList];
    updated[index].title = val;
    setSubtaskList(updated);
  };

  const handleRemoveSubtaskItem = (index) => {
    setSubtaskList(subtaskList.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const payload = {
        task: values.task.trim(),
        title: values.task.trim(),
        description: values.description ? values.description.trim() : '',
        owner: values.owner,
        reviewer: values.reviewer,
        department: values.department,
        project: values.project,
        priority: values.priority,
        dueDate: values.dueDate ? values.dueDate.toISOString() : undefined,
        status: values.status,
      };

      if (!initialData) {
        payload.subtasks = subtaskList
          .filter((s) => s.title && s.title.trim())
          .map((s) => ({ title: s.title.trim(), completed: false }));
      }

      let response;
      if (initialData?._id) {
        response = await request.patch({
          entity: `task/update/${initialData._id}`,
          jsonData: payload,
        });
      } else {
        response = await request.post({
          entity: 'task/create',
          jsonData: payload,
        });
      }

      if (response && response.success) {
        message.success(initialData ? 'Task updated successfully' : 'Task created successfully');
        form.resetFields();
        onClose();
        if (onSuccess) onSuccess(response.result);
      } else {
        message.error(response?.message || 'Operation failed');
      }
    } catch (err) {
      if (err.errorFields) {
        return; // Validation errors handled by form
      }
      message.error(err.message || 'Error submitting task');
    } finally {
      setLoading(false);
    }
  };

  const isEdit = Boolean(initialData?._id);

  return (
    <Modal
      title={isEdit ? 'Edit Task' : 'Create New Task'}
      open={visible}
      onCancel={onClose}
      width={680}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          {isEdit ? 'Save Changes' : 'Create Task'}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item
          name="task"
          label="Task Summary / Title"
          rules={[{ required: true, message: 'Please enter task title' }]}
        >
          <Input placeholder="e.g. Implement OAuth SSO Integration" />
        </Form.Item>

        <Form.Item name="description" label="Description / Deliverable Details">
          <TextArea
            rows={3}
            placeholder="Detailed description, requirements, or acceptance criteria..."
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="owner"
              label="Assignee / Owner"
              rules={[{ required: true, message: 'Please select an assignee' }]}
            >
              <Select
                showSearch
                placeholder="Select employee"
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={employees.map((e) => ({
                  value: e._id,
                  label: `${e.name} ${e.surname || ''} (${e.departmentName || 'No Dept'})`,
                }))}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="reviewer" label="Reviewer / Approver">
              <Select
                showSearch
                allowClear
                placeholder="Select reviewer (Optional)"
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={employees.map((e) => ({
                  value: e._id,
                  label: `${e.name} ${e.surname || ''} (${e.designationName || 'Employee'})`,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="department"
              label="Department"
              rules={[{ required: true, message: 'Please select department' }]}
            >
              <Select
                placeholder="Select department"
                options={[
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

          <Col span={12}>
            <Form.Item name="project" label="Project">
              <Select
                showSearch
                allowClear
                placeholder="Select project (Optional)"
                optionFilterProp="children"
                options={projects.map((p) => ({
                  value: p._id,
                  label: `${p.name} (${p.code || ''})`,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="dueDate"
              label="Due Date"
              rules={[{ required: true, message: 'Please select due date' }]}
            >
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item name="status" label="Status">
              <Select
                options={[
                  { value: 'Not Started', label: 'Not Started' },
                  { value: 'In Progress', label: 'In Progress' },
                  { value: 'Waiting', label: 'Waiting' },
                  { value: 'Completed', label: 'Completed' },
                  { value: 'Overdue', label: 'Overdue' },
                  { value: 'Cancelled', label: 'Cancelled' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="priority" label="Priority">
          <Radio.Group buttonStyle="solid">
            <Radio.Button value="Low">Low</Radio.Button>
            <Radio.Button value="Medium">Medium</Radio.Button>
            <Radio.Button value="High">High</Radio.Button>
            <Radio.Button value="Critical">Critical</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {/* Subtask checklist builder (for new tasks) */}
        {!isEdit && (
          <div>
            <Divider style={{ margin: '14px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Initial Subtasks (Optional)</span>
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddSubtaskItem}
              >
                Add Subtask
              </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {subtaskList.map((st, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8 }}>
                  <Input
                    placeholder={`Subtask #${idx + 1}`}
                    value={st.title}
                    onChange={(e) => handleSubtaskChange(idx, e.target.value)}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveSubtaskItem(idx)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Form>
    </Modal>
  );
}

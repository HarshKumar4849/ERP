import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Avatar,
  Typography,
  Modal,
  Input,
  message,
  Tooltip,
  Badge,
  Tabs,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';
import { ROLES } from '@/utils/rbac';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function LeaveApprovalsQueue({ currentAdmin, userRole, onApprovalDone }) {
  const [loading, setLoading] = useState(false);
  const [pendingList, setPendingList] = useState([]);
  const [activeTab, setActiveTab] = useState(userRole === ROLES.HR ? 'hr' : 'manager');

  useEffect(() => {
    if (userRole === ROLES.HR) {
      setActiveTab('hr');
    }
  }, [userRole]);

  useEffect(() => {
    if (pendingList.length > 0 && userRole === ROLES.HR) {
      const hasHr = pendingList.some((l) => l.status === 'Pending HR Approval');
      if (hasHr) setActiveTab('hr');
    }
  }, [pendingList, userRole]);

  // Action Modals
  const [actionModal, setActionModal] = useState({
    open: false,
    actionType: 'Approve', // 'Approve' or 'Reject'
    stage: 'manager', // 'manager' or 'hr'
    record: null,
  });
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isHrOrMgmt = userRole === ROLES.HR || userRole === ROLES.ADMIN;

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await request.get({ entity: 'leave/approvals-queue' });
      setPendingList(res?.result || []);
    } catch (err) {
      console.error('Failed to load approvals queue', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [userRole]);

  const openAction = (record, actionType, stage) => {
    setActionModal({
      open: true,
      actionType,
      stage,
      record,
    });
    setRemarks('');
  };

  const handleConfirmAction = async () => {
    const { actionType, stage, record } = actionModal;
    if (actionType === 'Reject' && !remarks.trim()) {
      message.error('Please enter a rejection reason before confirming.');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint =
        stage === 'hr'
          ? `leave/hr-approval/${record._id}`
          : `leave/manager-approval/${record._id}`;

      const payload = {
        action: actionType,
        remarks: remarks.trim(),
        rejectionReason: actionType === 'Reject' ? remarks.trim() : undefined,
      };

      const res = await request.patch({
        entity: endpoint,
        jsonData: payload,
      });

      if (res?.success) {
        message.success(res.message || `Leave ${actionType.toLowerCase()}d successfully`);
        setActionModal({ open: false, actionType: 'Approve', stage: 'manager', record: null });
        fetchQueue();
        if (onApprovalDone) onApprovalDone();
      } else {
        message.error(res?.message || 'Approval action failed');
      }
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || 'Operation error');
    } finally {
      setSubmitting(false);
    }
  };

  const managerPending = pendingList.filter((l) => l.status === 'Pending Manager Approval');
  const hrPending = pendingList.filter((l) => l.status === 'Pending HR Approval');

  const getColumns = (stage) => [
    {
      title: 'Employee',
      dataIndex: 'employee',
      key: 'employee',
      width: 220,
      render: (emp) => {
        if (!emp) return <Text type="secondary">—</Text>;
        const fullName = `${emp.name || ''} ${emp.surname || ''}`.trim() || emp.fullName || emp.email;
        return (
          <Space orientation="horizontal" size={10}>
            <Avatar src={emp.photo} icon={<UserOutlined />} style={{ backgroundColor: '#002244' }} />
            <div>
              <Text strong style={{ color: '#002244', display: 'block', fontSize: 13 }}>
                {fullName}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {emp.employeeId} • {emp.departmentName || ''}
              </Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Leave Type',
      dataIndex: 'leaveType',
      key: 'leaveType',
      width: 150,
      render: (type) => <Tag color="geekblue">{type}</Tag>,
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 180,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#002244' }}>
            {dayjs(r.fromDate || r.startDate).format('MMM DD')} — {dayjs(r.toDate || r.endDate).format('MMM DD, YYYY')}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            <strong>{r.daysCount || r.numberOfDays} {r.daysCount === 1 ? 'day' : 'days'}</strong>
          </div>
        </div>
      ),
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <span style={{ color: '#475569', fontSize: 12 }}>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Manager Status',
      key: 'mgrStatus',
      width: 150,
      render: (_, r) => (
        <Tag color={r.managerApproval?.status === 'Approved' ? 'green' : 'gold'}>
          {r.managerApproval?.status || 'Pending'}
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 180,
      align: 'center',
      render: (_, record) => {
        // Prevent employee approving own leave
        const isOwn =
          (record.user && record.user.toString() === currentAdmin?._id?.toString()) ||
          (record.employee?._id && currentAdmin?.employeeId && record.employee.employeeId === currentAdmin.employeeId);

        if (isOwn) {
          return (
            <Tooltip title="You cannot approve your own leave request">
              <Tag color="default">Self-Leave (Locked)</Tag>
            </Tooltip>
          );
        }

        return (
          <Space orientation="horizontal" size={8}>
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => openAction(record, 'Approve', stage)}
              style={{ backgroundColor: '#10B981', borderColor: '#10B981' }}
            >
              Approve
            </Button>
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => openAction(record, 'Reject', stage)}
            >
              Reject
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <Card
      bordered={false}
      style={{
        borderRadius: 16,
        boxShadow: '0 8px 24px rgba(0, 34, 68, 0.08)',
      }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'manager',
            label: (
              <span>
                <ClockCircleOutlined style={{ marginRight: 6 }} />
                Pending Manager Approval{' '}
                <Badge count={managerPending.length} style={{ backgroundColor: '#f59e0b', marginLeft: 4 }} />
              </span>
            ),
            children: (
              <Table
                rowKey="_id"
                columns={getColumns('manager')}
                dataSource={managerPending}
                loading={loading}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 850 }}
              />
            ),
          },
          ...(isHrOrMgmt
            ? [
                {
                  key: 'hr',
                  label: (
                    <span>
                      <CheckOutlined style={{ marginRight: 6 }} />
                      Pending HR Approval{' '}
                      <Badge count={hrPending.length} style={{ backgroundColor: '#2563eb', marginLeft: 4 }} />
                    </span>
                  ),
                  children: (
                    <Table
                      rowKey="_id"
                      columns={getColumns('hr')}
                      dataSource={hrPending}
                      loading={loading}
                      pagination={{ pageSize: 10 }}
                      scroll={{ x: 850 }}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />

      {/* CONFIRMATION / REMARKS MODAL */}
      <Modal
        title={
          actionModal.actionType === 'Approve'
            ? `Confirm Approval (${actionModal.stage.toUpperCase()} Stage)`
            : `Reject Leave Request (${actionModal.stage.toUpperCase()} Stage)`
        }
        open={actionModal.open}
        onCancel={() => setActionModal({ ...actionModal, open: false })}
        onOk={handleConfirmAction}
        confirmLoading={submitting}
        okText={actionModal.actionType === 'Approve' ? 'Confirm Approval' : 'Confirm Rejection'}
        okButtonProps={{
          danger: actionModal.actionType === 'Reject',
          style: actionModal.actionType === 'Approve' ? { backgroundColor: '#10B981', borderColor: '#10B981' } : {},
        }}
        width={480}
      >
        <Paragraph style={{ marginTop: 12 }}>
          {actionModal.actionType === 'Approve'
            ? 'Are you sure you want to approve this leave request? This will advance it to the next workflow stage or synchronize approved status.'
            : 'Please specify the rejection reason below. This will notify the employee and restore their pending leave quota.'}
        </Paragraph>

        <div style={{ marginTop: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>
            {actionModal.actionType === 'Reject' ? 'Rejection Reason (Required):' : 'Approver Comments (Optional):'}
          </Text>
          <TextArea
            rows={3}
            placeholder={
              actionModal.actionType === 'Reject'
                ? 'e.g. Critical release scheduled, insufficient team coverage...'
                : 'e.g. Approved, deliverables covered by sprint team...'
            }
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            maxLength={250}
            showCount
          />
        </div>
      </Modal>
    </Card>
  );
}

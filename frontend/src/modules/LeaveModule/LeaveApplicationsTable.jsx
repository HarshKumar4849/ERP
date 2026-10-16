import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Row,
  Col,
  Input,
  Select,
  Button,
  Tag,
  Space,
  Avatar,
  Tooltip,
  Typography,
  Popconfirm,
  Popover,
  Timeline,
  message,
  Modal,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  CloseCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';
import { ROLES } from '@/utils/rbac';
import LeaveApplicationModal from './LeaveApplicationModal';

const { Text } = Typography;

export default function LeaveApplicationsTable({ currentAdmin, userRole, onRefreshBalances }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  // Departments for HR/Mgmt
  const [departments, setDepartments] = useState([]);

  // Modal
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const isHrOrAdmin = userRole === ROLES.HR || userRole === ROLES.ADMIN;

  const fetchLeaves = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      const options = {
        page,
        items: limit,
      };
      if (searchQuery.trim()) options.q = searchQuery.trim();
      if (selectedDept) options.department = selectedDept;
      if (selectedStatus) options.status = selectedStatus;
      if (selectedType) options.leaveType = selectedType;

      const res = await request.list({ entity: 'leave', options });
      if (res?.success) {
        setData(res.result || []);
        if (res.pagination) {
          setPagination({
            current: res.pagination.page,
            pageSize: limit,
            total: res.pagination.count,
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch leave records', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchDepts = async () => {
      if (isHrOrAdmin) {
        try {
          const res = await request.listAll({ entity: 'department' });
          if (res?.success) setDepartments(res.result || []);
        } catch (err) {
          console.error(err);
        }
      }
    };
    fetchDepts();
  }, [userRole]);

  useEffect(() => {
    fetchLeaves(1, pagination.pageSize);
  }, [selectedDept, selectedStatus, selectedType]);

  const handleCancelLeave = async (id) => {
    try {
      setCancellingId(id);
      const res = await request.patch({
        entity: `leave/cancel/${id}`,
        jsonData: {},
      });
      if (res?.success) {
        message.success('Leave request cancelled successfully');
        fetchLeaves(pagination.current, pagination.pageSize);
        if (onRefreshBalances) onRefreshBalances();
      } else {
        message.error(res?.message || 'Failed to cancel leave');
      }
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || 'Error cancelling leave');
    } finally {
      setCancellingId(null);
    }
  };

  const [approvingId, setApprovingId] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, record: null, reason: '' });
  const [submittingReject, setSubmittingReject] = useState(false);

  const handleQuickApprove = async (record) => {
    try {
      setApprovingId(record._id);
      const stage = record.status === 'Pending HR Approval' ? 'hr-approval' : 'manager-approval';
      const res = await request.patch({
        entity: `leave/${stage}/${record._id}`,
        jsonData: { action: 'Approve', remarks: 'Approved' },
      });
      if (res?.success) {
        message.success(res.message || 'Leave approved successfully');
        fetchLeaves(pagination.current, pagination.pageSize);
        if (onRefreshBalances) onRefreshBalances();
      } else {
        message.error(res?.message || 'Failed to approve leave');
      }
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || 'Error approving leave');
    } finally {
      setApprovingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModal.reason.trim()) {
      message.error('Please enter a rejection reason');
      return;
    }
    try {
      setSubmittingReject(true);
      const stage = rejectModal.record?.status === 'Pending HR Approval' ? 'hr-approval' : 'manager-approval';
      const res = await request.patch({
        entity: `leave/${stage}/${rejectModal.record?._id}`,
        jsonData: {
          action: 'Reject',
          remarks: rejectModal.reason.trim(),
          rejectionReason: rejectModal.reason.trim(),
        },
      });
      if (res?.success) {
        message.success('Leave request rejected');
        setRejectModal({ open: false, record: null, reason: '' });
        fetchLeaves(pagination.current, pagination.pageSize);
        if (onRefreshBalances) onRefreshBalances();
      } else {
        message.error(res?.message || 'Failed to reject leave');
      }
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || 'Error rejecting leave');
    } finally {
      setSubmittingReject(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      'Pending Manager Approval': { color: 'gold', icon: <ClockCircleOutlined /> },
      'Pending HR Approval': { color: 'blue', icon: <ClockCircleOutlined /> },
      Approved: { color: 'green', icon: <CheckCircleOutlined /> },
      Rejected: { color: 'red', icon: <CloseCircleOutlined /> },
      Cancelled: { color: 'default', icon: <CloseCircleOutlined /> },
    };
    const c = map[status] || { color: 'default', icon: null };
    return (
      <Tag color={c.color} icon={c.icon} style={{ borderRadius: 4, fontWeight: 600 }}>
        {status}
      </Tag>
    );
  };

  const renderApprovalTimeline = (record) => {
    const history = record.approvalHistory || [];
    return (
      <div style={{ maxWidth: 300, padding: 8 }}>
        <Text strong style={{ display: 'block', marginBottom: 12 }}>
          Approval Workflow Audit Trail
        </Text>
        <Timeline
          items={[
            {
              color: 'green',
              children: (
                <div>
                  <strong>Employee Applied</strong>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {dayjs(record.created).format('YYYY-MM-DD hh:mm A')}
                  </div>
                </div>
              ),
            },
            {
              color:
                record.managerApproval?.status === 'Approved'
                  ? 'green'
                  : record.managerApproval?.status === 'Rejected'
                  ? 'red'
                  : record.managerApproval?.status === 'Skipped'
                  ? 'gray'
                  : 'blue',
              children: (
                <div>
                  <strong>Manager Step: {record.managerApproval?.status || 'Pending'}</strong>
                  {record.managerApproval?.approverName && (
                    <div style={{ fontSize: 11 }}>By: {record.managerApproval.approverName}</div>
                  )}
                  {record.managerApproval?.remarks && (
                    <div style={{ fontSize: 11, fontStyle: 'italic', color: '#475569' }}>
                      "{record.managerApproval.remarks}"
                    </div>
                  )}
                </div>
              ),
            },
            {
              color:
                record.hrApproval?.status === 'Approved'
                  ? 'green'
                  : record.hrApproval?.status === 'Rejected'
                  ? 'red'
                  : 'blue',
              children: (
                <div>
                  <strong>HR Final Step: {record.hrApproval?.status || 'Pending'}</strong>
                  {record.hrApproval?.approverName && (
                    <div style={{ fontSize: 11 }}>By: {record.hrApproval.approverName}</div>
                  )}
                  {record.hrApproval?.remarks && (
                    <div style={{ fontSize: 11, fontStyle: 'italic', color: '#475569' }}>
                      "{record.hrApproval.remarks}"
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
        {record.rejectionReason && (
          <div style={{ marginTop: 8, padding: 8, background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>
            <span style={{ color: '#b91c1c', fontSize: 12, fontWeight: 600 }}>Rejection Reason:</span>
            <div style={{ fontSize: 11, color: '#7f1d1d' }}>{record.rejectionReason}</div>
          </div>
        )}
      </div>
    );
  };

  const columns = [
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
      width: 160,
      render: (type) => <Tag color="geekblue" style={{ borderRadius: 4 }}>{type}</Tag>,
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 200,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, color: '#002244' }}>
            {dayjs(r.fromDate || r.startDate).format('MMM DD, YYYY')} — {dayjs(r.toDate || r.endDate).format('MMM DD, YYYY')}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 190,
      render: (status, record) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {getStatusBadge(status)}
          <Popover
            content={renderApprovalTimeline(record)}
            title={null}
            trigger="click"
            placement="bottomLeft"
          >
            <Tooltip title="Click to view approval history">
              <Button
                type="text"
                size="small"
                shape="circle"
                icon={<HistoryOutlined style={{ color: '#64748b', fontSize: 13 }} />}
                style={{ width: 22, height: 22, minWidth: 22, padding: 0 }}
                onClick={(e) => e.stopPropagation()}
              />
            </Tooltip>
          </Popover>
        </span>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 175,
      align: 'center',
      fixed: 'right',
      render: (_, record) => {
        const isOwn =
          (record.user && record.user.toString() === currentAdmin?._id?.toString()) ||
          (record.employee?._id && currentAdmin?.employeeId && record.employee.employeeId === currentAdmin.employeeId);

        const canHrApprove = isHrOrAdmin && record.status === 'Pending HR Approval' && !isOwn;
        const canMgrApprove = isHrOrAdmin && record.status === 'Pending Manager Approval' && !isOwn;
        const canCancel = isOwn && ['Pending Manager Approval', 'Pending HR Approval'].includes(record.status);
        const isCancelling = cancellingId === record._id;
        const isApproving = approvingId === record._id;

        if (canHrApprove || canMgrApprove) {
          return (
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                loading={isApproving}
                style={{
                  backgroundColor: '#10B981',
                  borderColor: '#10B981',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  height: 28,
                  padding: '0 10px',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickApprove(record);
                }}
              >
                Approve
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseOutlined />}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  height: 28,
                  padding: '0 10px',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setRejectModal({ open: true, record, reason: '' });
                }}
              >
                Reject
              </Button>
            </div>
          );
        }

        if (canCancel) {
          return (
            <Popconfirm
              title="Cancel this leave request?"
              description="This will restore your leave quota balance."
              onConfirm={(e) => {
                e?.stopPropagation();
                handleCancelLeave(record._id);
              }}
              okText="Yes, Cancel"
              cancelText="No"
              placement="topLeft"
              okButtonProps={{ loading: isCancelling, danger: true }}
            >
              <Button
                type="link"
                danger
                size="small"
                loading={isCancelling}
                style={{ fontWeight: 500, fontSize: 12 }}
                onClick={(e) => e.stopPropagation()}
              >
                Cancel
              </Button>
            </Popconfirm>
          );
        }

        return <Text type="secondary" style={{ fontSize: 13 }}>—</Text>;
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
      {/* FILTER & ACTION BAR */}
      <div style={{ marginBottom: 20 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Search reason, leave type..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={() => fetchLeaves(1, pagination.pageSize)}
              allowClear
            />
          </Col>

          {isHrOrAdmin && (
            <Col xs={24} sm={12} md={4}>
              <Select
                placeholder="Department"
                aria-label="Filter leave requests by department"
                style={{ width: '100%' }}
                value={selectedDept}
                onChange={setSelectedDept}
                allowClear
              >
                {departments.map((d) => (
                  <Select.Option key={d.name} value={d.name}>
                    {d.name}
                  </Select.Option>
                ))}
              </Select>
            </Col>
          )}

          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="Status"
              aria-label="Filter leave requests by status"
              style={{ width: '100%' }}
              value={selectedStatus}
              onChange={setSelectedStatus}
              allowClear
            >
              <Select.Option value="Pending Manager Approval">Pending Manager</Select.Option>
              <Select.Option value="Pending HR Approval">Pending HR</Select.Option>
              <Select.Option value="Approved">Approved</Select.Option>
              <Select.Option value="Rejected">Rejected</Select.Option>
              <Select.Option value="Cancelled">Cancelled</Select.Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="Leave Type"
              aria-label="Filter leave requests by leave type"
              style={{ width: '100%' }}
              value={selectedType}
              onChange={setSelectedType}
              allowClear
            >
              <Select.Option value="Casual Leave">Casual Leave</Select.Option>
              <Select.Option value="Sick Leave">Sick Leave</Select.Option>
              <Select.Option value="Earned/Privilege Leave">Earned/Privilege Leave</Select.Option>
              <Select.Option value="Compensatory Off">Compensatory Off</Select.Option>
              <Select.Option value="Half Day">Half Day</Select.Option>
              <Select.Option value="Work From Home">Work From Home</Select.Option>
              <Select.Option value="Unpaid Leave">Unpaid Leave</Select.Option>
              <Select.Option value="Other">Other</Select.Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={6} style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button icon={<ReloadOutlined />} onClick={() => fetchLeaves(1, pagination.pageSize)}>
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsApplyModalOpen(true)}
              style={{
                backgroundColor: '#002244',
                borderColor: '#002244',
                fontWeight: 600,
                borderRadius: 8,
              }}
            >
              Apply for Leave
            </Button>
          </Col>
        </Row>
      </div>

      {/* DATA TABLE */}
      <Table
        rowKey="_id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} leave requests`,
          onChange: (page, pageSize) => fetchLeaves(page, pageSize),
        }}
        scroll={{ x: 950 }}
      />

      {/* APPLICATION MODAL */}
      <LeaveApplicationModal
        open={isApplyModalOpen}
        onCancel={() => setIsApplyModalOpen(false)}
        onSuccess={() => {
          setIsApplyModalOpen(false);
          fetchLeaves(1, pagination.pageSize);
          if (onRefreshBalances) onRefreshBalances();
        }}
        currentAdmin={currentAdmin}
        userRole={userRole}
      />

      {/* REJECTION REASON MODAL */}
      <Modal
        title="Reject Leave Request"
        open={rejectModal.open}
        onCancel={() => setRejectModal({ open: false, record: null, reason: '' })}
        onOk={handleConfirmReject}
        confirmLoading={submittingReject}
        okText="Confirm Rejection"
        okButtonProps={{ danger: true }}
      >
        <p style={{ marginBottom: 12 }}>
          Please specify a reason for rejecting this leave request for{' '}
          <strong>
            {rejectModal.record?.employee?.name ? `${rejectModal.record.employee.name} ${rejectModal.record.employee.surname || ''}` : 'the employee'}
          </strong>:
        </p>
        <Input.TextArea
          rows={3}
          placeholder="e.g. Critical release scheduled, insufficient team coverage..."
          value={rejectModal.reason}
          onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
          maxLength={250}
          showCount
        />
      </Modal>
    </Card>
  );
}

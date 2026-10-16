import React from 'react';
import { Table, Avatar, Tag, Space, Button, Dropdown, Popconfirm, Tooltip } from 'antd';
import {
  UserOutlined,
  MoreOutlined,
  EyeOutlined,
  EditOutlined,
  SwapOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  MailOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { FILE_BASE_URL } from '@/config/serverApiConfig';

const getStatusColor = (status) => {
  switch (status) {
    case 'Active':
      return 'success';
    case 'Probation':
      return 'processing';
    case 'On Notice':
      return 'warning';
    case 'On Leave':
      return 'gold';
    case 'Resigned':
      return 'purple';
    case 'Terminated':
      return 'error';
    default:
      return 'default';
  }
};

const getDeptColor = (dept) => {
  switch (dept) {
    case 'Engineering':
      return 'blue';
    case 'Human Resources':
      return 'magenta';
    case 'Finance':
      return 'green';
    case 'Executive':
      return 'purple';
    case 'Marketing':
      return 'orange';
    case 'Administration':
      return 'cyan';
    case 'Operations':
      return 'geekblue';
    default:
      return 'default';
  }
};

export default function EmployeeTable({
  data = [],
  pagination = {},
  loading = false,
  onPageChange,
  onViewProfile,
  onEdit,
  onChangeStatus,
  onDelete,
}) {
  const columns = [
    {
      title: 'Employee',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      render: (_, record) => {
        const photoUrl = record.photo
          ? record.photo.startsWith('http')
            ? record.photo
            : `${FILE_BASE_URL.replace(/\/?$/, '/')}${record.photo.replace(/^\//, '')}`
          : null;

        const fullName = `${record.name || ''} ${record.surname || ''}`.trim();

        return (
          <Space orientation="horizontal" size="middle" align="center">
            <Avatar
              size={44}
              src={photoUrl}
              icon={!photoUrl && <UserOutlined />}
              style={{
                backgroundColor: photoUrl ? 'transparent' : '#1677ff',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onClick={() => onViewProfile(record)}
            />
            <div>
              <div
                style={{ fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#1677ff' }}
                onClick={() => onViewProfile(record)}
              >
                {fullName}
              </div>
              <Space size={4} style={{ marginTop: 2 }}>
                <Tag color="geekblue" style={{ fontSize: 11, padding: '0 6px', margin: 0 }}>
                  {record.employeeId}
                </Tag>
                {record.gender && (
                  <span style={{ fontSize: 11, color: '#8c8c8c' }}>• {record.gender}</span>
                )}
              </Space>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Department & Role',
      key: 'department',
      width: 200,
      render: (_, record) => (
        <div>
          <Tag color={getDeptColor(record.departmentName)} style={{ fontWeight: 500, margin: 0 }}>
            {record.departmentName || 'Unassigned'}
          </Tag>
          <div style={{ fontSize: 13, color: '#595959', marginTop: 4 }}>
            {record.designationName || (record.designation?.name) || 'Staff'}
          </div>
        </div>
      ),
    },
    {
      title: 'Contact Details',
      key: 'contact',
      width: 220,
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#595959' }}>
            <MailOutlined style={{ color: '#8c8c8c' }} />
            <span>{record.email}</span>
          </div>
          {record.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8c8c8c', marginTop: 4 }}>
              <PhoneOutlined />
              <span>{record.phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Location & Type',
      key: 'employmentType',
      width: 180,
      render: (_, record) => (
        <div>
          <Tag style={{ margin: 0 }}>{record.employmentType || 'Full Time'}</Tag>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <EnvironmentOutlined />
            <span>{record.workLocationName || 'HQ'}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Reporting Manager',
      key: 'reportingManager',
      width: 170,
      render: (_, record) => {
        const mgr = record.reportingManager;
        if (!mgr) return <span style={{ color: '#bfbfbf', fontSize: 12 }}>None</span>;
        const mgrName = `${mgr.name || ''} ${mgr.surname || ''}`.trim();
        return (
          <Space size={6} align="center">
            <Avatar size={24} icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{mgrName}</span>
          </Space>
        );
      },
    },
    {
      title: 'Joining Date',
      dataIndex: 'joiningDate',
      key: 'joiningDate',
      width: 120,
      render: (date) => (
        <span style={{ fontSize: 13, color: '#595959' }}>
          {date ? dayjs(date).format('DD MMM YYYY') : '-'}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status) => (
        <Tag color={getStatusColor(status)} style={{ fontWeight: 500, padding: '2px 8px' }}>
          {status || 'Active'}
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => {
        const items = [
          {
            key: 'view',
            label: 'View 360° Profile',
            icon: <EyeOutlined />,
            onClick: () => onViewProfile(record),
          },
          {
            key: 'edit',
            label: 'Edit Employee',
            icon: <EditOutlined />,
            onClick: () => onEdit(record),
          },
          {
            key: 'status',
            label: 'Change Status',
            icon: <SwapOutlined />,
            onClick: () => onChangeStatus(record),
          },
          {
            type: 'divider',
          },
          {
            key: 'delete',
            danger: true,
            label: (
              <Popconfirm
                title="Are you sure you want to remove this employee?"
                description="This will mark the employee record as removed."
                okText="Yes, Remove"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
                onConfirm={() => onDelete(record)}
              >
                <span style={{ color: '#ff4d4f' }}>Delete Employee</span>
              </Popconfirm>
            ),
            icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
          },
        ];

        return (
          <Space size="small">
            <Tooltip title="View Profile">
              <Button
                type="text"
                shape="circle"
                icon={<EyeOutlined />}
                onClick={() => onViewProfile(record)}
              />
            </Tooltip>
            <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
              <Button type="text" shape="circle" icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: 8,
        border: '1px solid #f0f0f0',
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      <Table
        rowKey="_id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          current: pagination.page || 1,
          pageSize: pagination.items || 10,
          total: pagination.count || 0,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} employees`,
          showSizeChanger: true,
          pageSizeOptions: ['5', '10', '20', '50'],
          onChange: onPageChange,
        }}
      />
    </div>
  );
}

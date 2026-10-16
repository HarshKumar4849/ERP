import React from 'react';
import { Row, Col, Input, Select, Button, Space, Segmented } from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  TableOutlined,
  AppstoreOutlined,
  FilterOutlined,
} from '@ant-design/icons';

const { Option } = Select;

export default function EmployeeFilterBar({
  filters,
  onFilterChange,
  onResetFilters,
  onAddNew,
  onRefresh,
  viewMode,
  onViewModeChange,
  departments = [],
  locations = [],
  loading = false,
}) {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        padding: '16px',
        borderRadius: 8,
        border: '1px solid #f0f0f0',
        marginBottom: 16,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
    >
      <Row gutter={[12, 12]} align="middle" justify="space-between">
        {/* Left Side: Search & Primary Filters */}
        <Col xs={24} md={16} lg={18}>
          <Row gutter={[8, 8]}>
            {/* Search Input */}
            <Col xs={24} sm={10} md={8}>
              <Input
                placeholder="Search name, ID, email, skill..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                allowClear
                value={filters.q}
                onChange={(e) => onFilterChange('q', e.target.value)}
              />
            </Col>

            {/* Department Filter */}
            <Col xs={12} sm={6} md={4}>
              <Select
                placeholder="Department"
                aria-label="Filter by department"
                style={{ width: '100%' }}
                value={filters.department || 'all'}
                onChange={(val) => onFilterChange('department', val)}
              >
                <Option value="all">All Depts</Option>
                {departments.map((d) => (
                  <Option key={d._id || d.name} value={d.name}>
                    {d.name}
                  </Option>
                ))}
              </Select>
            </Col>

            {/* Status Filter */}
            <Col xs={12} sm={6} md={4}>
              <Select
                placeholder="Status"
                aria-label="Filter by status"
                style={{ width: '100%' }}
                value={filters.status || 'all'}
                onChange={(val) => onFilterChange('status', val)}
              >
                <Option value="all">All Statuses</Option>
                <Option value="Active">Active</Option>
                <Option value="Probation">Probation</Option>
                <Option value="On Notice">On Notice</Option>
                <Option value="On Leave">On Leave</Option>
                <Option value="Resigned">Resigned</Option>
                <Option value="Terminated">Terminated</Option>
              </Select>
            </Col>

            {/* Employment Type Filter */}
            <Col xs={12} sm={6} md={4}>
              <Select
                placeholder="Type"
                aria-label="Filter by employment type"
                style={{ width: '100%' }}
                value={filters.employmentType || 'all'}
                onChange={(val) => onFilterChange('employmentType', val)}
              >
                <Option value="all">All Types</Option>
                <Option value="Full Time">Full Time</Option>
                <Option value="Part Time">Part Time</Option>
                <Option value="Intern">Intern</Option>
                <Option value="Consultant">Consultant</Option>
              </Select>
            </Col>

            {/* Work Location Filter */}
            <Col xs={12} sm={6} md={4}>
              <Select
                placeholder="Location"
                aria-label="Filter by work location"
                style={{ width: '100%' }}
                value={filters.workLocation || 'all'}
                onChange={(val) => onFilterChange('workLocation', val)}
              >
                <Option value="all">All Locations</Option>
                {locations.map((l) => (
                  <Option key={l._id || l.name} value={l.name}>
                    {l.name}
                  </Option>
                ))}
              </Select>
            </Col>
          </Row>
        </Col>

        {/* Right Side: Sorting, View Mode & Actions */}
        <Col xs={24} md={8} lg={6} style={{ textAlign: 'right' }}>
          <Space wrap size="small">
            <Select
              style={{ width: 140 }}
              aria-label="Sort employees"
              value={`${filters.sortBy}:${filters.sortValue}`}
              onChange={(val) => {
                const [sortBy, sortValue] = val.split(':');
                onFilterChange('sort', { sortBy, sortValue: parseInt(sortValue) });
              }}
            >
              <Option value="created:-1">Newest Added</Option>
              <Option value="name:1">Name (A-Z)</Option>
              <Option value="name:-1">Name (Z-A)</Option>
              <Option value="employeeId:1">Employee ID</Option>
              <Option value="joiningDate:-1">Joining Date</Option>
            </Select>

            <Segmented
              value={viewMode}
              onChange={onViewModeChange}
              options={[
                { value: 'table', icon: <TableOutlined /> },
                { value: 'grid', icon: <AppstoreOutlined /> },
              ]}
            />

            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={onRefresh}
              title="Refresh"
            />

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={onAddNew}
              style={{ backgroundColor: '#1677ff' }}
            >
              Add Employee
            </Button>
          </Space>
        </Col>
      </Row>
    </div>
  );
}

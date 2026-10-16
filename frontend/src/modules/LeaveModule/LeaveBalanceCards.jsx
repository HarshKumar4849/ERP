import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  Typography,
  Progress,
  Tag,
  Space,
  Spin,
  Alert,
} from 'antd';
import {
  CalendarOutlined,
  HeartOutlined,
  StarOutlined,
  CoffeeOutlined,
  HourglassOutlined,
  HomeOutlined,
  FileExcelOutlined,
  AppstoreOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { request } from '@/request';
import { ROLES } from '@/utils/rbac';

const { Title, Text } = Typography;

export default function LeaveBalanceCards({ currentAdmin, userRole, selectedEmployeeId, onSelectEmployee }) {
  const [loading, setLoading] = useState(false);
  const [balanceData, setBalanceData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [activeEmpId, setActiveEmpId] = useState(selectedEmployeeId);

  const isHrOrAdmin = userRole === ROLES.HR || userRole === ROLES.ADMIN;

  useEffect(() => {
    const fetchEmps = async () => {
      if (isHrOrAdmin) {
        try {
          const res = await request.listAll({ entity: 'employee' });
          if (res?.success) {
            let list = res.result || [];
            setEmployees(list);
            if (!activeEmpId && list.length > 0) {
              setActiveEmpId(list[0]._id);
            }
          }
        } catch (err) {
          console.error('Failed to load employees for leave balance', err);
        }
      }
    };
    fetchEmps();
  }, [userRole]);

  const fetchBalance = async (empId) => {
    setLoading(true);
    try {
      let query = '';
      if (empId) query = `?employee=${empId}`;
      const res = await request.get({ entity: `leave/balance${query}` });
      setBalanceData(res?.result || null);
    } catch (err) {
      console.error('Failed to fetch leave balance', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance(activeEmpId);
  }, [activeEmpId]);

  const handleEmpChange = (val) => {
    setActiveEmpId(val);
    if (onSelectEmployee) onSelectEmployee(val);
  };

  const getLeaveTypeConfig = (type) => {
    const config = {
      'Casual Leave': { icon: <CoffeeOutlined />, color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
      'Sick Leave': { icon: <HeartOutlined />, color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
      'Earned/Privilege Leave': { icon: <StarOutlined />, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
      'Compensatory Off': { icon: <CalendarOutlined />, color: '#10B981', bg: '#ecfdf5', border: '#a7f3d0' },
      'Half Day': { icon: <HourglassOutlined />, color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
      'Work From Home': { icon: <HomeOutlined />, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
      'Unpaid Leave': { icon: <FileExcelOutlined />, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
      Other: { icon: <AppstoreOutlined />, color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
    };
    return config[type] || { icon: <CalendarOutlined />, color: '#002244', bg: '#ffffff', border: '#e2e8f0' };
  };

  const balances = balanceData?.balances || {};

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Selector Header for HR/Admin */}
      {isHrOrAdmin && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Text strong style={{ color: '#002244', fontSize: 14 }}>
              Viewing Leave Quotas For:
            </Text>
          </div>
          <Select
            style={{ width: 260 }}
            aria-label="Select employee to view leave balances"
            placeholder="Select Employee"
            value={activeEmpId}
            onChange={handleEmpChange}
            showSearch
            filterOption={(input, option) =>
              (option?.children || '').toLowerCase().includes(input.toLowerCase())
            }
          >
            {employees.map((e) => (
              <Select.Option key={e._id} value={e._id}>
                {e.name} {e.surname} ({e.employeeId} - {e.departmentName || ''})
              </Select.Option>
            ))}
          </Select>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '30px 0', textAlign: 'center' }}>
          <Spin tip="Loading leave balance allowances..." />
        </div>
      ) : (
        <Row gutter={[14, 14]}>
          {Object.entries(balances).map(([type, b]) => {
            const cfg = getLeaveTypeConfig(type);
            const allocated = b.allocated || 0;
            const used = b.used || 0;
            const pending = b.pending || 0;
            const remaining = b.remaining;
            const pct = allocated > 0 ? Math.min(100, Math.round((used / allocated) * 100)) : 0;

            return (
              <Col xs={24} sm={12} md={6} lg={6} xl={3} key={type} style={{ flex: '1 1 200px' }}>
                <Card
                  size="small"
                  bordered={false}
                  style={{
                    borderRadius: 12,
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    height: '100%',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Space orientation="horizontal" size={6}>
                      <span style={{ color: cfg.color, fontSize: 16 }}>{cfg.icon}</span>
                      <Text strong style={{ fontSize: 12, color: '#1e293b' }}>
                        {type}
                      </Text>
                    </Space>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: cfg.color }}>
                      {remaining}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {type === 'Unpaid Leave' ? 'No limit' : `of ${allocated} days`}
                    </Text>
                  </div>

                  {type !== 'Unpaid Leave' && (
                    <Progress
                      percent={pct}
                      size="small"
                      showInfo={false}
                      strokeColor={cfg.color}
                      aria-label={`${type} usage: ${pct}%`}
                      style={{ marginBottom: 8 }}
                    />
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    <span>Used: <strong>{used}d</strong></span>
                    {pending > 0 ? (
                      <span style={{ color: '#d97706' }}>Pending: <strong>{pending}d</strong></span>
                    ) : (
                      <span>Pending: 0d</span>
                    )}
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Card, Select, Typography, Spin, Space, Alert, Tag, Row, Col } from 'antd';
import { FileProtectOutlined, UserOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { selectCurrentAdmin } from '@/redux/auth/selectors';
import { normalizeRole, ROLES } from '@/utils/rbac';
import EmployeeDocumentVault from '@/modules/EmployeeModule/components/EmployeeDocumentVault';
import axios from 'axios';
import { API_BASE_URL } from '@/config/serverApiConfig';
import storePersist from '@/redux/storePersist';

const { Title, Text } = Typography;
const { Option } = Select;

export default function Documents() {
  const currentAdmin = useSelector(selectCurrentAdmin);
  const userRole = normalizeRole(currentAdmin?.role || (currentAdmin?.department === 'HR' ? 'HR' : ''));

  const isEmployee = userRole === ROLES.EMPLOYEE;
  const isPrivileged = [ROLES.ADMIN, ROLES.HR].includes(userRole);

  const [loading, setLoading] = useState(true);
  const [employeeRecord, setEmployeeRecord] = useState(null);
  const [employeeList, setEmployeeList] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState(null);

  const getAuthHeaders = () => {
    const auth = storePersist.get('auth');
    const token = auth?.current?.token;
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  // 1. Fetch own employee profile if Employee, or fetch all employees if Privileged
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (isPrivileged) {
          // Privileged (Admin / HR / Management): fetch all employees
          let ownRecord = null;
          if (currentAdmin?._id) {
            try {
              const selfRes = await axios.get(
                `${API_BASE_URL}employee/read/${currentAdmin._id}`,
                getAuthHeaders()
              );
              if (selfRes.data?.success && selfRes.data?.result) {
                ownRecord = selfRes.data.result;
              }
            } catch (err) {
              console.log('Own employee record resolution skipped:', err.message);
            }
          }

          const res = await axios.get(`${API_BASE_URL}employee/list?items=100`, getAuthHeaders());
          let list = [];
          if (res.data?.success && Array.isArray(res.data?.result)) {
            list = res.data.result;
          }

          if (ownRecord && !list.some((e) => e._id === ownRecord._id)) {
            list.unshift(ownRecord);
          }

          setEmployeeList(list);
          if (list.length > 0) {
            setSelectedEmpId(list[0]._id);
            setEmployeeRecord(list[0]);
          } else if (ownRecord) {
            setSelectedEmpId(ownRecord._id);
            setEmployeeRecord(ownRecord);
          }
        } else {
          // Employee: fetch own record by user._id or employeeId
          const identifier = currentAdmin?._id || currentAdmin?.employeeId;
          if (identifier) {
            try {
              const res = await axios.get(
                `${API_BASE_URL}employee/read/${identifier}`,
                getAuthHeaders()
              );
              if (res.data.success && res.data.result) {
                setEmployeeRecord(res.data.result);
                setSelectedEmpId(res.data.result._id);
              }
            } catch (err) {
              console.log('Employee read fallback:', err.message);
              // Fallback employee object
              const fallback = {
                _id: currentAdmin._id,
                name: `${currentAdmin.name || ''} ${currentAdmin.surname || ''}`.trim() || 'Employee',
                workEmail: currentAdmin.email,
                employeeId: currentAdmin.employeeId || 'EMP-SELF',
              };
              setEmployeeRecord(fallback);
              setSelectedEmpId(currentAdmin._id);
            }
          }
        }
      } catch (e) {
        console.error('Failed to initialize document portal:', e);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [currentAdmin, isPrivileged]);

  const handleSelectEmployee = (empId) => {
    setSelectedEmpId(empId);
    const found = employeeList.find((e) => e._id === empId);
    setEmployeeRecord(found || null);
  };

  return (
    <div style={{ padding: '0 8px 32px' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #002244 0%, #003366 100%)',
          borderRadius: 12,
          padding: '24px 28px',
          color: '#ffffff',
          marginBottom: 20,
          boxShadow: '0 4px 12px rgba(0, 34, 68, 0.15)',
        }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Space align="center" size="middle">
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileProtectOutlined style={{ fontSize: 26, color: '#52c41a' }} />
              </div>
              <div>
                <Title level={3} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
                  {isEmployee ? 'My Document Vault' : 'Enterprise Document Vault'}
                </Title>
                <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 13 }}>
                  {isEmployee
                    ? 'Upload and manage your confidential verification documents, ID proofs, and certifications.'
                    : 'Review, verify, and manage confidential employee compliance documents with strict RBAC.'}
                </Text>
              </div>
            </Space>
          </Col>

          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            {isEmployee ? (
              <Tag
                color="blue"
                style={{ fontSize: 13, padding: '6px 14px', borderRadius: 20, fontWeight: 600 }}
              >
                <UserOutlined style={{ marginRight: 6 }} />
                {employeeRecord?.name || currentAdmin?.name || 'My Documents'}
              </Tag>
            ) : (
              <div style={{ textAlign: 'left', display: 'block', width: '100%' }}>
                <Text style={{ color: '#fff', fontSize: 12, display: 'block', marginBottom: 4 }}>
                  Select Employee:
                </Text>
                <Select
                  showSearch
                  placeholder="Select Employee"
                  aria-label="Select employee to view documents"
                  value={selectedEmpId}
                  onChange={handleSelectEmployee}
                  style={{ width: '100%' }}
                  optionFilterProp="children"
                >
                  {employeeList.map((emp) => (
                    <Option key={emp._id} value={emp._id}>
                      {emp.name} {emp.surname || ''} ({emp.employeeId || 'ID'}) - {emp.departmentName || 'General'}
                    </Option>
                  ))}
                </Select>
              </div>
            )}
          </Col>
        </Row>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" tip="Loading Document Vault..." />
        </div>
      ) : selectedEmpId ? (
        <EmployeeDocumentVault
          employeeId={selectedEmpId}
          employeeRecord={employeeRecord}
        />
      ) : (
        <Alert
          message="No Employee Selected"
          description="Please select an employee to view their document records."
          type="info"
          showIcon
        />
      )}
    </div>
  );
}

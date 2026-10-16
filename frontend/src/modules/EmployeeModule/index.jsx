import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Breadcrumb, message } from 'antd';
import { HomeOutlined, TeamOutlined } from '@ant-design/icons';
import axios from 'axios';
import { API_BASE_URL } from '@/config/serverApiConfig';
import storePersist from '@/redux/storePersist';

import EmployeeStats from './components/EmployeeStats';
import EmployeeFilterBar from './components/EmployeeFilterBar';
import EmployeeTable from './components/EmployeeTable';
import EmployeeGrid from './components/EmployeeGrid';
import EmployeeProfileDrawer from './components/EmployeeProfileDrawer';
import EmployeeFormDrawer from './components/EmployeeFormDrawer';
import EmployeeStatusModal from './components/EmployeeStatusModal';

const { Title } = Typography;

export default function EmployeeModule() {
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);

  // Pagination & Filtering
  const [pagination, setPagination] = useState({ page: 1, items: 10, count: 0, pages: 1 });
  const [filters, setFilters] = useState({
    q: '',
    department: 'all',
    status: 'all',
    employmentType: 'all',
    workLocation: 'all',
    sortBy: 'created',
    sortValue: -1,
  });

  const [viewMode, setViewMode] = useState('table');

  // Modals & Drawers state
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  // Organization Structure dropdown data
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [locations, setLocations] = useState([]);
  const [managers, setManagers] = useState([]);
  const [projects, setProjects] = useState([]);

  // Auth helper
  const getAuthHeaders = () => {
    const auth = storePersist.get('auth');
    const token = auth?.current?.token;
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  // 1. Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const res = await axios.get(`${API_BASE_URL}employee/summary`, getAuthHeaders());
      if (res.data.success) {
        setStats(res.data.result);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // 2. Fetch Employees
  const fetchEmployees = useCallback(
    async (page = pagination.page, items = pagination.items, currentFilters = filters) => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('items', items);
        if (currentFilters.q) params.append('q', currentFilters.q);
        if (currentFilters.department && currentFilters.department !== 'all')
          params.append('department', currentFilters.department);
        if (currentFilters.status && currentFilters.status !== 'all')
          params.append('status', currentFilters.status);
        if (currentFilters.employmentType && currentFilters.employmentType !== 'all')
          params.append('employmentType', currentFilters.employmentType);
        if (currentFilters.workLocation && currentFilters.workLocation !== 'all')
          params.append('workLocation', currentFilters.workLocation);
        params.append('sortBy', currentFilters.sortBy || 'created');
        params.append('sortValue', currentFilters.sortValue || -1);

        const res = await axios.get(
          `${API_BASE_URL}employee/list?${params.toString()}`,
          getAuthHeaders()
        );

        if (res.data.success) {
          setEmployees(res.data.result || []);
          if (res.data.pagination) {
            setPagination({
              page: res.data.pagination.page,
              items: items,
              count: res.data.pagination.count,
              pages: res.data.pagination.pages,
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch employees:', err);
        message.error('Failed to load employee list');
      } finally {
        setLoading(false);
      }
    },
    [pagination.page, pagination.items, filters]
  );

  // 3. Fetch Organization Structure options
  const fetchOrgStructure = useCallback(async () => {
    try {
      const [deptRes, desigRes, locRes, mgrRes, projRes] = await Promise.all([
        axios.get(`${API_BASE_URL}department/listAll`, getAuthHeaders()).catch(() => ({ data: { result: [] } })),
        axios.get(`${API_BASE_URL}designation/listAll`, getAuthHeaders()).catch(() => ({ data: { result: [] } })),
        axios.get(`${API_BASE_URL}location/listAll`, getAuthHeaders()).catch(() => ({ data: { result: [] } })),
        axios.get(`${API_BASE_URL}employee/listAll`, getAuthHeaders()).catch(() => ({ data: { result: [] } })),
        axios.get(`${API_BASE_URL}project/listAll`, getAuthHeaders()).catch(() => ({ data: { result: [] } })),
      ]);

      setDepartments(deptRes.data.result || []);
      setDesignations(desigRes.data.result || []);
      setLocations(locRes.data.result || []);
      setManagers(mgrRes.data.result || []);
      setProjects(projRes.data.result || []);
    } catch (err) {
      console.error('Failed to fetch organization structure data:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchOrgStructure();
    fetchEmployees(1, 10, filters);
  }, []);

  // Debounced search / filter update
  const handleFilterChange = (key, value) => {
    if (key === 'sort') {
      const updated = { ...filters, sortBy: value.sortBy, sortValue: value.sortValue };
      setFilters(updated);
      fetchEmployees(1, pagination.items, updated);
      return;
    }

    const updated = { ...filters, [key]: value };
    setFilters(updated);
    fetchEmployees(1, pagination.items, updated);
  };

  const handleResetFilters = () => {
    const cleanFilters = {
      q: '',
      department: 'all',
      status: 'all',
      employmentType: 'all',
      workLocation: 'all',
      sortBy: 'created',
      sortValue: -1,
    };
    setFilters(cleanFilters);
    fetchEmployees(1, pagination.items, cleanFilters);
  };

  const handlePageChange = (page, pageSize) => {
    fetchEmployees(page, pageSize, filters);
  };

  // Open Full Profile
  const handleViewProfile = async (emp) => {
    try {
      const res = await axios.get(`${API_BASE_URL}employee/read/${emp._id}`, getAuthHeaders());
      if (res.data.success) {
        setSelectedEmployee(res.data.result);
        setProfileVisible(true);
      } else {
        setSelectedEmployee(emp);
        setProfileVisible(true);
      }
    } catch (e) {
      setSelectedEmployee(emp);
      setProfileVisible(true);
    }
  };

  // Open Edit Form
  const handleEdit = (emp) => {
    setSelectedEmployee(emp);
    setFormVisible(true);
  };

  // Open Add Form
  const handleAddNew = () => {
    setSelectedEmployee(null);
    setFormVisible(true);
  };

  // Open Status Modal
  const handleChangeStatus = (emp) => {
    setSelectedEmployee(emp);
    setStatusModalVisible(true);
  };

  // Delete Employee
  const handleDelete = async (emp) => {
    try {
      const res = await axios.delete(
        `${API_BASE_URL}employee/delete/${emp._id}`,
        getAuthHeaders()
      );
      if (res.data.success) {
        message.success(`Employee ${emp.name} removed successfully.`);
        fetchEmployees(pagination.page, pagination.items, filters);
        fetchStats();
      } else {
        message.error(res.data.message || 'Failed to remove employee');
      }
    } catch (err) {
      message.error('Error removing employee');
    }
  };

  // Create or Update submit
  const handleFormSubmit = async (payload, id) => {
    try {
      setFormSubmitting(true);
      const isMultipart = !!payload.file;

      let res;
      if (id) {
        // UPDATE
        if (isMultipart) {
          const formData = new FormData();
          Object.keys(payload).forEach((k) => {
            if (k === 'file') {
              formData.append('file', payload[k]);
            } else if (typeof payload[k] === 'object' && payload[k] !== null) {
              formData.append(k, JSON.stringify(payload[k]));
            } else if (payload[k] !== undefined && payload[k] !== null) {
              formData.append(k, payload[k]);
            }
          });
          const auth = getAuthHeaders();
          res = await axios.patch(`${API_BASE_URL}employee/update/${id}`, formData, {
            headers: {
              ...auth.headers,
              'Content-Type': 'multipart/form-data',
            },
          });
        } else {
          res = await axios.patch(
            `${API_BASE_URL}employee/update/${id}`,
            payload,
            getAuthHeaders()
          );
        }
      } else {
        // CREATE
        if (isMultipart) {
          const formData = new FormData();
          Object.keys(payload).forEach((k) => {
            if (k === 'file') {
              formData.append('file', payload[k]);
            } else if (typeof payload[k] === 'object' && payload[k] !== null) {
              formData.append(k, JSON.stringify(payload[k]));
            } else if (payload[k] !== undefined && payload[k] !== null) {
              formData.append(k, payload[k]);
            }
          });
          const auth = getAuthHeaders();
          res = await axios.post(`${API_BASE_URL}employee/create`, formData, {
            headers: {
              ...auth.headers,
              'Content-Type': 'multipart/form-data',
            },
          });
        } else {
          res = await axios.post(`${API_BASE_URL}employee/create`, payload, getAuthHeaders());
        }
      }

      if (res.data.success) {
        message.success(
          id ? 'Employee profile updated successfully.' : 'New employee created successfully.'
        );
        setFormVisible(false);
        fetchEmployees(1, pagination.items, filters);
        fetchStats();
        fetchOrgStructure(); // update manager lists if new employee
      } else {
        message.error(res.data.message || 'Operation failed');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error saving employee';
      message.error(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Quick Status change submit
  const handleStatusSubmit = async (id, statusPayload) => {
    try {
      setStatusSubmitting(true);
      const res = await axios.patch(
        `${API_BASE_URL}employee/status/${id}`,
        statusPayload,
        getAuthHeaders()
      );
      if (res.data.success) {
        message.success('Employee status updated.');
        setStatusModalVisible(false);
        fetchEmployees(pagination.page, pagination.items, filters);
        fetchStats();
      } else {
        message.error(res.data.message || 'Failed to update status');
      }
    } catch (err) {
      message.error('Error updating status');
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Photo uploaded callback
  const handlePhotoUploaded = (photoPath) => {
    if (selectedEmployee) {
      setSelectedEmployee({ ...selectedEmployee, photo: photoPath });
    }
    fetchEmployees(pagination.page, pagination.items, filters);
  };

  return (
    <div style={{ padding: '24px 32px', minHeight: '100%', backgroundColor: '#f5f7fa' }}>
      {/* Breadcrumb Header */}
      <div style={{ marginBottom: 20 }}>
        <Breadcrumb
          items={[
            { href: '/', title: <HomeOutlined /> },
            {
              title: (
                <span>
                  <TeamOutlined style={{ marginRight: 6 }} />
                  HR & Workforce
                </span>
              ),
            },
            { title: 'Employee Master' },
          ]}
          style={{ marginBottom: 8 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Title level={2} style={{ margin: 0, fontWeight: 700, color: '#141414' }}>
              Employee Master Directory
            </Title>
            <Typography.Text type="secondary" style={{ fontSize: 14 }}>
              Comprehensive centralized repository for employee profiles, organization mapping, and records.
            </Typography.Text>
          </div>
        </div>
      </div>

      {/* KPI Stats Summary */}
      <EmployeeStats stats={stats} loading={loadingStats} />

      {/* Search, Filter & Controls */}
      <EmployeeFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        onAddNew={handleAddNew}
        onRefresh={() => {
          fetchEmployees(pagination.page, pagination.items, filters);
          fetchStats();
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        departments={departments}
        locations={locations}
        loading={loading}
      />

      {/* Directory Views: Table or Grid */}
      {viewMode === 'table' ? (
        <EmployeeTable
          data={employees}
          pagination={pagination}
          loading={loading}
          onPageChange={handlePageChange}
          onViewProfile={handleViewProfile}
          onEdit={handleEdit}
          onChangeStatus={handleChangeStatus}
          onDelete={handleDelete}
        />
      ) : (
        <EmployeeGrid
          data={employees}
          pagination={pagination}
          loading={loading}
          onPageChange={handlePageChange}
          onViewProfile={handleViewProfile}
          onEdit={handleEdit}
        />
      )}

      {/* 360° Profile Drawer */}
      <EmployeeProfileDrawer
        visible={profileVisible}
        employee={selectedEmployee}
        onClose={() => setProfileVisible(false)}
        onEdit={(emp) => {
          setProfileVisible(false);
          handleEdit(emp);
        }}
        onChangeStatus={(emp) => {
          handleChangeStatus(emp);
        }}
        onPhotoUploaded={handlePhotoUploaded}
      />

      {/* Create & Edit Drawer */}
      <EmployeeFormDrawer
        visible={formVisible}
        employee={selectedEmployee}
        onClose={() => setFormVisible(false)}
        onSubmit={handleFormSubmit}
        loading={formSubmitting}
        departments={departments}
        designations={designations}
        locations={locations}
        managers={managers}
        projects={projects}
      />

      {/* Quick Status Modal */}
      <EmployeeStatusModal
        visible={statusModalVisible}
        employee={selectedEmployee}
        onClose={() => setStatusModalVisible(false)}
        onSubmit={handleStatusSubmit}
        loading={statusSubmitting}
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  Modal,
  Form,
  InputNumber,
  DatePicker,
  Drawer,
  List,
  Avatar,
  Typography,
  Tooltip,
  Divider,
  Statistic,
  Spin,
  Empty,
  Popconfirm,
  message,
} from 'antd';
import {
  DollarOutlined,
  SafetyCertificateOutlined,
  FilePdfOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  BankOutlined,
  CalculatorOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  TeamOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/request';
import { ROLES, normalizeRole } from '@/utils/rbac';
import SalarySlipModal from './SalarySlipModal';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

function formatCurrency(amount) {
  const val = Number(amount || 0);
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SalaryManagement({ userRole, currentAdmin }) {
  const [loading, setLoading] = useState(false);
  const [salaryList, setSalaryList] = useState([]);
  const [summaryStats, setSummaryStats] = useState(null);
  const [employees, setEmployees] = useState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Salary Slip Modal
  const [selectedSalary, setSelectedSalary] = useState(null);
  const [slipModalVisible, setSlipModalVisible] = useState(false);

  // Create / Edit Modal
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Audit Drawer
  const [auditDrawerVisible, setAuditDrawerVisible] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const role = normalizeRole(userRole || currentAdmin?.role);
  const isEmployee = role === ROLES.EMPLOYEE;
  const isAuthorized = [ROLES.ADMIN, ROLES.HR].includes(role);

  // Fetch Salary Records
  const fetchSalaries = async () => {
    try {
      setLoading(true);
      const queryParams = [];
      if (!isEmployee) {
        if (selectedYear && selectedYear !== 'ALL') queryParams.push(`year=${selectedYear}`);
        if (selectedMonth && selectedMonth !== 'ALL') queryParams.push(`month=${selectedMonth}`);
        if (selectedStatus && selectedStatus !== 'ALL') queryParams.push(`status=${selectedStatus}`);
      }

      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const res = await request.list({ entity: `salary/list${queryString}` });

      if (res && res.success) {
        setSalaryList(res.result || []);
        if (res.summary) setSummaryStats(res.summary);
      }
    } catch (err) {
      console.error('Failed to load salary list:', err);
      message.error('Unable to fetch salary records.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Employees for dropdown (Authorized only)
  const fetchEmployees = async () => {
    if (isEmployee) return;
    try {
      const res = await request.list({ entity: 'employee' });
      if (res && res.success) {
        setEmployees(res.result || []);
      }
    } catch (err) {
      console.error('Failed to fetch employees list:', err);
    }
  };

  useEffect(() => {
    fetchSalaries();
    if (!isEmployee) {
      fetchEmployees();
    }
  }, [selectedYear, selectedMonth, selectedStatus]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      year: 2026,
      month: 'October',
      workingDays: 31,
      paidDays: 31,
      lopDays: 0,
      basic: 45000,
      hra: 18000,
      allowances: 8000,
      incentives: 0,
      bonus: 0,
      deductions: 2400,
      professionalTax: 200,
      tds: 3500,
      otherDeductions: 0,
      paymentMode: 'Bank Transfer',
      status: 'Paid',
    });
    setFormModalVisible(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (record) => {
    setEditingRecord(record);
    form.resetFields();
    form.setFieldsValue({
      employee: record.employee?._id || record.employee,
      year: record.year,
      month: record.month,
      workingDays: record.workingDays || 30,
      paidDays: record.paidDays || 30,
      lopDays: record.lopDays || 0,
      basic: record.basic || record.basicSalary || 0,
      hra: record.hra || 0,
      allowances: record.allowances || 0,
      incentives: record.incentives || 0,
      bonus: record.bonus || 0,
      deductions: record.deductions || 0,
      professionalTax: record.professionalTax || 0,
      tds: record.tds || 0,
      otherDeductions: record.otherDeductions || 0,
      paymentMode: record.paymentMode || 'Bank Transfer',
      status: record.status || 'Paid',
      transactionReference: record.transactionReference || '',
      notes: record.notes || '',
    });
    setFormModalVisible(true);
  };

  // Form Submit
  const handleFormSubmit = async (values) => {
    try {
      setSubmitting(true);
      if (editingRecord) {
        const res = await request.patch({
          entity: `salary/update/${editingRecord._id}`,
          jsonData: values,
        });
        if (res && res.success) {
          message.success('Salary record updated successfully.');
          setFormModalVisible(false);
          fetchSalaries();
        } else {
          message.error(res?.message || 'Failed to update salary');
        }
      } else {
        const res = await request.post({
          entity: 'salary/create',
          jsonData: values,
        });
        if (res && res.success) {
          message.success('Salary processed and slip generated successfully!');
          setFormModalVisible(false);
          fetchSalaries();
        } else {
          message.error(res?.message || 'Failed to create salary record');
        }
      }
    } catch (err) {
      message.error('Error submitting salary information.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Salary
  const handleDelete = async (id) => {
    try {
      const res = await request.delete({ entity: `salary/delete/${id}` });
      if (res && res.success) {
        message.success('Salary record removed.');
        fetchSalaries();
      } else {
        message.error(res?.message || 'Failed to delete record');
      }
    } catch (err) {
      message.error('Failed to delete salary record.');
    }
  };

  // Open Audit Drawer
  const handleOpenAudit = async (salaryId) => {
    try {
      setAuditLoading(true);
      setAuditDrawerVisible(true);
      const url = salaryId ? `salary/audit/${salaryId}` : 'salary/audit';
      const res = await request.list({ entity: url });
      if (res && res.success) {
        setAuditLogs(res.result || []);
      }
    } catch (err) {
      message.error('Failed to load audit history.');
    } finally {
      setAuditLoading(false);
    }
  };

  // Filtered List by Search Query
  const filteredList = salaryList.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const name = item.employeeName || (item.employee ? `${item.employee.name} ${item.employee.surname || ''}` : '');
    const code = item.employeeCode || item.employee?.employeeId || '';
    const slip = item.slipNumber || '';
    return name.toLowerCase().includes(q) || code.toLowerCase().includes(q) || slip.toLowerCase().includes(q);
  });

  // Table Columns
  const columns = [
    {
      title: 'Employee',
      key: 'employee',
      render: (_, r) => {
        const name = r.employeeName || (r.employee ? `${r.employee.name} ${r.employee.surname || ''}`.trim() : 'Unknown');
        const code = r.employeeCode || r.employee?.employeeId || 'TM-EMP';
        const dept = r.department || r.employee?.departmentName || 'Engineering';
        const desig = r.designation || r.employee?.designationName || 'Staff';

        return (
          <Space orientation="horizontal" size={10}>
            <Avatar style={{ backgroundColor: '#002244' }} icon={<UserOutlined />} />
            <div>
              <div style={{ fontWeight: 600, color: '#002244' }}>{name}</div>
              <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                <Tag color="geekblue" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>{code}</Tag> • {dept}
              </div>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Period',
      key: 'period',
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 600 }}>{r.month} {r.year}</span>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
            Paid: {r.paidDays || 30} Days {r.lopDays > 0 && <span style={{ color: '#cf1322' }}>• LOP: {r.lopDays}d</span>}
          </div>
        </div>
      ),
    },
    {
      title: 'Gross Earnings',
      key: 'earnings',
      render: (_, r) => (
        <Tooltip
          title={
            <div style={{ fontSize: 12 }}>
              <div>Basic: {formatCurrency(r.basic || r.basicSalary)}</div>
              <div>HRA: {formatCurrency(r.hra)}</div>
              <div>Allowances: {formatCurrency(r.allowances)}</div>
              {r.incentives > 0 && <div>Incentives: {formatCurrency(r.incentives)}</div>}
              {r.bonus > 0 && <div>Bonus: {formatCurrency(r.bonus)}</div>}
            </div>
          }
        >
          <span style={{ color: '#237804', fontWeight: 600, cursor: 'help' }}>
            {formatCurrency(r.totalEarnings)}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Deductions & TDS',
      key: 'deductions',
      render: (_, r) => (
        <Tooltip
          title={
            <div style={{ fontSize: 12 }}>
              <div>PF / Deductions: {formatCurrency(r.deductions)}</div>
              <div>Professional Tax: {formatCurrency(r.professionalTax)}</div>
              <div>TDS: {formatCurrency(r.tds)}</div>
              {r.otherDeductions > 0 && <div>Other: {formatCurrency(r.otherDeductions)}</div>}
            </div>
          }
        >
          <span style={{ color: '#cf1322', fontWeight: 600, cursor: 'help' }}>
            {formatCurrency(r.totalDeductions)}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Net Salary',
      key: 'netSalary',
      render: (_, r) => (
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#002244' }}>
            {formatCurrency(r.netSalary)}
          </span>
          <div style={{ fontSize: 10, color: '#8c8c8c' }}>
            {r.paymentMode || 'Bank Transfer'}
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, r) => {
        const isPaid = String(r.status).toLowerCase() === 'paid';
        return (
          <Tag color={isPaid ? 'success' : 'warning'} style={{ borderRadius: 12, fontWeight: 500 }}>
            {r.status || 'Paid'}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space size={6}>
          <Tooltip title="View Payslip">
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedSalary(r);
                setSlipModalVisible(true);
              }}
              style={{ backgroundColor: '#002244', borderColor: '#002244' }}
            />
          </Tooltip>

          <Tooltip title="Download PDF Slip">
            <Button
              size="small"
              icon={<FilePdfOutlined />}
              onClick={() => window.open(`/api/salary/slip/pdf/${r._id}`, '_blank')}
            />
          </Tooltip>

          {isAuthorized && (
            <>
              <Tooltip title="Audit Trail">
                <Button
                  size="small"
                  icon={<HistoryOutlined />}
                  onClick={() => handleOpenAudit(r._id)}
                />
              </Tooltip>

              <Tooltip title="Edit Salary">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleOpenEditModal(r)}
                />
              </Tooltip>

              <Popconfirm
                title="Delete this salary record?"
                onConfirm={() => handleDelete(r._id)}
                okText="Yes"
                cancelText="No"
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '4px 0 32px 0' }}>
      {/* Hero Banner */}
      <Card
        bordered={false}
        style={{
          background: 'linear-gradient(135deg, #001f3f 0%, #003366 100%)',
          borderRadius: 16,
          color: '#fff',
          marginBottom: 24,
          boxShadow: '0 8px 24px rgba(0, 31, 63, 0.15)',
        }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Space align="center" size={16} orientation="horizontal">
              <Avatar
                size={56}
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#d4af37' }}
                icon={<DollarOutlined style={{ fontSize: 28 }} />}
              />
              <div>
                <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 700 }}>
                  {isEmployee ? 'MY COMPENSATION & SALARY SLIPS' : 'TECMOTIV PAYROLL & SALARY MANAGEMENT'}
                </Title>
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
                  {isEmployee
                    ? 'Review personal earnings, tax deductions, and download official PDF payslips.'
                    : 'Manage corporate compensation structures, monthly payroll processing, and audit trails.'}
                </Text>
              </div>
            </Space>
          </Col>
          <Col xs={24} md={8} orientation="horizontal" style={{ textAlign: 'right' }}>
            {/* wrap keeps the two large header buttons inside this column on
                tablet/mobile instead of forcing the page to scroll sideways. */}
            <Space wrap>
              {isAuthorized && (
                <>
                  <Button
                    size="large"
                    icon={<HistoryOutlined />}
                    onClick={() => handleOpenAudit()}
                    style={{ borderRadius: 8, fontWeight: 600 }}
                  >
                    Global Audit Trail
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlusOutlined />}
                    onClick={handleOpenCreateModal}
                    style={{
                      backgroundColor: '#d4af37',
                      borderColor: '#d4af37',
                      color: '#001f3f',
                      fontWeight: 700,
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(212, 175, 55, 0.35)',
                    }}
                  >
                    Process Salary
                  </Button>
                </>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Top Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title={isEmployee ? 'Total Records' : 'Total Disbursed Payroll'}
              value={isEmployee ? salaryList.length : summaryStats?.totalPayroll || 0}
              prefix={isEmployee ? <SafetyCertificateOutlined style={{ color: '#002244' }} /> : '₹'}
              precision={isEmployee ? 0 : 2}
              valueStyle={{ color: '#002244', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title={isEmployee ? 'Latest Net Pay' : 'Total Basic Disbursed'}
              value={isEmployee ? salaryList[0]?.netSalary || 0 : summaryStats?.totalBasic || 0}
              prefix="₹"
              precision={2}
              valueStyle={{ color: '#237804', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title={isEmployee ? 'Total Allowances' : 'Total Allowances'}
              value={
                isEmployee
                  ? salaryList.reduce((acc, curr) => acc + (curr.allowances || 0), 0)
                  : summaryStats?.totalAllowances || 0
              }
              prefix="₹"
              precision={2}
              valueStyle={{ color: '#1890ff', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <Statistic
              title={isEmployee ? 'Total Taxes / Deductions' : 'Total Deductions & TDS'}
              value={
                isEmployee
                  ? salaryList.reduce((acc, curr) => acc + (curr.totalDeductions || 0), 0)
                  : summaryStats?.totalDeductions || 0
              }
              prefix="₹"
              precision={2}
              valueStyle={{ color: '#cf1322', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content Area */}
      <Card
        bordered={false}
        style={{
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        }}
      >
        {/* Controls Bar */}
        <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} md={10}>
            <Input
              placeholder="Search by Employee, ID, or Slip #..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </Col>
          {!isEmployee && (
            <Col xs={24} md={14} orientation="horizontal" style={{ textAlign: 'right' }}>
              <Space wrap>
                <Select
                  value={selectedYear}
                  onChange={setSelectedYear}
                  style={{ width: 110 }}
                >
                  <Option value="ALL">All Years</Option>
                  <Option value="2026">2026</Option>
                  <Option value="2025">2025</Option>
                </Select>

                <Select
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                  style={{ width: 130 }}
                >
                  <Option value="ALL">All Months</Option>
                  <Option value="October">October</Option>
                  <Option value="September">September</Option>
                  <Option value="August">August</Option>
                  <Option value="July">July</Option>
                </Select>

                <Select
                  value={selectedStatus}
                  onChange={setSelectedStatus}
                  style={{ width: 110 }}
                >
                  <Option value="ALL">All Status</Option>
                  <Option value="Paid">Paid</Option>
                  <Option value="Pending">Pending</Option>
                  <Option value="Processing">Processing</Option>
                </Select>
              </Space>
            </Col>
          )}
        </Row>

        {/* Salaries Table */}
        <Table
          columns={columns}
          dataSource={filteredList}
          rowKey="_id"
          loading={loading}
          // Keeps the wide salary grid inside its container instead of forcing
          // the whole page to scroll horizontally on narrow viewports.
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 8, showTotal: (t) => `Total ${t} records` }}
        />
      </Card>

      {/* Official Salary Slip Viewer Modal */}
      <SalarySlipModal
        visible={slipModalVisible}
        onClose={() => setSlipModalVisible(false)}
        salary={selectedSalary}
      />

      {/* Process / Edit Salary Modal */}
      <Modal
        title={
          <Space>
            <CalculatorOutlined style={{ color: '#002244' }} />
            <span>{editingRecord ? 'Edit Compensation Record' : 'Process Monthly Salary Record'}</span>
          </Space>
        }
        open={formModalVisible}
        onCancel={() => setFormModalVisible(false)}
        footer={null}
        width={740}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="employee"
                label="Select Employee"
                rules={[{ required: true, message: 'Please select an employee' }]}
              >
                <Select
                  showSearch
                  placeholder="Select employee"
                  disabled={Boolean(editingRecord)}
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
            </Col>
            <Col span={6}>
              <Form.Item
                name="month"
                label="Salary Month"
                rules={[{ required: true }]}
              >
                <Select disabled={Boolean(editingRecord)}>
                  <Option value="October">October</Option>
                  <Option value="September">September</Option>
                  <Option value="August">August</Option>
                  <Option value="July">July</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="year"
                label="Salary Year"
                rules={[{ required: true }]}
              >
                <Select disabled={Boolean(editingRecord)}>
                  <Option value={2026}>2026</Option>
                  <Option value={2025}>2025</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '12px 0 16px 0', fontSize: 13, color: '#002244' }}>
            <span style={{ fontWeight: 700 }}>EARNINGS STRUCTURE</span>
          </Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="basic" label="Basic Salary (₹)" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="hra" label="HRA (₹)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="allowances" label="Allowances (₹)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="incentives" label="Performance Incentives (₹)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bonus" label="Bonus & Ex-Gratia (₹)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '12px 0 16px 0', fontSize: 13, color: '#cf1322' }}>
            <span style={{ fontWeight: 700 }}>DEDUCTIONS STRUCTURE</span>
          </Divider>

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="professionalTax" label="Professional Tax (₹)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="tds" label="TDS / Income Tax (₹)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="deductions" label="PF / Deductions (₹)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="otherDeductions" label="Other Deductions (₹)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '12px 0 16px 0', fontSize: 13, color: '#002244' }}>
            <span style={{ fontWeight: 700 }}>DISBURSEMENT DETAILS</span>
          </Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="paymentMode" label="Payment Mode">
                <Select>
                  <Option value="Bank Transfer">Bank Transfer</Option>
                  <Option value="NEFT">NEFT</Option>
                  <Option value="RTGS">RTGS</Option>
                  <Option value="IMPS">IMPS</Option>
                  <Option value="Cheque">Cheque</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="Disbursement Status">
                <Select>
                  <Option value="Paid">Paid</Option>
                  <Option value="Pending">Pending</Option>
                  <Option value="Processing">Processing</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="transactionReference" label="UTR / Ref ID">
                <Input placeholder="e.g. UTR-TM-202610-098" />
              </Form.Item>
            </Col>
          </Row>

          {/* Dynamic Net Salary Preview */}
          <Form.Item shouldUpdate noStyle>
            {({ getFieldsValue }) => {
              const vals = getFieldsValue();
              const b = Number(vals.basic || 0);
              const h = Number(vals.hra || 0);
              const al = Number(vals.allowances || 0);
              const inc = Number(vals.incentives || 0);
              const bn = Number(vals.bonus || 0);
              const gross = b + h + al + inc + bn;

              const pt = Number(vals.professionalTax || 0);
              const tds = Number(vals.tds || 0);
              const ded = Number(vals.deductions || 0);
              const od = Number(vals.otherDeductions || 0);
              const totalDed = pt + tds + ded + od;

              const net = Math.max(0, gross - totalDed);

              return (
                <div
                  style={{
                    background: '#f8fbff',
                    border: '1.5px solid #002244',
                    padding: '12px 16px',
                    borderRadius: 8,
                    marginBottom: 20,
                  }}
                >
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Gross Earnings: {formatCurrency(gross)} • Deductions: {formatCurrency(totalDed)}
                      </Text>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#002244' }}>
                        CALCULATED NET SALARY:
                      </div>
                    </Col>
                    <Col>
                      <span style={{ fontSize: 22, fontWeight: 800, color: '#002244' }}>
                        {formatCurrency(net)}
                      </span>
                    </Col>
                  </Row>
                </div>
              );
            }}
          </Form.Item>

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setFormModalVisible(false)}>Cancel</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                style={{ backgroundColor: '#002244', borderColor: '#002244' }}
              >
                {editingRecord ? 'Save Changes' : 'Confirm & Generate Slip'}
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* Salary Audit Trail Drawer */}
      <Drawer
        title={
          <Space>
            <HistoryOutlined style={{ color: '#002244' }} />
            <span>Salary Audit Trail & Changes</span>
          </Space>
        }
        placement="right"
        width={560}
        open={auditDrawerVisible}
        onClose={() => setAuditDrawerVisible(false)}
      >
        {auditLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        ) : auditLogs.length === 0 ? (
          <Empty description="No audit log entries found." />
        ) : (
          <List
            itemLayout="vertical"
            dataSource={auditLogs}
            renderItem={(item) => (
              <List.Item
                style={{
                  background: '#fafafa',
                  border: '1px solid #f0f0f0',
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Tag
                    color={
                      item.action === 'CREATED'
                        ? 'green'
                        : item.action === 'UPDATED'
                        ? 'blue'
                        : item.action === 'DELETED'
                        ? 'red'
                        : 'purple'
                    }
                    style={{ fontWeight: 600 }}
                  >
                    {item.action}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {dayjs(item.timestamp).format('DD MMM YYYY, h:mm A')}
                  </Text>
                </div>
                <div style={{ fontWeight: 600, color: '#002244', fontSize: 13 }}>
                  {item.employeeName} ({item.periodLabel})
                </div>
                <Paragraph style={{ margin: '6px 0', fontSize: 12, color: '#595959' }}>
                  {item.details}
                </Paragraph>
                <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                  Logged by: <strong>{item.performedByName}</strong> ({item.performedByRole})
                </div>
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </div>
  );
}

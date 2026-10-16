import React, { useEffect, useState } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Row,
  Col,
  Tabs,
  Upload,
  message,
  Divider,
} from 'antd';
import {
  UploadOutlined,
  ReloadOutlined,
  UserOutlined,
  ApartmentOutlined,
  BookOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

export default function EmployeeFormDrawer({
  visible,
  employee,
  onClose,
  onSubmit,
  loading = false,
  departments = [],
  designations = [],
  locations = [],
  managers = [],
  projects = [],
}) {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('basic');
  const [photoFileList, setPhotoFileList] = useState([]);
  const isEdit = !!employee?._id;

  // Populate form on open
  useEffect(() => {
    if (visible) {
      if (employee) {
        form.setFieldsValue({
          employeeId: employee.employeeId,
          name: employee.name,
          surname: employee.surname,
          gender: employee.gender || 'Prefer not to say',
          birthDate: employee.birthDate ? dayjs(employee.birthDate) : null,
          phone: employee.phone,
          personalEmail: employee.personalEmail,
          email: employee.email,
          address: employee.address,
          emergencyContactName: employee.emergencyContact?.name,
          emergencyContactPhone: employee.emergencyContact?.phone,
          emergencyContactRel: employee.emergencyContact?.relationship,

          // Employment
          joiningDate: employee.joiningDate ? dayjs(employee.joiningDate) : dayjs(),
          department: employee.department?._id || employee.department || employee.departmentName,
          designation: employee.designation?._id || employee.designation || employee.designationName,
          reportingManager: employee.reportingManager?._id || employee.reportingManager,
          employmentType: employee.employmentType || 'Full Time',
          probationPeriod: employee.probationPeriod || '3 Months',
          confirmationDate: employee.confirmationDate ? dayjs(employee.confirmationDate) : null,
          workLocation: employee.workLocation?._id || employee.workLocation || employee.workLocationName,
          status: employee.status || 'Active',

          // Professional
          skills: employee.skills || [],
          areasOfExpertise: employee.areasOfExpertise || [],
          experience: employee.experience,
          linkedin: employee.linkedin,
          qualifications: employee.qualifications || [],
          certifications: employee.certifications || [],
          assignedProjects: (employee.assignedProjects || []).map((p) => p?._id || p),
          currentResponsibilities: employee.currentResponsibilities,
        });
      } else {
        form.resetFields();
        const randId = `TM-${Math.floor(1000 + Math.random() * 9000)}`;
        form.setFieldsValue({
          employeeId: randId,
          employmentType: 'Full Time',
          status: 'Active',
          probationPeriod: '3 Months',
          joiningDate: dayjs(),
          gender: 'Prefer not to say',
        });
      }
      setPhotoFileList([]);
      setActiveTab('basic');
    }
  }, [visible, employee, form]);

  const handleFinish = (values) => {
    const payload = {
      ...values,
      birthDate: values.birthDate ? values.birthDate.toISOString() : null,
      joiningDate: values.joiningDate ? values.joiningDate.toISOString() : null,
      confirmationDate: values.confirmationDate ? values.confirmationDate.toISOString() : null,
      emergencyContact: {
        name: values.emergencyContactName || '',
        phone: values.emergencyContactPhone || '',
        relationship: values.emergencyContactRel || '',
      },
    };

    delete payload.emergencyContactName;
    delete payload.emergencyContactPhone;
    delete payload.emergencyContactRel;

    // Attach uploaded file if any
    if (photoFileList.length > 0 && photoFileList[0].originFileObj) {
      payload.file = photoFileList[0].originFileObj;
    }

    onSubmit(payload, isEdit ? employee._id : null);
  };

  const generateNewId = () => {
    const randId = `TM-${Math.floor(1000 + Math.random() * 9000)}`;
    form.setFieldsValue({ employeeId: randId });
  };

  return (
    <Drawer
      title={isEdit ? `Edit Employee (${employee?.employeeId})` : 'Create New Employee Master'}
      placement="right"
      width={780}
      onClose={onClose}
      open={visible}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={loading} onClick={() => form.submit()}>
            {isEdit ? 'Update Employee' : 'Create Employee'}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            // ==========================================
            // TAB 1: BASIC DETAILS
            // ==========================================
            {
              key: 'basic',
              label: (
                <span>
                  <UserOutlined /> Basic Information
                </span>
              ),
              children: (
                <div>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="employeeId"
                        label="Employee ID"
                        tooltip="Auto-generated if left blank"
                      >
                        <Input
                          placeholder="e.g. TM-1001"
                          suffix={
                            !isEdit && (
                              <Button
                                type="text"
                                size="small"
                                icon={<ReloadOutlined />}
                                onClick={generateNewId}
                                title="Generate ID"
                              />
                            )
                          }
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="gender"
                        label="Gender"
                      >
                        <Select placeholder="Select gender">
                          <Option value="Male">Male</Option>
                          <Option value="Female">Female</Option>
                          <Option value="Non-Binary">Non-Binary</Option>
                          <Option value="Other">Other</Option>
                          <Option value="Prefer not to say">Prefer not to say</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="name"
                        label="First Name"
                        rules={[{ required: true, message: 'First name is required' }]}
                      >
                        <Input placeholder="e.g. Alexander" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="surname" label="Last Name / Surname">
                        <Input placeholder="e.g. Vance" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="email"
                        label="Official Company Email"
                        rules={[
                          { required: true, message: 'Official email is required' },
                          { type: 'email', message: 'Enter a valid email' },
                        ]}
                      >
                        <Input placeholder="e.g. alex.vance@tecmotiv.com" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="personalEmail"
                        label="Personal Email"
                        rules={[{ type: 'email', message: 'Enter a valid email' }]}
                      >
                        <Input placeholder="e.g. alex.personal@gmail.com" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="loginPassword"
                        label="Initial Login Password"
                        tooltip="Defaults to admin123 if left empty. The employee will use this password and their Official Company Email to log in."
                      >
                        <Input.Password placeholder="Default: admin123 (Optional)" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="phone" label="Mobile Phone">
                        <Input placeholder="e.g. +1-555-0199" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="birthDate" label="Date of Birth">
                        <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item name="address" label="Residential Address">
                    <TextArea rows={2} placeholder="Full residential street, city, state, postal code" />
                  </Form.Item>

                  <Divider orientation="left" style={{ margin: '16px 0 12px 0', fontSize: 13 }}>
                    Emergency Contact
                  </Divider>

                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="emergencyContactName" label="Contact Name">
                        <Input placeholder="e.g. Sarah Vance" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="emergencyContactRel" label="Relationship">
                        <Input placeholder="e.g. Spouse / Sibling / Parent" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="emergencyContactPhone" label="Contact Phone">
                        <Input placeholder="e.g. +1-555-9088" />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* Photo Upload */}
                  <Divider orientation="left" style={{ margin: '16px 0 12px 0', fontSize: 13 }}>
                    Profile Photo
                  </Divider>
                  <Form.Item label="Upload Profile Photo">
                    <Upload
                      beforeUpload={(file) => {
                        setPhotoFileList([file]);
                        return false;
                      }}
                      fileList={photoFileList}
                      onRemove={() => setPhotoFileList([])}
                      maxCount={1}
                      accept="image/*"
                    >
                      <Button icon={<UploadOutlined />}>Select Photo (JPG / PNG)</Button>
                    </Upload>
                  </Form.Item>
                </div>
              ),
            },

            // ==========================================
            // TAB 2: EMPLOYMENT & ORG STRUCTURE
            // ==========================================
            {
              key: 'employment',
              label: (
                <span>
                  <ApartmentOutlined /> Employment & Org
                </span>
              ),
              children: (
                <div>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="joiningDate"
                        label="Date of Joining"
                      >
                        <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="employmentType"
                        label="Employment Type"
                      >
                        <Select placeholder="Select type (e.g. Full Time)" allowClear>
                          <Option value="Full Time">Full Time</Option>
                          <Option value="Part Time">Part Time</Option>
                          <Option value="Intern">Intern</Option>
                          <Option value="Consultant">Consultant</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="department"
                        label="Department"
                      >
                        <Select placeholder="Select Department (Optional)" allowClear showSearch optionFilterProp="children">
                          {departments.map((d) => (
                            <Option key={d._id} value={d._id}>
                              {d.name} ({d.code || 'DEPT'})
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="designation"
                        label="Designation / Role"
                      >
                        <Select placeholder="Select Designation (Optional)" allowClear showSearch optionFilterProp="children">
                          {designations.map((dg) => (
                            <Option key={dg._id} value={dg._id}>
                              {dg.name} {dg.level ? `(${dg.level})` : ''}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="reportingManager" label="Reporting Manager">
                        <Select
                          placeholder="Select Manager"
                          allowClear
                          showSearch
                          optionFilterProp="children"
                        >
                          {managers
                            .filter((m) => !isEdit || m._id !== employee?._id)
                            .map((m) => (
                              <Option key={m._id} value={m._id}>
                                {`${m.name || ''} ${m.surname || ''}`.trim()} ({m.employeeId})
                              </Option>
                            ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="workLocation" label="Work Location">
                        <Select placeholder="Select Location" showSearch optionFilterProp="children">
                          {locations.map((loc) => (
                            <Option key={loc._id} value={loc._id}>
                              {loc.name} ({loc.type || 'Office'})
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="probationPeriod" label="Probation Period">
                        <Select placeholder="Probation">
                          <Option value="None">None</Option>
                          <Option value="1 Month">1 Month</Option>
                          <Option value="3 Months">3 Months</Option>
                          <Option value="6 Months">6 Months</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="confirmationDate" label="Confirmation Date">
                        <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="status" label="Current Status">
                        <Select placeholder="Status">
                          <Option value="Active">Active</Option>
                          <Option value="Probation">Probation</Option>
                          <Option value="On Notice">On Notice</Option>
                          <Option value="On Leave">On Leave</Option>
                          <Option value="Resigned">Resigned</Option>
                          <Option value="Terminated">Terminated</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              ),
            },

            // ==========================================
            // TAB 3: PROFESSIONAL & EXPERTISE
            // ==========================================
            {
              key: 'professional',
              label: (
                <span>
                  <BookOutlined /> Professional Profile
                </span>
              ),
              children: (
                <div>
                  <Form.Item
                    name="skills"
                    label="Technical Skills & Competencies"
                    tooltip="Type and hit Enter to add individual skills"
                  >
                    <Select
                      mode="tags"
                      style={{ width: '100%' }}
                      placeholder="e.g. React, Node.js, Python, AWS, Docker"
                      tokenSeparators={[',']}
                    />
                  </Form.Item>

                  <Form.Item
                    name="areasOfExpertise"
                    label="Areas of Expertise"
                    tooltip="Core domain expertise"
                  >
                    <Select
                      mode="tags"
                      style={{ width: '100%' }}
                      placeholder="e.g. Cloud Architecture, Data Engineering, UI/UX"
                      tokenSeparators={[',']}
                    />
                  </Form.Item>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="experience" label="Total Work Experience">
                        <Input placeholder="e.g. 5 Years or 8+ Years" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="linkedin" label="LinkedIn Profile URL">
                        <Input placeholder="https://linkedin.com/in/username" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="qualifications"
                    label="Educational Qualifications"
                    tooltip="Degrees and educational backgrounds"
                  >
                    <Select
                      mode="tags"
                      style={{ width: '100%' }}
                      placeholder="e.g. B.Tech Computer Science, MBA"
                      tokenSeparators={[',']}
                    />
                  </Form.Item>

                  <Form.Item
                    name="certifications"
                    label="Certifications & Accreditations"
                  >
                    <Select
                      mode="tags"
                      style={{ width: '100%' }}
                      placeholder="e.g. AWS Solutions Architect, PMP, Scrum Master"
                      tokenSeparators={[',']}
                    />
                  </Form.Item>

                  <Form.Item name="assignedProjects" label="Assigned Projects">
                    <Select
                      mode="multiple"
                      style={{ width: '100%' }}
                      placeholder="Select ongoing projects"
                      optionFilterProp="children"
                    >
                      {projects.map((p) => (
                        <Option key={p._id} value={p._id}>
                          {p.name} ({p.code || 'PRJ'})
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item name="currentResponsibilities" label="Current Responsibilities">
                    <TextArea
                      rows={3}
                      placeholder="Summarize daily scope of work, key deliverables, and deliverables..."
                    />
                  </Form.Item>
                </div>
              ),
            },
          ]}
        />
      </Form>
    </Drawer>
  );
}

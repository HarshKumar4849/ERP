import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Select,
  Typography,
  Row,
  Col,
  message,
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
} from '@ant-design/icons';
import AuthModule from '@/modules/AuthModule';
import { register as registerApi } from '@/auth/auth.service';

const { Text, Paragraph } = Typography;
const { Option } = Select;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // Submit Registration & Auto-Login immediately
  const handleRegisterFinish = async (values) => {
    try {
      setLoading(true);
      const res = await registerApi({
        registerData: {
          name: values.name.trim(),
          surname: values.surname ? values.surname.trim() : '',
          email: values.email.trim().toLowerCase(),
          password: values.password,
          department: values.department || 'General',
          role: 'EMPLOYEE',
        },
      });

      if (res && res.success) {
        message.success('Account created successfully! Please sign in with your credentials.');
        navigate('/login');
      } else {
        message.error(res?.message || 'Registration failed. Please check your details.');
      }
    } catch (err) {
      console.error('Registration failed:', err);
      message.error(err?.response?.data?.message || err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderRegistrationFormContent = () => (
    <div>
      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
        Create your employee profile with Tecmotiv ERP. Your account will be activated immediately.
      </Paragraph>

      <Form
        form={form}
        layout="vertical"
        name="employee_register"
        onFinish={handleRegisterFinish}
        initialValues={{
          department: 'Engineering',
          role: 'EMPLOYEE',
        }}
      >
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              label="First Name"
              name="name"
              rules={[{ required: true, message: 'Please enter your first name' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#8c8c8c' }} />}
                placeholder="First Name"
                size="large"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Last Name" name="surname">
              <Input placeholder="Last Name" size="large" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="Work / Personal Email"
          name="email"
          rules={[
            { required: true, message: 'Please enter your email' },
            { type: 'email', message: 'Please enter a valid email address' },
          ]}
        >
          <Input
            prefix={<MailOutlined style={{ color: '#8c8c8c' }} />}
            placeholder="e.g. employee@tecmotiv.com"
            size="large"
            type="email"
          />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Account Position / Role" name="role">
              <Select size="large" disabled>
                <Option value="EMPLOYEE">Employee (Staff)</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Department"
              name="department"
              rules={[{ required: true, message: 'Please select a department' }]}
            >
              <Select size="large" placeholder="Select Department">
                <Option value="Engineering">Engineering</Option>
                <Option value="Design">Design</Option>
                <Option value="Marketing">Marketing</Option>
                <Option value="Sales">Sales</Option>
                <Option value="Operations">Operations</Option>
                <Option value="Finance">Finance</Option>
                <Option value="Human Resources">Human Resources</Option>
                <Option value="General">General</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="Password"
          name="password"
          rules={[
            { required: true, message: 'Please enter a password' },
            { min: 6, message: 'Password must be at least 6 characters' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
            placeholder="Enter secure password"
            size="large"
          />
        </Form.Item>

        <Form.Item
          label="Confirm Password"
          name="confirmPassword"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Please confirm your password' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('The two passwords do not match'));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
            placeholder="Re-enter password"
            size="large"
          />
        </Form.Item>

        <Form.Item style={{ marginTop: 12 }}>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            block
            loading={loading}
            style={{
              backgroundColor: '#002244',
              borderColor: '#002244',
              borderRadius: 6,
              height: 44,
              fontWeight: 600,
            }}
          >
            Create Account
          </Button>
        </Form.Item>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary">Already have an account? </Text>
          <Link to="/login" style={{ color: '#1677ff', fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </Form>
    </div>
  );

  return (
    <AuthModule
      AUTH_TITLE="Register as Employee"
      isForRegistre={true}
      authContent={renderRegistrationFormContent()}
    />
  );
}

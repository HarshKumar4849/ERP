import React, { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Select,
  Typography,
  Space,
  Row,
  Col,
  message,
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import useLanguage from '@/locale/useLanguage';
import AuthModule from '@/modules/AuthModule';
import { register as registerApi, resendOtp as resendOtpApi } from '@/auth/auth.service';
import { verifyOtpLogin } from '@/redux/auth/actions';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export default function RegisterPage() {
  const translate = useLanguage();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Load pending email from sessionStorage if available
  const savedEmail = sessionStorage.getItem('pendingOtpEmail') || '';
  const initialStep = savedEmail ? 2 : 1;

  const [step, setStep] = useState(initialStep); // 1 = Registration form, 2 = OTP verification
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState(savedEmail);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // 6 separate OTP digits
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const digitInputRefs = useRef([]);

  const [form] = Form.useForm();

  // Focus first OTP input when step 2 opens
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => {
        if (digitInputRefs.current[0]) {
          digitInputRefs.current[0].focus();
        }
      }, 150);
    }
  }, [step]);

  // Countdown timer for resend OTP
  useEffect(() => {
    let timer;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  // Handle digit input change
  const handleDigitChange = (val, index) => {
    const digitsOnly = val.replace(/\D/g, '');
    if (!digitsOnly) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    if (digitsOnly.length === 2 && otpDigits[index]) {
      // User typed a digit into a box that already had a digit
      const newChar = digitsOnly[0] === otpDigits[index] ? digitsOnly[1] : digitsOnly[0];
      const newDigits = [...otpDigits];
      newDigits[index] = newChar;
      setOtpDigits(newDigits);
      if (index < 5 && digitInputRefs.current[index + 1]) {
        digitInputRefs.current[index + 1].focus();
      }
      return;
    }

    if (digitsOnly.length > 1) {
      // User typed or pasted multiple digits directly into the box
      const newDigits = [...otpDigits];
      for (let i = 0; i < digitsOnly.length && index + i < 6; i++) {
        newDigits[index + i] = digitsOnly[i];
      }
      setOtpDigits(newDigits);
      const nextFocus = Math.min(index + digitsOnly.length, 5);
      if (digitInputRefs.current[nextFocus]) {
        digitInputRefs.current[nextFocus].focus();
      }
      return;
    }

    // Single digit entered
    const newDigits = [...otpDigits];
    newDigits[index] = digitsOnly;
    setOtpDigits(newDigits);

    // Auto advance to next box
    if (index < 5 && digitInputRefs.current[index + 1]) {
      digitInputRefs.current[index + 1].focus();
    }
  };

  // Handle backspace and arrow navigation
  const handleDigitKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        // Move to previous box and clear it
        e.preventDefault();
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        if (digitInputRefs.current[index - 1]) {
          digitInputRefs.current[index - 1].focus();
        }
      } else {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle pasting full 6-digit code
  const handleDigitPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/\D/g, '');
    if (pastedData) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pastedData[i] || '';
      }
      setOtpDigits(newDigits);
      const nextFocus = Math.min(pastedData.length, 5);
      digitInputRefs.current[nextFocus]?.focus();
    }
  };

  // Handle direct continuous 6-digit input
  const handleSingleOtpChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 6);
    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < raw.length; i++) {
      newDigits[i] = raw[i];
    }
    setOtpDigits(newDigits);
  };

  // Step 1: Submit Registration
  const handleRegisterFinish = async (values) => {
    try {
      setLoading(true);
      const res = await registerApi({
        registerData: {
          name: values.name,
          surname: values.surname || '',
          email: values.email,
          password: values.password,
          department: values.department || 'General',
          role: 'EMPLOYEE',
        },
      });

      if (res && res.success) {
        setRegisteredEmail(values.email);
        sessionStorage.setItem('pendingOtpEmail', values.email);
        setStep(2);
        setOtpDigits(['', '', '', '', '', '']);
        setCountdown(60);
        setCanResend(false);
        message.success('Verification code has been sent to your email.');
      }
    } catch (err) {
      console.error('Registration failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit OTP Verification
  const handleVerifyOtpSubmit = async (e) => {
    if (e) e.preventDefault();
    const fullOtp = otpDigits.join('').trim();
    if (fullOtp.length !== 6) {
      message.error('Please enter the complete 6-digit verification code.');
      return;
    }

    try {
      setLoading(true);
      const res = await dispatch(
        verifyOtpLogin({
          email: registeredEmail,
          otp: fullOtp,
        })
      );

      if (res && res.success) {
        sessionStorage.removeItem('pendingOtpEmail');
        message.success('Account successfully verified! Welcome to TecMotiv ERP.');
        navigate('/');
      }
    } catch (err) {
      console.error('OTP verification failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (!canResend || !registeredEmail) return;
    try {
      setResending(true);
      const res = await resendOtpApi({ email: registeredEmail });
      if (res && res.success) {
        message.success('A new 6-digit verification code was sent to your email.');
        setCountdown(60);
        setCanResend(false);
        setOtpDigits(['', '', '', '', '', '']);
        digitInputRefs.current[0]?.focus();
      }
    } catch (err) {
      console.error('Failed to resend code:', err);
    } finally {
      setResending(false);
    }
  };

  const renderRegistrationFormContent = () => (
    <div>
      <Paragraph type="secondary" style={{ marginBottom: 20 }}>
        Register your employee profile with TecMotiv ERP. A 6-digit confirmation code will be sent to your email.
      </Paragraph>

      <Form
        form={form}
        layout="vertical"
        name="employee_register"
        onFinish={handleRegisterFinish}
        initialValues={{
          department: 'Engineering',
          role: 'EMPLOYEE',
          email: registeredEmail || '',
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
            Create Account & Send Code
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

  const renderOtpVerificationContent = () => (
    <div>
      <div
        style={{
          background: '#f0f5ff',
          border: '1px solid #adc6ff',
          borderRadius: 8,
          padding: '16px 20px',
          marginBottom: 20,
          textAlign: 'center',
        }}
      >
        <MailOutlined style={{ fontSize: 28, color: '#2f54eb', marginBottom: 8 }} />
        <Title level={5} style={{ margin: '0 0 6px 0', color: '#10239e' }}>
          Verification Code Sent
        </Title>
        <Text style={{ color: '#595959', fontSize: 14 }}>
          We've sent a 6-digit confirmation code to:
        </Text>
        <br />
        <Text strong style={{ color: '#002244', fontSize: 15 }}>
          {registeredEmail}
        </Text>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Enter the 6-digit code received on your email below:
        </Text>
      </div>

      {/* 6 Individual Digit Boxes */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          margin: '16px 0 24px 0',
        }}
        onPaste={handleDigitPaste}
      >
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <input
            key={index}
            ref={(el) => (digitInputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otpDigits[index]}
            onFocus={(e) => e.target.select()}
            onChange={(e) => handleDigitChange(e.target.value, index)}
            onKeyDown={(e) => handleDigitKeyDown(e, index)}
            style={{
              width: '46px',
              height: '54px',
              textAlign: 'center',
              fontSize: '24px',
              fontWeight: 700,
              fontFamily: 'monospace',
              borderRadius: '8px',
              border: '2px solid ' + (otpDigits[index] ? '#1677ff' : '#d9d9d9'),
              backgroundColor: otpDigits[index] ? '#f0f5ff' : '#ffffff',
              color: '#002244',
              outline: 'none',
              boxShadow: otpDigits[index] ? '0 0 0 2px rgba(22, 119, 255, 0.15)' : 'none',
              transition: 'all 0.2s ease',
            }}
          />
        ))}
      </div>

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          Or enter / paste complete 6-digit code here:
        </Text>
        <Input
          size="middle"
          maxLength={6}
          placeholder="e.g. 123456"
          value={otpDigits.join('')}
          onChange={handleSingleOtpChange}
          style={{
            maxWidth: 200,
            textAlign: 'center',
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: 4,
            borderRadius: 6,
          }}
        />
      </div>

      <Button
        type="primary"
        onClick={handleVerifyOtpSubmit}
        size="large"
        block
        loading={loading}
        icon={<CheckCircleOutlined />}
        disabled={otpDigits.join('').trim().length !== 6}
        style={{
          backgroundColor: '#002244',
          borderColor: '#002244',
          borderRadius: 6,
          height: 46,
          fontWeight: 600,
        }}
      >
        Verify & Sign In
      </Button>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 18,
        }}
      >
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            sessionStorage.removeItem('pendingOtpEmail');
            setStep(1);
          }}
          style={{ padding: 0 }}
        >
          Change Email / Back
        </Button>

        {canResend ? (
          <Button
            type="link"
            icon={<ReloadOutlined />}
            onClick={handleResendOtp}
            loading={resending}
            style={{ padding: 0, fontWeight: 600 }}
          >
            Resend Code
          </Button>
        ) : (
          <Text type="secondary" style={{ fontSize: 13 }}>
            Resend in <Text strong>{countdown}s</Text>
          </Text>
        )}
      </div>
    </div>
  );

  return (
    <AuthModule
      AUTH_TITLE={step === 1 ? 'Register as Employee' : 'Email Verification'}
      isForRegistre={true}
      authContent={step === 1 ? renderRegistrationFormContent() : renderOtpVerificationContent()}
    />
  );
}

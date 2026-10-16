import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import { Form, Result, Button, Typography } from 'antd';
import useOnFetch from '@/hooks/useOnFetch';
import { request } from '@/request';

import ForgetPasswordForm from '@/forms/ForgetPasswordForm';

import useLanguage from '@/locale/useLanguage';

import Loading from '@/components/Loading';
import AuthModule from '@/modules/AuthModule';

const { Text } = Typography;

const ForgetPassword = () => {
  const translate = useLanguage();
  const [requestedEmail, setRequestedEmail] = useState('');

  const navigate = useNavigate();

  const { onFetch, result, isSuccess, isLoading } = useOnFetch();

  async function postData(data) {
    return await request.post({ entity: 'forgetpassword', jsonData: data });
  }

  const onFinish = (values) => {
    if (values?.email) setRequestedEmail(values.email);
    const callback = postData(values);
    onFetch(callback);
  };

  const FormContainer = () => {
    return (
      <Loading isLoading={isLoading}>
        <Form
          name="signup"
          className="login-form"
          initialValues={{
            remember: true,
          }}
          onFinish={onFinish}
        >
          <ForgetPasswordForm />
          <Form.Item>
            <Button type="primary" htmlType="submit" className="login-form-button" size="large">
              {translate('Request new Password')}
            </Button>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
              <Link to="/login">{translate('already have account Login')}</Link>
              <Link to="/resetpassword" style={{ fontWeight: 500 }}>
                {translate('Reset password')}
              </Link>
            </div>
          </Form.Item>
        </Form>
      </Loading>
    );
  };
  if (!isSuccess) {
    return <AuthModule authContent={<FormContainer />} AUTH_TITLE="Forget Password" />;
  } else {
    return (
      <Result
        status="success"
        title="Password Reset Verification Code Ready"
        subTitle={
          <div>
            <p>
              {result?.emailSent
                ? 'A verification code and reset link have been dispatched to your email address.'
                : 'Your secure verification code has been generated.'}
            </p>
            {result?.verificationCode && (
              <div
                style={{
                  margin: '16px auto',
                  padding: '16px 24px',
                  background: '#f6ffed',
                  border: '1px solid #b7eb8f',
                  borderRadius: '8px',
                  maxWidth: '340px',
                }}
              >
                <Text type="secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '13px' }}>
                  6-Digit Verification Code:
                </Text>
                <div
                  style={{
                    fontSize: '28px',
                    fontWeight: 700,
                    letterSpacing: '6px',
                    color: '#237804',
                    fontFamily: 'monospace',
                  }}
                >
                  {result.verificationCode}
                </div>
              </div>
            )}
          </div>
        }
        style={{ maxWidth: '480px', margin: 'auto' }}
        extra={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Button
              type="primary"
              size="large"
              onClick={() => {
                navigate(`/resetpassword?email=${encodeURIComponent(requestedEmail)}&token=${result?.verificationCode || ''}`, {
                  state: { email: requestedEmail, resetToken: result?.verificationCode || '' },
                });
              }}
            >
              Enter Code & Set New Password
            </Button>
            <Button
              onClick={() => {
                navigate(`/login`);
              }}
            >
              {translate('Back to Login')}
            </Button>
          </div>
        }
      ></Result>
    );
  }
};

export default ForgetPassword;

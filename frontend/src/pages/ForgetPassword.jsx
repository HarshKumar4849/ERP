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

  const { onFetch, isSuccess, isLoading } = useOnFetch();

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
        title={translate('Check your email address to reset your password')}
        subTitle={translate('A password reset link and verification code have been dispatched to your email address.')}
        style={{ maxWidth: '450px', margin: 'auto' }}
        extra={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Button
              type="primary"
              size="large"
              onClick={() => {
                navigate(`/resetpassword?email=${encodeURIComponent(requestedEmail)}`, {
                  state: { email: requestedEmail },
                });
              }}
            >
              {translate('Enter Verification Code & Set New Password')}
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

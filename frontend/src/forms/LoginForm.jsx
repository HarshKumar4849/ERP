import React from 'react';
import { Form, Input, Checkbox } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

import useLanguage from '@/locale/useLanguage';

export default function LoginForm() {
  const translate = useLanguage();
  return (
    <div>
      <Form.Item
        label={translate('email')}
        name="email"
        rules={[
          {
            required: true,
          },
          {
            type: 'email',
          },
        ]}
      >
        <Input
          prefix={<UserOutlined className="site-form-item-icon" />}
          placeholder={'admin@admin.com'}
          type="email"
          size="large"
        />
      </Form.Item>
      <Form.Item
        label={translate('password')}
        name="password"
        rules={[
          {
            required: true,
          },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined className="site-form-item-icon" />}
          placeholder={'admin123'}
          size="large"
        />
      </Form.Item>

      <Form.Item>
        <Form.Item name="remember" valuePropName="checked" noStyle>
          <Checkbox>{translate('Remember me')}</Checkbox>
        </Form.Item>
        <Link className="login-form-forgot" to="/forgetpassword" style={{ marginLeft: '0px' }}>
          {translate('Forgot password')}
        </Link>
      </Form.Item>

      <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid #f0f0f0' }}>
        <span style={{ color: '#767676', fontSize: 13 }}>New employee? </span>
        <Link to="/register" style={{ color: '#1677ff', fontWeight: 600, fontSize: 13 }}>
          Register as Employee
        </Link>
      </div>
    </div>
  );
}

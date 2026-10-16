import React from 'react';
import { Form, Input } from 'antd';
import { LockOutlined, MailOutlined, KeyOutlined } from '@ant-design/icons';

export default function ResetPasswordForm({ hasUrlTokens = true }) {
  return (
    <>
      {!hasUrlTokens && (
        <>
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please enter your registered email address.' },
              { type: 'email', message: 'Enter a valid email address.' },
            ]}
          >
            <Input
              prefix={<MailOutlined className="site-form-item-icon" />}
              placeholder="Registered Email Address"
              aria-label="Registered Email Address"
              size="large"
            />
          </Form.Item>
          <Form.Item
            name="resetToken"
            rules={[{ required: true, message: 'Please enter the 6-digit verification code or reset token.' }]}
          >
            <Input
              prefix={<KeyOutlined className="site-form-item-icon" />}
              placeholder="6-Digit Code (or Reset Token from email)"
              aria-label="Reset Code or Token"
              size="large"
            />
          </Form.Item>
        </>
      )}
      <Form.Item
        name="password"
        rules={[
          {
            required: true,
            message: 'Please enter your new password.',
          },
          { min: 8, message: 'Use at least 8 characters.' },
          { max: 128, message: 'Use no more than 128 characters.' },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined className="site-form-item-icon" />}
          placeholder="New Password (min 8 chars)"
          aria-label="New password"
          size="large"
        />
      </Form.Item>
      <Form.Item
        name="confirm_password"
        rules={[
          {
            required: true,
          },
          { min: 8, message: 'Use at least 8 characters.' },
          { max: 128, message: 'Use no more than 128 characters.' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('The two passwords that you entered do not match!'));
            },
          }),
        ]}
        hasFeedback
      >
        <Input.Password
          prefix={<LockOutlined className="site-form-item-icon" />}
          placeholder="Confirm new password"
          aria-label="Confirm new password"
          size="large"
        />
      </Form.Item>
    </>
  );
}

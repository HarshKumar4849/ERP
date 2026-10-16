import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';

import { resetPassword } from '@/redux/auth/actions';
import { selectAuth } from '@/redux/auth/selectors';

import { Form, Button } from 'antd';

import ResetPasswordForm from '@/forms/ResetPasswordForm';

import useLanguage from '@/locale/useLanguage';

import Loading from '@/components/Loading';
import AuthModule from '@/modules/AuthModule';

const ResetPassword = () => {
  const translate = useLanguage();
  const { isLoading } = useSelector(selectAuth);
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, resetToken } = useParams();

  const searchParams = new URLSearchParams(location.search);
  const defaultEmail = location.state?.email || searchParams.get('email') || '';
  const queryUserId = searchParams.get('userId');
  const queryResetToken = searchParams.get('token') || searchParams.get('resetToken');

  const activeUserId = userId || queryUserId;
  const activeResetToken = resetToken || queryResetToken;
  const hasUrlTokens = Boolean(activeUserId && activeResetToken);

  const dispatch = useDispatch();
  const onFinish = async (values) => {
    const targetUserId = activeUserId || values.userId;
    const targetResetToken = activeResetToken || values.resetToken;
    const targetEmail = values.email || defaultEmail;

    const payload = {
      password: values.password,
    };
    if (targetUserId) payload.userId = targetUserId;
    if (targetResetToken) payload.resetToken = targetResetToken;
    if (targetEmail) payload.email = targetEmail;

    const result = await dispatch(
      resetPassword({
        resetPasswordData: payload,
      })
    );
    if (result?.success) navigate('/login');
  };

  const FormContainer = () => {
    return (
      <Loading isLoading={isLoading}>
        <Form
          name="signup"
          className="login-form"
          initialValues={{
            email: defaultEmail,
            remember: true,
          }}
          onFinish={onFinish}
        >
          <ResetPasswordForm hasUrlTokens={hasUrlTokens} />
          <Form.Item>
            <Button type="primary" htmlType="submit" className="login-form-button" size="large">
              {translate('update password')}
            </Button>
            {translate('Or')} <Link to="/login"> {translate('already have account Login')} </Link>
          </Form.Item>
        </Form>
      </Loading>
    );
  };
  return <AuthModule authContent={<FormContainer />} AUTH_TITLE="Reset Password" />;
};

export default ResetPassword;

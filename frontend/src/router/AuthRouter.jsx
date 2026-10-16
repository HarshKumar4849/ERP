import { Routes, Route, Navigate } from 'react-router-dom';

import Login from '@/pages/Login';
import NotFound from '@/pages/NotFound';

import ForgetPassword from '@/pages/ForgetPassword';
import ResetPassword from '@/pages/ResetPassword';
import Register from '@/pages/Register';

import { useDispatch } from 'react-redux';

export default function AuthRouter() {
  const dispatch = useDispatch();

  return (
    <Routes>
      <Route element={<Login />} path="/" />
      <Route element={<Login />} path="/login" />
      <Route element={<Navigate to="/login" replace />} path="/logout" />
      <Route element={<Register />} path="/register" />
      <Route element={<ForgetPassword />} path="/forgetpassword" />
      <Route element={<ForgetPassword />} path="/forgotpassword" />
      <Route element={<ForgetPassword />} path="/forget-password" />
      <Route element={<ForgetPassword />} path="/forgot-password" />
      <Route element={<ResetPassword />} path="/resetpassword/:userId/:resetToken" />
      <Route element={<ResetPassword />} path="/reset-password/:userId/:resetToken" />
      <Route element={<ResetPassword />} path="/resetpassword" />
      <Route element={<ResetPassword />} path="/reset-password" />
      {/* While signed out only auth routes are reachable. Any other URL is a
          deep link into the protected app, so send the user to the login screen
          instead of a misleading 404. */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

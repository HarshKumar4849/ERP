const Joi = require('joi');

const mongoose = require('mongoose');

const checkAndCorrectURL = require('./checkAndCorrectURL');
const sendMail = require('./sendMail');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const randomBytes = promisify(crypto.randomBytes);
const { useAppSettings } = require('../../../settings');

const forgetPassword = async (req, res, { userModel }) => {
  const UserPassword = mongoose.model(userModel + 'Password');
  const User = mongoose.model(userModel);
  const { email } = req.body;

  // validate
  const objectSchema = Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: true } })
      .required(),
  });

  const { error } = objectSchema.validate({ email });
  if (error) {
    return res.status(409).json({
      success: false,
      result: null,
      error: error,
      message: 'Invalid email.',
      errorMessage: error.message,
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  let user = await User.findOne({ email: normalizedEmail, removed: false });

  if (!user) {
    try {
      const Employee = mongoose.model('Employee');
      const emp = await Employee.findOne({ email: normalizedEmail, removed: false });
      if (emp) {
        const isHr =
          emp.departmentName === 'Human Resources' ||
          emp.departmentName === 'HR' ||
          (emp.designationName && /HR|People|Human Resource/i.test(emp.designationName));

        user = new User({
          name: emp.name || 'Employee',
          surname: emp.surname || '',
          email: normalizedEmail,
          employeeId: emp.employeeId,
          role: isHr ? 'HR' : 'EMPLOYEE',
          department: emp.departmentName || '',
          designation: emp.designationName || '',
          enabled: true,
          removed: false,
        });
        await user.save();
        emp.user = user._id;
        await emp.save();
      }
    } catch (e) {
      console.error('Error finding employee in forgetPassword:', e);
    }
  }

  if (user) {
    const rawToken = (await randomBytes(32)).toString('hex');
    const resetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const resetOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const updated = await UserPassword.findOneAndUpdate(
      { user: user._id },
      { $set: { resetToken, resetTokenExpires: expiresAt, emailOtp: resetOtp, emailOtpExpires: expiresAt, removed: false } },
      { new: true, upsert: true }
    ).exec();
    if (updated) {
      const settings = useAppSettings();
      const idurar_app_email = settings['idurar_app_email'];
      const idurar_base_url = settings['idurar_base_url'];
      const configuredClientUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL)?.split(',')[0].trim();
      const originFromHeader = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
      const hostFromHeader = req.headers['x-forwarded-host'] || req.headers.host;
      const protoFromHeader = req.headers['x-forwarded-proto'] || 'https';
      const forwardedUrl = hostFromHeader ? `${protoFromHeader}://${hostFromHeader}` : null;
      const url = checkAndCorrectURL(configuredClientUrl || originFromHeader || forwardedUrl || idurar_base_url || 'https://tecmotiv-erp.vercel.app');
      const link = url + '/resetpassword/' + user._id + '/' + rawToken;

      try {
        await sendMail({
          email: normalizedEmail,
          name: user.name,
          link,
          otp: resetOtp,
          subject: 'Reset your password | TecMotiv ERP',
          idurar_app_email,
          type: 'passwordVerfication',
        });
      } catch (mailErr) {
        console.error('Password reset email failed to send:', mailErr.message);
        return res.status(500).json({
          success: false,
          result: null,
          message: 'Unable to deliver password reset email. Please contact your Administrator to reset your password directly.',
        });
      }
    }
  } else {
    console.warn(`[AUTH] Password reset requested for unregistered or inactive email: "${normalizedEmail}". Check that this user exists in MongoDB.`);
  }

  return res.status(200).json({
    success: true,
    result: null,
    message: 'If an account exists for that email, you will receive password reset instructions shortly.',
  });
};

module.exports = forgetPassword;

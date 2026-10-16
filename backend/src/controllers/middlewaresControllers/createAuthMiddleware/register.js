const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Joi = require('joi');
const mail = require('../../../handlers/mail');

const register = async (req, res, { userModel }) => {
  try {
    const UserModel = mongoose.model(userModel);
    const UserPasswordModel = mongoose.model(userModel + 'Password');

    const { name, surname = '', email, password, department = 'General' } = req.body;

    // Validate inputs
    const schema = Joi.object({
      name: Joi.string().trim().min(2).max(50).required(),
      surname: Joi.string().trim().allow('').max(50),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).max(64).required(),
      department: Joi.string().trim().allow('').max(50),
      role: Joi.string().allow(''),
    });

    const { error } = schema.validate({ name, surname, email, password, department });
    if (error) {
      return res.status(400).json({
        success: false,
        result: null,
        message: error.details[0]?.message || 'Invalid input data.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email: cleanEmail, removed: false });
    if (existingUser && existingUser.enabled) {
      return res.status(409).json({
        success: false,
        result: null,
        message: 'An active account with this email already exists. Please log in.',
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(salt + password);

    let user;
    if (existingUser && !existingUser.enabled) {
      // Re-use pending unverified registration
      existingUser.name = name.trim();
      existingUser.surname = surname ? surname.trim() : '';
      existingUser.department = department.trim();
      existingUser.role = 'EMPLOYEE';
      user = await existingUser.save();

      await UserPasswordModel.findOneAndUpdate(
        { user: user._id },
        {
          password: hashedPassword,
          salt: salt,
          emailOtp: otp,
          emailOtpExpires: otpExpires,
          emailVerified: false,
        },
        { upsert: true }
      );
    } else {
      // Create new unverified user
      user = new UserModel({
        name: name.trim(),
        surname: surname ? surname.trim() : '',
        email: cleanEmail,
        role: 'EMPLOYEE',
        department: department.trim(),
        enabled: false,
        removed: false,
      });
      await user.save();

      const userPassword = new UserPasswordModel({
        user: user._id,
        password: hashedPassword,
        salt: salt,
        emailOtp: otp,
        emailOtpExpires: otpExpires,
        emailVerified: false,
      });
      await userPassword.save();
    }

    // Send email with OTP
    const htmlEmail = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e8e8e8; overflow: hidden;">
        <div style="background: #002244; padding: 28px 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">TecMotiv ERP</h1>
          <p style="color: #69c0ff; margin: 6px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Account Verification</p>
        </div>
        <div style="padding: 36px 32px;">
          <h2 style="color: #1f1f1f; margin-top: 0; font-size: 20px;">Welcome to TecMotiv, ${name}!</h2>
          <p style="color: #595959; font-size: 15px; line-height: 1.6;">
            Thank you for registering your employee account. To complete your registration and log in, please enter the 6-digit verification code below:
          </p>
          <div style="background: #f0f5ff; border: 1.5px dashed #2f54eb; border-radius: 8px; padding: 20px; text-align: center; margin: 28px 0;">
            <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #10239e;">${otp}</span>
            <p style="color: #8c8c8c; font-size: 12px; margin: 8px 0 0 0;">This code expires in 10 minutes</p>
          </div>
          <p style="color: #8c8c8c; font-size: 13px; line-height: 1.5;">
            If you did not request this registration, you can safely ignore this email.
          </p>
        </div>
        <div style="background: #fafafa; padding: 18px 32px; text-align: center; border-top: 1px solid #f0f0f0;">
          <p style="color: #bfbfbf; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} TecMotiv ERP. All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      await mail.send({
        to: cleanEmail,
        subject: `${otp} is your TecMotiv ERP verification code`,
        html: htmlEmail,
        text: `Your TecMotiv ERP verification code is ${otp}. It expires in 10 minutes.`,
      });
    } catch (mailError) {
      console.error('Failed to send verification email:', mailError);
    }

    return res.status(200).json({
      success: true,
      result: {
        email: cleanEmail,
      },
      message: 'Verification code sent to your email.',
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      result: null,
      message: 'An error occurred during registration. Please try again.',
      error: error.message,
    });
  }
};

module.exports = register;

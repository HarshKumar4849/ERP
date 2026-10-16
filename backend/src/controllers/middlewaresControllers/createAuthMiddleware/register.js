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

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(salt + password);

    let user;
    if (existingUser) {
      existingUser.name = name.trim();
      existingUser.surname = surname ? surname.trim() : '';
      existingUser.department = department.trim();
      existingUser.role = 'EMPLOYEE';
      existingUser.enabled = true;
      user = await existingUser.save();

      await UserPasswordModel.findOneAndUpdate(
        { user: user._id },
        {
          password: hashedPassword,
          salt: salt,
          emailVerified: true,
        },
        { upsert: true }
      );
    } else {
      // Create new active user directly without OTP roadblock
      user = new UserModel({
        name: name.trim(),
        surname: surname ? surname.trim() : '',
        email: cleanEmail,
        role: 'EMPLOYEE',
        department: department.trim(),
        enabled: true,
        removed: false,
      });
      await user.save();

      const userPassword = new UserPasswordModel({
        user: user._id,
        password: hashedPassword,
        salt: salt,
        emailVerified: true,
      });
      await userPassword.save();
    }

    // Optional welcome email (non-blocking, never fails registration)
    const welcomeHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e8e8e8; overflow: hidden;">
        <div style="background: #002244; padding: 28px 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">Tecmotiv ERP</h1>
          <p style="color: #69c0ff; margin: 6px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Welcome to the Team</p>
        </div>
        <div style="padding: 36px 32px;">
          <h2 style="color: #1f1f1f; margin-top: 0; font-size: 20px;">Welcome to Tecmotiv, ${name}!</h2>
          <p style="color: #595959; font-size: 15px; line-height: 1.6;">
            Your employee account has been created successfully. You can now log in to Tecmotiv ERP with your email and password.
          </p>
        </div>
        <div style="background: #fafafa; padding: 18px 32px; text-align: center; border-top: 1px solid #f0f0f0;">
          <p style="color: #bfbfbf; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Tecmotiv ERP. All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      mail.send({
        to: cleanEmail,
        subject: `Welcome to Tecmotiv ERP, ${name}!`,
        html: welcomeHtml,
        text: `Welcome to Tecmotiv ERP, ${name}! Your employee account has been created successfully and is ready to use.`,
      }).catch((mailErr) => {
        console.warn('Welcome email skipped:', mailErr.message);
      });
    } catch (_) {}

    return res.status(200).json({
      success: true,
      result: {
        _id: user._id,
        name: user.name,
        surname: user.surname,
        email: cleanEmail,
        role: user.role,
        department: user.department,
      },
      message: 'Account created successfully! You can now log in.',
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

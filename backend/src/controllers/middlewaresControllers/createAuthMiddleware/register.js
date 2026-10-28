const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

const generateEmployeeCode = async () => {
  const Employee = mongoose.model('Employee');
  for (let attempts = 0; attempts < 30; attempts++) {
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const testId = `TM-${randNum}`;
    const exists = await Employee.findOne({ employeeId: testId });
    if (!exists) {
      return testId;
    }
  }
  const count = await Employee.countDocuments();
  return `TM-${1000 + count + 1}`;
};

const register = async (req, res, { userModel }) => {
  let user = null;
  try {
    const UserModel = mongoose.model(userModel);
    const UserPasswordModel = mongoose.model(userModel + 'Password');

    const { name, surname = '', email, password, department = 'General' } = req.body;

    // Validate inputs
    const schema = Joi.object({
      name: Joi.string().trim().min(2).max(50).required(),
      surname: Joi.string().trim().allow('').max(50),
      email: Joi.string().trim().email().required(),
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
          emailOtp: null,
          emailOtpExpires: null,
        },
        { upsert: true }
      );
    } else {
      // Create new active user directly — zero OTP or verification roadblock
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
        emailOtp: null,
        emailOtpExpires: null,
      });
      await userPassword.save();
    }

    // Automatically create or link Employee profile for instant ERP access
    const EmployeeModel = mongoose.model('Employee');
    let empDoc = await EmployeeModel.findOne({
      $or: [{ user: user._id }, { email: cleanEmail }],
      removed: false,
    });

    if (!empDoc) {
      const empCode = await generateEmployeeCode();
      empDoc = new EmployeeModel({
        employeeId: empCode,
        name: user.name,
        surname: user.surname || '',
        email: cleanEmail,
        departmentName: user.department || 'General',
        status: 'Active',
        user: user._id,
        removed: false,
        enabled: true,
      });
      await empDoc.save();
      user.employeeId = empCode;
    } else {
      if (!empDoc.user) {
        empDoc.user = user._id;
        await empDoc.save();
      }
      user.employeeId = empDoc.employeeId;
      const isHr =
        empDoc.departmentName === 'Human Resources' ||
        empDoc.departmentName === 'HR' ||
        (empDoc.designationName && /HR|People|Human Resource/i.test(empDoc.designationName));
      if (isHr) {
        user.role = 'HR';
        user.department = empDoc.departmentName || 'Human Resources';
        user.designation = empDoc.designationName || 'HR';
      }
    }
    await user.save();

    // Generate active JWT token for immediate auto-login session
    const token = jwt.sign(
      {
        id: user._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await UserPasswordModel.findOneAndUpdate(
      { user: user._id },
      { $push: { loggedSessions: token } }
    );

    return res.status(200).json({
      success: true,
      result: {
        _id: user._id,
        name: user.name,
        surname: user.surname,
        email: cleanEmail,
        role: user.role,
        department: user.department,
        designation: user.designation,
        employeeId: user.employeeId,
        photo: user.photo,
        token: token,
      },
      message: 'Account created successfully! Please sign in with your credentials.',
    });
  } catch (error) {
    if (error.code === 11000) {
      // Race condition / duplicate key caught at database level
      if (typeof user !== 'undefined' && user && user._id) {
        try {
          const UserModel = mongoose.model(userModel);
          const UserPasswordModel = mongoose.model(userModel + 'Password');
          await UserModel.deleteOne({ _id: user._id });
          await UserPasswordModel.deleteOne({ user: user._id });
        } catch (cleanupErr) {}
      }
      return res.status(409).json({
        success: false,
        result: null,
        message: 'An active account with this email already exists. Please log in.',
      });
    }
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


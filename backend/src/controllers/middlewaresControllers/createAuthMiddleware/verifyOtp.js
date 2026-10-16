const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const generateEmployeeCode = async () => {
  const Employee = mongoose.model('Employee');
  const count = await Employee.countDocuments();
  const nextNum = 1000 + count + 1;
  return `TM-${nextNum}`;
};

const verifyOtp = async (req, res, { userModel }) => {
  try {
    const UserModel = mongoose.model(userModel);
    const UserPasswordModel = mongoose.model(userModel + 'Password');

    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'Email and verification code are required.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = String(otp).trim();

    const user = await UserModel.findOne({ email: cleanEmail, removed: false });
    if (!user) {
      return res.status(404).json({
        success: false,
        result: null,
        message: 'No registration found for this email.',
      });
    }

    const userPassword = await UserPasswordModel.findOne({ user: user._id, removed: false });
    if (!userPassword) {
      return res.status(404).json({
        success: false,
        result: null,
        message: 'Authentication record not found.',
      });
    }

    // Verify OTP
    if (!userPassword.emailOtp || userPassword.emailOtp !== cleanOtp) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'Invalid verification code. Please check and try again.',
      });
    }

    if (userPassword.emailOtpExpires && new Date(userPassword.emailOtpExpires) < new Date()) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'Verification code has expired. Please request a new one.',
      });
    }

    // Activate User
    user.enabled = true;
    userPassword.emailVerified = true;
    userPassword.emailOtp = null;
    userPassword.emailOtpExpires = null;

    // Automatically create or link Employee profile if needed
    if (user.role === 'EMPLOYEE') {
      const EmployeeModel = mongoose.model('Employee');
      let empDoc = await EmployeeModel.findOne({
        $or: [{ user: user._id }, { email: user.email }],
        removed: false,
      });

      if (!empDoc) {
        const empCode = await generateEmployeeCode();
        empDoc = new EmployeeModel({
          employeeId: empCode,
          name: user.name,
          surname: user.surname || '',
          email: user.email,
          departmentName: user.department || 'General',
          status: 'Active',
          user: user._id,
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
    }

    await user.save();

    // Generate JWT token for auto-login
    const token = jwt.sign(
      {
        id: user._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    userPassword.loggedSessions.push(token);
    await userPassword.save();

    return res.status(200).json({
      success: true,
      result: {
        _id: user._id,
        name: user.name,
        surname: user.surname,
        role: user.role,
        department: user.department,
        designation: user.designation,
        employeeId: user.employeeId,
        email: user.email,
        photo: user.photo,
        token: token,
      },
      message: 'Account successfully verified and logged in.',
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      result: null,
      message: 'An error occurred during verification. Please try again.',
      error: error.message,
    });
  }
};

module.exports = verifyOtp;

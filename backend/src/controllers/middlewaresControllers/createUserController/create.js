const mongoose = require('mongoose');
const { generate: uniqueId } = require('shortid');

const create = async (userModel, req, res) => {
  const User = mongoose.model(userModel);
  const UserPassword = mongoose.model(userModel + 'Password');

  const { email, password, name, surname, role, department, designation, employeeId } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'Name, email and password are required fields.',
    });
  }

  const existingUser = await User.findOne({ email: email.toLowerCase(), removed: false });
  if (existingUser) {
    return res.status(409).json({
      success: false,
      result: null,
      message: 'An account with this email already exists.',
    });
  }

  const userDoc = new User({
    email,
    name,
    surname,
    role: role || 'EMPLOYEE',
    department,
    designation,
    employeeId,
    enabled: true,
  });

  const savedUser = await userDoc.save();

  const userPassword = new UserPassword();
  const salt = uniqueId();
  const passwordHash = userPassword.generateHash(salt, password);

  const newPasswordData = {
    password: passwordHash,
    emailVerified: true,
    salt,
    user: savedUser._id,
  };

  await new UserPassword(newPasswordData).save();

  return res.status(201).json({
    success: true,
    result: savedUser,
    message: 'User created successfully.',
  });
};

module.exports = create;

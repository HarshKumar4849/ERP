const Joi = require('joi');

const mongoose = require('mongoose');

const authUser = require('./authUser');

const login = async (req, res, { userModel }) => {
  const UserPasswordModel = mongoose.model(userModel + 'Password');
  const UserModel = mongoose.model(userModel);
  const { email, password } = req.body;

  const cleanEmail = (email || '').trim().toLowerCase();

  // validate
  const objectSchema = Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: true } })
      .required(),
    password: Joi.string().required(),
  });

  const { error } = objectSchema.validate({ email: cleanEmail, password });
  if (error) {
    return res.status(409).json({
      success: false,
      result: null,
      error: error,
      message: 'Invalid/Missing credentials.',
      errorMessage: error.message,
    });
  }

  // 1. Exact or case-insensitive search
  let user = await UserModel.findOne({
    $or: [
      { email: cleanEmail },
      { email: { $regex: new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
    ],
    removed: false,
  });

  // 2. Resilient typo tolerance (e.g., gamil.com vs gmail.com)
  if (!user && cleanEmail.includes('@')) {
    if (cleanEmail.endsWith('@gmail.com')) {
      const typoVariant = cleanEmail.replace('@gmail.com', '@gamil.com');
      user = await UserModel.findOne({ email: typoVariant, removed: false });
    } else if (cleanEmail.endsWith('@gamil.com')) {
      const fixedVariant = cleanEmail.replace('@gamil.com', '@gmail.com');
      user = await UserModel.findOne({ email: fixedVariant, removed: false });
    }
  }

  if (!user)
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Invalid credentials.',
    });

  const databasePassword = await UserPasswordModel.findOne({ user: user._id, removed: false });
  if (!databasePassword)
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Invalid credentials.',
    });

  if (!user.enabled)
    return res.status(409).json({
      success: false,
      result: null,
      message: 'Your account is disabled, contact your account adminstrator',
    });

  // authUser if user has correct password
  authUser(req, res, {
    user,
    databasePassword,
    password,
    UserPasswordModel,
  });
};

module.exports = login;

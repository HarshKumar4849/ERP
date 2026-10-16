const bcrypt = require('bcryptjs');
const Joi = require('joi');
const mongoose = require('mongoose');
const shortid = require('shortid');

const crypto = require('node:crypto');

const resetPassword = async (req, res, { userModel }) => {
  const UserPassword = mongoose.model(userModel + 'Password');
  const User = mongoose.model(userModel);
  const { password, userId, resetToken, email, resetOtp } = req.body;

  // Validate before any account or token lookup to avoid leaking account state.
  const objectSchema = Joi.object({
    password: Joi.string().min(8).max(128).required(),
    userId: Joi.string().hex().length(24).optional().allow(null, ''),
    resetToken: Joi.string().max(128).optional().allow(null, ''),
    email: Joi.string().email().optional().allow(null, ''),
    resetOtp: Joi.string().max(128).optional().allow(null, ''),
  });

  const { error } = objectSchema.validate({ password, userId, resetToken, email, resetOtp });
  const hasIdentifier = Boolean(userId || email);
  const hasCredential = Boolean(resetToken || resetOtp);

  if (error || !hasIdentifier || !hasCredential) {
    return res.status(409).json({
      success: false,
      result: null,
      error: error || 'Missing required reset credentials',
      message: 'Invalid reset password parameters',
      errorMessage: error ? error.message : 'Provide your email/ID and verification code or reset token.',
    });
  }

  let user = null;
  const tokenCandidate = (resetToken || resetOtp || '').trim();

  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    user = await User.findOne({ _id: userId, removed: false }).exec();
  } else if (email) {
    user = await User.findOne({ email: email.trim().toLowerCase(), removed: false }).exec();
  }

  if (!user || !tokenCandidate) {
    return res.status(400).json({ success: false, result: null, message: 'Reset link or verification code is invalid or expired.' });
  }

  const tokenHash = crypto.createHash('sha256').update(tokenCandidate).digest('hex');
  const databasePassword = await UserPassword.findOne({
    user: user._id,
    removed: false,
    $or: [
      { resetToken: tokenHash, resetTokenExpires: { $gt: new Date() } },
      { resetToken: tokenCandidate, resetTokenExpires: { $gt: new Date() } },
      { emailOtp: tokenCandidate, emailOtpExpires: { $gt: new Date() } },
    ],
  }).exec();

  if (!databasePassword) {
    return res.status(400).json({ success: false, result: null, message: 'Reset link or verification code is invalid or expired.' });
  }

  const salt = shortid.generate();
  const hashedPassword = bcrypt.hashSync(salt + password);
  const consumed = await UserPassword.findOneAndUpdate(
    { _id: databasePassword._id },
    {
      $set: {
        password: hashedPassword,
        salt,
        resetToken: null,
        resetTokenExpires: null,
        emailOtp: null,
        emailOtpExpires: null,
        emailVerified: true,
        loggedSessions: [],
      },
    },
    { new: true }
  ).exec();

  if (!consumed) {
    return res.status(400).json({ success: false, result: null, message: 'Reset link or verification code is invalid or expired.' });
  }

  await User.updateOne({ _id: user._id }, { $set: { enabled: true } });

  return res.status(200).json({ success: true, result: null, message: 'Password updated. Please log in.' });
};

module.exports = resetPassword;

const mongoose = require('mongoose');
const mail = require('../../../handlers/mail');

const resendOtp = async (req, res, { userModel }) => {
  try {
    const UserModel = mongoose.model(userModel);
    const UserPasswordModel = mongoose.model(userModel + 'Password');

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'Email is required.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await UserModel.findOne({ email: cleanEmail, removed: false });
    if (!user) {
      return res.status(404).json({
        success: false,
        result: null,
        message: 'No registration found for this email.',
      });
    }

    if (user.enabled) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'Account is already verified. Please log in.',
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

    // Generate fresh OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    userPassword.emailOtp = otp;
    userPassword.emailOtpExpires = otpExpires;
    await userPassword.save();

    // Send email with new OTP
    const htmlEmail = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e8e8e8; overflow: hidden;">
        <div style="background: #002244; padding: 28px 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">TecMotiv ERP</h1>
          <p style="color: #69c0ff; margin: 6px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">New Verification Code</p>
        </div>
        <div style="padding: 36px 32px;">
          <h2 style="color: #1f1f1f; margin-top: 0; font-size: 20px;">Hello, ${user.name}!</h2>
          <p style="color: #595959; font-size: 15px; line-height: 1.6;">
            Here is your new 6-digit verification code to complete your TecMotiv ERP account verification:
          </p>
          <div style="background: #f0f5ff; border: 1.5px dashed #2f54eb; border-radius: 8px; padding: 20px; text-align: center; margin: 28px 0;">
            <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #10239e;">${otp}</span>
            <p style="color: #8c8c8c; font-size: 12px; margin: 8px 0 0 0;">This code expires in 10 minutes</p>
          </div>
          <p style="color: #8c8c8c; font-size: 13px; line-height: 1.5;">
            If you did not request this code, please ignore this email.
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
        subject: `${otp} is your new TecMotiv ERP verification code`,
        html: htmlEmail,
        text: `Your new TecMotiv ERP verification code is ${otp}. It expires in 10 minutes.`,
      });
    } catch (mailError) {
      console.error('Failed to send resend OTP email:', mailError);
    }

    return res.status(200).json({
      success: true,
      result: { email: cleanEmail },
      message: 'A new verification code has been sent to your email.',
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({
      success: false,
      result: null,
      message: 'Failed to resend verification code. Please try again.',
      error: error.message,
    });
  }
};

module.exports = resendOtp;

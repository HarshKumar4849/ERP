const express = require('express');

const router = express.Router();

const { catchErrors } = require('../../handlers/errorHandlers');
const adminAuth = require('../../controllers/coreControllers/adminAuth');
const { rateLimit } = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 30 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    result: null,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    result: null,
    message: 'Too many password reset attempts. Please try again later.',
  },
});

router.route('/login').post(authLimiter, catchErrors(adminAuth.login));
router.route('/register').post(authLimiter, catchErrors(adminAuth.register));
router.route('/verify-otp').post(authLimiter, catchErrors(adminAuth.verifyOtp));
router.route('/resend-otp').post(authLimiter, catchErrors(adminAuth.resendOtp));

router.route('/forgetpassword').post(passwordResetLimiter, catchErrors(adminAuth.forgetPassword));
router.route('/resetpassword').post(passwordResetLimiter, catchErrors(adminAuth.resetPassword));

router.route('/logout').post(adminAuth.isValidAuthToken, catchErrors(adminAuth.logout));

module.exports = router;

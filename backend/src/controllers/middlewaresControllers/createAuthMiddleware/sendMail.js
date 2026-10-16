const { passwordVerfication } = require('../../../emailTemplate/emailVerfication');
const mailHandler = require('../../../handlers/mail');

const sendMail = async ({
  email,
  name,
  link,
  otp,
  idurar_app_email,
  subject = 'Verify your email | TecMotiv ERP',
  type = 'emailVerfication',
  emailToken,
}) => {
  return await mailHandler.send({
    to: email,
    subject,
    html: passwordVerfication({ name, link, otp }),
    text: `Hello ${name || 'User'},\n\nWe received a request to reset your password on TecMotiv ERP.\n\nYour 6-digit verification code is: ${otp}\n\nOr click this link to reset your password directly:\n${link}\n\nIf you did not request this, you can safely ignore this email.`,
  });
};

module.exports = sendMail;

const nodemailer = require('nodemailer');
const { Resend } = require('resend');

let transporter = null;

if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  const service = process.env.EMAIL_SERVICE || 'gmail';
  transporter = nodemailer.createTransport({
    service,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS.replace(/\s+/g, ''),
    },
  });
}

exports.send = async ({ to, subject, html, text }) => {
  const from =
    process.env.EMAIL_FROM ||
    (process.env.EMAIL_USER ? `TecMotiv ERP <${process.env.EMAIL_USER}>` : 'TecMotiv ERP <no-reply@tecmotiv.com>');

  let lastError = null;

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      return { success: true, provider: 'smtp', info };
    } catch (err) {
      lastError = err;
      console.error('Nodemailer send failed:', err.message);
    }
  }

  if (process.env.RESEND_API && process.env.RESEND_API !== 'test') {
    try {
      const resend = new Resend(process.env.RESEND_API);
      const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'TecMotiv ERP <onboarding@resend.dev>',
        to,
        subject,
        html,
      });
      if (error) {
        lastError = error;
        console.error('Resend returned error:', error.message || error);
      } else {
        return { success: true, provider: 'resend', data };
      }
    } catch (err) {
      lastError = err;
      console.error('Resend send failed:', err.message);
    }
  }

  if (lastError) {
    throw new Error(`Email delivery failed: ${lastError.message || 'SMTP server rejected the request'}`);
  }

  console.warn('Email dispatch simulated (no active email provider):', { to, subject });
  return { success: true, provider: 'simulated', to, subject };
};

exports.verify = async () => {
  if (transporter) {
    return await transporter.verify();
  }
  return false;
};

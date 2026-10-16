exports.SendNotification = ({ title = 'TecMotiv ERP Notification', name = '', message = '', time = new Date() }) => {
  return `
    <div>
        <head data-id="__react-email-head">
            <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
            <title>${title}</title>
        </head>
        <body data-id="__react-email-body" style="font-family: sans-serif; color: #333; padding: 20px;">
            <h2 data-id="react-email-heading" style="color: #1677ff;">${title}</h2>
            <hr data-id="react-email-hr" style="width:100%;border:none;border-top:1px solid #eaeaea; margin: 20px 0;" />
            <p style="font-size:15px;line-height:24px;">Hello ${name},</p>
            <p style="font-size:14px;line-height:24px;">${message}</p>
            <p style="font-size:12px;color:#888;margin-top:30px;">Sent from TecMotiv ERP at ${time}</p>
        </body>
    </div>
  `;
};

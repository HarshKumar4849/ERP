const mongoose = require('mongoose');

/**
 * PHASE 19 — CENTRALIZED NOTIFICATION SERVICE
 * 
 * Central dispatch for all notification events across TecMotiv ERP.
 * Multi-channel architecture prepared for:
 * 1. In-App Notifications (Persisted to database)
 * 2. Email Notifications (Integrated with email pipeline)
 * 3. WhatsApp Notifications (Multi-channel template messaging)
 * 4. Real-time Socket.IO delivery
 */

const NOTIFICATION_TYPES = {
  LEAVE_SUBMITTED: 'LEAVE_SUBMITTED',
  LEAVE_APPROVED: 'LEAVE_APPROVED',
  LEAVE_REJECTED: 'LEAVE_REJECTED',
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_DUE: 'TASK_DUE',
  TASK_OVERDUE: 'TASK_OVERDUE',
  BIRTHDAY: 'BIRTHDAY',
  ANNIVERSARY: 'ANNIVERSARY',
  POLICY_ACKNOWLEDGEMENT: 'POLICY_ACKNOWLEDGEMENT',
  DOCUMENT_EXPIRY: 'DOCUMENT_EXPIRY',
  PROBATION_ENDING: 'PROBATION_ENDING',
  EVENT_REMINDER: 'EVENT_REMINDER',
  RECOGNITION_NOMINATION: 'RECOGNITION_NOMINATION',
  SALARY_SLIP_AVAILABLE: 'SALARY_SLIP_AVAILABLE',
  SAAS_RENEWAL: 'SAAS_RENEWAL',
  SYSTEM_ANNOUNCEMENT: 'SYSTEM_ANNOUNCEMENT',
};

// Map notification type string to preference key
const typeToPrefKey = (type) => {
  const map = {
    LEAVE_SUBMITTED: 'leaveSubmitted',
    LEAVE_APPROVED: 'leaveApproved',
    LEAVE_REJECTED: 'leaveRejected',
    TASK_ASSIGNED: 'taskAssigned',
    TASK_DUE: 'taskDue',
    TASK_OVERDUE: 'taskOverdue',
    BIRTHDAY: 'birthday',
    ANNIVERSARY: 'anniversary',
    POLICY_ACKNOWLEDGEMENT: 'policyAcknowledgement',
    DOCUMENT_EXPIRY: 'documentExpiry',
    PROBATION_ENDING: 'probationEnding',
    EVENT_REMINDER: 'eventReminder',
    RECOGNITION_NOMINATION: 'recognitionNomination',
    SALARY_SLIP_AVAILABLE: 'salarySlipAvailable',
    SAAS_RENEWAL: 'saasRenewal',
  };
  return map[type] || 'inApp';
};

/**
 * ---------------------------------------------------------------------------
 * MULTI-CHANNEL ADAPTERS (EMAIL & WHATSAPP)
 * ---------------------------------------------------------------------------
 */

// Email Delivery Adapter (prepared for SMTP / Resend / SendGrid)
const emailDeliveryAdapter = async ({ toEmail, recipientName, title, message, link, data }) => {
  // If email recipient is not provided, skip gracefully
  if (!toEmail) return { status: 'none', reason: 'No recipient email' };

  try {
    // Check if sendEmail helper exists in project
    let emailSender = null;
    try {
      emailSender = require('../handlers/mail');
    } catch (e) {
      // fallback
    }

    if (emailSender && typeof emailSender.send === 'function') {
      await emailSender.send({
        to: toEmail,
        subject: `[TECMOTIV ERP] ${title}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #002244;">TECMOTIV SOLUTIONS</h2>
            <h3>${title}</h3>
            <p>${message}</p>
            ${link ? `<p><a href="${process.env.PUBLIC_SERVER_FILE || 'http://localhost:3000'}${link}" style="display:inline-block;padding:10px 16px;background:#002244;color:#fff;text-decoration:none;border-radius:4px;">View in ERP</a></p>` : ''}
            <hr style="border:none;border-top:1px solid #eee;margin-top:20px;" />
            <p style="font-size:12px;color:#888;">This is an automated notification from TecMotiv ERP.</p>
          </div>
        `,
      });
      return { status: 'sent', recipient: toEmail };
    }

    // In dev / test mode, log email delivery receipt
    return { status: 'queued', recipient: toEmail, simulated: true };
  } catch (error) {
    console.error('Email delivery adapter error:', error.message);
    return { status: 'failed', error: error.message };
  }
};

// WhatsApp Delivery Adapter (prepared for Meta WhatsApp Business / Twilio API)
const whatsappDeliveryAdapter = async ({ toPhone, recipientName, title, message, link, data }) => {
  if (!toPhone) return { status: 'none', reason: 'No WhatsApp phone configured' };

  try {
    // Formatted WhatsApp payload template
    const whatsappPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone.replace(/[^0-9]/g, ''),
      type: 'text',
      text: {
        body: `*TECMOTIV ERP: ${title}*\n\n${message}${link ? `\n\nLink: ${process.env.PUBLIC_SERVER_FILE || 'http://localhost:3000'}${link}` : ''}`,
      },
    };

    // If external WhatsApp API credentials configured in .env:
    if (process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      const waUrl = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      const res = await fetch(waUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(whatsappPayload),
      });
      const resData = await res.json();
      return { status: res.ok ? 'sent' : 'failed', response: resData };
    }

    // Default: Log multi-channel WhatsApp queue receipt
    return { status: 'queued', phone: toPhone, simulated: true };
  } catch (error) {
    console.error('WhatsApp delivery adapter error:', error.message);
    return { status: 'failed', error: error.message };
  }
};

/**
 * ---------------------------------------------------------------------------
 * CORE CENTRALIZED DISPATCH FUNCTION
 * ---------------------------------------------------------------------------
 */
const notify = async ({
  recipient, // Single ObjectId or Array of ObjectIds
  recipientEmployee, // Optional linked employee ObjectId
  type,
  title,
  message,
  link = '',
  data = {},
  priority = 'normal',
  channels = ['in_app', 'email', 'whatsapp'],
  eventId,
}) => {
  if (!recipient) {
    throw new Error('Recipient is required for notification.');
  }
  if (!title || !message) {
    throw new Error('Title and message are required for notification.');
  }

  const Notification = mongoose.models.Notification || require('../models/appModels/Notification');
  const NotificationPreference = mongoose.models.NotificationPreference || require('../models/appModels/NotificationPreference');
  const Admin = mongoose.models.Admin || require('../models/coreModels/Admin');

  const recipientIds = Array.isArray(recipient) ? recipient : [recipient];
  const results = [];

  for (const rId of recipientIds) {
    try {
      const recipientUser = await Admin.findById(rId).lean();
      if (!recipientUser) continue;

      // Load user preferences
      let pref = await NotificationPreference.findOne({ user: rId, removed: false }).lean();
      const prefKey = typeToPrefKey(type);
      const typePref = pref?.typePreferences?.[prefKey] || { inApp: true, email: true, whatsapp: false };

      const allowInApp = pref ? (pref.channels?.inApp !== false && typePref.inApp !== false) : true;
      const allowEmail = pref ? (pref.channels?.email !== false && typePref.email !== false) : true;
      const allowWhatsApp = pref ? (pref.channels?.whatsapp === true && typePref.whatsapp === true) : false;

      let inAppStatus = 'none';
      let emailStatus = 'none';
      let whatsappStatus = 'none';
      let notificationDoc = null;

      // 1. In-App Notification (Database storage)
      // Deduplicate: skip if a notification with the same eventId already exists for this recipient
      if (allowInApp && channels.includes('in_app')) {
        const existingDoc = eventId
          ? await Notification.findOne({ recipient: rId, eventId, removed: false })
          : null;
        if (!existingDoc) {
          notificationDoc = await new Notification({
            recipient: rId,
            recipientEmployee: recipientEmployee || null,
            type: type || NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT,
            title: title.trim(),
            message: message.trim(),
            link: link.trim(),
            data: data || {},
            priority: priority || 'normal',
            read: false,
            channelStatuses: {
              inApp: 'delivered',
              email: 'none',
              whatsapp: 'none',
            },
            eventId,
          }).save();
        } else {
          // Use existing notification document
          notificationDoc = existingDoc;
        }
        inAppStatus = 'delivered';
      }

      // 2. Email Delivery
      if (allowEmail && channels.includes('email') && recipientUser.email) {
        const emailRes = await emailDeliveryAdapter({
          toEmail: recipientUser.email,
          recipientName: `${recipientUser.name || ''} ${recipientUser.surname || ''}`.trim(),
          title,
          message,
          link,
          data,
        });
        emailStatus = emailRes.status;
      }

      // 3. WhatsApp Delivery
      if (allowWhatsApp && channels.includes('whatsapp') && (pref?.whatsappPhone || recipientUser.phone)) {
        const phone = pref?.whatsappPhone || recipientUser.phone;
        const waRes = await whatsappDeliveryAdapter({
          toPhone: phone,
          recipientName: `${recipientUser.name || ''} ${recipientUser.surname || ''}`.trim(),
          title,
          message,
          link,
          data,
        });
        whatsappStatus = waRes.status;
      }

      // Update notification channel statuses if document was created
      if (notificationDoc) {
        notificationDoc.channelStatuses.email = emailStatus;
        notificationDoc.channelStatuses.whatsapp = whatsappStatus;
        await notificationDoc.save();
      }

      // Real-time Socket.IO emission to recipient room
      if (allowInApp && notificationDoc) {
        try {
          const { getSocketIO } = require('../socket');
          const io = getSocketIO();
          if (io) {
            const unreadCount = await Notification.countDocuments({
              recipient: rId,
              read: false,
              removed: false,
            });
            const latestNotifications = await Notification.find({
              recipient: rId,
              removed: false,
            })
              .sort({ created: -1 })
              .limit(20)
              .lean();

            io.to(`user_${rId}`).emit('unread-count', {
              success: true,
              count: unreadCount,
            });
            io.to(`user_${rId}`).emit('notification-list', {
              success: true,
              notifications: latestNotifications,
              unreadCount,
              newNotification: notificationDoc,
            });
          }
        } catch (socketErr) {
          console.warn(`Socket.IO live emission failed for recipient ${rId}:`, socketErr.message);
        }
      }

      results.push({
        recipient: rId,
        notification: notificationDoc,
        channelStatuses: {
          inApp: inAppStatus,
          email: emailStatus,
          whatsapp: whatsappStatus,
        },
      });
    } catch (err) {
      console.error(`Error notifying recipient ${rId}:`, err);
    }
  }

  return results;
};

/**
 * ---------------------------------------------------------------------------
 * DEDICATED CONVENIENCE DISPATCHERS FOR ALL 15 REQUIRED EVENTS
 * ---------------------------------------------------------------------------
 */

// 1. Leave submitted
const notifyLeaveSubmitted = async ({ leave, applicantName, approverUserIds }) => {
  return await notify({
    recipient: approverUserIds,
    type: NOTIFICATION_TYPES.LEAVE_SUBMITTED,
    title: `Leave Application Submitted: ${applicantName}`,
    message: `${applicantName} submitted a ${leave.leaveType || 'Leave'} request from ${new Date(leave.fromDate).toLocaleDateString()} to ${new Date(leave.toDate).toLocaleDateString()} (${leave.daysCount} days).`,
    link: '/leave',
    data: { leaveId: leave._id },
    priority: 'normal',
    eventId: `leave_${leave._id}`,
  });
};

// 2. Leave approved
const notifyLeaveApproved = async ({ leave, applicantUserId }) => {
  return await notify({
    recipient: applicantUserId,
    type: NOTIFICATION_TYPES.LEAVE_APPROVED,
    title: 'Leave Application Approved',
    message: `Your ${leave.leaveType || 'Leave'} application for ${leave.daysCount} days has been approved.`,
    link: '/leave',
    data: { leaveId: leave._id },
    priority: 'normal',
    eventId: `leave_${leave._id}_approved`,
  });
};

// 3. Leave rejected
const notifyLeaveRejected = async ({ leave, applicantUserId, reason }) => {
  return await notify({
    recipient: applicantUserId,
    type: NOTIFICATION_TYPES.LEAVE_REJECTED,
    title: 'Leave Application Declined',
    message: `Your ${leave.leaveType || 'Leave'} request was declined.${reason ? ` Reason: ${reason}` : ''}`,
    link: '/leave',
    data: { leaveId: leave._id },
    priority: 'high',
    eventId: `leave_${leave._id}_rejected`,
  });
};

// 4. Task assigned
const notifyTaskAssigned = async ({ task, assigneeUserId, assignerName }) => {
  return await notify({
    recipient: assigneeUserId,
    type: NOTIFICATION_TYPES.TASK_ASSIGNED,
    title: 'New Task Assigned',
    message: `You have been assigned task: "${task.task || task.title}". Priority: ${task.priority || 'Normal'}.${assignerName ? ` Assigned by ${assignerName}.` : ''}`,
    link: '/tasks',
    data: { taskId: task._id },
    priority: 'normal',
    eventId: `task_${task._id}_assigned`,
  });
};

// 5. Task due
const notifyTaskDue = async ({ task, assigneeUserId }) => {
  return await notify({
    recipient: assigneeUserId,
    type: NOTIFICATION_TYPES.TASK_DUE,
    title: 'Task Due Soon',
    message: `Reminder: Task "${task.task || task.title}" is due on ${new Date(task.dueDate).toLocaleDateString()}.`,
    link: '/tasks',
    data: { taskId: task._id },
    priority: 'high',
    eventId: `task_${task._id}_due`,
  });
};

// 6. Task overdue
const notifyTaskOverdue = async ({ task, assigneeUserId, reviewerUserId }) => {
  const recipients = [assigneeUserId, reviewerUserId].filter(Boolean);
  return await notify({
    recipient: recipients,
    type: NOTIFICATION_TYPES.TASK_OVERDUE,
    title: '⚠️ Task Overdue Alert',
    message: `Urgent: Task "${task.task || task.title}" was due on ${new Date(task.dueDate).toLocaleDateString()} and is now overdue.`,
    link: '/tasks',
    data: { taskId: task._id },
    priority: 'urgent',
    eventId: `task_${task._id}_overdue`,
  });
};

// 7. Birthday
const notifyBirthday = async ({ employee, colleagueUserIds }) => {
  return await notify({
    recipient: colleagueUserIds,
    recipientEmployee: employee._id,
    type: NOTIFICATION_TYPES.BIRTHDAY,
    title: `🎂 Birthday Celebration: ${employee.name} ${employee.surname}`,
    message: `Today is ${employee.name} ${employee.surname}'s birthday (${employee.departmentName})! Don't forget to wish them well!`,
    link: '/calendar',
    data: { employeeId: employee._id },
    priority: 'normal',
    eventId: `birthday_${employee._id}`,
  });
};

// 8. Anniversary
const notifyAnniversary = async ({ employee, colleagueUserIds, yearsCompleted }) => {
  return await notify({
    recipient: colleagueUserIds,
    recipientEmployee: employee._id,
    type: NOTIFICATION_TYPES.ANNIVERSARY,
    title: `🏆 Work Anniversary: ${employee.name} ${employee.surname}`,
    message: `Congratulations to ${employee.name} ${employee.surname} for celebrating ${yearsCompleted} year(s) with TecMotiv Solutions!`,
    link: '/calendar',
    data: { employeeId: employee._id, yearsCompleted },
    priority: 'normal',
    eventId: `anniversary_${employee._id}`,
  });
};

// 9. Policy acknowledgement
const notifyPolicyAcknowledgement = async ({ policy, userIds }) => {
  return await notify({
    recipient: userIds,
    type: NOTIFICATION_TYPES.POLICY_ACKNOWLEDGEMENT,
    title: `New Policy Requiring Acknowledgement: ${policy.name}`,
    message: `Please review and acknowledge policy "${policy.name}" (Version ${policy.version || '1.0'}).`,
    link: '/policies',
    data: { policyId: policy._id },
    priority: 'high',
    eventId: `policy_${policy._id}`,
  });
};

// 10. Document expiry
const notifyDocumentExpiry = async ({ document, userIds, daysLeft }) => {
  return await notify({
    recipient: userIds,
    type: NOTIFICATION_TYPES.DOCUMENT_EXPIRY,
    title: `Document Expiring Soon: ${document.documentType || document.name}`,
    message: `The document "${document.documentType || document.name}" is set to expire in ${daysLeft} days on ${new Date(document.expiryDate).toLocaleDateString()}.`,
    link: '/employee',
    data: { documentId: document._id },
    priority: 'high',
    eventId: `document_${document._id}`,
  });
};

// 11. Probation ending
const notifyProbationEnding = async ({ employee, hrUserIds, daysLeft }) => {
  return await notify({
    recipient: hrUserIds,
    recipientEmployee: employee._id,
    type: NOTIFICATION_TYPES.PROBATION_ENDING,
    title: `Probation Ending: ${employee.name} ${employee.surname}`,
    message: `Probation review period for ${employee.name} ${employee.surname} (${employee.departmentName}) ends in ${daysLeft} days.`,
    link: '/employee',
    data: { employeeId: employee._id },
    priority: 'high',
    eventId: `probation_${employee._id}`,
  });
};

// 12. Event reminder
const notifyEventReminder = async ({ event, participantUserIds }) => {
  return await notify({
    recipient: participantUserIds,
    type: NOTIFICATION_TYPES.EVENT_REMINDER,
    title: `Upcoming Event Reminder: ${event.title || event.eventName}`,
    message: `Reminder for upcoming event "${event.title || event.eventName}" scheduled for ${new Date(event.startDate).toLocaleDateString()} at ${event.venue || event.location || 'TecMotiv Auditorium'}.`,
    link: '/events',
    data: { eventId: event._id },
    priority: 'normal',
    eventId: `event_${event._id}`,
  });
};

// 13. Recognition nomination
const notifyRecognitionNomination = async ({ recipientUserId, nomineeName, awardName }) => {
  return await notify({
    recipient: recipientUserId,
    type: NOTIFICATION_TYPES.RECOGNITION_NOMINATION,
    title: `🌟 Star Recognition Award: ${awardName}`,
    message: `Congratulations! You have received recognition: "${awardName}". Keep up the exceptional work at TecMotiv!`,
    link: '/recognition',
    priority: 'normal',
    eventId: `recognition_${recipientUserId}_${Date.now()}`,
  });
};

// 14. Salary slip available
const notifySalarySlipAvailable = async ({ employeeUserId, salaryPeriod }) => {
  return await notify({
    recipient: employeeUserId,
    type: NOTIFICATION_TYPES.SALARY_SLIP_AVAILABLE,
    title: `Salary Slip Available: ${salaryPeriod}`,
    message: `Your verified salary slip for period ${salaryPeriod} is now available in your employee self-service portal.`,
    link: '/payroll',
    priority: 'normal',
    eventId: `salary_slip_${employeeUserId}_${salaryPeriod}`,
  });
};

// 15. SaaS renewal
const notifySaaSRenewal = async ({ service, adminUserIds, daysLeft }) => {
  return await notify({
    recipient: adminUserIds,
    type: NOTIFICATION_TYPES.SAAS_RENEWAL,
    title: `Digital Service Renewal Reminder: ${service.serviceName}`,
    message: `Subscription renewal for ${service.serviceName} (${service.serviceType}) is due in ${daysLeft} days on ${new Date(service.renewalDate).toLocaleDateString()}. Annual Cost: ₹${service.cost}.`,
    link: '/admin',
    data: { serviceId: service._id },
    priority: 'high',
    eventId: `saas_${service._id}`,
  });
};

module.exports = {
  NOTIFICATION_TYPES,
  notify,
  emailDeliveryAdapter,
  whatsappDeliveryAdapter,
  // 15 Specialized Dispatchers
  notifyLeaveSubmitted,
  notifyLeaveApproved,
  notifyLeaveRejected,
  notifyTaskAssigned,
  notifyTaskDue,
  notifyTaskOverdue,
  notifyBirthday,
  notifyAnniversary,
  notifyPolicyAcknowledgement,
  notifyDocumentExpiry,
  notifyProbationEnding,
  notifyEventReminder,
  notifyRecognitionNomination,
  notifySalarySlipAvailable,
  notifySaaSRenewal,
};

const mongoose = require('mongoose');
const notificationService = require('../../../services/notificationService');

// Socket.IO real-time emission (decoupled via socket.js store)
const { getSocketIO } = require('../../../socket');
const io = {
  to: (room) => {
    const instance = getSocketIO();
    return instance ? instance.to(room) : { emit: () => {} };
  },
  emit: (...args) => {
    const instance = getSocketIO();
    if (instance) instance.emit(...args);
  },
};

// =============================================================================
// 1. LIST NOTIFICATIONS FOR AUTHENTICATED USER
// =============================================================================
const list = async (req, res) => {
  try {
    const user = req.user;
    const Notification = mongoose.models.Notification || require('../../../models/appModels/Notification');

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.items, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = {
      recipient: user._id,
      removed: false,
    };

    if (req.query.unreadOnly === 'true' || req.query.read === 'false') {
      filter.read = false;
    }
    if (req.query.type) {
      filter.type = req.query.type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ created: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: user._id, read: false, removed: false }),
    ]);

    // Emit notifications list via Socket.IO for real-time update
    if (io) {
      try {
        io.to(`user_${user._id}`).emit('notification-list', {
          success: true,
          notifications,
          pagination: {
            page,
            pages: Math.ceil(total / limit) || 1,
            count: total,
          },
          unreadCount,
        });
      } catch (emitError) {
        // Socket.IO emission failed; client will re-fetch on next action
        console.warn('Socket.IO notification-list emission failed:', emitError.message);
      }
    }

    return res.status(200).json({
      success: true,
      result: notifications,
      pagination: {
        page,
        pages: Math.ceil(total / limit) || 1,
        count: total,
      },
      unreadCount,
    });
  } catch (error) {
    console.error('Notification list error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// 2. GET UNREAD COUNT (FOR BADGE)
// =============================================================================
const unreadCount = async (req, res) => {
  try {
    const user = req.user;
    const Notification = mongoose.models.Notification || require('../../../models/appModels/Notification');

    const count = await Notification.countDocuments({
      recipient: user._id,
      read: false,
      removed: false,
    });

    // Emit updated unread count via Socket.IO for real-time badge update
    if (io) {
      try {
        io.to(`user_${user._id}`).emit('unread-count', {
          success: true,
          count,
        });
      } catch (emitError) {
        console.warn('Socket.IO unread-count emission failed:', emitError.message);
      }
    }

    return res.status(200).json({
      success: true,
      result: { count },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// 3. MARK SINGLE NOTIFICATION AS READ
// =============================================================================
const markRead = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const Notification = mongoose.models.Notification || require('../../../models/appModels/Notification');
    const notification = await Notification.findOne({
      _id: id,
      recipient: user._id,
      removed: false,
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    notification.read = true;
    notification.readAt = Date.now();
    await notification.save();

    const remainingUnread = await Notification.countDocuments({
      recipient: user._id,
      read: false,
      removed: false,
    });

    // Emit updated notification and unread count via Socket.IO
    if (io) {
      try {
        io.to(`user_${user._id}`).emit('notification-read', {
          success: true,
          notification,
          unreadCount: remainingUnread,
        });
        io.to(`user_${user._id}`).emit('unread-count', {
          success: true,
          count: remainingUnread,
        });
      } catch (emitError) {
        console.warn('Socket.IO markRead emission failed:', emitError.message);
      }
    }

    return res.status(200).json({
      success: true,
      result: notification,
      unreadCount: remainingUnread,
      message: 'Marked as read',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// 4. MARK ALL NOTIFICATIONS AS READ
// =============================================================================
const markAllRead = async (req, res) => {
  try {
    const user = req.user;
    const Notification = mongoose.models.Notification || require('../../../models/appModels/Notification');

    await Notification.updateMany(
      { recipient: user._id, read: false, removed: false },
      { $set: { read: true, readAt: Date.now() } }
    );

    // Emit updated unread count via Socket.IO
    const remainingUnread = await Notification.countDocuments({
      recipient: user._id,
      read: false,
      removed: false,
    });

    if (io) {
      try {
        io.to(`user_${user._id}`).emit('unread-count', {
          success: true,
          count: remainingUnread,
        });
        io.to(`user_${user._id}`).emit('notification-cleared', {
          success: true,
          message: 'All notifications marked as read',
        });
      } catch (emitError) {
        console.warn('Socket.IO markAllRead emission failed:', emitError.message);
      }
    }

    return res.status(200).json({
      success: true,
      unreadCount: 0,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// 5. DELETE / DISMISS NOTIFICATION
// =============================================================================
const deleteNotification = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const Notification = mongoose.models.Notification || require('../../../models/appModels/Notification');
    const notification = await Notification.findOne({
      _id: id,
      recipient: user._id,
      removed: false,
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    notification.removed = true;
    await notification.save();

    const remainingUnread = await Notification.countDocuments({
      recipient: user._id,
      read: false,
      removed: false,
    });

    if (io) {
      try {
        io.to(`user_${user._id}`).emit('unread-count', {
          success: true,
          count: remainingUnread,
        });
      } catch (emitError) {
        console.warn('Socket.IO deleteNotification emission failed:', emitError.message);
      }
    }

    return res.status(200).json({
      success: true,
      unreadCount: remainingUnread,
      message: 'Notification dismissed',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// 6. CLEAR ALL READ NOTIFICATIONS
// =============================================================================
const clearAll = async (req, res) => {
  try {
    const user = req.user;
    const Notification = mongoose.models.Notification || require('../../../models/appModels/Notification');

    await Notification.updateMany(
      { recipient: user._id, read: true, removed: false },
      { $set: { removed: true } }
    );

    return res.status(200).json({
      success: true,
      message: 'Read notifications cleared',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// 7. GET NOTIFICATION PREFERENCES
// =============================================================================
const getPreferences = async (req, res) => {
  try {
    const user = req.user;
    const NotificationPreference = mongoose.models.NotificationPreference || require('../../../models/appModels/NotificationPreference');

    let pref = await NotificationPreference.findOne({ user: user._id, removed: false });

    if (!pref) {
      pref = new NotificationPreference({
        user: user._id,
      });
      await pref.save();
    }

    return res.status(200).json({
      success: true,
      result: pref,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// 8. UPDATE NOTIFICATION PREFERENCES
// =============================================================================
const updatePreferences = async (req, res) => {
  try {
    const user = req.user;
    const NotificationPreference = mongoose.models.NotificationPreference || require('../../../models/appModels/NotificationPreference');

    let pref = await NotificationPreference.findOne({ user: user._id, removed: false });

    if (!pref) {
      pref = new NotificationPreference({ user: user._id });
    }

    const { channels, whatsappPhone, typePreferences, dndEnabled, dndStart, dndEnd } = req.body;

    if (channels !== undefined) {
      pref.channels = { ...pref.channels, ...channels };
    }
    if (whatsappPhone !== undefined) {
      pref.whatsappPhone = whatsappPhone;
    }
    if (typePreferences !== undefined) {
      pref.typePreferences = { ...pref.typePreferences, ...typePreferences };
    }
    if (dndEnabled !== undefined) {
      pref.dndEnabled = Boolean(dndEnabled);
    }
    if (dndStart !== undefined) pref.dndStart = dndStart;
    if (dndEnd !== undefined) pref.dndEnd = dndEnd;

    await pref.save();

    return res.status(200).json({
      success: true,
      result: pref,
      message: 'Notification preferences updated successfully',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================================
// 9. TRIGGER NOTIFICATION (CENTRALIZED TEST / DISPATCH ENDPOINT)
// =============================================================================
const PRIVILEGED_DISPATCH_ROLES = ['MANAGEMENT', 'OWNER', 'SUPER_ADMIN', 'HR', 'ADMIN'];

const trigger = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();
    const { type, title, message, link, recipient, data, priority, channels } = req.body;

    // Non-privileged roles may only notify themselves and only via
    // the in-app channel - prevents notification/email/WhatsApp spoofing.
    const isPrivileged = PRIVILEGED_DISPATCH_ROLES.includes(role);
    const targetRecipient = isPrivileged && recipient ? recipient : user._id;
    const safeChannels = isPrivileged ? channels || ['in_app'] : ['in_app'];

    const dispatchResult = await notificationService.notify({
      recipient: targetRecipient,
      type: type || 'SYSTEM_ANNOUNCEMENT',
      title: title || 'Notification Alert',
      message: message || 'You have a new update.',
      link: link || '',
      data: data || {},
      priority: priority || 'normal',
      channels: safeChannels,
    });

    return res.status(201).json({
      success: true,
      result: dispatchResult,
      message: 'Notification dispatched successfully via centralized notification service',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 10. GENERIC CRUD FALLBACKS (OWNERSHIP-SCOPED)
//
// The generic CRUD layer has no notion of notification ownership, so
// every fallback here is explicitly scoped to the authenticated user's
// own notifications to prevent cross-user reads/writes (IDOR).
// =========================================================================
const scopeToSelf = (req) => ({ recipient: req.user._id, removed: false });

const crudRead = async (req, res) => {
  try {
    const Notification = mongoose.models.Notification || require('../../../models/appModels/Notification');
    const notification = await Notification.findOne({
      _id: req.params.id,
      ...scopeToSelf(req),
    }).lean();
    if (!notification) {
      return res.status(404).json({ success: false, result: null, message: 'Notification not found' });
    }
    return res.status(200).json({ success: true, result: notification });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const crudCreate = async (req, res) => {
  try {
    const Notification = mongoose.models.Notification || require('../../../models/appModels/Notification');
    // Recipients are always restricted to the authenticated user.
    const notification = await new Notification({
      recipient: req.user._id,
      type: req.body.type || 'SYSTEM_ANNOUNCEMENT',
      title: req.body.title || 'Notification',
      message: req.body.message || '',
      link: req.body.link || '',
      data: req.body.data || {},
      priority: req.body.priority || 'normal',
      read: false,
    }).save();
    return res.status(201).json({ success: true, result: notification, message: 'Notification created' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const crudUpdate = async (req, res) => {
  try {
    const Notification = mongoose.models.Notification || require('../../../models/appModels/Notification');
    const notification = await Notification.findOne({
      _id: req.params.id,
      ...scopeToSelf(req),
    });
    if (!notification) {
      return res.status(404).json({ success: false, result: null, message: 'Notification not found' });
    }
    // Only the read state may be modified through the generic endpoint.
    if (req.body.read !== undefined) {
      notification.read = Boolean(req.body.read);
      notification.readAt = Date.now();
    }
    await notification.save();
    return res.status(200).json({ success: true, result: notification, message: 'Notification updated' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const crudListAll = async (req, res) => {
  try {
    const Notification = mongoose.models.Notification || require('../../../models/appModels/Notification');
    const result = await Notification.find(scopeToSelf(req))
      .sort({ created: -1 })
      .limit(100)
      .lean();
    return res.status(200).json({ success: true, result, message: 'Notifications retrieved' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const crudSearch = async (req, res) => {
  try {
    const Notification = mongoose.models.Notification || require('../../../models/appModels/Notification');
    const escapeRegex = (text) => (typeof text === 'string' ? text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '');
    const regex = new RegExp(escapeRegex(req.query.q || ''), 'i');
    const result = await Notification.find({
      ...scopeToSelf(req),
      $or: [{ title: regex }, { message: regex }, { type: regex }],
    })
      .limit(20)
      .lean();
    return res.status(200).json({ success: true, result, message: 'Notifications retrieved' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const crudFilter = crudListAll;

const crudSummary = async (req, res) => {
  try {
    const Notification = mongoose.models.Notification || require('../../../models/appModels/Notification');
    const countAllDocs = await Notification.countDocuments(scopeToSelf(req));
    const countFilter = await Notification.countDocuments({
      ...scopeToSelf(req),
      read: false,
    });
    return res.status(200).json({
      success: true,
      result: { countFilter, countAllDocs },
      message: 'Notification counts retrieved',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  list,
  unreadCount,
  markRead,
  markAllRead,
  delete: deleteNotification,
  clearAll,
  getPreferences,
  updatePreferences,
  trigger,
  // Ownership-scoped generic CRUD fallbacks
  read: crudRead,
  create: crudCreate,
  update: crudUpdate,
  listAll: crudListAll,
  search: crudSearch,
  filter: crudFilter,
  summary: crudSummary,
};

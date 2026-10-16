const mongoose = require('mongoose');
let ROLES;
try {
  ROLES = require('../../../rbac/roles').ROLES;
} catch (e) {
  ROLES = require('../../../rbac/roles').ROLES;
}

// =========================================================================
// 1. BULLETIN FEED PARTITIONED BY REQUIRED 4 SECTIONS
// =========================================================================
const feed = async (req, res) => {
  try {
    const Announcement = mongoose.models.Announcement || require('../../../models/appModels/Announcement');

    const filter = { removed: false };
    if (req.query.section) {
      filter.section = req.query.section.toUpperCase();
    }
    if (req.query.subType) {
      filter.subType = req.query.subType;
    }
    if (req.query.q) {
      const qReg = new RegExp(req.query.q, 'i');
      filter.$or = [{ title: qReg }, { content: qReg }, { subType: qReg }, { authorName: qReg }];
    }

    const allItems = await Announcement.find(filter)
      .sort({ pinned: -1, date: -1 })
      .lean();

    // Group into 4 requested sections
    const companyNews = allItems.filter((i) => i.section === 'COMPANY NEWS');
    const announcements = allItems.filter((i) => i.section === 'ANNOUNCEMENTS');
    const events = allItems.filter((i) => i.section === 'EVENTS');
    const recognition = allItems.filter((i) => i.section === 'RECOGNITION');

    return res.status(200).json({
      success: true,
      result: {
        all: allItems,
        companyNews,
        announcements,
        events,
        recognition,
        counts: {
          total: allItems.length,
          companyNews: companyNews.length,
          announcements: announcements.length,
          events: events.length,
          recognition: recognition.length,
        },
      },
      message: 'Bulletin feed retrieved successfully.',
    });
  } catch (error) {
    console.error('Bulletin feed error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 2. CREATE BULLETIN ITEM
// =========================================================================
const create = async (req, res) => {
  try {
    const user = req.user;
    const Announcement = mongoose.models.Announcement || require('../../../models/appModels/Announcement');

    const {
      title,
      content,
      summary,
      section,
      subType,
      department,
      priority,
      pinned,
      coverImage,
      tags,
    } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and Content are required.' });
    }

    const validSections = ['COMPANY NEWS', 'ANNOUNCEMENTS', 'EVENTS', 'RECOGNITION'];
    const selectedSection = (section || 'ANNOUNCEMENTS').toUpperCase();

    const newItem = await new Announcement({
      title: title.trim(),
      content: content.trim(),
      summary: (summary || content.slice(0, 140)).trim(),
      section: validSections.includes(selectedSection) ? selectedSection : 'ANNOUNCEMENTS',
      subType: subType || 'General',
      department: department || 'All',
      priority: priority || 'Normal',
      pinned: Boolean(pinned),
      coverImage: coverImage || '',
      tags: Array.isArray(tags) ? tags : [],
      author: user._id,
      authorName: `${user.name || ''} ${user.surname || ''}`.trim() || user.email,
      date: new Date(),
    }).save();

    return res.status(201).json({
      success: true,
      result: newItem,
      message: 'Bulletin post published successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 3. LIKE / UPVOTE A BULLETIN POST
// =========================================================================
const like = async (req, res) => {
  try {
    const Announcement = mongoose.models.Announcement || require('../../../models/appModels/Announcement');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid bulletin id.' });
    }
    const item = await Announcement.findOne({ _id: req.params.id, removed: false });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Bulletin post not found.' });
    }

    item.likes = (item.likes || 0) + 1;
    await item.save();

    return res.status(200).json({
      success: true,
      result: item,
      likes: item.likes,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 4. DELETE BULLETIN POST
// =========================================================================
const deleteItem = async (req, res) => {
  try {
    const Announcement = mongoose.models.Announcement || require('../../../models/appModels/Announcement');
    const item = await Announcement.findOne({ _id: req.params.id, removed: false });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Bulletin post not found.' });
    }

    item.removed = true;
    await item.save();

    return res.status(200).json({
      success: true,
      message: 'Bulletin post removed successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  feed,
  list: feed,
  create,
  like,
  delete: deleteItem,
  read: async (req, res) => {
    const Announcement = mongoose.models.Announcement || require('../../../models/appModels/Announcement');
    const item = await Announcement.findOne({ _id: req.params.id, removed: false });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
    return res.status(200).json({ success: true, result: item });
  },
};

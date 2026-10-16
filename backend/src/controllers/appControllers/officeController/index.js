const mongoose = require('mongoose');

// =========================================================================
// 1. LIST OFFICE OPERATIONS (BY CATEGORY & FILTERS)
// =========================================================================
const list = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();

    // Normal employees cannot access unrelated office administration records
    if (role === 'EMPLOYEE') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Unrelated administrative records are restricted to administrators.',
      });
    }

    const OfficeOperation =
      mongoose.models.OfficeOperation || require('../../../models/appModels/OfficeOperation');

    const filter = { removed: false };
    if (req.query.category && req.query.category !== 'ALL') {
      filter.category = req.query.category;
    }
    if (req.query.status && req.query.status !== 'ALL') {
      filter.status = req.query.status;
    }
    if (req.query.q) {
      const qReg = new RegExp(req.query.q, 'i');
      filter.$or = [{ title: qReg }, { vendor: qReg }, { notes: qReg }, { location: qReg }];
    }

    const items = await OfficeOperation.find(filter)
      .sort({ created: -1 })
      .lean();

    // Grouping by categories for overview
    const categories = [
      'Rent',
      'Office Facilities',
      'Housekeeping',
      'Pantry',
      'Stationery',
      'Equipment',
      'Assets',
      'Vendors',
      'Maintenance',
    ];

    const categoryStats = {};
    let totalExpenditure = 0;

    categories.forEach((cat) => {
      categoryStats[cat] = { count: 0, totalAmount: 0 };
    });

    const allOps = await OfficeOperation.find({ removed: false }).lean();
    allOps.forEach((op) => {
      totalExpenditure += Number(op.amount || 0);
      if (categoryStats[op.category]) {
        categoryStats[op.category].count++;
        categoryStats[op.category].totalAmount += Number(op.amount || 0);
      }
    });

    return res.status(200).json({
      success: true,
      result: items,
      summary: {
        totalRecords: items.length,
        totalExpenditure,
        categoryStats,
      },
      message: 'Office operations retrieved successfully.',
    });
  } catch (error) {
    console.error('Office operations list error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 2. CREATE OFFICE OPERATION RECORD
// =========================================================================
const create = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();

    if (!['ADMIN', 'MANAGEMENT', 'OWNER', 'SUPER_ADMIN'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only administrators can create office operations records.',
      });
    }

    const OfficeOperation =
      mongoose.models.OfficeOperation || require('../../../models/appModels/OfficeOperation');

    const {
      title,
      category,
      vendor,
      vendorContact,
      amount,
      frequency,
      dueDate,
      status,
      location,
      responsiblePerson,
      notes,
    } = req.body;

    if (!title || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title and Category are required fields.',
      });
    }

    const newOp = new OfficeOperation({
      title: title.trim(),
      category,
      vendor: vendor || '',
      vendorContact: vendorContact || '',
      amount: Number(amount || 0),
      frequency: frequency || 'Monthly',
      dueDate: dueDate ? new Date(dueDate) : null,
      status: status || 'Active',
      location: location || 'HQ - Bangalore',
      responsiblePerson: responsiblePerson || 'Admin Operations',
      notes: notes || '',
      createdBy: user._id,
    });

    await newOp.save();

    return res.status(201).json({
      success: true,
      result: newOp,
      message: 'Office management record added successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 3. UPDATE OFFICE OPERATION
// =========================================================================
const update = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();

    if (!['ADMIN', 'MANAGEMENT', 'OWNER', 'SUPER_ADMIN'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const OfficeOperation =
      mongoose.models.OfficeOperation || require('../../../models/appModels/OfficeOperation');

    const op = await OfficeOperation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!op) return res.status(404).json({ success: false, message: 'Record not found.' });

    return res.status(200).json({ success: true, result: op, message: 'Updated successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 4. DELETE OFFICE OPERATION
// =========================================================================
const deleteItem = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();

    if (!['ADMIN', 'MANAGEMENT', 'OWNER', 'SUPER_ADMIN'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const OfficeOperation =
      mongoose.models.OfficeOperation || require('../../../models/appModels/OfficeOperation');

    await OfficeOperation.findByIdAndUpdate(req.params.id, { removed: true });
    return res.status(200).json({ success: true, message: 'Office record deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  list,
  create,
  update,
  delete: deleteItem,
};

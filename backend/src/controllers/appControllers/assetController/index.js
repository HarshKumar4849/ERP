const mongoose = require('mongoose');

let ROLES;
try {
  ROLES = require('../../../rbac/roles').ROLES;
} catch (e) {
  ROLES = require('../../../rbac/roles').ROLES;
}

// =========================================================================
// 1. LIST ASSETS (INVENTORY WITH ROLE-BASED SCOPING)
// =========================================================================
const list = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();

    const Asset = mongoose.models.Asset || require('../../../models/appModels/Asset');
    const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');

    let filter = { removed: false };

    // Employee: ONLY assigned to themselves
    if (role === 'EMPLOYEE') {
      const emp = await Employee.findOne({ user: user._id, removed: false });
      if (!emp) {
        return res.status(200).json({
          success: true,
          result: [],
          counts: { total: 0, available: 0, issued: 0, returned: 0, maintenance: 0 },
          message: 'No employee record associated with this account.',
        });
      }
      filter.employee = emp._id;
      filter.status = 'Issued';
    } else {
      // ADMIN & MANAGEMENT Filters
      if (req.query.status && req.query.status !== 'ALL') {
        filter.status = req.query.status;
      }
      if (req.query.category && req.query.category !== 'ALL') {
        filter.category = req.query.category;
      }
      if (req.query.employee) {
        filter.employee = req.query.employee;
      }
      if (req.query.q) {
        const qReg = new RegExp(req.query.q, 'i');
        filter.$or = [{ name: qReg }, { assetId: qReg }, { serialNumber: qReg }, { employeeName: qReg }];
      }
    }

    const items = await Asset.find(filter)
      .populate('employee', 'name surname employeeId departmentName designationName email')
      .sort({ created: -1 })
      .lean();

    // Inventory status counts (for admins)
    let counts = { total: 0, available: 0, issued: 0, returned: 0, maintenance: 0 };
    if (role !== 'EMPLOYEE') {
      const allAssets = await Asset.find({ removed: false }).lean();
      counts.total = allAssets.length;
      allAssets.forEach((a) => {
        if (a.status === 'Available') counts.available++;
        else if (a.status === 'Issued') counts.issued++;
        else if (a.status === 'Returned') counts.returned++;
        else if (a.status === 'Maintenance') counts.maintenance++;
      });
    } else {
      counts = { total: items.length, issued: items.length, available: 0, returned: 0, maintenance: 0 };
    }

    return res.status(200).json({
      success: true,
      result: items,
      counts,
      message: 'Assets retrieved successfully.',
    });
  } catch (error) {
    console.error('Asset list error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 2. READ SINGLE ASSET
// =========================================================================
const read = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();

    const Asset = mongoose.models.Asset || require('../../../models/appModels/Asset');
    const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');

    const item = await Asset.findOne({ _id: req.params.id, removed: false })
      .populate('employee')
      .lean();

    if (!item) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }

    // Normal employee check: only own assigned asset
    if (role === 'EMPLOYEE') {
      const emp = await Employee.findOne({ user: user._id, removed: false });
      const empIdStr = emp ? emp._id.toString() : '';
      const assignedEmpStr = item.employee ? (item.employee._id || item.employee).toString() : '';

      if (!empIdStr || empIdStr !== assignedEmpStr) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only view assets assigned to yourself.',
        });
      }
    }

    return res.status(200).json({ success: true, result: item });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 3. CREATE ASSET (INVENTORY ENTRY)
// =========================================================================
const create = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();

    if (!['ADMIN', 'MANAGEMENT', 'OWNER', 'SUPER_ADMIN'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied: Only administrators can create assets.' });
    }

    const Asset = mongoose.models.Asset || require('../../../models/appModels/Asset');

    const {
      name,
      assetId,
      category,
      brand,
      model,
      serialNumber,
      cost,
      location,
      condition,
      remarks,
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Asset name is required.' });
    }

    const uniqueId = assetId || `TM-AST-${Math.floor(1000 + Math.random() * 9000)}`;

    const newAsset = new Asset({
      name: name.trim(),
      assetId: uniqueId.trim().toUpperCase(),
      category: category || 'Equipment',
      brand: brand || '',
      model: model || '',
      serialNumber: serialNumber || '',
      cost: Number(cost || 0),
      location: location || 'HQ - Bangalore',
      condition: condition || 'New',
      status: 'Available',
      remarks: remarks || '',
      history: [
        {
          action: 'CREATED',
          date: new Date(),
          condition: condition || 'New',
          performedBy: user._id,
          performedByName: `${user.name || ''} ${user.surname || ''}`.trim() || user.email,
          remarks: 'Asset cataloged in inventory.',
        },
      ],
    });

    await newAsset.save();

    return res.status(201).json({
      success: true,
      result: newAsset,
      message: 'Asset cataloged successfully.',
    });
  } catch (error) {
    console.error('Asset create error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 4. ASSIGN ASSET TO EMPLOYEE (Available -> Issued)
// =========================================================================
const assign = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();

    if (!['ADMIN', 'MANAGEMENT', 'OWNER', 'SUPER_ADMIN'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied: Only administrators can assign assets.' });
    }

    const Asset = mongoose.models.Asset || require('../../../models/appModels/Asset');
    const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');

    const asset = await Asset.findOne({ _id: req.params.id, removed: false });
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }

    if (asset.status === 'Issued') {
      return res.status(400).json({
        success: false,
        message: `Asset is already issued to ${asset.employeeName}. Must be returned first.`,
      });
    }

    if (asset.status === 'Maintenance') {
      return res.status(400).json({
        success: false,
        message: 'Asset is currently undergoing maintenance. Complete maintenance before assigning.',
      });
    }

    const { employee: employeeId, dateIssued, condition, expectedReturnDate, remarks } = req.body;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee selection is required for assignment.' });
    }

    const emp = await Employee.findOne({ _id: employeeId, removed: false });
    if (!emp) {
      return res.status(404).json({ success: false, message: 'Selected employee not found.' });
    }

    // Update Asset State
    asset.status = 'Issued';
    asset.employee = emp._id;
    asset.employeeName = `${emp.name} ${emp.surname || ''}`.trim();
    asset.employeeCode = emp.employeeId || '';
    asset.dateIssued = dateIssued ? new Date(dateIssued) : new Date();
    asset.condition = condition || asset.condition || 'Good';
    asset.expectedReturnDate = expectedReturnDate ? new Date(expectedReturnDate) : null;
    asset.returnDate = null;
    asset.remarks = remarks || '';

    // Append to History
    asset.history.push({
      action: 'ASSIGNED',
      employee: emp._id,
      employeeName: asset.employeeName,
      date: asset.dateIssued,
      condition: asset.condition,
      performedBy: user._id,
      performedByName: `${user.name || ''} ${user.surname || ''}`.trim() || user.email,
      remarks: remarks || `Issued to ${asset.employeeName}`,
    });

    await asset.save();

    return res.status(200).json({
      success: true,
      result: asset,
      message: `Asset successfully issued to ${asset.employeeName}.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 5. RETURN ASSET (Issued -> Returned)
// =========================================================================
const returnAsset = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();

    if (!['ADMIN', 'MANAGEMENT', 'OWNER', 'SUPER_ADMIN'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied: Only administrators can record asset returns.' });
    }

    const Asset = mongoose.models.Asset || require('../../../models/appModels/Asset');

    const asset = await Asset.findOne({ _id: req.params.id, removed: false });
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }

    if (asset.status !== 'Issued') {
      return res.status(400).json({
        success: false,
        message: `Asset cannot be returned because it is currently '${asset.status}'.`,
      });
    }

    const { returnDate, condition, remarks } = req.body;

    const rDate = returnDate ? new Date(returnDate) : new Date();
    const prevEmp = asset.employee;
    const prevEmpName = asset.employeeName;

    asset.status = 'Returned';
    asset.returnDate = rDate;
    if (condition) asset.condition = condition;
    if (remarks) asset.remarks = remarks;

    // Append to History
    asset.history.push({
      action: 'RETURNED',
      employee: prevEmp,
      employeeName: prevEmpName,
      date: rDate,
      condition: asset.condition,
      performedBy: user._id,
      performedByName: `${user.name || ''} ${user.surname || ''}`.trim() || user.email,
      remarks: remarks || `Returned by ${prevEmpName} in ${asset.condition} condition.`,
    });

    await asset.save();

    return res.status(200).json({
      success: true,
      result: asset,
      message: `Asset successfully marked as Returned by ${prevEmpName}.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 6. SEND TO MAINTENANCE (Returned -> Maintenance)
// =========================================================================
const maintenance = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();

    if (!['ADMIN', 'MANAGEMENT', 'OWNER', 'SUPER_ADMIN'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied: Only administrators can log maintenance.' });
    }

    const Asset = mongoose.models.Asset || require('../../../models/appModels/Asset');

    const asset = await Asset.findOne({ _id: req.params.id, removed: false });
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }

    const { issue, vendor, cost, remarks } = req.body;

    asset.status = 'Maintenance';
    asset.maintenanceIssue = issue || 'Routine check / Repair';
    asset.maintenanceVendor = vendor || 'Authorized Service Center';
    asset.maintenanceCost = Number(cost || 0);
    asset.maintenanceStartDate = new Date();
    asset.employee = null;
    asset.employeeName = '';
    asset.employeeCode = '';

    // Append to History
    asset.history.push({
      action: 'SENT_TO_MAINTENANCE',
      date: new Date(),
      condition: asset.condition,
      performedBy: user._id,
      performedByName: `${user.name || ''} ${user.surname || ''}`.trim() || user.email,
      remarks: remarks || `Sent to maintenance: ${asset.maintenanceIssue} (Vendor: ${asset.maintenanceVendor})`,
    });

    await asset.save();

    return res.status(200).json({
      success: true,
      result: asset,
      message: 'Asset sent to maintenance queue.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 7. COMPLETE MAINTENANCE (Maintenance -> Available)
// =========================================================================
const completeMaintenance = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();

    if (!['ADMIN', 'MANAGEMENT', 'OWNER', 'SUPER_ADMIN'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied: Only administrators can complete maintenance.' });
    }

    const Asset = mongoose.models.Asset || require('../../../models/appModels/Asset');

    const asset = await Asset.findOne({ _id: req.params.id, removed: false });
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }

    const { condition, remarks, actualCost } = req.body;

    asset.status = 'Available';
    asset.condition = condition || 'Good';
    asset.maintenanceEndDate = new Date();
    if (actualCost) asset.maintenanceCost = Number(actualCost);

    // Append to History
    asset.history.push({
      action: 'MAINTENANCE_COMPLETED',
      date: new Date(),
      condition: asset.condition,
      performedBy: user._id,
      performedByName: `${user.name || ''} ${user.surname || ''}`.trim() || user.email,
      remarks: remarks || 'Maintenance successfully completed. Returned to available inventory.',
    });

    await asset.save();

    return res.status(200).json({
      success: true,
      result: asset,
      message: 'Maintenance completed. Asset is now Available for reissue.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 8. ASSET HISTORY
// =========================================================================
const history = async (req, res) => {
  try {
    const Asset = mongoose.models.Asset || require('../../../models/appModels/Asset');

    const asset = await Asset.findOne({ _id: req.params.id, removed: false }).lean();
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found.' });
    }

    return res.status(200).json({
      success: true,
      result: asset.history || [],
      message: 'Asset history retrieved successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 9. UPDATE & DELETE
// =========================================================================
const update = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();
    if (!['ADMIN', 'MANAGEMENT', 'OWNER', 'SUPER_ADMIN'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const Asset = mongoose.models.Asset || require('../../../models/appModels/Asset');
    const asset = await Asset.findByIdAndUpdate(req.params.id, req.body, { new: true });
    return res.status(200).json({ success: true, result: asset });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteItem = async (req, res) => {
  try {
    const user = req.user;
    const role = (user.role || 'EMPLOYEE').toUpperCase();
    if (!['ADMIN', 'MANAGEMENT', 'OWNER', 'SUPER_ADMIN'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const Asset = mongoose.models.Asset || require('../../../models/appModels/Asset');
    await Asset.findByIdAndUpdate(req.params.id, { removed: true });
    return res.status(200).json({ success: true, message: 'Asset removed from inventory.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  list,
  read,
  create,
  update,
  delete: deleteItem,
  assign,
  returnAsset,
  maintenance,
  completeMaintenance,
  history,
};

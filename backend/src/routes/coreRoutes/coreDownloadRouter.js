const mongoose = require('mongoose');
const downloadPdf = require('../../handlers/downloadHandler/downloadPdf');
const { ROLES, normalizeRole } = require('../../rbac/roles');
const { isActionAllowed } = require('../../rbac/permissions');
const express = require('express');

const router = express.Router();

router.route('/:directory/:file').get(async function (req, res) {
  try {
    const { directory, file } = req.params;
    const user = req.user || req.admin;

    if (!user) {
      return res.status(401).json({
        success: false,
        result: null,
        message: 'Authentication required. No valid session found.',
      });
    }

    const role = normalizeRole(user.role);
    const entity = directory.toLowerCase();

    // Vault documents are private and must only be accessed through /api/document/download/:id
    if (entity === 'document') {
      return res.status(403).json({
        success: false,
        result: null,
        message: 'Access denied: Document vault files must be accessed via /api/document/download/:id',
      });
    }

    // Check role-level permission to read this entity
    if (!isActionAllowed(role, entity, 'read')) {
      return res.status(403).json({
        success: false,
        result: null,
        message: `Access denied: Role '${role}' is not authorized to download ${directory} files.`,
      });
    }

    const id = file.slice(directory.length + 1).slice(0, -4); // extract id from file name

    if (['document', 'salary'].includes(entity) && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'Invalid download id.',
      });
    }

    // Ownership check for employees
    if (role === ROLES.EMPLOYEE) {
      if (entity === 'salary' && mongoose.Types.ObjectId.isValid(id)) {
        const SalaryModel = mongoose.model('Salary');
        const salaryRecord = await SalaryModel.findOne({ _id: id, removed: false });
        if (salaryRecord && salaryRecord.user && salaryRecord.user.toString() !== user._id.toString()) {
          return res.status(403).json({
            success: false,
            result: null,
            message: "Access denied: You cannot download another employee's confidential salary data.",
          });
        }
      }
      if (entity === 'employee') {
        const EmployeeModel = mongoose.model('Employee');
        const empQuery = mongoose.Types.ObjectId.isValid(id)
          ? { $or: [{ _id: id }, { user: id }] }
          : { employeeId: id.toUpperCase() };
        const empRecord = await EmployeeModel.findOne({ ...empQuery, removed: false });
        if (empRecord && empRecord.user && empRecord.user.toString() !== user._id.toString()) {
          return res.status(403).json({
            success: false,
            result: null,
            message: "Access denied: You cannot download another employee's confidential profile.",
          });
        }
      }
    }

    downloadPdf(req, res, { directory, id });
  } catch (error) {
    return res.status(503).json({
      success: false,
      result: null,
      message: error.message,
      error: error,
    });
  }
});

module.exports = router;

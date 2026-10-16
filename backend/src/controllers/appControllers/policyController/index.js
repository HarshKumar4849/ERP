const mongoose = require('mongoose');
let ROLES;
try {
  ROLES = require('../../../rbac/roles').ROLES;
} catch (e) {
  ROLES = require('../../../rbac/roles').ROLES;
}

// Helper to resolve Employee document
const resolveEmployee = async (user) => {
  if (!user) return null;
  const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');
  let employee = await Employee.findOne({ user: user._id, removed: false });
  if (!employee && user.email) {
    employee = await Employee.findOne({ email: user.email.toLowerCase(), removed: false });
  }
  return employee;
};

// =========================================================================
// 1. LIST POLICIES WITH REAL-TIME EMPLOYEE ACKNOWLEDGEMENT STATUS
// =========================================================================
const list = async (req, res) => {
  try {
    const user = req.user;
    const Policy = mongoose.models.Policy || require('../../../models/appModels/Policy');
    const PolicyAcknowledgement = mongoose.models.PolicyAcknowledgement || require('../../../models/appModels/PolicyAcknowledgement');

    const userEmp = await resolveEmployee(user);
    const empId = userEmp?._id;

    const policies = await Policy.find({ removed: false })
      .sort({ category: 1, name: 1 })
      .lean();

    // Check user acknowledgements if employee
    const userAckMap = {};
    if (empId) {
      const userAcks = await PolicyAcknowledgement.find({
        employee: empId,
      }).lean();

      userAcks.forEach((ack) => {
        userAckMap[ack.policy.toString()] = {
          acknowledged: true,
          version: ack.version,
          timestamp: ack.timestamp,
          statement: ack.statement,
        };
      });
    }

    // Enhance each policy with acknowledgement status
    const enhancedPolicies = policies.map((p) => {
      const ackInfo = userAckMap[p._id.toString()];
      const isUpToDateAck = ackInfo && ackInfo.version === p.version;
      return {
        ...p,
        isAcknowledged: Boolean(isUpToDateAck),
        acknowledgementDetails: ackInfo || null,
      };
    });

    // Group into requested categories: HR, IT, COMPANY
    const hrPolicies = enhancedPolicies.filter((p) => p.category === 'HR');
    const itPolicies = enhancedPolicies.filter((p) => p.category === 'IT');
    const companyPolicies = enhancedPolicies.filter((p) => p.category === 'COMPANY' || p.category === 'General');

    return res.status(200).json({
      success: true,
      result: {
        all: enhancedPolicies,
        hr: hrPolicies,
        it: itPolicies,
        company: companyPolicies,
        total: enhancedPolicies.length,
      },
      message: 'Policy library retrieved successfully.',
    });
  } catch (error) {
    console.error('Policy list error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 2. DIGITALLY ACKNOWLEDGE POLICY ("I have read and understood this policy.")
// =========================================================================
const acknowledge = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid policy id.' });
    }

    const Policy = mongoose.models.Policy || require('../../../models/appModels/Policy');
    const PolicyAcknowledgement = mongoose.models.PolicyAcknowledgement || require('../../../models/appModels/PolicyAcknowledgement');

    const policy = await Policy.findOne({ _id: id, removed: false });
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    const employee = await resolveEmployee(user);
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'No associated employee profile found for user account.',
      });
    }

    const empName = `${employee.name} ${employee.surname}`.trim();

    // Upsert acknowledgement record
    const ackRecord = await PolicyAcknowledgement.findOneAndUpdate(
      {
        employee: employee._id,
        policy: policy._id,
        version: policy.version || '1.0',
      },
      {
        employee: employee._id,
        user: user._id,
        employeeName: empName,
        department: employee.departmentName || user.department || 'General',
        policy: policy._id,
        policyName: policy.name || policy.title,
        version: policy.version || '1.0',
        timestamp: new Date(),
        statement: 'I have read and understood this policy.',
        ipAddress: req.ip || '127.0.0.1',
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      result: ackRecord,
      message: `Policy "${policy.name}" (v${policy.version}) has been successfully acknowledged.`,
    });
  } catch (error) {
    console.error('Policy acknowledgement error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 3. GET AUDIT TRAIL OF ACKNOWLEDGEMENTS FOR A POLICY (HR / MANAGEMENT)
// =========================================================================
const acknowledgements = async (req, res) => {
  try {
    const { id } = req.params;
    const Policy = mongoose.models.Policy || require('../../../models/appModels/Policy');
    const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');
    const PolicyAcknowledgement = mongoose.models.PolicyAcknowledgement || require('../../../models/appModels/PolicyAcknowledgement');

    const user = req.user;
    const role = (user?.role || req.userRole || 'EMPLOYEE').toUpperCase();
    if (!['ADMIN', 'MANAGEMENT', 'OWNER', 'SUPER_ADMIN', 'HR'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only HR and Administrators can view compliance audit trails.',
      });
    }

    const policy = await Policy.findOne({ _id: id, removed: false });
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    const [acks, totalEmployees] = await Promise.all([
      PolicyAcknowledgement.find({ policy: policy._id })
        .populate('employee', 'name surname photo departmentName designationName email employeeId')
        .sort({ timestamp: -1 })
        .lean(),
      Employee.countDocuments({ removed: false, status: { $ne: 'Terminated' } }),
    ]);

    const complianceRate = totalEmployees > 0 ? Math.round((acks.length / totalEmployees) * 100) : 0;

    return res.status(200).json({
      success: true,
      result: {
        policy,
        acknowledgements: acks,
        totalAcknowledged: acks.length,
        totalEmployees,
        complianceRate,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 4. CREATE POLICY (HR / MANAGEMENT / ADMIN)
// =========================================================================
const create = async (req, res) => {
  try {
    const user = req.user;
    const Policy = mongoose.models.Policy || require('../../../models/appModels/Policy');

    const {
      name,
      title,
      category,
      subType,
      version,
      effectiveDate,
      ownerName,
      content,
      document,
      file,
      acknowledgementRequired,
      isMandatory,
    } = req.body;

    const policyName = name || title;
    if (!policyName || !policyName.trim()) {
      return res.status(400).json({ success: false, message: 'Policy name is required.' });
    }

    const newPolicy = await new Policy({
      name: policyName.trim(),
      title: policyName.trim(),
      category: category || 'COMPANY',
      subType: subType || 'General Policy',
      version: version || '1.0',
      effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
      owner: user._id,
      ownerName: ownerName || `${user.name} ${user.surname}`.trim() || 'HR & Compliance',
      content: content || '',
      document: document || file || '',
      file: document || file || '',
      acknowledgementRequired: acknowledgementRequired !== undefined ? Boolean(acknowledgementRequired) : true,
      isMandatory: isMandatory !== undefined ? Boolean(isMandatory) : true,
    }).save();

    return res.status(201).json({
      success: true,
      result: newPolicy,
      message: 'Policy created successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 5. UPDATE POLICY
// =========================================================================
const update = async (req, res) => {
  try {
    const Policy = mongoose.models.Policy || require('../../../models/appModels/Policy');
    const policy = await Policy.findOne({ _id: req.params.id, removed: false });

    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    const fields = [
      'name',
      'title',
      'category',
      'subType',
      'version',
      'effectiveDate',
      'ownerName',
      'content',
      'document',
      'file',
      'acknowledgementRequired',
      'isMandatory',
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        policy[f] = req.body[f];
      }
    });

    policy.updated = Date.now();
    await policy.save();

    return res.status(200).json({
      success: true,
      result: policy,
      message: 'Policy updated successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 6. DELETE POLICY
// =========================================================================
const deletePolicy = async (req, res) => {
  try {
    const Policy = mongoose.models.Policy || require('../../../models/appModels/Policy');
    const policy = await Policy.findOne({ _id: req.params.id, removed: false });

    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found.' });
    }

    policy.removed = true;
    policy.updated = Date.now();
    await policy.save();

    return res.status(200).json({
      success: true,
      message: 'Policy deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  list,
  listAll: list,
  filter: list,
  acknowledge,
  acknowledgements,
  create,
  update,
  delete: deletePolicy,
  read: async (req, res) => {
    const Policy = mongoose.models.Policy || require('../../../models/appModels/Policy');
    const policy = await Policy.findOne({ _id: req.params.id, removed: false });
    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found.' });
    return res.status(200).json({ success: true, result: policy });
  },
};

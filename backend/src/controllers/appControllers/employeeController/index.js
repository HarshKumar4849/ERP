const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, normalizeRole } = require('../../../rbac/roles');

const isEmployeeRole = (req) => {
  const role = req.userRole || (req.user && req.user.role);
  return normalizeRole ? normalizeRole(role) === ROLES.EMPLOYEE : (role === 'EMPLOYEE' || role === 'employee');
};

const resolveOrCreateEmployee = async (userDoc) => {
  if (!userDoc) return null;
  const Employee = mongoose.model('Employee');
  const userId = userDoc._id;
  const userEmail = (userDoc.email || '').toLowerCase().trim();
  const userEmpId = (userDoc.employeeId || '').toUpperCase().trim();

  // 1. Broadly search for any existing Employee document across all matching criteria
  const orClauses = [];
  if (userId) orClauses.push({ user: userId });
  if (userEmail) {
    orClauses.push({ email: userEmail });
    orClauses.push({ personalEmail: userEmail });
  }
  if (userEmpId) {
    orClauses.push({ employeeId: userEmpId });
  }

  let emp = orClauses.length > 0 ? await Employee.findOne({ $or: orClauses }) : null;

  if (emp) {
    let changed = false;
    if (emp.removed) {
      emp.removed = false;
      changed = true;
    }
    if (userId && (!emp.user || emp.user.toString() !== userId.toString())) {
      emp.user = userId;
      changed = true;
    }
    if (!emp.name && userDoc.name) {
      emp.name = userDoc.name;
      changed = true;
    }
    if (!emp.surname && userDoc.surname) {
      emp.surname = userDoc.surname;
      changed = true;
    }
    if (changed) {
      await emp.save();
    }
    return emp;
  }

  // 2. Generate guaranteed collision-free employeeId
  let candidateEmpId = userEmpId;
  if (!candidateEmpId) {
    for (let attempts = 0; attempts < 30; attempts++) {
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const testId = `TM-${randNum}`;
      const exists = await Employee.findOne({ employeeId: testId });
      if (!exists) {
        candidateEmpId = testId;
        break;
      }
    }
    if (!candidateEmpId) candidateEmpId = `TM-${Date.now().toString().slice(-4)}`;
  }

  const role = normalizeRole ? normalizeRole(userDoc.role || (userDoc.department === 'HR' ? 'HR' : '')) : userDoc.role;
  const newEmp = new Employee({
    employeeId: candidateEmpId,
    name: userDoc.name || 'Employee',
    surname: userDoc.surname || '',
    email: userEmail || `emp-${Date.now()}@tecmotiv.local`,
    departmentName: userDoc.department || 'General',
    designationName: userDoc.designation || (role === ROLES.HR ? 'HR Specialist' : 'Staff'),
    status: 'Active',
    user: userId,
    removed: false,
    enabled: true,
  });

  try {
    await newEmp.save();
    if (userDoc.save && !userDoc.employeeId) {
      try {
        userDoc.employeeId = candidateEmpId;
        await userDoc.save();
      } catch (e) {}
    }
    return newEmp;
  } catch (err) {
    if (err.code === 11000) {
      const existing = await Employee.findOne({
        $or: [
          ...(userEmail ? [{ email: userEmail }] : []),
          { employeeId: candidateEmpId },
          ...(userId ? [{ user: userId }] : []),
        ],
      });
      if (existing) {
        if (userId) existing.user = userId;
        existing.removed = false;
        await existing.save();
        return existing;
      }
    }
    throw err;
  }
};

// Helper to normalize array fields (skills, qualifications, etc.)
const normalizeArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // not JSON, treat as comma-separated
    }
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

// Helper to resolve Department name/id
const resolveDepartment = async (deptInput) => {
  if (!deptInput) return { id: undefined, name: '' };
  const Department = mongoose.model('Department');
  if (mongoose.Types.ObjectId.isValid(deptInput)) {
    const doc = await Department.findById(deptInput);
    if (doc) return { id: doc._id, name: doc.name };
  }
  const byName = await Department.findOne({
    name: { $regex: new RegExp(`^${deptInput}$`, 'i') },
    removed: false,
  });
  if (byName) return { id: byName._id, name: byName.name };
  return { id: undefined, name: String(deptInput) };
};

// Helper to resolve Designation name/id
const resolveDesignation = async (desigInput) => {
  if (!desigInput) return { id: undefined, name: '' };
  const Designation = mongoose.model('Designation');
  if (mongoose.Types.ObjectId.isValid(desigInput)) {
    const doc = await Designation.findById(desigInput);
    if (doc) return { id: doc._id, name: doc.name };
  }
  const byName = await Designation.findOne({
    name: { $regex: new RegExp(`^${desigInput}$`, 'i') },
    removed: false,
  });
  if (byName) return { id: byName._id, name: byName.name };
  return { id: undefined, name: String(desigInput) };
};

// Helper to resolve Location name/id
const resolveLocation = async (locInput) => {
  if (!locInput) return { id: undefined, name: '' };
  const Location = mongoose.model('Location');
  if (mongoose.Types.ObjectId.isValid(locInput)) {
    const doc = await Location.findById(locInput);
    if (doc) return { id: doc._id, name: doc.name };
  }
  const byName = await Location.findOne({
    name: { $regex: new RegExp(`^${locInput}$`, 'i') },
    removed: false,
  });
  if (byName) return { id: byName._id, name: byName.name };
  return { id: undefined, name: String(locInput) };
};

// Auto-generate employee ID
const generateEmployeeId = async () => {
  const Employee = mongoose.model('Employee');
  const count = await Employee.countDocuments();
  const nextNum = 1000 + count + 1;
  return `TM-${nextNum}`;
};

const employeeController = {
  // ==========================================
  // CREATE EMPLOYEE
  // ==========================================
  create: async (req, res) => {
    if (isEmployeeRole(req)) {
      return res.status(403).json({
        success: false,
        result: null,
        message: 'Access denied: Employees cannot create employee records.',
      });
    }

    const Employee = mongoose.model('Employee');
    const body = { ...req.body };

    // Handle photo if uploaded via multer
    if (req.file) {
      body.photo = `public/uploads/employee/${req.file.filename}`;
    }

    if (!body.name || !body.email) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'Name and official email are required.',
      });
    }

    // Auto-generate employee ID if missing
    if (!body.employeeId || body.employeeId.trim() === '') {
      body.employeeId = await generateEmployeeId();
    } else {
      body.employeeId = body.employeeId.trim().toUpperCase();
    }

    // Check email uniqueness
    const existing = await Employee.findOne({
      email: body.email.toLowerCase().trim(),
      removed: false,
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        result: null,
        message: `An employee with email '${body.email}' already exists.`,
      });
    }

    // Check employeeId uniqueness
    const existingId = await Employee.findOne({
      employeeId: body.employeeId,
      removed: false,
    });
    if (existingId) {
      return res.status(400).json({
        success: false,
        result: null,
        message: `Employee ID '${body.employeeId}' is already assigned.`,
      });
    }

    // Resolve relationships
    if (body.department) {
      const dept = await resolveDepartment(body.department);
      if (dept.id) body.department = dept.id;
      else delete body.department;
      body.departmentName = dept.name;
    }

    if (body.designation) {
      const desig = await resolveDesignation(body.designation);
      if (desig.id) body.designation = desig.id;
      else delete body.designation;
      body.designationName = desig.name;
    }

    if (body.workLocation) {
      const loc = await resolveLocation(body.workLocation);
      if (loc.id) body.workLocation = loc.id;
      else delete body.workLocation;
      body.workLocationName = loc.name;
    }

    if (body.reportingManager && !mongoose.Types.ObjectId.isValid(body.reportingManager)) {
      delete body.reportingManager;
    }

    // Parse array fields
    body.skills = normalizeArray(body.skills);
    body.qualifications = normalizeArray(body.qualifications);
    body.certifications = normalizeArray(body.certifications);
    body.areasOfExpertise = normalizeArray(body.areasOfExpertise);
    if (body.assignedProjects && Array.isArray(body.assignedProjects)) {
      body.assignedProjects = body.assignedProjects.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );
    }

    // Parse emergencyContact if passed as JSON string
    if (typeof body.emergencyContact === 'string') {
      try {
        body.emergencyContact = JSON.parse(body.emergencyContact);
      } catch (e) {
        body.emergencyContact = { name: '', phone: '', relationship: '' };
      }
    }

    const newEmployee = new Employee(body);
    const result = await newEmployee.save();

    // Auto-provision user login account (Admin + AdminPassword) so the employee/HR can immediately log in
    try {
      const AdminModel = mongoose.model('Admin');
      const AdminPasswordModel = mongoose.model('AdminPassword');
      const cleanEmail = body.email.toLowerCase().trim();

      let userAccount = await AdminModel.findOne({ email: cleanEmail, removed: false });

      const isHrRole =
        body.departmentName === 'Human Resources' ||
        body.departmentName === 'HR' ||
        (body.designationName && /HR|People|Human Resource/i.test(body.designationName));

      const assignedRole = isHrRole ? 'HR' : 'EMPLOYEE';

      if (!userAccount) {
        userAccount = new AdminModel({
          name: body.name ? body.name.trim() : 'Employee',
          surname: body.surname ? body.surname.trim() : '',
          email: cleanEmail,
          employeeId: body.employeeId,
          role: assignedRole,
          department: body.departmentName || '',
          designation: body.designationName || '',
          enabled: true,
          removed: false,
        });
        await userAccount.save();

        const initialPassword = body.loginPassword || 'admin123';
        const userPassword = new AdminPasswordModel({ user: userAccount._id });
        const salt = bcrypt.genSaltSync(10);
        userPassword.salt = salt;
        userPassword.password = userPassword.generateHash(salt, initialPassword);
        userPassword.emailVerified = true;
        await userPassword.save();
      } else {
        if (!userAccount.employeeId) userAccount.employeeId = body.employeeId;
        if (body.departmentName) userAccount.department = body.departmentName;
        if (body.designationName) userAccount.designation = body.designationName;
        if (isHrRole && userAccount.role === 'EMPLOYEE') {
          userAccount.role = 'HR';
        }
        userAccount.enabled = true;
        await userAccount.save();

        if (body.loginPassword) {
          let userPassword = await AdminPasswordModel.findOne({ user: userAccount._id });
          if (!userPassword) {
            userPassword = new AdminPasswordModel({ user: userAccount._id });
          }
          const salt = bcrypt.genSaltSync(10);
          userPassword.salt = salt;
          userPassword.password = userPassword.generateHash(salt, body.loginPassword);
          userPassword.emailVerified = true;
          await userPassword.save();
        }
      }

      result.user = userAccount._id;
      await result.save();
    } catch (provisionErr) {
      console.error('Error auto-provisioning login account for employee:', provisionErr);
    }

    const populated = await Employee.findById(result._id)
      .populate('department', 'name code')
      .populate('designation', 'name code level')
      .populate('workLocation', 'name code city type')
      .populate('reportingManager', 'name surname employeeId email photo')
      .populate('assignedProjects', 'name code status')
      .populate('user', 'email role');

    return res.status(200).json({
      success: true,
      result: populated,
      message: 'Employee record created successfully.',
    });
  },

  // ==========================================
  // READ EMPLOYEE BY ID
  // ==========================================
  read: async (req, res) => {
    const Employee = mongoose.model('Employee');
    const Admin = mongoose.model('Admin');
    const { id } = req.params;

    const targetId = (id === 'self' || id === 'me') && req.user ? req.user._id : id;

    const query = mongoose.Types.ObjectId.isValid(targetId)
      ? { $or: [{ _id: targetId }, { user: targetId }] }
      : {
          $or: [
            { employeeId: String(targetId).toUpperCase() },
            { email: String(targetId).toLowerCase() },
          ],
        };

    let result = await Employee.findOne({ ...query, removed: false })
      .populate('department', 'name code description')
      .populate('designation', 'name code level description')
      .populate('workLocation', 'name code city state country type')
      .populate('reportingManager', 'name surname employeeId email photo designationName departmentName')
      .populate('assignedProjects', 'name code description status startDate endDate')
      .populate('user', 'email role enabled created');

    if (!result) {
      // Check if targetId matches an Admin record
      let adminUser = null;
      if (req.user && (req.user._id?.toString() === String(targetId) || req.user.employeeId === targetId || req.user.email === targetId)) {
        adminUser = req.user;
      } else if (mongoose.Types.ObjectId.isValid(targetId)) {
        adminUser = await Admin.findOne({ _id: targetId, removed: false });
      }

      if (adminUser) {
        result = await resolveOrCreateEmployee(adminUser);
      }
    }

    if (!result) {
      return res.status(404).json({
        success: false,
        result: null,
        message: 'Employee not found.',
      });
    }

    if (isEmployeeRole(req)) {
      let ownEmp = await Employee.findOne({ user: req.user._id, removed: false });
      if (!ownEmp && req.user.email) {
        ownEmp = await Employee.findOne({ email: req.user.email.toLowerCase(), removed: false });
      }
      const ownEmpIdStr = ownEmp ? ownEmp._id.toString() : '';
      const userIdStr = req.user._id.toString();
      const recIdStr = result._id.toString();
      const recUserStr = result.user ? (result.user._id ? result.user._id.toString() : result.user.toString()) : '';
      if (recIdStr !== ownEmpIdStr && recUserStr !== userIdStr) {
        return res.status(403).json({
          success: false,
          result: null,
          message: "Access denied: You cannot access another employee's confidential profile.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      result,
      message: 'Employee record retrieved successfully.',
    });
  },

  // ==========================================
  // UPDATE EMPLOYEE
  // ==========================================
  update: async (req, res) => {
    const Employee = mongoose.model('Employee');
    const { id } = req.params;
    const body = { ...req.body };

    if (isEmployeeRole(req)) {
      let ownEmp = await Employee.findOne({ user: req.user._id, removed: false });
      if (!ownEmp && req.user.email) {
        ownEmp = await Employee.findOne({ email: req.user.email.toLowerCase(), removed: false });
      }
      const ownEmpIdStr = ownEmp ? ownEmp._id.toString() : '';
      if (!ownEmpIdStr || ownEmpIdStr !== id.toString()) {
        return res.status(403).json({
          success: false,
          result: null,
          message: "Access denied: You cannot modify another employee's profile.",
        });
      }
      // Prevent privilege escalation or critical field tampering
      delete body.department;
      delete body.departmentName;
      delete body.designation;
      delete body.designationName;
      delete body.status;
      delete body.employeeId;
      delete body.user;
      delete body.removed;
      delete body.enabled;
    }

    const employee = await Employee.findOne({ _id: id, removed: false });
    if (!employee) {
      return res.status(404).json({
        success: false,
        result: null,
        message: 'Employee record not found.',
      });
    }

    if (req.file) {
      body.photo = `public/uploads/employee/${req.file.filename}`;
    }

    // Validate email uniqueness if changing email
    if (body.email && body.email.toLowerCase().trim() !== employee.email) {
      const existing = await Employee.findOne({
        email: body.email.toLowerCase().trim(),
        _id: { $ne: id },
        removed: false,
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          result: null,
          message: `An employee with email '${body.email}' already exists.`,
        });
      }
    }

    // Resolve relationships
    if (body.department !== undefined) {
      const dept = await resolveDepartment(body.department);
      body.department = dept.id || null;
      body.departmentName = dept.name;
    }

    if (body.designation !== undefined) {
      const desig = await resolveDesignation(body.designation);
      body.designation = desig.id || null;
      body.designationName = desig.name;
    }

    if (body.workLocation !== undefined) {
      const loc = await resolveLocation(body.workLocation);
      body.workLocation = loc.id || null;
      body.workLocationName = loc.name;
    }

    if (body.reportingManager !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(body.reportingManager)) {
        body.reportingManager = null;
      }
    }

    if (body.skills !== undefined) body.skills = normalizeArray(body.skills);
    if (body.qualifications !== undefined) body.qualifications = normalizeArray(body.qualifications);
    if (body.certifications !== undefined) body.certifications = normalizeArray(body.certifications);
    if (body.areasOfExpertise !== undefined) body.areasOfExpertise = normalizeArray(body.areasOfExpertise);

    if (body.emergencyContact && typeof body.emergencyContact === 'string') {
      try {
        body.emergencyContact = JSON.parse(body.emergencyContact);
      } catch (e) {}
    }

    body.updated = Date.now();

    const updated = await Employee.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    })
      .populate('department', 'name code')
      .populate('designation', 'name code level')
      .populate('workLocation', 'name code city type')
      .populate('reportingManager', 'name surname employeeId email photo')
      .populate('assignedProjects', 'name code status')
      .populate('user', 'email role');

    if (updated && updated.user) {
      try {
        const AdminModel = mongoose.model('Admin');
        const AdminPasswordModel = mongoose.model('AdminPassword');
        const isHrRole =
          updated.departmentName === 'Human Resources' ||
          updated.departmentName === 'HR' ||
          (updated.designationName && /HR|People|Human Resource/i.test(updated.designationName));

        const userUpdates = {};
        if (isHrRole) userUpdates.role = 'HR';
        if (updated.departmentName) userUpdates.department = updated.departmentName;
        if (updated.designationName) userUpdates.designation = updated.designationName;
        if (Object.keys(userUpdates).length > 0) {
          await AdminModel.findByIdAndUpdate(updated.user, userUpdates);
        }

        if (body.loginPassword) {
          let userPassword = await AdminPasswordModel.findOne({ user: updated.user });
          if (!userPassword) {
            userPassword = new AdminPasswordModel({ user: updated.user });
          }
          const salt = bcrypt.genSaltSync(10);
          userPassword.salt = salt;
          userPassword.password = userPassword.generateHash(salt, body.loginPassword);
          userPassword.emailVerified = true;
          await userPassword.save();
        }
      } catch (syncErr) {
        console.error('Error syncing user account on employee update:', syncErr);
      }
    }

    return res.status(200).json({
      success: true,
      result: updated,
      message: 'Employee record updated successfully.',
    });
  },

  // ==========================================
  // DELETE (SOFT DELETE) EMPLOYEE
  // ==========================================
  delete: async (req, res) => {
    if (isEmployeeRole(req)) {
      return res.status(403).json({
        success: false,
        result: null,
        message: 'Access denied: Employees cannot delete employee records.',
      });
    }

    const Employee = mongoose.model('Employee');
    const { id } = req.params;

    const result = await Employee.findByIdAndUpdate(
      id,
      { removed: true, enabled: false, updated: Date.now() },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        result: null,
        message: 'Employee record not found.',
      });
    }

    // Cascade deactivation to the associated login user account
    if (result.user) {
      const AdminModel = mongoose.model('Admin');
      const UserPasswordModel = mongoose.model('AdminPassword');
      await AdminModel.findByIdAndUpdate(result.user, {
        enabled: false,
        removed: true,
        updated: Date.now(),
      });
      // Invalidate active login sessions
      await UserPasswordModel.findOneAndUpdate(
        { user: result.user },
        { $set: { loggedSessions: [] } }
      );
    }

    return res.status(200).json({
      success: true,
      result,
      message: 'Employee record marked as removed successfully.',
    });
  },

  // ==========================================
  // LIST / SEARCH / FILTER / PAGINATION
  // ==========================================
  list: async (req, res) => {
    if (isEmployeeRole(req)) {
      return res.status(403).json({
        success: false,
        result: null,
        message: 'Access denied: Employees cannot list all employee records.',
      });
    }

    const Employee = mongoose.model('Employee');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.items) || 10;
    const skip = (page - 1) * limit;

    const {
      q,
      department,
      status,
      employmentType,
      workLocation,
      sortBy = 'created',
      sortValue = -1,
    } = req.query;

    const filterConditions = { removed: false };

    // Search query
    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      filterConditions.$or = [
        { name: regex },
        { surname: regex },
        { employeeId: regex },
        { email: regex },
        { phone: regex },
        { skills: regex },
        { departmentName: regex },
        { designationName: regex },
        { workLocationName: regex },
      ];
    }

    // Filter by department
    if (department && department !== 'all') {
      if (mongoose.Types.ObjectId.isValid(department)) {
        filterConditions.department = department;
      } else {
        filterConditions.departmentName = new RegExp(`^${department}$`, 'i');
      }
    }

    // Filter by status
    if (status && status !== 'all') {
      filterConditions.status = status;
    }

    // Filter by employmentType
    if (employmentType && employmentType !== 'all') {
      filterConditions.employmentType = employmentType;
    }

    // Filter by workLocation
    if (workLocation && workLocation !== 'all') {
      if (mongoose.Types.ObjectId.isValid(workLocation)) {
        filterConditions.workLocation = workLocation;
      } else {
        filterConditions.workLocationName = new RegExp(`^${workLocation}$`, 'i');
      }
    }

    const sortOrder = parseInt(sortValue) || -1;
    const sortField = sortBy || 'created';

    const [result, count] = await Promise.all([
      Employee.find(filterConditions)
        .select('-bankDetails')
        .skip(skip)
        .limit(limit)
        .sort({ [sortField]: sortOrder })
        .populate('department', 'name code')
        .populate('designation', 'name code level')
        .populate('workLocation', 'name code city type')
        .populate('reportingManager', 'name surname employeeId email photo')
        .exec(),
      Employee.countDocuments(filterConditions),
    ]);

    const pages = Math.ceil(count / limit);
    return res.status(200).json({
      success: true,
      result,
      pagination: {
        page,
        pages,
        count,
      },
      message: 'Employees retrieved successfully.',
    });
  },

  // ==========================================
  // LIST ALL ACTIVE EMPLOYEES (FOR DROPDOWNS)
  // ==========================================
  listAll: async (req, res) => {
    if (isEmployeeRole(req)) {
      return res.status(403).json({
        success: false,
        result: null,
        message: 'Access denied: Employees cannot list all employee records.',
      });
    }

    const Employee = mongoose.model('Employee');
    const result = await Employee.find({ removed: false })
      .select('name surname employeeId email photo departmentName designationName status')
      .sort({ name: 1 })
      .exec();

    return res.status(200).json({
      success: true,
      result,
      message: 'All employees retrieved.',
    });
  },

  // ==========================================
  // SEARCH QUICK ENDPOINT
  // ==========================================
  search: async (req, res) => {
    if (isEmployeeRole(req)) {
      return res.status(403).json({
        success: false,
        result: null,
        message: 'Access denied: Employees cannot search employee records.',
      });
    }

    const Employee = mongoose.model('Employee');
    const q = req.query.q || '';
    const regex = new RegExp(q, 'i');

    const result = await Employee.find({
      removed: false,
      $or: [{ name: regex }, { surname: regex }, { employeeId: regex }, { email: regex }],
    })
      .select('-bankDetails')
      .limit(20)
      .exec();

    return res.status(200).json({
      success: true,
      result,
      message: 'Search completed.',
    });
  },

  // ==========================================
  // FILTER ENDPOINT
  // ==========================================
  filter: async (req, res) => {
    return employeeController.list(req, res);
  },

  // ==========================================
  // SUMMARY METRICS / STATS
  // ==========================================
  summary: async (req, res) => {
    if (isEmployeeRole(req)) {
      return res.status(403).json({
        success: false,
        result: null,
        message: 'Access denied: Employees cannot view employee organization summary.',
      });
    }

    const Employee = mongoose.model('Employee');
    const Department = mongoose.model('Department');

    const [total, active, probation, onNotice, terminated, departmentsCount, deptAggregation] =
      await Promise.all([
        Employee.countDocuments({ removed: false }),
        Employee.countDocuments({ removed: false, status: 'Active' }),
        Employee.countDocuments({ removed: false, status: 'Probation' }),
        Employee.countDocuments({ removed: false, status: { $in: ['On Notice', 'On Leave'] } }),
        Employee.countDocuments({ removed: false, status: { $in: ['Terminated', 'Resigned'] } }),
        Department.countDocuments({ removed: false }),
        Employee.aggregate([
          { $match: { removed: false } },
          { $group: { _id: '$departmentName', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
      ]);

    return res.status(200).json({
      success: true,
      result: {
        total,
        active,
        probation,
        onNotice,
        terminated,
        departmentsCount,
        deptDistribution: deptAggregation.map((d) => ({
          name: d._id || 'Unassigned',
          count: d.count,
        })),
      },
      message: 'Employee summary statistics calculated.',
    });
  },

  // ==========================================
  // CHANGE STATUS QUICK ACTION
  // ==========================================
  changeStatus: async (req, res) => {
    if (isEmployeeRole(req)) {
      return res.status(403).json({
        success: false,
        result: null,
        message: 'Access denied: Employees cannot change employee status or deactivation.',
      });
    }

    const Employee = mongoose.model('Employee');
    const { id } = req.params;
    const { status, exitDate, reasonForExit } = req.body;

    const validStatuses = ['Active', 'On Notice', 'Terminated', 'Resigned', 'Probation', 'On Leave'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        result: null,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const updateData = { status, updated: Date.now() };
    if (exitDate) updateData.exitDate = exitDate;
    if (reasonForExit) updateData.reasonForExit = reasonForExit;

    const result = await Employee.findByIdAndUpdate(id, updateData, { new: true });
    if (!result) {
      return res.status(404).json({
        success: false,
        result: null,
        message: 'Employee not found.',
      });
    }

    return res.status(200).json({
      success: true,
      result,
      message: `Employee status updated to '${status}'.`,
    });
  },

  // ==========================================
  // UPLOAD PHOTO
  // ==========================================
  uploadPhoto: async (req, res) => {
    const Employee = mongoose.model('Employee');
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'No photo file uploaded.',
      });
    }

    const photoPath = `public/uploads/employee/${req.file.filename}`;
    const result = await Employee.findByIdAndUpdate(
      id,
      { photo: photoPath, updated: Date.now() },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        result: null,
        message: 'Employee not found.',
      });
    }

    return res.status(200).json({
      success: true,
      result: { photo: photoPath },
      message: 'Profile photo uploaded successfully.',
    });
  },
};

module.exports = employeeController;

const mongoose = require('mongoose');

// Safe regex-based interpolation (NO arbitrary code execution)
const safeInterpolate = (text, dictionary = {}) => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(dictionary, key)) {
      const val = dictionary[key];
      return val !== undefined && val !== null ? String(val) : '';
    }
    return match; // Return unchanged if not matched
  });
};

// =========================================================================
// 1. LIST TEMPLATES
// =========================================================================
const list = async (req, res) => {
  try {
    const Template = mongoose.models.Template || require('../../../models/appModels/Template');

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.items, 10) || 50;
    const skip = (page - 1) * limit;

    const query = { removed: false };

    if (req.query.category && req.query.category !== 'All') {
      query.category = req.query.category;
    }

    if (req.query.type && req.query.type !== 'All') {
      query.type = req.query.type;
    }

    if (req.query.search && req.query.search.trim()) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { type: searchRegex },
        { subject: searchRegex },
      ];
    }

    const [templates, total] = await Promise.all([
      Template.find(query)
        .sort({ isDefault: -1, created: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Template.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      result: templates,
      pagination: {
        page,
        pages: Math.ceil(total / limit) || 1,
        count: total,
      },
    });
  } catch (error) {
    console.error('Template list error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 2. READ TEMPLATE
// =========================================================================
const read = async (req, res) => {
  try {
    const Template = mongoose.models.Template || require('../../../models/appModels/Template');
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Template ID' });
    }

    const template = await Template.findOne({ _id: id, removed: false })
      .populate('createdBy', 'name surname email')
      .populate('updatedBy', 'name surname email');

    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    return res.status(200).json({
      success: true,
      result: template,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 3. CREATE TEMPLATE
// =========================================================================
const create = async (req, res) => {
  try {
    const Template = mongoose.models.Template || require('../../../models/appModels/Template');
    const user = req.user;

    const { title, category, type, description, subject, content, variables, tags } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Template title is required' });
    }
    if (!category) {
      return res.status(400).json({ success: false, message: 'Category is required' });
    }
    if (!type) {
      return res.status(400).json({ success: false, message: 'Template type is required' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Template content is required' });
    }

    const newTemplate = new Template({
      title: title.trim(),
      category,
      type,
      description: (description || '').trim(),
      subject: (subject || '').trim(),
      content: content.trim(),
      variables: Array.isArray(variables) ? variables : [],
      tags: Array.isArray(tags) ? tags : [],
      createdBy: user?._id,
      updatedBy: user?._id,
      isDefault: false,
    });

    const saved = await newTemplate.save();

    return res.status(201).json({
      success: true,
      result: saved,
      message: 'Template created successfully.',
    });
  } catch (error) {
    console.error('Template create error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 4. UPDATE TEMPLATE
// =========================================================================
const update = async (req, res) => {
  try {
    const Template = mongoose.models.Template || require('../../../models/appModels/Template');
    const user = req.user;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Template ID' });
    }

    const template = await Template.findOne({ _id: id, removed: false });
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const updatable = ['title', 'category', 'type', 'description', 'subject', 'content', 'variables', 'tags'];
    updatable.forEach((f) => {
      if (req.body[f] !== undefined) {
        template[f] = req.body[f];
      }
    });

    template.updatedBy = user?._id;
    template.updated = Date.now();

    await template.save();

    return res.status(200).json({
      success: true,
      result: template,
      message: 'Template updated successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 5. DELETE TEMPLATE
// =========================================================================
const deleteTemplate = async (req, res) => {
  try {
    const Template = mongoose.models.Template || require('../../../models/appModels/Template');
    const { id } = req.params;

    const template = await Template.findOne({ _id: id, removed: false });
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    template.removed = true;
    template.updated = Date.now();
    await template.save();

    return res.status(200).json({
      success: true,
      message: 'Template deleted successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 6. PREVIEW & GENERATE (SAFE SUBSTITUTION WITHOUT CODE EXECUTION)
// =========================================================================
const preview = async (req, res) => {
  try {
    const Template = mongoose.models.Template || require('../../../models/appModels/Template');
    const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');

    const { id } = req.params || {};
    const { content: rawContent, subject: rawSubject, employeeId, variables = {} } = req.body || {};

    let targetContent = rawContent;
    let targetSubject = rawSubject;

    if (id && mongoose.Types.ObjectId.isValid(id)) {
      const template = await Template.findOne({ _id: id, removed: false });
      if (template) {
        targetContent = rawContent || template.content;
        targetSubject = rawSubject !== undefined ? rawSubject : template.subject;
      }
    }

    if (!targetContent) {
      return res.status(400).json({ success: false, message: 'Template content is required for preview' });
    }

    // Default system dictionary
    const now = new Date();
    const dictionary = {
      companyName: 'TecMotiv Solutions Pvt. Ltd.',
      companyAddress: 'TecMotiv Tower, Tech Enclave, Outer Ring Road, Bengaluru, Karnataka, 560103',
      currentDate: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      effectiveDate: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      managerName: 'Operations Director',
      eventName: 'TecMotiv Corporate Showcase',
      eventDate: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      venue: 'TecMotiv Corporate Auditorium',
      yearsCompleted: '3',
      festivalName: 'Diwali',
      awardTitle: 'Excellence in Engineering',
      ...variables,
    };

    // If an Employee ID is specified, merge real employee data
    if (employeeId && mongoose.Types.ObjectId.isValid(employeeId)) {
      const user = req.user;
      const role = (user?.role || req.userRole || 'EMPLOYEE').toUpperCase();
      if (role === 'EMPLOYEE') {
        let ownEmp = await Employee.findOne({ user: user._id, removed: false });
        if (!ownEmp && user.email) {
          ownEmp = await Employee.findOne({ email: user.email.toLowerCase(), removed: false });
        }
        const ownEmpIdStr = ownEmp ? ownEmp._id.toString() : '';
        if (!ownEmpIdStr || employeeId.toString() !== ownEmpIdStr) {
          return res.status(403).json({
            success: false,
            message: "Access denied: Employees cannot substitute another employee's ID for template previews.",
          });
        }
      }
      const emp = await Employee.findOne({ _id: employeeId, removed: false }).lean();
      if (emp) {
        dictionary.employeeName = `${emp.name} ${emp.surname || ''}`.trim();
        dictionary.employeeId = emp.employeeId || emp._id.toString();
        dictionary.department = emp.departmentName || 'Engineering';
        dictionary.designation = emp.designationName || 'Consultant';
        dictionary.email = emp.email || '';
        dictionary.phone = emp.phone || '';
        if (emp.joiningDate) {
          dictionary.joiningDate = new Date(emp.joiningDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        }
      }
    } else if (!dictionary.employeeName) {
      // Default placeholder values for live preview
      dictionary.employeeName = dictionary.employeeName || 'Aditya Sharma';
      dictionary.employeeId = dictionary.employeeId || 'TM-ENG-2045';
      dictionary.department = dictionary.department || 'Engineering';
      dictionary.designation = dictionary.designation || 'Lead Cloud Architect';
      dictionary.joiningDate = dictionary.joiningDate || 'March 15, 2023';
      dictionary.salary = dictionary.salary || '₹ 1,20,000 / month';
      dictionary.email = dictionary.email || 'aditya.sharma@tecmotiv.com';
      dictionary.phone = dictionary.phone || '+91 98765 43210';
    }

    // Safely interpolate content and subject
    const renderedContent = safeInterpolate(targetContent, dictionary);
    const renderedSubject = targetSubject ? safeInterpolate(targetSubject, dictionary) : '';

    // Detect any remaining unresolved variables
    const remainingMatches = renderedContent.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [];
    const unresolvedVariables = [...new Set(remainingMatches.map((m) => m.replace(/[\{\}\s]/g, '')))];

    return res.status(200).json({
      success: true,
      result: {
        renderedContent,
        renderedSubject,
        usedVariables: dictionary,
        unresolvedVariables,
      },
    });
  } catch (error) {
    console.error('Preview generation error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  list,
  filter: list,
  search: list,
  read,
  create,
  update,
  delete: deleteTemplate,
  preview,
  generate: preview,
};

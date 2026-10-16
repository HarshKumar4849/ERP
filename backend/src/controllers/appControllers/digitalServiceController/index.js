const mongoose = require('mongoose');

// Ensure Employee model is loaded for population
try {
  if (!mongoose.models.Employee) {
    try { require('../../../models/appModels/Employee'); } catch (e) { require('../../../models/appModels/Employee'); }
  }
} catch (e) {}

// =========================================================================
// 1. LIST DIGITAL SERVICES (WITH STATS & EXPIRING RENEWALS)
// =========================================================================
const list = async (req, res) => {
  try {
    const DigitalService = mongoose.models.DigitalService || require('../../../models/appModels/DigitalService');

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.items, 10) || 100;
    const skip = (page - 1) * limit;

    const query = { removed: false };
    const { serviceType, status, scope, search } = req.query;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (serviceType && serviceType !== 'All') {
      query.serviceType = serviceType;
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    if (scope === 'upcoming_renewals') {
      const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      query.$or = [
        { status: 'Expiring Soon' },
        { renewalDate: { $gte: today, $lte: in30Days } },
      ];
    } else if (scope === 'expired') {
      query.$or = [
        { status: 'Expired' },
        { renewalDate: { $lt: today }, status: { $ne: 'Cancelled' } },
      ];
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { serviceName: searchRegex },
        { loginEmail: searchRegex },
        { accountOwnerName: searchRegex },
        { customServiceName: searchRegex },
        { notes: searchRegex },
      ];
    }

    const [services, total, allActiveServices] = await Promise.all([
      DigitalService.find(query)
        .sort({ renewalDate: 1 })
        .skip(skip)
        .limit(limit)
        .populate('accountOwner', 'name surname email employeeId departmentName photo')
        .lean(),
      DigitalService.countDocuments(query),
      DigitalService.find({ removed: false }).lean(),
    ]);

    // Calculate spend and renewal metrics
    let totalAnnualSpend = 0;
    let totalMonthlySpend = 0;
    let activeCount = 0;
    let expiringSoonCount = 0;
    let expiredCount = 0;

    allActiveServices.forEach((s) => {
      if (s.status === 'Active' || s.status === 'Expiring Soon') {
        const costVal = Number(s.cost) || 0;
        let annualMultiplier = 1;

        if (s.billingCycle === 'Monthly') {
          annualMultiplier = 12;
          totalMonthlySpend += costVal;
        } else if (s.billingCycle === 'Quarterly') {
          annualMultiplier = 4;
          totalMonthlySpend += costVal / 3;
        } else if (s.billingCycle === 'Half-Yearly') {
          annualMultiplier = 2;
          totalMonthlySpend += costVal / 6;
        } else {
          annualMultiplier = 1;
          totalMonthlySpend += costVal / 12;
        }

        totalAnnualSpend += costVal * annualMultiplier;
      }

      if (s.status === 'Active') activeCount++;
      if (s.status === 'Expiring Soon') expiringSoonCount++;
      if (s.status === 'Expired') expiredCount++;
    });

    return res.status(200).json({
      success: true,
      result: services,
      counts: {
        total: allActiveServices.length,
        active: activeCount,
        expiringSoon: expiringSoonCount,
        expired: expiredCount,
        totalAnnualSpend: Math.round(totalAnnualSpend),
        totalMonthlySpend: Math.round(totalMonthlySpend),
      },
      pagination: {
        page,
        pages: Math.ceil(total / limit) || 1,
        count: total,
      },
    });
  } catch (error) {
    console.error('Digital services list error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 2. READ SERVICE
// =========================================================================
const read = async (req, res) => {
  try {
    const DigitalService = mongoose.models.DigitalService || require('../../../models/appModels/DigitalService');
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Service ID' });
    }

    const service = await DigitalService.findOne({ _id: id, removed: false })
      .populate('accountOwner', 'name surname email employeeId departmentName photo phone')
      .populate('createdBy', 'name surname email')
      .populate('updatedBy', 'name surname email');

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    return res.status(200).json({
      success: true,
      result: service,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 3. CREATE DIGITAL SERVICE (STRICT CREDENTIAL-FREE STORAGE)
// =========================================================================
const create = async (req, res) => {
  try {
    const DigitalService = mongoose.models.DigitalService || require('../../../models/appModels/DigitalService');
    const Employee = mongoose.models.Employee || require('../../../models/appModels/Employee');
    const user = req.user;

    const {
      serviceName,
      serviceType,
      customServiceName,
      accountOwner,
      accountOwnerName,
      loginEmail,
      renewalDate,
      billingCycle,
      cost,
      currency,
      paymentMethod,
      paymentMethodDetails,
      status,
      reminderDaysBefore,
      notes,
      serviceUrl,
      department,
    } = req.body;

    if (!serviceName || !serviceName.trim()) {
      return res.status(400).json({ success: false, message: 'Service Name is required' });
    }
    if (!serviceType) {
      return res.status(400).json({ success: false, message: 'Service Type is required' });
    }
    if (!loginEmail || !loginEmail.trim()) {
      return res.status(400).json({ success: false, message: 'Login Email is required' });
    }
    if (!renewalDate) {
      return res.status(400).json({ success: false, message: 'Renewal Date is required' });
    }

    // Resolve owner name if accountOwner ID is provided
    let resolvedOwnerName = (accountOwnerName || '').trim();
    if (accountOwner && mongoose.Types.ObjectId.isValid(accountOwner) && !resolvedOwnerName) {
      const emp = await Employee.findById(accountOwner);
      if (emp) {
        resolvedOwnerName = `${emp.name} ${emp.surname || ''}`.trim();
      }
    }

    const newService = new DigitalService({
      serviceName: serviceName.trim(),
      serviceType,
      customServiceName: (customServiceName || '').trim(),
      accountOwner: accountOwner && mongoose.Types.ObjectId.isValid(accountOwner) ? accountOwner : undefined,
      accountOwnerName: resolvedOwnerName || 'IT Operations Lead',
      loginEmail: loginEmail.trim().toLowerCase(),
      renewalDate: new Date(renewalDate),
      billingCycle: billingCycle || 'Yearly',
      cost: cost !== undefined ? Number(cost) : 0,
      currency: currency || 'INR',
      paymentMethod: paymentMethod || 'Corporate Credit Card',
      paymentMethodDetails: (paymentMethodDetails || '').trim(),
      status: status || 'Active',
      reminderDaysBefore: reminderDaysBefore !== undefined ? Number(reminderDaysBefore) : 15,
      notes: (notes || '').trim(),
      serviceUrl: (serviceUrl || '').trim(),
      department: department || 'IT',
      createdBy: user?._id,
      updatedBy: user?._id,
    });

    const saved = await newService.save();

    return res.status(201).json({
      success: true,
      result: saved,
      message: 'Digital Service registered successfully.',
    });
  } catch (error) {
    console.error('Create Digital Service error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 4. UPDATE SERVICE
// =========================================================================
const update = async (req, res) => {
  try {
    const DigitalService = mongoose.models.DigitalService || require('../../../models/appModels/DigitalService');
    const user = req.user;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Service ID' });
    }

    const service = await DigitalService.findOne({ _id: id, removed: false });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const fields = [
      'serviceName',
      'serviceType',
      'customServiceName',
      'accountOwner',
      'accountOwnerName',
      'loginEmail',
      'renewalDate',
      'billingCycle',
      'cost',
      'currency',
      'paymentMethod',
      'paymentMethodDetails',
      'status',
      'reminderDaysBefore',
      'notes',
      'serviceUrl',
      'department',
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        if (f === 'renewalDate') {
          service[f] = new Date(req.body[f]);
        } else if (f === 'loginEmail') {
          service[f] = req.body[f].trim().toLowerCase();
        } else if (f === 'cost') {
          service[f] = Number(req.body[f]);
        } else {
          service[f] = req.body[f];
        }
      }
    });

    service.updatedBy = user?._id;
    service.updated = Date.now();

    await service.save();

    const updatedService = await DigitalService.findById(id)
      .populate('accountOwner', 'name surname email employeeId departmentName photo');

    return res.status(200).json({
      success: true,
      result: updatedService,
      message: 'Digital Service updated successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 5. DELETE SERVICE (SOFT DELETE)
// =========================================================================
const deleteService = async (req, res) => {
  try {
    const DigitalService = mongoose.models.DigitalService || require('../../../models/appModels/DigitalService');
    const { id } = req.params;

    const service = await DigitalService.findOne({ _id: id, removed: false });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    service.removed = true;
    service.updated = Date.now();
    await service.save();

    return res.status(200).json({
      success: true,
      message: 'Digital Service record removed successfully.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 6. RENEW SERVICE (EXTENDS RENEWAL DATE & RECORDS RENEWAL TIMESTAMP)
// =========================================================================
const renew = async (req, res) => {
  try {
    const DigitalService = mongoose.models.DigitalService || require('../../../models/appModels/DigitalService');
    const user = req.user;
    const { id } = req.params;
    const { newRenewalDate, cost: updatedCost } = req.body;

    const service = await DigitalService.findOne({ _id: id, removed: false });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    let calculatedNextDate;
    if (newRenewalDate) {
      calculatedNextDate = new Date(newRenewalDate);
    } else {
      const baseDate = new Date(service.renewalDate > new Date() ? service.renewalDate : new Date());
      if (service.billingCycle === 'Monthly') {
        baseDate.setMonth(baseDate.getMonth() + 1);
      } else if (service.billingCycle === 'Quarterly') {
        baseDate.setMonth(baseDate.getMonth() + 3);
      } else if (service.billingCycle === 'Half-Yearly') {
        baseDate.setMonth(baseDate.getMonth() + 6);
      } else if (service.billingCycle === 'Multi-Year') {
        baseDate.setFullYear(baseDate.getFullYear() + 2);
      } else {
        baseDate.setFullYear(baseDate.getFullYear() + 1); // Default 1 Year
      }
      calculatedNextDate = baseDate;
    }

    service.lastRenewedDate = new Date();
    service.renewalDate = calculatedNextDate;
    service.status = 'Active';
    service.reminderSent = false;
    if (updatedCost !== undefined) {
      service.cost = Number(updatedCost);
    }
    service.updatedBy = user?._id;
    service.updated = Date.now();

    await service.save();

    return res.status(200).json({
      success: true,
      result: service,
      message: `Service successfully renewed! Next renewal scheduled for ${calculatedNextDate.toDateString()}.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 7. RENEWAL REMINDERS FEED
// =========================================================================
const reminders = async (req, res) => {
  try {
    const DigitalService = mongoose.models.DigitalService || require('../../../models/appModels/DigitalService');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const upcoming = await DigitalService.find({
      removed: false,
      status: { $ne: 'Cancelled' },
      renewalDate: { $gte: today, $lte: in30Days },
    })
      .sort({ renewalDate: 1 })
      .populate('accountOwner', 'name surname email')
      .lean();

    return res.status(200).json({
      success: true,
      result: upcoming,
      count: upcoming.length,
    });
  } catch (error) {
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
  delete: deleteService,
  renew,
  reminders,
};

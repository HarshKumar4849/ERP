const { buildScopeFilter } = require('./scopeFilter');

const paginatedList = async (Model, req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.items, 10) || 10;
  const skip = (page - 1) * limit;

  const { sortBy = 'enabled', sortValue = -1, filter, equal } = req.query;

  const fieldsArray = req.query.fields ? req.query.fields.split(',') : [];

  const escapeRegex = (text) => (typeof text === 'string' ? text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '');
  let fields;

  fields = fieldsArray.length === 0 ? {} : { $or: [] };
  const sanitizedQuery = escapeRegex(req.query.q || '');

  for (const field of fieldsArray) {
    fields.$or.push({ [field]: { $regex: new RegExp(sanitizedQuery, 'i') } });
  }

  // Build filter condition safely: reject MongoDB operators in values
  let filterCondition = {};
  if (filter && equal !== undefined) {
    if (typeof equal === 'object') {
      return res.status(400).json({
        success: false,
        result: [],
        message: 'Invalid filter value',
      });
    }
    filterCondition = { [filter]: equal };
  }

  // Enforce the RBAC access scope (ownership / department constraints
  // set by rbacMiddleware) so list operations never leak records the
  // caller is not allowed to see.
  const scopeCondition = buildScopeFilter(Model, req);

  //  Query the database for a list of all results
  const resultsPromise = Model.find({
    removed: false,
    ...scopeCondition,
    ...filterCondition,
    ...fields,
  })
    .skip(skip)
    .limit(limit)
    .sort({ [sortBy]: sortValue })
    .populate()
    .exec();

  // Counting the total documents
  const countPromise = Model.countDocuments({
    removed: false,
    ...scopeCondition,
    ...filterCondition,
    ...fields,
  });
  // Resolving both promises
  const [result, count] = await Promise.all([resultsPromise, countPromise]);

  // Calculating total pages
  const pages = Math.ceil(count / limit);

  // Getting Pagination Object
  const pagination = { page, pages, count };
  if (count > 0) {
    return res.status(200).json({
      success: true,
      result,
      pagination,
      message: 'Successfully found all documents',
    });
  } else {
    return res.status(203).json({
      success: true,
      result: [],
      pagination,
      message: 'Collection is Empty',
    });
  }
};

module.exports = paginatedList;

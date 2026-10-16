const { buildScopeFilter } = require('./scopeFilter');

const SENSITIVE_FIELDS = new Set([
  'password',
  'salt',
  'resetToken',
  'emailOtp',
  'loggedSessions',
  'token',
  '__v',
]);

const search = async (Model, req, res) => {
  const escapeRegex = (text) => (typeof text === 'string' ? text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '');
  
  // Only string schema paths support regex search
  const stringPaths =
    Model.schema && Model.schema.paths
      ? Object.keys(Model.schema.paths).filter((p) => {
          const type = Model.schema.paths[p]?.instance;
          return type === 'String' && !SENSITIVE_FIELDS.has(p);
        })
      : [];

  const rawFields = req.query.fields ? req.query.fields.split(',') : [];
  const validFields = rawFields
    .map((f) => f.trim())
    .filter((f) => f && stringPaths.includes(f));

  let fieldsArray = validFields;
  if (fieldsArray.length === 0) {
    if (stringPaths.includes('name')) {
      fieldsArray = ['name'];
    } else if (stringPaths.includes('title')) {
      fieldsArray = ['title'];
    } else if (stringPaths.includes('task')) {
      fieldsArray = ['task'];
    } else if (stringPaths.includes('department')) {
      fieldsArray = ['department'];
    } else if (stringPaths.includes('dateString')) {
      fieldsArray = ['dateString'];
    } else if (stringPaths.length > 0) {
      fieldsArray = [stringPaths[0]];
    }
  }

  if (fieldsArray.length === 0) {
    return res.status(202).json({
      success: false,
      result: [],
      message: 'No document found by this request',
    });
  }

  const fields = { $or: [] };
  const sanitizedQuery = escapeRegex(req.query.q || '');

  for (const field of fieldsArray) {
    fields.$or.push({ [field]: { $regex: sanitizedQuery, $options: 'i' } });
  }

  // Enforce the RBAC access scope (ownership / department constraints
  // set by rbacMiddleware) so search never leaks records the caller is
  // not allowed to see.
  const scopeCondition = buildScopeFilter(Model, req);

  let results = await Model.find({
    ...scopeCondition,
    ...fields,
  })

    .where('removed', false)
    .limit(20)
    .exec();

  if (results.length >= 1) {
    return res.status(200).json({
      success: true,
      result: results,
      message: 'Successfully found all documents',
    });
  } else {
    return res
      .status(202)
      .json({
        success: false,
        result: [],
        message: 'No document found by this request',
      })
      .end();
  }
};

module.exports = search;

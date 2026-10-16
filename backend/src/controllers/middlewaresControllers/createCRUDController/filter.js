const { buildScopeFilter } = require('./scopeFilter');

const filter = async (Model, req, res) => {
  if (req.query.filter === undefined || req.query.equal === undefined) {
    return res.status(400).json({
      success: false,
      result: null,
      message: 'filter not provided correctly',
    });
  }

  // Enforce the RBAC access scope (ownership / department constraints
  // set by rbacMiddleware) so filter never leaks records the caller is
  // not allowed to see.
  const scopeCondition = buildScopeFilter(Model, req);

  const result = await Model.find({
    removed: false,
    ...scopeCondition,
  })
    .where(req.query.filter)
    .equals(req.query.equal)
    .exec();
  if (!result || result.length === 0) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  } else {
    // Return success resposne
    return res.status(200).json({
      success: true,
      result,
      message: 'Successfully found all documents  ',
    });
  }
};

module.exports = filter;

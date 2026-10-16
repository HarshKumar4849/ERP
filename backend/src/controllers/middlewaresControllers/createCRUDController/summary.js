const { buildScopeFilter } = require('./scopeFilter');

const summary = async (Model, req, res) => {
  // Enforce the RBAC access scope (ownership / department constraints
  // set by rbacMiddleware) so summary counts never leak organisation
  // wide metrics the caller is not allowed to see.
  const scopeCondition = buildScopeFilter(Model, req);

  // Query the database for a list of all results
  const countAllDocs = await Model.countDocuments({
    removed: false,
    ...scopeCondition,
  });

  let countFilter = 0;
  if (req.query.filter && req.query.equal !== undefined) {
    countFilter = await Model.countDocuments({
      removed: false,
      ...scopeCondition,
    })
      .where(req.query.filter)
      .equals(req.query.equal)
      .exec();
  } else {
    countFilter = countAllDocs;
  }

  return res.status(200).json({
    success: true,
    result: { countFilter, countAllDocs },
    message: 'Successfully counted all documents',
  });
};

module.exports = summary;

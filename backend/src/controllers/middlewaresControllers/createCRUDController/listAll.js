const { buildScopeFilter } = require('./scopeFilter');

const CACHEABLE_MODELS = ['Department', 'Designation', 'Location'];

const listAll = async (Model, req, res) => {
  const sort = req.query.sort || 'desc';
  const enabled = req.query.enabled || undefined;

  // Enforce the RBAC access scope (ownership / department constraints
  // set by rbacMiddleware) so listAll never leaks records the caller
  // is not allowed to see.
  const scopeCondition = buildScopeFilter(Model, req);

  const modelName = Model.modelName;
  const isCacheable = CACHEABLE_MODELS.includes(modelName) && Object.keys(scopeCondition).length === 0;
  let cacheKey = null;

  if (isCacheable) {
    try {
      const cacheService = require('../../../services/cacheService');
      if (cacheService.isReady()) {
        const version = await cacheService.getVersion(modelName.toLowerCase());
        const sortKey = sort === 'desc' ? 'desc' : 'asc';
        const enabledKey = enabled !== undefined ? `en_${enabled}` : 'en_all';
        cacheKey = cacheService.buildKey({
          entity: modelName.toLowerCase(),
          scope: `listAll:${sortKey}:${enabledKey}`,
          version,
        });

        const cached = await cacheService.get(cacheKey);
        if (cached && cached.payload) {
          res.setHeader('X-Cache', 'HIT');
          return res.status(cached.status || 200).json(cached.payload);
        }
      }
    } catch (cacheErr) {
      // Fallback silently to MongoDB
    }
  }

  // Query the database for a list of all results
  let result;
  if (enabled === undefined) {
    result = await Model.find({
      removed: false,
      ...scopeCondition,
    })
      .sort({ created: sort })
      .populate()
      .exec();
  } else {
    result = await Model.find({
      removed: false,
      enabled: enabled,
      ...scopeCondition,
    })
      .sort({ created: sort })
      .populate()
      .exec();
  }

  const responseStatus = result.length > 0 ? 200 : 203;
  const responsePayload = {
    success: result.length > 0,
    result,
    message: result.length > 0 ? 'Successfully found all documents' : 'Collection is Empty',
  };

  if (isCacheable && cacheKey) {
    try {
      const cacheService = require('../../../services/cacheService');
      if (cacheService.isReady()) {
        cacheService.set(cacheKey, { status: responseStatus, payload: responsePayload }, 3600);
        res.setHeader('X-Cache', 'MISS');
      }
    } catch (e) {}
  }

  return res.status(responseStatus).json(responsePayload);
};

module.exports = listAll;

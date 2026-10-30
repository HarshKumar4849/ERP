const CACHEABLE_MODELS = ['Department', 'Designation', 'Location'];

const read = async (Model, req, res) => {
  const modelName = Model.modelName;
  const isCacheable = CACHEABLE_MODELS.includes(modelName);
  let cacheKey = null;

  if (isCacheable && req.params.id) {
    try {
      const cacheService = require('../../../services/cacheService');
      if (cacheService.isReady()) {
        const version = await cacheService.getVersion(modelName.toLowerCase());
        cacheKey = cacheService.buildKey({
          entity: modelName.toLowerCase(),
          scope: `read:${req.params.id}`,
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

  // Find document by id
  const result = await Model.findOne({
    _id: req.params.id,
    removed: false,
  }).exec();

  // If no results found, return document not found
  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  } else {
    const payload = {
      success: true,
      result,
      message: 'we found this document ',
    };
    if (isCacheable && cacheKey) {
      try {
        const cacheService = require('../../../services/cacheService');
        if (cacheService.isReady()) {
          cacheService.set(cacheKey, { status: 200, payload }, 3600);
          res.setHeader('X-Cache', 'MISS');
        }
      } catch (e) {}
    }
    return res.status(200).json(payload);
  }
};

module.exports = read;

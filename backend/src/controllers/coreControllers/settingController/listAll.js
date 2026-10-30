const mongoose = require('mongoose');
const Model = mongoose.model('Setting');

const listAll = async (req, res) => {
  const sort = parseInt(req.query.sort) || 'desc';

  let cacheKey = null;
  try {
    const cacheService = require('../../../services/cacheService');
    if (cacheService.isReady()) {
      const version = await cacheService.getVersion('setting');
      cacheKey = cacheService.buildKey({
        entity: 'setting',
        scope: `publicListAll:${sort}`,
        version,
      });

      const cached = await cacheService.get(cacheKey);
      if (cached && cached.payload) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cached.payload);
      }
    }
  } catch (e) {}

  //  Query the database for a list of all results
  const result = await Model.find({
    removed: false,
    isPrivate: false,
  }).sort({ created: sort });

  const payload = {
    success: true,
    result,
    message: result.length > 0 ? 'Successfully found all documents' : 'Collection is Empty',
  };

  if (cacheKey) {
    try {
      const cacheService = require('../../../services/cacheService');
      if (cacheService.isReady()) {
        const cached = await cacheService.set(cacheKey, { payload }, 1800);
        if (cached) {
          res.setHeader('X-Cache', 'MISS');
        }
      }
    } catch (e) {}
  }

  return res.status(200).json(payload);
};

module.exports = listAll;

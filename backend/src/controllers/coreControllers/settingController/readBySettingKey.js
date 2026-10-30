const mongoose = require('mongoose');

const Model = mongoose.model('Setting');

const PUBLIC_SETTING_ALLOWLIST = new Set([
  'app_name',
  'app_title',
  'app_logo',
  'app_timezone',
  'default_currency',
  'date_format',
  'company_name',
  'company_address',
]);

const readBySettingKey = async (req, res) => {
  // Find document by id
  const settingKey = req.params.settingKey || undefined;

  if (!settingKey) {
    return res.status(202).json({
      success: false,
      result: null,
      message: 'No settingKey provided ',
    });
  }

  const cleanKey = String(settingKey).toLowerCase();
  const isCacheable = PUBLIC_SETTING_ALLOWLIST.has(cleanKey);
  let cacheKey = null;

  if (isCacheable) {
    try {
      const cacheService = require('../../../services/cacheService');
      if (cacheService.isReady()) {
        const version = await cacheService.getVersion('setting');
        cacheKey = cacheService.buildKey({
          entity: 'setting',
          scope: `key:${cleanKey}`,
          version,
        });

        const cached = await cacheService.get(cacheKey);
        if (cached && cached.payload) {
          res.setHeader('X-Cache', 'HIT');
          return res.status(200).json(cached.payload);
        }
      }
    } catch (cacheErr) {}
  }

  const result = await Model.findOne({
    settingKey: cleanKey,
  });

  // If no results found, return document not found
  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found by this settingKey: ' + settingKey,
    });
  } else {
    const payload = {
      success: true,
      result,
      message: 'we found this document by this settingKey: ' + settingKey,
    };

    // Strictly ensure only non-private settings are written to cache
    if (isCacheable && cacheKey && result.isPrivate !== true) {
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
  }
};

module.exports = readBySettingKey;

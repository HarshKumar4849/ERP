const CACHEABLE_MODELS = ['Department', 'Designation', 'Location'];

const create = async (Model, req, res) => {
  // Creating a new document in the collection
  req.body.removed = false;
  const result = await new Model({
    ...req.body,
  }).save();

  const modelName = Model.modelName;
  if (CACHEABLE_MODELS.includes(modelName)) {
    try {
      const cacheService = require('../../../services/cacheService');
      cacheService.incrementVersion(modelName.toLowerCase());
    } catch (e) {}
  }

  // Returning successfull response
  return res.status(200).json({
    success: true,
    result,
    message: 'Successfully Created the document in Model ',
  });
};

module.exports = create;

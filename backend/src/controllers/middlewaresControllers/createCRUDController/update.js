const CACHEABLE_MODELS = ['Department', 'Designation', 'Location'];

const update = async (Model, req, res) => {
  // Find document by id and updates with the required fields
  req.body.removed = false;
  const result = await Model.findOneAndUpdate(
    {
      _id: req.params.id,
      removed: false,
    },
    req.body,
    {
      new: true, // return the new result instead of the old one
      runValidators: true,
    }
  ).exec();
  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  } else {
    const modelName = Model.modelName;
    if (CACHEABLE_MODELS.includes(modelName)) {
      try {
        const cacheService = require('../../../services/cacheService');
        cacheService.incrementVersion(modelName.toLowerCase());
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      result,
      message: 'we update this document ',
    });
  }
};

module.exports = update;

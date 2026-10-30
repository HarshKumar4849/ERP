const CACHEABLE_MODELS = ['Department', 'Designation', 'Location'];

const remove = async (Model, req, res) => {
  // Find the document by id and delete it
  let updates = {
    removed: true,
  };
  // Find the document by id and delete it
  const result = await Model.findOneAndUpdate(
    {
      _id: req.params.id,
    },
    { $set: updates },
    {
      new: true, // return the new result instead of the old one
    }
  ).exec();
  // If no results found, return document not found
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
      message: 'Successfully Deleted the document ',
    });
  }
};

module.exports = remove;

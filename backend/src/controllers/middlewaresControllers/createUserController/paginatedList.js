const mongoose = require('mongoose');

const paginatedList = async (userModel, req, res) => {
  const User = mongoose.model(userModel);
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.items, 10) || 10;
  const skip = page * limit - limit;

  const query = { removed: false };
  if (req.query.filter && req.query.equal) {
    query[req.query.filter] = req.query.equal;
  }

  const [result, count] = await Promise.all([
    User.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ created: 'desc' })
      .select('-__v')
      .exec(),
    User.countDocuments(query),
  ]);

  const pages = Math.ceil(count / limit);

  return res.status(200).json({
    success: true,
    result,
    pagination: {
      page,
      pages,
      count,
    },
    message: 'Successfully found all documents',
  });
};

module.exports = paginatedList;

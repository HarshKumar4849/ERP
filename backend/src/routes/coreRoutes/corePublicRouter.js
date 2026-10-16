const express = require('express');
const router = express.Router();

const path = require('path');
const fs = require('fs');
const { isPathInside } = require('../../utils/is-path-inside');

router.route('/:subPath/:directory/:file').get(function (req, res) {
  try {
    const { subPath, directory, file } = req.params;

    // Decode each parameter separately
    const decodedSubPath = decodeURIComponent(subPath);
    const decodedDirectory = decodeURIComponent(directory);
    const decodedFile = decodeURIComponent(file);

    const relativePath = path.join(decodedSubPath, decodedDirectory, decodedFile);

    // Primary static root directory
    const primaryRootDir = path.join(__dirname, '../../public');
    const primaryPath = path.join(primaryRootDir, relativePath);

    // Writable /tmp storage directory (used in serverless environments)
    const tmpRootDir = path.join('/tmp', 'public');
    const tmpPath = path.join(tmpRootDir, relativePath);

    let targetPath = primaryPath;
    let allowedRoot = primaryRootDir;

    if (fs.existsSync(tmpPath)) {
      targetPath = tmpPath;
      allowedRoot = tmpRootDir;
    }

    // Check if the resulting path stays inside allowedRoot
    if (!isPathInside(targetPath, allowedRoot)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filepath',
      });
    }

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({
        success: false,
        result: null,
        message: 'we could not find : ' + file,
      });
    }

    return res.sendFile(targetPath, (error) => {
      if (error && !res.headersSent) {
        return res.status(404).json({
          success: false,
          result: null,
          message: 'we could not find : ' + file,
        });
      }
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      result: null,
      message: error.message,
    });
  }
});

module.exports = router;

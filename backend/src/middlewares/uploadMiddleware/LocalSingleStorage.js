const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { slugify } = require('transliteration');

const fileFilter = require('./utils/LocalfileFilter');

const getUploadDir = (entity) => {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const baseDir = isServerless
    ? path.join('/tmp', 'public', 'uploads', entity)
    : path.resolve(__dirname, '../../public/uploads', entity);

  try {
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    return baseDir;
  } catch (err) {
    const fallback = path.join('/tmp', 'public', 'uploads', entity);
    try {
      if (!fs.existsSync(fallback)) {
        fs.mkdirSync(fallback, { recursive: true });
      }
      return fallback;
    } catch (e) {
      return baseDir;
    }
  }
};

const singleStorageUpload = ({
  entity,
  fileType = 'default',
  uploadFieldName = 'file',
  fieldName = 'file',
}) => {
  var diskStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = getUploadDir(entity);
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      try {
        let fileExtension = path.extname(file.originalname);
        let uniqueFileID = Math.random().toString(36).slice(2, 7);

        let originalname = '';
        if (req.body.seotitle) {
          originalname = slugify(req.body.seotitle.toLocaleLowerCase());
        } else {
          originalname = slugify(file.originalname.split('.')[0].toLocaleLowerCase());
        }

        let _fileName = `${originalname}-${uniqueFileID}${fileExtension}`;

        const filePath = `public/uploads/${entity}/${_fileName}`;
        req.upload = {
          fileName: _fileName,
          fieldExt: fileExtension,
          entity: entity,
          fieldName: fieldName,
          fileType: fileType,
          filePath: filePath,
        };

        req.body[fieldName] = filePath;

        cb(null, _fileName);
      } catch (error) {
        cb(error);
      }
    },
  });

  let filterType = fileFilter(fileType);

  const multerStorage = multer({ storage: diskStorage, fileFilter: filterType }).single('file');
  return multerStorage;
};

module.exports = singleStorageUpload;

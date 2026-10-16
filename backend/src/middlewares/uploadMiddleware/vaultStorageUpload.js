const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { slugify } = require('transliteration');

const defaultVaultPath = process.env.VERCEL ? '/tmp/storage/vault' : 'src/storage/vault';
let VAULT_DIR = path.resolve(process.env.DOCUMENT_VAULT_DIR || defaultVaultPath);

// Ensure directory exists safely
try {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }
} catch (err) {
  VAULT_DIR = '/tmp/storage/vault';
  try {
    if (!fs.existsSync(VAULT_DIR)) {
      fs.mkdirSync(VAULT_DIR, { recursive: true });
    }
  } catch (e) {
    console.warn('Document vault filesystem notice:', e.message);
  }
}

// Storage engine for private document vault
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let targetDir = VAULT_DIR;
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    } catch (err) {
      targetDir = '/tmp/storage/vault';
      try {
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
      } catch (e) {}
    }
    cb(null, targetDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const baseName = slugify(path.basename(file.originalname, ext)).slice(0, 30) || 'doc';
    const fileName = `${baseName}-${Date.now()}-${uniqueId}${ext}`;
    cb(null, fileName);
  },
});

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const EXTENSIONS_BY_MIME = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_MIME_TYPES.includes(file.mimetype) && EXTENSIONS_BY_MIME[file.mimetype]?.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      Object.assign(new Error(`Invalid file type or extension for '${file.mimetype}'.`), { status: 400 }),
      false
    );
  }
};

// 10 MB maximum limit
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
}).single('file');

const vaultUpload = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) return next();
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (cleanupError) {}
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, result: null, message: 'File exceeds the 10 MiB vault limit.' });
    }
    return res.status(error.status || 400).json({ success: false, result: null, message: error.message });
  });
};

module.exports = vaultUpload;

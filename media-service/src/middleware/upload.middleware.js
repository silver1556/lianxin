const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { v4: uuidv4 } = require("uuid");
const config = require("../config/app.config");
const { ValidationError } = require("../errors/validation.error");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(
      config.tempDir,
      "uploads",
      req.user.userId.toString()
    );
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${Date.now()}${path.extname(
      file.originalname
    )}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize,
    files: 10, // Max 10 files per request
  },
  fileFilter: (req, file, cb) => {
    const isValidType =
      config.supportedImageTypes.includes(file.mimetype) ||
      config.supportedVideoTypes.includes(file.mimetype);

    if (!isValidType) {
      return cb(new ValidationError(`Unsupported file type: ${file.mimetype}`));
    }

    cb(null, true);
  },
});

module.exports = {
  single: (fieldName) => upload.single(fieldName),
  array: (fieldName, maxCount) => upload.array(fieldName, maxCount),
  fields: (fields) => upload.fields(fields),
  none: () => upload.none(),
  any: () => upload.any(),
};

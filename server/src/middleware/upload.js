import multer from 'multer';
import { HttpError } from '../utils/validators.js';

// Three images are analysed together, so keep the complete inline vision
// payload comfortably below the provider's request-size ceiling.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB per image

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 3 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new HttpError(415, 'Only image files are allowed.'));
  },
});

/** Memory-only multipart handler for a single "image" field. */
export const handleImageUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Image too large. Maximum size is 2 MB.'
          : `Upload error: ${err.message}`;
      return next(new HttpError(400, message));
    }
    if (err) return next(err);
    return next();
  });
};

/** Memory-only multipart handler for multiple "images" fields (proof photos). */
export const handleProofImagesUpload = (req, res, next) => {
  upload.array('images', 3)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Image too large. Maximum size is 2 MB.'
          : err.code === 'LIMIT_FILE_COUNT'
            ? 'Maximum of 3 proof images allowed.'
            : `Upload error: ${err.message}`;
      return next(new HttpError(400, message));
    }
    if (err) return next(err);
    return next();
  });
};

/** Validates magic bytes of the uploaded buffer (JPEG / PNG / WEBP only). */
export const hasValidImageSignature = (buffer) => {
  if (!buffer || buffer.length < 12) return false;
  const hex4 = buffer.toString('hex', 0, 4);
  const hex3 = buffer.toString('hex', 0, 3);
  return (
    hex4 === '89504e47' || // PNG
    hex3 === 'ffd8ff' || // JPEG
    (hex4 === '52494646' && buffer.toString('hex', 8, 12) === '57454250') // WEBP
  );
};

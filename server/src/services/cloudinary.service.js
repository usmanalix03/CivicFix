import streamifier from 'streamifier';
import cloudinary from '../config/cloudinary.js';

/** Streams an in-memory image buffer to Cloudinary and returns URL + public_id. */
export const uploadImageBuffer = (buffer, folder = 'civicfix_reports') =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

/** Best-effort removal of a previously uploaded asset (used for rollback). */
export const destroyImage = (publicId) =>
  publicId ? cloudinary.uploader.destroy(publicId).catch(() => null) : Promise.resolve(null);

import cloudinary from 'cloudinary';
import { env } from './env.js';

cloudinary.v2.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
  secure: true,
});

export default cloudinary.v2;

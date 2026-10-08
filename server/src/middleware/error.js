import { logger } from '../config/logger.js';
import { HttpError } from '../utils/validators.js';

export const notFoundHandler = (req, res, next) => {
  next(new HttpError(404, 'Route not found.'));
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;

  if (status >= 500) {
    logger.error(err.stack || err.message);
  }

  res.status(status).json({
    error: status >= 500 && !err.isOperational ? 'Internal server error.' : err.message,
    ...(err.code ? { code: err.code } : {}),
  });
};

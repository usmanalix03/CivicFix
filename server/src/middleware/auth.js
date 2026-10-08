import { verifyToken } from '../services/auth.service.js';
import { HttpError } from '../utils/validators.js';

/** Extracts and verifies the Bearer JWT, attaching the payload to req.user. */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Access denied. No token provided.', 'TOKEN_INVALID'));
  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return next(new HttpError(401, 'Invalid or expired token. Please log in again.', 'TOKEN_INVALID'));
  }
};

/** Role gate: requireRole('ADMIN') or requireRole('ADMIN','SUPER_ADMIN'). */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new HttpError(403, 'You do not have permission to perform this action.'));
  }
  return next();
};

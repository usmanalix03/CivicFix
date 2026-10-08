import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken } from '../middleware/auth.js';
import {
  requestCitizenOtp,
  signupCitizen,
  requestAdminOtp,
  signupAdmin,
  login,
  requestPasswordReset,
  resetPassword,
  getDashboard,
  changePassword,
  updateCitizenProfile,
  requestAdminEditOtp,
  confirmAdminEdit,
  requestDeleteOtp,
  confirmDelete,
} from '../controllers/auth.controller.js';

const router = Router();

// --- Public routes ---
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many code requests. Please try again later.' },
});

router.post('/citizen/request-otp', otpLimiter, requestCitizenOtp);
router.post('/citizen/signup', signupCitizen);
router.post('/admin/request-otp', otpLimiter, requestAdminOtp);
router.post('/admin/signup', signupAdmin);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});
router.post('/login', loginLimiter, login);

router.post('/forgot-password/request-otp', otpLimiter, requestPasswordReset);
router.post('/forgot-password/confirm', resetPassword);

// --- Authenticated profile routes ---
router.get('/me', authenticateToken, getDashboard);
router.put('/me/change-password', authenticateToken, changePassword);
router.put('/me/citizen', authenticateToken, updateCitizenProfile);

router.post('/me/admin/request-edit', authenticateToken, requestAdminEditOtp);
router.put('/me/admin', authenticateToken, confirmAdminEdit);

router.post('/me/request-delete', authenticateToken, requestDeleteOtp);
router.delete('/me', authenticateToken, confirmDelete);

export default router;

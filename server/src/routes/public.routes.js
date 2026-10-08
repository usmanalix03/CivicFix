import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getPublicFeed } from '../controllers/public.controller.js';

const router = Router();

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests.' },
});

router.get('/feed', publicLimiter, getPublicFeed);

export default router;

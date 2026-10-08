import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { env } from './config/env.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import reportRoutes from './routes/report.routes.js';
import adminRoutes from './routes/admin.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import publicRoutes from './routes/public.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: false }));

  // Flexible CORS: multiple origins via comma-separated FRONTEND_URL.
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || env.frontendUrl.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
    }),
  );

  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  app.use(express.json({ limit: '256kb' }));

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api', globalLimiter);

  app.get('/health', async (req, res) => {
    try {
      const { pool } = await import('./config/db.js');
      await pool.query('SELECT 1');
      res.status(200).json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'disconnected' });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/public', publicRoutes);

  // Serve the built frontend (single-deploy production mode).
  const webDist = path.resolve(__dirname, '../../web/dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist, { maxAge: '1h', index: 'index.html' }));
    app.get(/^(?!\/(api|health)).*/, (req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

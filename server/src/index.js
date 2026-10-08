import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { pool } from './config/db.js';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { startScheduler, runEscalationJob } from './services/escalation.service.js';

const bootstrap = async () => {
  if (process.env.SKIP_MIGRATIONS === 'true') {
    logger.warn('SKIP_MIGRATIONS=true — database migrations skipped.');
  } else {
    await runMigrations();
  }

  const app = createApp();

  const server = app.listen(env.port, () => {
    logger.info(`CivicFix engine listening on port ${env.port} (${env.nodeEnv})`);
  });

  // One escalation pass shortly after boot, then on schedule.
  const bootPass = setTimeout(() => {
    runEscalationJob().catch((e) => logger.error(e.message));
  }, 30_000);
  bootPass.unref?.();

  const timers = startScheduler();

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received — shutting down gracefully.`);
    timers.forEach(clearInterval);
    clearTimeout(bootPass);
    server.close(async () => {
      await pool.end();
      logger.info('Shutdown complete.');
      process.exit(0);
    });
    // Hard-exit fallback.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

bootstrap().catch((err) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});

import { env } from './env.js';

const levelOf = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const threshold = env.nodeEnv === 'test' ? levelOf.error : levelOf.info;

const ts = () => new Date().toISOString();

const write = (level, args) => {
  if (levelOf[level] > threshold) return;
  const line = args
    .map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.stack || a.message : JSON.stringify(a)))
    .join(' ');
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](`[${ts()}] [${level.toUpperCase()}] ${line}`);
};

export const logger = {
  error: (...args) => write('error', args),
  warn: (...args) => write('warn', args),
  info: (...args) => write('info', args),
  debug: (...args) => write('debug', args),
};

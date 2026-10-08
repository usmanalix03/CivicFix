import 'dotenv/config';

const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'GEMINI_API_KEY',
  'TURNSTILE_SECRET_KEY',
  'SYSTEM_EMAIL',
  'SYSTEM_EMAIL_PASSWORD',
  'SUPER_ADMIN_EMAIL',
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  // Fail fast with an actionable message instead of a confusing runtime error.
  throw new Error(
    `CivicFix is missing required environment variables: ${missing.join(', ')}.\n` +
      'Copy server/.env.example to server/.env and fill in real values.',
  );
}

const bool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: int(process.env.PORT, 5000),

  databaseUrl: process.env.DATABASE_URL,
  dbPoolMax: int(process.env.DB_POOL_MAX, 20),
  dbPoolMin: int(process.env.DB_POOL_MIN, 2),

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',

  // Optional dedicated key for reversibly encrypting stored user emails.
  // Falls back to JWT_SECRET when unset.
  emailEncryptionKey: process.env.EMAIL_ENCRYPTION_KEY,

  // Comma-separated list of allowed CORS origins.
  frontendUrl: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((s) => s.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:3000'],

  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,

  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',

  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY,
  // Allow a dev bypass token ONLY when explicitly enabled.
  turnstileDevBypass: bool(process.env.TURNSTILE_DEV_BYPASS, false),

  systemEmail: process.env.SYSTEM_EMAIL,
  systemEmailPassword: process.env.SYSTEM_EMAIL_PASSWORD,
  emailFromName: process.env.EMAIL_FROM_NAME || 'CivicFix',
  emailEnabled: bool(process.env.EMAIL_ENABLED, true),

  superAdminEmail: process.env.SUPER_ADMIN_EMAIL,

  h3Resolution: int(process.env.H3_RESOLUTION, 10),

  // Hours within which a user may only file one report per H3 cell.
  spatialRateLimitHours: int(process.env.SPATIAL_RATE_LIMIT_HOURS, 1),

  // DAG escalation thresholds (hours).
  escalationActiveHours: int(process.env.ESCALATION_ACTIVE_HOURS, 72),
  contestedResolutionHours: int(process.env.CONTESTED_RESOLUTION_HOURS, 48),

  // Nominatim locality buffer (metres) when no polygon boundary is returned.
  regionBufferMeters: int(process.env.REGION_BUFFER_METERS, 1000),
  nominatimUserAgent: process.env.NOMINATIM_USER_AGENT || 'CivicFix/1.0 (civic reporting)',
};

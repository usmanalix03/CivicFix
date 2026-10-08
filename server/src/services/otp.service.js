import crypto from 'node:crypto';
import { query } from '../config/db.js';
import { HttpError } from '../utils/validators.js';
import { hashCode } from './auth.service.js';

const RATE_LIMIT_MS = 60_000;
const MAX_ATTEMPTS = 3;

const OTP_TTL_MINUTES = {
  CITIZEN_SIGNUP: 10,
  PASSWORD_RESET: 10,
  USER_DELETE: 10,
  ADMIN_SIGNUP: 15,
  ADMIN_SIGNUP_SUPER: 15,
  ADMIN_EDIT: 10,
  ADMIN_DELETE: 15,
  ADMIN_DELETE_SUPER: 15,
};

/**
 * Creates a persisted, single-use OTP and returns the plaintext code to email.
 * Enforces a 60-second re-request rate limit per (email, purpose).
 */
export async function createOtp(emailHash, purpose, ttlOverride) {
  const ttlMinutes = ttlOverride || OTP_TTL_MINUTES[purpose] || 10;

  const recent = await query(
    `SELECT created_at FROM otp_codes
     WHERE email_hash = $1 AND purpose = $2
     ORDER BY created_at DESC LIMIT 1`,
    [emailHash, purpose],
  );

  if (recent.rows.length > 0) {
    const elapsed = Date.now() - new Date(recent.rows[0].created_at).getTime();
    if (elapsed < RATE_LIMIT_MS) {
      const wait = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
      throw new HttpError(429, `Please wait ${wait}s before requesting another code.`, 'RATE_LIMIT');
    }
  }

  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  await query(
    `INSERT INTO otp_codes (email_hash, purpose, code_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [emailHash, purpose, hashCode(code), expiresAt],
  );

  return { code, expiresAt };
}

/**
 * Verifies a single-use OTP. On success the code is consumed (can't be reused).
 * Throws HttpError on invalid/expired/exhausted codes.
 */
export async function verifyOtp(emailHash, purpose, code) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    throw new HttpError(401, 'Invalid OTP.');
  }

  const { rows } = await query(
    `SELECT * FROM otp_codes
     WHERE email_hash = $1 AND purpose = $2 AND consumed = false
     ORDER BY created_at DESC LIMIT 1`,
    [emailHash, purpose],
  );

  const record = rows[0];
  if (!record) throw new HttpError(401, 'Invalid or expired OTP.');

  if (new Date(record.expires_at).getTime() < Date.now()) {
    await query('DELETE FROM otp_codes WHERE id = $1', [record.id]);
    throw new HttpError(401, 'OTP has expired. Please request a new one.');
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await query('DELETE FROM otp_codes WHERE id = $1', [record.id]);
    throw new HttpError(429, 'Too many failed attempts. Please request a new code.');
  }

  const valid = crypto.timingSafeEqual(Buffer.from(record.code_hash), Buffer.from(hashCode(code)));
  if (!valid) {
    await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [record.id]);
    throw new HttpError(401, 'Invalid OTP.');
  }

  await query('UPDATE otp_codes SET consumed = true WHERE id = $1', [record.id]);
  return true;
}

/** Periodic cleanup of stale codes to keep the table lean. */
export async function cleanupExpiredOtps() {
  await query(`DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 hour'`);
}

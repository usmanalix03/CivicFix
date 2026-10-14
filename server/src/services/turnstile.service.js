import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * Verifies a Cloudflare Turnstile token (invisible bot protection).
 * A `dev_dummy_token` bypass exists ONLY when TURNSTILE_DEV_BYPASS is enabled.
 */
export async function verifyTurnstile(token) {
  if (env.turnstileDevBypass && token === 'dev_dummy_token') return true;
  if (!token) return false;

  const secret = env.turnstileSecretKey?.trim();
  if (!secret) {
    logger.error('Turnstile verification failed: TURNSTILE_SECRET_KEY is empty');
    return false;
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);

    const { data } = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      params.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 8_000,
      },
    );

    if (!data.success) {
      logger.warn('[turnstile] Verification rejected by Cloudflare:', JSON.stringify(data));
    }

    return Boolean(data.success);
  } catch (err) {
    const cfError = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    logger.error(`[turnstile] Verification request failed: ${cfError}`);
    return false;
  }
}

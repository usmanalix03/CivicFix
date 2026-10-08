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

  try {
    const params = new URLSearchParams();
    params.append('secret', env.turnstileSecretKey);
    params.append('response', token);

    const { data } = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      params.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 8_000,
      },
    );

    return Boolean(data.success);
  } catch (err) {
    logger.error('Turnstile verification failed:', err.message);
    return false;
  }
}

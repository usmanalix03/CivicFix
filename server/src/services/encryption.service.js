import crypto from 'node:crypto';
import { env } from '../config/env.js';

const ALGO = 'aes-256-gcm';

/** 32-byte key derived from a dedicated key when present, else the JWT secret. */
function getKey() {
  const secret = env.emailEncryptionKey || env.jwtSecret;
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/** Encrypts an email to "iv:authTag:ciphertext" (all hex). */
export function encryptEmail(email) {
  if (!email) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(email), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

/** Decrypts an encrypted email payload; returns null when malformed. */
export function decryptEmail(payload) {
  if (!payload || typeof payload !== 'string') return null;
  const parts = payload.split(':');
  if (parts.length !== 3) return null;
  try {
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(parts[0], 'hex'));
    decipher.setAuthTag(Buffer.from(parts[1], 'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(parts[2], 'hex')), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return null;
  }
}

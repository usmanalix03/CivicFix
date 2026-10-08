import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

/** Deterministic SHA-256 email hash: privacy-preserving identity. */
export const hashEmail = (email) =>
  crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');

export const generateToken = ({ id, emailHash, role, regionId }) =>
  jwt.sign({ id, emailHash, role, regionId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);

export const hashPassword = (password) => bcrypt.hash(password, 12);

export const comparePassword = (password, hashed) => bcrypt.compare(password, hashed);

/** Constant-time string comparison to avoid timing side-channels on OTPs. */
export const safeCompare = (a, b) => {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

export const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

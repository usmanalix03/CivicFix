import { pool } from '../config/db.js';
import {
  hashEmail,
  generateToken,
  hashPassword,
  comparePassword,
} from '../services/auth.service.js';
import { createOtp, verifyOtp } from '../services/otp.service.js';
import { sendOtpEmail, sendEmail } from '../services/email.service.js';
import { encryptEmail } from '../services/encryption.service.js';
import { provisionRegion } from '../services/region.service.js';
import { asyncHandler, HttpError, isValidEmail, parseCoordinates } from '../utils/validators.js';
import { escapeHTML, cleanText, normalizePhone } from '../utils/sanitize.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const MIN_PASSWORD_LENGTH = 8;

const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }
  return password;
};

const assertNotRegistered = async (emailHash) => {
  const { rows } = await pool.query('SELECT 1 FROM users WHERE email_hash = $1', [emailHash]);
  if (rows.length > 0) throw new HttpError(409, 'An account with this email already exists. Please log in.');
};

/** Provisions the user's locality region from live GPS and returns { regionId, regionName }. */
const bindRegionFromCoordinates = async (lat, lng) => {
  const client = await pool.connect();
  try {
    return await provisionRegion(client, lat, lng);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    logger.error('Region provisioning failed:', err.message);
    throw new HttpError(502, 'Could not determine your civic locality. Please try again.');
  } finally {
    client.release();
  }
};

// ---------------------------------------------------------------------------
// Citizen signup (single real-email OTP + live GPS region binding)
// ---------------------------------------------------------------------------

export const requestCitizenOtp = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!isValidEmail(email)) throw new HttpError(400, 'A valid email address is required.');

  const emailHash = hashEmail(email.trim());
  await assertNotRegistered(emailHash);

  const { code } = await createOtp(emailHash, 'CITIZEN_SIGNUP');
  await sendOtpEmail(email.trim(), 'Verification code', code, '<br/>Use it to finish creating your citizen account.');

  res.status(200).json({ message: 'Verification code sent to your email.' });
});

export const signupCitizen = asyncHandler(async (req, res) => {
  const { email, otp, password, lat, lng } = req.body || {};
  if (!isValidEmail(email) || !otp || !password) {
    throw new HttpError(400, 'Email, OTP, and password are required.');
  }
  const coords = parseCoordinates(lat, lng);
  if (!coords) throw new HttpError(400, 'Valid live GPS coordinates are required.');

  validatePassword(password);

  const emailHash = hashEmail(email.trim());
  await assertNotRegistered(emailHash);
  await verifyOtp(emailHash, 'CITIZEN_SIGNUP', String(otp));

  const { regionId, regionName } = await bindRegionFromCoordinates(coords.lat, coords.lng);

  const passHash = await hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO users (email_hash, password_hash, role, status, region_id, email_encrypted)
     VALUES ($1, $2, 'USER', 'ACTIVE', $3, $4)
     RETURNING id, role, region_id`,
    [emailHash, passHash, regionId, encryptEmail(email.trim())],
  );

  const token = generateToken({ id: rows[0].id, emailHash, role: rows[0].role, regionId: rows[0].region_id });

  sendEmail({
    to: email.trim(),
    subject: 'Welcome to CivicFix',
    preheader: 'Your account is active.',
    body: `Your account is active and spatially bound to <b>${escapeHTML(regionName)}</b>.<br/>Report civic issues with your camera — the community verifies every fix.`,
  }).catch((err) => logger.error('Welcome email failed:', err.message));

  res.status(201).json({
    message: `Account created. You are spatially bound to ${regionName}.`,
    token,
    user: { id: rows[0].id, role: rows[0].role, regionId: rows[0].region_id, regionName },
  });
});

// ---------------------------------------------------------------------------
// Admin signup (dual authorization: primary code + Super Admin code)
// ---------------------------------------------------------------------------

export const requestAdminOtp = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!isValidEmail(email)) throw new HttpError(400, 'A valid email address is required.');

  const emailHash = hashEmail(email.trim());
  await assertNotRegistered(emailHash);

  const primary = await createOtp(emailHash, 'ADMIN_SIGNUP');
  const secondary = await createOtp(emailHash, 'ADMIN_SIGNUP_SUPER');

  await sendOtpEmail(email.trim(), 'Admin verification (step 1 of 2)', primary.code);
  await sendOtpEmail(
    env.superAdminEmail,
    'New authority request authorization (step 2 of 2)',
    secondary.code,
    `<br/>An authority account is being created for <b>${escapeHTML(email.trim())}</b>.<br/>Share the code below with that person ONLY if you approve.`,
  );

  res.status(200).json({
    message: 'Primary code sent to your email. Contact the Super Admin for the secondary authorization code.',
  });
});

export const signupAdmin = asyncHandler(async (req, res) => {
  const { email, otp1, otp2, password, lat, lng } = req.body || {};
  if (!isValidEmail(email) || !otp1 || !otp2 || !password) {
    throw new HttpError(400, 'Email, both OTPs, and password are required.');
  }
  const coords = parseCoordinates(lat, lng);
  if (!coords) throw new HttpError(400, 'Valid live GPS coordinates are required.');

  validatePassword(password);

  const emailHash = hashEmail(email.trim());
  await assertNotRegistered(emailHash);
  await verifyOtp(emailHash, 'ADMIN_SIGNUP', String(otp1));
  await verifyOtp(emailHash, 'ADMIN_SIGNUP_SUPER', String(otp2));

  const { regionId, regionName } = await bindRegionFromCoordinates(coords.lat, coords.lng);

  const passHash = await hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO users (email_hash, password_hash, role, status, region_id, email_encrypted)
     VALUES ($1, $2, 'ADMIN', 'ACTIVE', $3, $4)
     RETURNING id, role, region_id`,
    [emailHash, passHash, regionId, encryptEmail(email.trim())],
  );

  const token = generateToken({ id: rows[0].id, emailHash, role: rows[0].role, regionId: rows[0].region_id });

  res.status(201).json({
    message: `Authority account created for ${regionName}.`,
    token,
    user: { id: rows[0].id, role: rows[0].role, regionId: rows[0].region_id, regionName },
  });
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || !password) throw new HttpError(400, 'Email and password are required.');

  const emailHash = hashEmail(email.trim());
  const { rows } = await pool.query(
    `SELECT u.*, r.name AS region_name
     FROM users u LEFT JOIN regions r ON u.region_id = r.id
     WHERE u.email_hash = $1`,
    [emailHash],
  );
  const user = rows[0];

  if (!user || !user.password_hash || !(await comparePassword(password, user.password_hash))) {
    throw new HttpError(401, 'Invalid email or password.');
  }
  if (user.status !== 'ACTIVE') throw new HttpError(403, 'Your account is not active.');

  const token = generateToken({ id: user.id, emailHash, role: user.role, regionId: user.region_id });

  res.status(200).json({
    token,
    user: {
      id: user.id,
      role: user.role,
      status: user.status,
      regionId: user.region_id,
      regionName: user.region_name,
      name: user.name,
    },
  });
});

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export const requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!isValidEmail(email)) throw new HttpError(400, 'A valid email address is required.');

  const emailHash = hashEmail(email.trim());
  const { rows } = await pool.query('SELECT 1 FROM users WHERE email_hash = $1', [emailHash]);
  if (rows.length === 0) {
    // Don't leak account existence, but keep the same response shape.
    return res.status(200).json({ message: 'If that email is registered, a reset code has been sent.' });
  }

  const { code } = await createOtp(emailHash, 'PASSWORD_RESET');
  await sendOtpEmail(email.trim(), 'Password reset code', code);

  res.status(200).json({ message: 'Reset code sent to your email.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body || {};
  if (!isValidEmail(email) || !otp || !newPassword) {
    throw new HttpError(400, 'Email, OTP, and new password are required.');
  }
  validatePassword(newPassword);

  const emailHash = hashEmail(email.trim());
  await verifyOtp(emailHash, 'PASSWORD_RESET', String(otp));

  const passHash = await hashPassword(newPassword);
  await pool.query('UPDATE users SET password_hash = $1 WHERE email_hash = $2', [passHash, emailHash]);

  res.status(200).json({ message: 'Password updated successfully. You can now log in.' });
});

// ---------------------------------------------------------------------------
// Authenticated profile
// ---------------------------------------------------------------------------

export const getDashboard = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.address, u.phone_number, u.role, u.status, u.created_at,
            r.name AS region_name, r.id AS region_id
     FROM users u LEFT JOIN regions r ON u.region_id = r.id
     WHERE u.id = $1`,
    [req.user.id],
  );
  if (!rows[0]) throw new HttpError(404, 'Account not found.');
  res.status(200).json(rows[0]);
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) throw new HttpError(400, 'Current and new password are required.');
  validatePassword(newPassword);

  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0] || !(await comparePassword(currentPassword, rows[0].password_hash))) {
    throw new HttpError(401, 'Current password is incorrect.');
  }

  const passHash = await hashPassword(newPassword);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passHash, req.user.id]);

  res.status(200).json({ message: 'Password changed successfully.' });
});

export const updateCitizenProfile = asyncHandler(async (req, res) => {
  if (req.user.role !== 'USER') throw new HttpError(403, 'Only citizens can use this route.');

  const { name, address, phoneNumber } = req.body || {};
  const safeName = name ? cleanText(name, 100) : null;
  const safeAddress = address ? cleanText(address, 500) : null;
  const safePhone = phoneNumber ? normalizePhone(phoneNumber) : null;

  if (!safeName && !safeAddress && !safePhone) {
    throw new HttpError(400, 'At least one field (name, address, phoneNumber) is required.');
  }
  if (phoneNumber && !safePhone) throw new HttpError(400, 'Invalid phone number format.');

  await pool.query(
    `UPDATE users SET name = COALESCE($1, name), address = COALESCE($2, address), phone_number = COALESCE($3, phone_number)
     WHERE id = $4`,
    [safeName, safeAddress, safePhone, req.user.id],
  );

  res.status(200).json({ message: 'Profile updated successfully.' });
});

// ---------------------------------------------------------------------------
// Admin profile edit (Super Admin authorization)
// ---------------------------------------------------------------------------

export const requestAdminEditOtp = asyncHandler(async (req, res) => {
  if (req.user.role !== 'ADMIN') throw new HttpError(403, 'Only admins can use this route.');

  const { email, name, address, phoneNumber } = req.body || {};
  if (!isValidEmail(email)) throw new HttpError(400, 'A valid email address is required.');
  if (hashEmail(email.trim()) !== req.user.emailHash) {
    throw new HttpError(401, 'Email mismatch — this is not your account email.');
  }

  const { code } = await createOtp(req.user.emailHash, 'ADMIN_EDIT');
  await sendEmail({
    to: env.superAdminEmail,
    subject: 'Authority profile update — authorization required',
    body:
      `An authority account (${escapeHTML(email.trim())}) requested a profile update.<br/><br/>` +
      `Name: ${escapeHTML(name || '—')}<br/>Address: ${escapeHTML(address || '—')}<br/>Phone: ${escapeHTML(phoneNumber || '—')}`,
    code,
  });

  res.status(200).json({ message: 'Update request sent to the Super Admin for authorization.' });
});

export const confirmAdminEdit = asyncHandler(async (req, res) => {
  if (req.user.role !== 'ADMIN') throw new HttpError(403, 'Only admins can use this route.');

  const { email, otp, name, address, phoneNumber } = req.body || {};
  if (!isValidEmail(email)) throw new HttpError(400, 'A valid email address is required.');
  if (hashEmail(email.trim()) !== req.user.emailHash) {
    throw new HttpError(401, 'Email mismatch — this is not your account email.');
  }

  await verifyOtp(req.user.emailHash, 'ADMIN_EDIT', String(otp || ''));

  const safeName = name ? cleanText(name, 100) : null;
  const safeAddress = address ? cleanText(address, 500) : null;
  const safePhone = phoneNumber ? normalizePhone(phoneNumber) : null;
  if (phoneNumber && !safePhone) throw new HttpError(400, 'Invalid phone number format.');

  await pool.query(
    `UPDATE users SET name = COALESCE($1, name), address = COALESCE($2, address), phone_number = COALESCE($3, phone_number)
     WHERE id = $4`,
    [safeName, safeAddress, safePhone, req.user.id],
  );

  res.status(200).json({ message: 'Profile updated securely.' });
});

// ---------------------------------------------------------------------------
// Account deletion (citizen: 1 code · admin: dual authorization)
// ---------------------------------------------------------------------------

export const requestDeleteOtp = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!isValidEmail(email)) throw new HttpError(400, 'A valid email address is required.');
  if (hashEmail(email.trim()) !== req.user.emailHash) {
    throw new HttpError(401, 'Email mismatch — this is not your account email.');
  }

  if (req.user.role === 'USER') {
    const { code } = await createOtp(req.user.emailHash, 'USER_DELETE');
    await sendOtpEmail(email.trim(), 'Account deletion code', code, '<br/>This permanently deletes your account and its records.');
    return res.status(200).json({ message: 'Deletion code sent to your email.' });
  }

  if (req.user.role === 'ADMIN') {
    const primary = await createOtp(req.user.emailHash, 'ADMIN_DELETE');
    const secondary = await createOtp(req.user.emailHash, 'ADMIN_DELETE_SUPER');
    await sendOtpEmail(email.trim(), 'Admin deletion (step 1 of 2)', primary.code);
    await sendOtpEmail(
      env.superAdminEmail,
      'Admin deletion authorization (step 2 of 2)',
      secondary.code,
      `<br/>An authority account (${escapeHTML(email.trim())}) requested deletion. Share this code ONLY if you approve.`,
    );
    return res.status(200).json({ message: 'Primary code sent. Contact the Super Admin for the secondary code.' });
  }

  throw new HttpError(403, 'Role not authorized for this deletion flow.');
});

export const confirmDelete = asyncHandler(async (req, res) => {
  const { email, otp1, otp2 } = req.body || {};
  if (!isValidEmail(email)) throw new HttpError(400, 'A valid email address is required.');
  if (hashEmail(email.trim()) !== req.user.emailHash) {
    throw new HttpError(401, 'Email mismatch — this is not your account email.');
  }

  if (req.user.role === 'USER') {
    await verifyOtp(req.user.emailHash, 'USER_DELETE', String(otp1 || ''));
  } else if (req.user.role === 'ADMIN') {
    await verifyOtp(req.user.emailHash, 'ADMIN_DELETE', String(otp1 || ''));
    await verifyOtp(req.user.emailHash, 'ADMIN_DELETE_SUPER', String(otp2 || ''));
  } else {
    throw new HttpError(403, 'Role not authorized for this deletion flow.');
  }

  await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
  res.status(200).json({ message: 'Account permanently deleted.' });
});

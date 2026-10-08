import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { pool } from '../src/config/db.js';
import { hashEmail, hashPassword } from '../src/services/auth.service.js';
import { encryptEmail } from '../src/services/encryption.service.js';
import { env } from '../src/config/env.js';

/**
 * Creates (or resets) the SUPER_ADMIN account.
 * Email comes from SUPER_ADMIN_EMAIL; password from SUPER_ADMIN_PASSWORD or an interactive prompt.
 */
async function main() {
  const email = env.superAdminEmail.trim();
  const emailHash = hashEmail(email);

  let password = process.env.SUPER_ADMIN_PASSWORD;
  if (!password) {
    const rl = readline.createInterface({ input, output });
    password = await rl.question(`Password for ${email}: `);
    rl.close();
  }
  if (!password || password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const passHash = await hashPassword(password);

  const existing = await pool.query('SELECT id FROM users WHERE email_hash = $1', [emailHash]);
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE users SET password_hash = $1, role = 'SUPER_ADMIN', status = 'ACTIVE', email_encrypted = $3 WHERE id = $2`,
      [passHash, existing.rows[0].id, encryptEmail(email)],
    );
    console.log(`SUPER_ADMIN updated: ${email}`);
  } else {
    await pool.query(
      `INSERT INTO users (email_hash, password_hash, role, status, email_encrypted)
       VALUES ($1, $2, 'SUPER_ADMIN', 'ACTIVE', $3)`,
      [emailHash, passHash, encryptEmail(email)],
    );
    console.log(`SUPER_ADMIN created: ${email}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

// Neon (and most managed Postgres providers) require SSL.
// We detect Neon URLs automatically; you can also force via DATABASE_SSL=true.
const isNeon = env.databaseUrl?.includes('neon.tech');
const requireSsl = isNeon || process.env.DATABASE_SSL === 'true';

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.dbPoolMax,
  min: env.dbPoolMin,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // Neon free tier: always use SSL; rejectUnauthorized=false avoids self-signed
  // cert issues common in managed serverless Postgres offerings.
  ...(requireSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

/** Runs a single query with an optional parameter array. */
export const query = (text, params) => pool.query(text, params);

/** Opens a dedicated client for multi-statement transactions. */
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

import 'dotenv/config';
import { runMigrations } from '../src/db/migrate.js';
import { pool } from '../src/config/db.js';

runMigrations()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });

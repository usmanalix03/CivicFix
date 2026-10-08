import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { notifyIssueParticipants, notifyRegionAdmins } from './notification.service.js';
import { sendSuperAdminNotification } from './email.service.js';

/**
 * The automated DAG escalation engine.
 *
 * 1. CONTESTED nodes whose 48h reverse-consensus window expired (no appeal) → ARCHIVED.
 * 2. ACTIVE nodes ignored by authorities beyond the threshold → escalation_count++,
 *    priority boost, and notifications to governing admins.
 * 3. Expired OTP rows are purged.
 *
 * Runs on a timer inside the API process; safe to re-run (idempotent).
 */
export async function runEscalationJob() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- Reverse consensus timer (authority "Issue Not Found" invalidation) ---
    const contested = await client.query(
      `UPDATE issue_nodes
       SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP
       WHERE status = 'CONTESTED'
         AND contested_at < NOW() - ($1 || ' hours')::interval
       RETURNING id, title`,
      [env.contestedResolutionHours],
    );
    for (const row of contested.rows) {
      await notifyIssueParticipants(
        client,
        row.id,
        'ISSUE_ARCHIVED',
        'Issue archived automatically',
        `"${row.title}" was archived because no citizen re-verified it within the appeal window.`,
      );
    }

    // --- Authority accountability escalation ---
    const candidates = await client.query(
      `SELECT id, region_id, title, density_score, escalation_count
       FROM issue_nodes
       WHERE status = 'ACTIVE'
         AND created_at < NOW() - ($1 || ' hours')::interval
         AND (last_escalated_at IS NULL OR last_escalated_at < NOW() - ($1 || ' hours')::interval)
       ORDER BY created_at ASC`,
      [env.escalationActiveHours],
    );

    for (const row of candidates.rows) {
      const level = row.escalation_count + 1;
      await client.query(
        `UPDATE issue_nodes
         SET escalation_count = $2, last_escalated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [row.id, level],
      );

      await notifyRegionAdmins(
        client,
        row.region_id,
        'ISSUE_ESCALATED',
        `Escalation #${level} — ${row.title}`,
        `This issue has ${row.density_score} citizen report(s) and no authority action yet. It has been auto-escalated by the accountability engine.`,
        `/admin/issues/${row.id}`,
      );
    }

    await client.query('COMMIT');

    if (contested.rows.length || candidates.rows.length) {
      logger.info(
        `Escalation engine: ${contested.rows.length} auto-archived, ${candidates.rows.length} escalated.`,
      );
    }

    if (candidates.rows.length > 0 && env.emailEnabled) {
      sendSuperAdminNotification(
        `CivicFix — ${candidates.rows.length} issue(s) auto-escalated`,
        candidates.rows
          .map((r, i) => `${i + 1}. ${r.title} (density ${r.density_score}, escalation ${r.escalation_count + 1})`)
          .join('\n'),
      ).catch((err) => logger.error('Super admin escalation email failed:', err.message));
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Escalation job failed:', err.message);
  } finally {
    client.release();
  }
}

/** Also purges expired OTPs on the same cadence. */
export async function runMaintenanceJob() {
  try {
    await pool.query(`DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 hour'`);
  } catch (err) {
    logger.error('Maintenance job failed:', err.message);
  }
}

export function startScheduler() {
  const intervalMs = 10 * 60 * 1000; // every 10 minutes
  const timers = [
    setInterval(() => runEscalationJob().catch((e) => logger.error(e.message)), intervalMs),
    setInterval(() => runMaintenanceJob().catch((e) => logger.error(e.message)), intervalMs),
  ];
  timers.forEach((t) => t.unref?.());
  logger.info(`DAG escalation scheduler started (every ${intervalMs / 60000} min).`);
  return timers;
}

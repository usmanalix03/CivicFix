import 'dotenv/config';
import { pool } from '../src/config/db.js';
import { provisionRegion } from '../src/services/region.service.js';
import { logger } from '../src/config/logger.js';

/**
 * Repairs legacy rows created before region auto-provisioning existed:
 *  - issue_nodes with NULL region_id → region provisioned from their coordinates.
 *  - users with NULL region_id → region taken from their most recent report location.
 * Rows that cannot be resolved (no coordinates anywhere) are reported for manual review.
 */
async function backfill() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Issue nodes.
    const nodes = await client.query(
      `SELECT id, ST_Y(coordinates::geometry) AS lat, ST_X(coordinates::geometry) AS lng
       FROM issue_nodes WHERE region_id IS NULL`,
    );
    for (const node of nodes.rows) {
      const { regionId, regionName } = await provisionRegion(client, node.lat, node.lng);
      await client.query('UPDATE issue_nodes SET region_id = $1 WHERE id = $2', [regionId, node.id]);
      logger.info(`Issue node ${node.id} bound to region "${regionName}".`);
    }

    // 2. Users with reports.
    const users = await client.query(
      `SELECT u.id,
              (SELECT ST_Y(n.coordinates::geometry)
               FROM issue_reports r JOIN issue_nodes n ON n.id = r.issue_node_id
               WHERE r.user_id = u.id ORDER BY r.created_at DESC LIMIT 1) AS lat,
              (SELECT ST_X(n.coordinates::geometry)
               FROM issue_reports r JOIN issue_nodes n ON n.id = r.issue_node_id
               WHERE r.user_id = u.id ORDER BY r.created_at DESC LIMIT 1) AS lng
       FROM users u WHERE u.region_id IS NULL`,
    );

    for (const user of users.rows) {
      if (!user.lat || !user.lng) {
        logger.warn(`User ${user.id} has NULL region and no coordinates to derive one — re-registration required.`);
        continue;
      }
      const { regionId, regionName } = await provisionRegion(client, user.lat, user.lng);
      await client.query('UPDATE users SET region_id = $1 WHERE id = $2', [regionId, user.id]);
      logger.info(`User ${user.id} bound to region "${regionName}".`);
    }

    await client.query('COMMIT');
    logger.info('Legacy backfill complete.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Backfill failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

backfill();

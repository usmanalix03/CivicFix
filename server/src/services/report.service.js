import { ISSUE_STATUSES } from '../utils/constants.js';

/** Finds a mergeable active node in the same category across the k-ring neighbourhood. */
export const findActiveNode = async (client, kRingHexagons, category, regionId, lat, lng) => {
  const { rows } = await client.query(
    `SELECT id, status
     FROM issue_nodes
     WHERE h3_index = ANY($1::text[])
       AND category = $2
       AND region_id = $3
       AND status IN ('ACTIVE', 'CONTESTED', 'NEEDS_VERIFICATION')
     ORDER BY coordinates <-> ST_SetSRID(ST_MakePoint($4, $5), 4326)
     LIMIT 1`,
    [kRingHexagons, category, regionId, lng, lat],
  );
  return rows[0] || null;
};

export const incrementNodeDensity = async (client, nodeId) => {
  await client.query(
    `UPDATE issue_nodes SET density_score = density_score + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [nodeId],
  );
};

export const createNewNode = async (client, { h3Index, lat, lng, title, description, category, regionId }) => {
  const { rows } = await client.query(
    `INSERT INTO issue_nodes (h3_index, coordinates, title, description, category, region_id)
     VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, $7)
     RETURNING id`,
    [h3Index, lng, lat, title, description, category, regionId],
  );
  return rows[0].id;
};

export const logUserAction = async (client, nodeId, userId, actionType, imageUrl = null, proofImages = []) => {
  await client.query(
    `INSERT INTO issue_reports (issue_node_id, user_id, action_type, image_url, proof_images)
     VALUES ($1, $2, $3, $4, $5)`,
    [nodeId, userId, actionType, imageUrl, proofImages],
  );
};

export const checkUserActionExists = async (client, nodeId, userId) => {
  const { rows } = await client.query(
    'SELECT 1 FROM issue_reports WHERE issue_node_id = $1 AND user_id = $2 LIMIT 1',
    [nodeId, userId],
  );
  return rows.length > 0;
};

export const checkSpecificActionExists = async (client, nodeId, userId, actionType) => {
  const { rows } = await client.query(
    'SELECT 1 FROM issue_reports WHERE issue_node_id = $1 AND user_id = $2 AND action_type = $3 LIMIT 1',
    [nodeId, userId, actionType],
  );
  return rows.length > 0;
};

/** Spatial velocity limit: one INITIAL_REPORT per H3 neighbourhood per window. */
export const checkSpatialRateLimit = async (client, userId, h3Indexes, hours) => {
  const { rows } = await client.query(
    `SELECT 1
     FROM issue_reports r
     JOIN issue_nodes n ON n.id = r.issue_node_id
     WHERE r.user_id = $1
       AND r.action_type = 'INITIAL_REPORT'
       AND n.h3_index = ANY($2::text[])
       AND r.created_at > NOW() - ($3 || ' hours')::interval
     LIMIT 1`,
    [userId, h3Indexes, hours],
  );
  return rows.length > 0;
};

/** A verifier must physically be close enough to the issue, not just in its region. */
export const isNearIssue = async (client, nodeId, lat, lng, radiusMeters = 1000) => {
  const { rows } = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM issue_nodes
       WHERE id = $1
         AND ST_DWithin(
           coordinates::geography,
           ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
           $4
         )
     ) AS "isNear"`,
    [nodeId, lat, lng, radiusMeters],
  );
  return Boolean(rows[0]?.isNear);
};

/**
 * Consensus engine — the mathematical heart of the DAG state machine.
 * Returns the new status when a transition fired, otherwise null.
 *
 * Locality-wide verification: once an authority marks an issue "Fixed"
 * (NEEDS_VERIFICATION), ANY citizen in the locality can verify. A quorum of
 * verifications (>= 2) needs agreement from at least 50% of eligible citizens:
 * "fixed" resolves it, while "still exists" returns it to ACTIVE. A tied vote
 * keeps the issue active, because an unverified problem should not be closed.
 */
export const evaluateConsensus = async (client, nodeId) => {
  const { rows } = await client.query(
    `SELECT
       n.status,
       n.density_score,
       (SELECT COUNT(*) FROM users u
        WHERE u.region_id = n.region_id AND u.role = 'USER' AND u.status = 'ACTIVE')::int AS eligible_citizens,
       (SELECT COUNT(DISTINCT r.user_id)
        FROM issue_reports r JOIN users u ON u.id = r.user_id
        WHERE r.issue_node_id = n.id
          AND r.action_type = 'CONFIRM_FIXED'
          AND u.role = 'USER'
          AND (n.verification_started_at IS NULL OR r.created_at >= n.verification_started_at))::int AS confirm_count,
       (SELECT COUNT(DISTINCT r.user_id)
        FROM issue_reports r JOIN users u ON u.id = r.user_id
        WHERE r.issue_node_id = n.id
          AND r.action_type = 'STILL_EXISTS'
          AND u.role = 'USER'
          AND (n.verification_started_at IS NULL OR r.created_at >= n.verification_started_at))::int AS oppose_count
     FROM issue_nodes n
     WHERE n.id = $1`,
    [nodeId],
  );
  if (rows.length === 0) return null;

  const confirms = parseInt(rows[0].confirm_count, 10);
  const opposes = parseInt(rows[0].oppose_count, 10);

  // Community verification (only meaningful during the "Fixed" window).
  if (rows[0].status === ISSUE_STATUSES.NEEDS_VERIFICATION) {
    const total = confirms + opposes;
    // A locality-wide quorum prevents only the original reporters from
    // deciding a public fix. Keep a two-person floor for tiny pilot regions.
    const eligibleCitizens = parseInt(rows[0].eligible_citizens, 10) || 0;
    const quorum = Math.max(2, Math.ceil(eligibleCitizens * 0.5));
    if (total >= quorum) {
      // Prefer the safe outcome for a dead-even result: preserve the report.
      if (opposes >= quorum) {
        await client.query(
          `UPDATE issue_nodes SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP, verification_started_at = NULL WHERE id = $1`,
          [nodeId],
        );
        return ISSUE_STATUSES.ACTIVE;
      }
      if (confirms >= quorum) {
        await client.query(
          `UPDATE issue_nodes SET status = 'RESOLVED', updated_at = CURRENT_TIMESTAMP, resolution_deadline = NULL WHERE id = $1`,
          [nodeId],
        );
        return ISSUE_STATUSES.RESOLVED;
      }
    }
  }

  return null;
};

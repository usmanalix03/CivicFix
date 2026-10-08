import { pool } from '../config/db.js';
import { asyncHandler } from '../utils/validators.js';

/**
 * Public, anonymized feed for the community dashboard.
 * Exposes no user identities — only aggregated issue nodes.
 */
export const getPublicFeed = asyncHandler(async (req, res) => {
  const { limit = 100, south_lat, west_lng, north_lat, east_lng } = req.query;
  const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));

  const params = [];
  let where = `WHERE n.status IN ('ACTIVE', 'NEEDS_VERIFICATION')`;

  const s = parseFloat(south_lat);
  const w = parseFloat(west_lng);
  const n2 = parseFloat(north_lat);
  const e = parseFloat(east_lng);
  if ([s, w, n2, e].every((v) => !Number.isNaN(v)) && s < n2 && w < e) {
    params.push(w, s, e, n2);
    where += ` AND ST_Intersects(n.coordinates, ST_MakeEnvelope($1, $2, $3, $4, 4326))`;
  }

  params.push(limitNum);
  const { rows } = await pool.query(
    `SELECT n.id, n.title, n.category, n.status, n.density_score, n.likes_count,
            n.created_at,
            ST_Y(n.coordinates::geometry) AS lat, ST_X(n.coordinates::geometry) AS lng,
            (SELECT image_url FROM issue_reports
             WHERE issue_node_id = n.id AND action_type = 'INITIAL_REPORT' AND image_url IS NOT NULL
             ORDER BY created_at LIMIT 1) AS "imageUrl"
     FROM issue_nodes n
     ${where}
     ORDER BY (n.density_score * 2 + n.likes_count) DESC, n.created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  res.status(200).json({ items: rows });
});

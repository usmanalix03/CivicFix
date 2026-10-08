import { pool } from '../config/db.js';
import { asyncHandler, HttpError, isValidUuid } from '../utils/validators.js';
import { notifyIssueParticipants, notifyRegionAdmins } from '../services/notification.service.js';
import { notifyRegionCitizens, notifyRegionAuthorities } from '../services/email.service.js';
import { ISSUE_STATUSES } from '../utils/constants.js';

/** Scope helper: super admins see everything, admins are bound to their region. */
const regionScope = (req) => (req.user.role === 'SUPER_ADMIN' ? null : req.user.regionId);

const requireAuthority = (req) => {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    throw new HttpError(403, 'Authority access required.');
  }
};

const withScope = (req) => {
  const regionId = regionScope(req);
  return regionId
    ? { clause: 'n.region_id = $1', params: [regionId] }
    : { clause: 'TRUE', params: [] };
};

// ---------------------------------------------------------------------------
// Authority queue — ranked by density, never by submission time
// ---------------------------------------------------------------------------

export const getAdminFeed = asyncHandler(async (req, res) => {
  requireAuthority(req);

  const { page = 1, limit = 50, status, category, q } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const { clause, params } = withScope(req);
  let where = `WHERE ${clause}`;

  if (status && Object.values(ISSUE_STATUSES).includes(String(status))) {
    params.push(String(status));
    where += ` AND n.status = $${params.length}`;
  }
  if (category) {
    params.push(String(category).slice(0, 50));
    where += ` AND n.category = $${params.length}`;
  }
  if (q) {
    params.push(`%${String(q).slice(0, 100)}%`);
    where += ` AND (n.title ILIKE $${params.length} OR n.description ILIKE $${params.length})`;
  }

  params.push(limitNum, offset);
  const { rows } = await pool.query(
    `SELECT n.id, n.title, n.category, n.status, n.density_score, n.likes_count, n.flag_count,
            n.escalation_count, n.contested_at, n.created_at, n.updated_at,
            ST_Y(n.coordinates::geometry) AS lat, ST_X(n.coordinates::geometry) AS lng,
            (n.density_score * 2 + n.likes_count + n.escalation_count * 3) AS priority_score,
            (SELECT image_url FROM issue_reports
             WHERE issue_node_id = n.id AND action_type = 'INITIAL_REPORT' AND image_url IS NOT NULL
             ORDER BY created_at LIMIT 1) AS "imageUrl",
            (SELECT COUNT(*) FROM issue_reports r
             WHERE r.issue_node_id = n.id AND r.action_type = 'INITIAL_REPORT') AS reporter_count
     FROM issue_nodes n
     ${where}
     ORDER BY priority_score DESC, n.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  res.status(200).json({ items: rows, page: pageNum, limit: limitNum });
});

// ---------------------------------------------------------------------------
// Authority dashboard metrics
// ---------------------------------------------------------------------------

export const getAdminStats = asyncHandler(async (req, res) => {
  requireAuthority(req);

  const { clause, params } = withScope(req);
  const where = `WHERE ${clause}`;

  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'ACTIVE')            AS active,
       COUNT(*) FILTER (WHERE status = 'CONTESTED')         AS contested,
       COUNT(*) FILTER (WHERE status = 'NEEDS_VERIFICATION') AS needs_verification,
       COUNT(*) FILTER (WHERE status = 'RESOLVED')          AS resolved,
       COUNT(*) FILTER (WHERE status = 'ARCHIVED')          AS archived,
       COUNT(*)                                             AS total,
       COALESCE(SUM(density_score), 0)                      AS total_density,
       COALESCE(SUM(likes_count), 0)                        AS total_likes,
       COALESCE(SUM(flag_count), 0)                         AS total_flags,
       COALESCE(SUM(escalation_count), 0)                   AS total_escalations,
       COUNT(*) FILTER (WHERE status = 'RESOLVED' AND updated_at > NOW() - INTERVAL '30 days') AS resolved_last_30d
     FROM issue_nodes n ${where}`,
    params,
  );

  const byCategory = await pool.query(
    `SELECT n.category, COUNT(*) AS count, COALESCE(SUM(n.density_score), 0) AS density
     FROM issue_nodes n ${where}
     GROUP BY n.category
     ORDER BY count DESC
     LIMIT 10`,
    params,
  );

  const usersInRegion = regionScope(req)
    ? await pool.query('SELECT COUNT(*) AS count FROM users WHERE region_id = $1', [regionScope(req)])
    : await pool.query('SELECT COUNT(*) AS count FROM users');

  res.status(200).json({
    stats: { ...rows[0], users: parseInt(usersInRegion.rows[0].count, 10) },
    byCategory: byCategory.rows,
  });
});

// ---------------------------------------------------------------------------
// Authority issue detail (with evidence timeline)
// ---------------------------------------------------------------------------

export const getAdminIssueDetails = asyncHandler(async (req, res) => {
  requireAuthority(req);
  const { id } = req.params;
  if (!isValidUuid(id)) throw new HttpError(400, 'Invalid issue id.');

  const { clause, params } = withScope(req);
  params.push(id);

  const nodeRes = await pool.query(
    `SELECT n.*, ST_Y(n.coordinates::geometry) AS lat, ST_X(n.coordinates::geometry) AS lng,
            (SELECT proof_images FROM issue_reports
             WHERE issue_node_id = n.id AND action_type = 'INITIAL_REPORT' AND image_url IS NOT NULL
             ORDER BY created_at LIMIT 1) AS "proofImages"
     FROM issue_nodes n
     WHERE ${clause} AND n.id = $${params.length}`,
    params,
  );
  if (nodeRes.rows.length === 0) throw new HttpError(404, 'Issue not found in your jurisdiction.');
  const node = nodeRes.rows[0];

  const [reports, comments] = await Promise.all([
    pool.query(
      `SELECT action_type, image_url, proof_images, created_at FROM issue_reports
       WHERE issue_node_id = $1 ORDER BY created_at ASC`,
      [id],
    ),
    pool.query(
      `SELECT id, content, created_at FROM issue_comments
       WHERE issue_node_id = $1 ORDER BY created_at ASC LIMIT 200`,
      [id],
    ),
  ]);

  res.status(200).json({ ...node, history: reports.rows, comments: comments.rows });
});

// ---------------------------------------------------------------------------
// Authority invalidation — "Issue Not Found" → CONTESTED (48h reverse consensus)
// ---------------------------------------------------------------------------

export const markIssueNotFound = asyncHandler(async (req, res) => {
  requireAuthority(req);
  const { id } = req.params;
  if (!isValidUuid(id)) throw new HttpError(400, 'Invalid issue id.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { clause, params } = withScope(req);
    params.push(id);
    const nodeRes = await client.query(
      `SELECT id, title, region_id, status FROM issue_nodes n
       WHERE ${clause} AND n.id = $${params.length} FOR UPDATE OF n`,
      params,
    );
    if (nodeRes.rows.length === 0) throw new HttpError(404, 'Issue not found in your jurisdiction.');

    const node = nodeRes.rows[0];
    if (node.status !== 'ACTIVE') {
      throw new HttpError(400, `Only active issues can be marked as not found (this issue is ${node.status}).`);
    }

    await client.query(
      `UPDATE issue_nodes SET status = 'CONTESTED', contested_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [node.id],
    );

    await notifyIssueParticipants(
      client,
      node.id,
      'ISSUE_CONTESTED',
      'Authority marked your issue as not found',
      `The authority could not find "${node.title}". If it still exists, appeal with a fresh photo within 48 hours or it will be archived automatically.`,
      req.user.id,
    );

    await notifyRegionAdmins(
      client,
      node.region_id,
      'ISSUE_CONTESTED',
      'Issue invalidated',
      `"${node.title}" was marked "not found" and moved to the 48-hour reverse-consensus window.`,
      `/admin/issues/${node.id}`,
    );

    await client.query('COMMIT');

    notifyRegionCitizens(
      pool,
      node.region_id,
      'Issue contested by authority',
      `The authority could not find "${node.title}". Appeal with fresh evidence if it still exists.`,
    ).catch(() => {});
    notifyRegionAuthorities(
      pool,
      node.region_id,
      'Issue contested by authority',
      `"${node.title}" was marked not found and is in a 48-hour citizen appeal window.`,
    ).catch(() => {});

    res.status(200).json({ message: 'Issue marked as not found. A 48-hour reverse-consensus window has started.', status: 'CONTESTED' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

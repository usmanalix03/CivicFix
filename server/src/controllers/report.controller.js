import { pool } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { verifyTurnstile } from '../services/turnstile.service.js';
import { analyzeReportEvidence, verifyAppealEvidence } from '../services/vision.service.js';
import { uploadImageBuffer, destroyImage } from '../services/cloudinary.service.js';
import { getH3Index, getNeighborCells } from '../services/h3.service.js';
import { verifyJurisdiction } from '../services/region.service.js';
import {
  findActiveNode,
  incrementNodeDensity,
  createNewNode,
  logUserAction,
  checkUserActionExists,
  checkSpecificActionExists,
  checkSpatialRateLimit,
  isNearIssue,
  evaluateConsensus,
} from '../services/report.service.js';
import { notifyIssueParticipants, notifyRegionAdmins } from '../services/notification.service.js';
import { notifyRegionCitizens, notifyRegionAuthorities } from '../services/email.service.js';
import { hasValidImageSignature } from '../middleware/upload.js';
import { asyncHandler, HttpError, parseCoordinates, isValidUuid } from '../utils/validators.js';
import { escapeHTML, cleanText } from '../utils/sanitize.js';
import { ISSUE_STATUSES, ACTION_TYPES } from '../utils/constants.js';

// ---------------------------------------------------------------------------
// CREATE REPORT — the full ingestion pipeline
// ---------------------------------------------------------------------------

export const createReport = asyncHandler(async (req, res) => {
  const { lat, lng, turnstileToken, website, locationSource } = req.body || {};
  const files = req.files || [];
  const { id: userId, regionId } = req.user;

  // Honeypot — humans never fill this hidden field.
  if (website) throw new HttpError(400, 'Invalid request.');

  if (files.length < 2 || lat === undefined || lng === undefined) {
    throw new HttpError(400, 'At least two proof photos and an issue location are required.');
  }
  if (!['UPLOAD', 'CAMERA'].includes(locationSource)) {
    throw new HttpError(400, 'Location must come from an uploaded-photo map pin or a live camera capture.');
  }
  if (files.some((file, index) => files.slice(0, index).some((other) => file.buffer.equals(other.buffer)))) {
    throw new HttpError(400, 'Upload distinct proof photos of the issue.');
  }
  for (const f of files) {
    if (!hasValidImageSignature(f.buffer)) {
      throw new HttpError(415, 'Invalid file type. Only authentic images (JPEG, PNG, WEBP) are allowed.');
    }
  }

  const coords = parseCoordinates(lat, lng);
  if (!coords) throw new HttpError(400, 'Invalid coordinates.');

  const isBotFree = await verifyTurnstile(turnstileToken);
  if (!isBotFree) throw new HttpError(403, 'Failed bot validation. Please retry.');

  // Zero-trust authorization: the coordinate must fall inside the user's jurisdiction.
  const isAuthorized = await verifyJurisdiction(regionId, coords.lat, coords.lng);
  if (!isAuthorized) {
    throw new HttpError(403, 'These coordinates are outside your authorized civic jurisdiction.');
  }

  const centerH3Index = getH3Index(coords.lat, coords.lng);
  const kRingHexagons = getNeighborCells(centerH3Index, 1);

  // Tier-2 spatial velocity rate limiting (pre-check; definitive check in txn).
  const alreadyRecent = await checkSpatialRateLimit(pool, userId, kRingHexagons, env.spatialRateLimitHours);
  if (alreadyRecent) {
    throw new HttpError(429, `You already reported in this area within the last ${env.spatialRateLimitHours}h.`);
  }

  // --- AI inspection of every submitted evidence photo ---
  const aiResult = await analyzeReportEvidence(files);
  if (!aiResult.isValid) {
    throw new HttpError(422, aiResult.reason || 'The submitted photos do not form valid evidence of one civic issue.');
  }

  // --- Image storage (upload every proof photo) ---
  const uploadedPublicIds = [];
  const imageUrls = [];
  try {
    for (const f of files) {
      const uploadResult = await uploadImageBuffer(f.buffer);
      uploadedPublicIds.push(uploadResult.publicId);
      imageUrls.push(uploadResult.url);
    }
    aiResult.imageUrl = imageUrls[0];
  } catch (err) {
    logger.error('Cloudinary upload failed:', err.message);
    await Promise.all(uploadedPublicIds.map((pid) => destroyImage(pid)));
    throw new HttpError(502, 'Image upload failed. Please try again.');
  }

  // --- H3 clustering & DAG transition (transactional) ---
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Definitive velocity check inside the transaction.
    const rateLimited = await checkSpatialRateLimit(client, userId, kRingHexagons, env.spatialRateLimitHours);
    if (rateLimited) {
      await client.query('ROLLBACK');
      await Promise.all(uploadedPublicIds.map((pid) => destroyImage(pid)));
      throw new HttpError(429, `You already reported in this area within the last ${env.spatialRateLimitHours}h.`);
    }

    const existing = await findActiveNode(client, kRingHexagons, aiResult.category, regionId, coords.lat, coords.lng);

    let nodeId;
    let nodeStatus;
    if (existing) {
      nodeId = existing.id;
      await incrementNodeDensity(client, nodeId);
      // N=1 stalemate breaker: one more unique report reactivates a frozen node.
      if (existing.status === ISSUE_STATUSES.NEEDS_VERIFICATION) {
        await client.query(
          `UPDATE issue_nodes SET status = 'ACTIVE', flag_count = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [nodeId],
        );
        nodeStatus = ISSUE_STATUSES.ACTIVE;
      } else {
        nodeStatus = existing.status;
      }
    } else {
      nodeId = await createNewNode(client, {
        h3Index: centerH3Index,
        lat: coords.lat,
        lng: coords.lng,
        title: aiResult.title,
        description: aiResult.description,
        category: aiResult.category,
        regionId,
      });
      nodeStatus = ISSUE_STATUSES.ACTIVE;
    }

    await logUserAction(client, nodeId, userId, ACTION_TYPES.INITIAL_REPORT, aiResult.imageUrl, imageUrls);

    await notifyRegionAdmins(
      client,
      regionId,
      'NEW_REPORT',
      aiResult.title,
      `A new ${aiResult.category} report was filed in your jurisdiction (density is now updated).`,
      `/admin/issues/${nodeId}`,
    );

    await client.query('COMMIT');

    // Fire-and-forget email alerts (feature #9).
    notifyRegionCitizens(
      pool,
      regionId,
      'New issue reported near you',
      `A new "${aiResult.category}" issue — "${aiResult.title}" — was reported in your locality.`,
    ).catch(() => {});
    notifyRegionAuthorities(
      pool,
      regionId,
      'New issue in your jurisdiction',
      `A new "${aiResult.category}" issue — "${aiResult.title}" — was reported in your jurisdiction.`,
    ).catch(() => {});

    res.status(200).json({
      message: 'Report ingested successfully!',
      nodeId,
      status: nodeStatus,
      category: aiResult.category,
      title: aiResult.title,
      imageUrl: aiResult.imageUrl,
      dynamicMessage: aiResult.dynamicMessage,
      aiUnavailable: false,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (uploadedPublicIds.length) await Promise.all(uploadedPublicIds.map((pid) => destroyImage(pid)));
    if (err.code === '23505') {
      throw new HttpError(409, 'You have already reported this exact issue.');
    }
    throw err;
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// MAP FEED — anonymized, priority-sorted, bounding-box filtered
// ---------------------------------------------------------------------------

const buildPriorityExpression = () =>
  `(n.density_score * 2 + n.likes_count + n.escalation_count * 3) AS priority_score`;

export const getMapFeed = asyncHandler(async (req, res) => {
  const { regionId, role } = req.user;
  const { page = 1, limit = 100, south_lat, west_lng, north_lat, east_lng } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 100));
  const offset = (pageNum - 1) * limitNum;

  const params = [];
  let where;
  if (role === 'SUPER_ADMIN') {
    where = `WHERE n.status IN ('ACTIVE', 'NEEDS_VERIFICATION', 'CONTESTED')`;
  } else {
    params.push(regionId);
    where = `WHERE n.region_id = $1 AND n.status IN ('ACTIVE', 'NEEDS_VERIFICATION', 'CONTESTED')`;
  }

  const s = parseFloat(south_lat);
  const w = parseFloat(west_lng);
  const n2 = parseFloat(north_lat);
  const e = parseFloat(east_lng);
  if ([s, w, n2, e].every((v) => !Number.isNaN(v)) && s < n2 && w < e) {
    params.push(w, s, e, n2);
    where += ` AND ST_Intersects(n.coordinates, ST_MakeEnvelope($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length}, 4326))`;
  }

  params.push(limitNum, offset);
  const { rows } = await pool.query(
    `SELECT n.id, n.h3_index,
            ST_Y(n.coordinates::geometry) AS lat,
            ST_X(n.coordinates::geometry) AS lng,
            n.title, n.category, n.density_score, n.likes_count, n.flag_count,
            n.status, n.escalation_count, n.created_at, n.updated_at,
            ${buildPriorityExpression()},
            (SELECT image_url FROM issue_reports
             WHERE issue_node_id = n.id AND action_type = 'INITIAL_REPORT' AND image_url IS NOT NULL
             ORDER BY created_at LIMIT 1) AS "imageUrl"
     FROM issue_nodes n
     ${where}
     ORDER BY priority_score DESC, n.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  res.status(200).json({ items: rows, page: pageNum, limit: limitNum });
});

// ---------------------------------------------------------------------------
// ISSUE DETAILS — with anonymized history, comments and viewer permissions
// ---------------------------------------------------------------------------

export const getIssueDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidUuid(id)) throw new HttpError(400, 'Invalid issue id.');
  const { regionId, role } = req.user;
  const userId = req.user.id;

  const scopeParams = role === 'SUPER_ADMIN' ? [id] : [id, regionId];
  const scopeClause = role === 'SUPER_ADMIN' ? 'n.id = $1' : 'n.id = $1 AND n.region_id = $2';

  const nodeRes = await pool.query(
    `SELECT n.id, n.title, n.description, n.category, n.density_score, n.likes_count,
            n.flag_count, n.status, n.escalation_count, n.contested_at, n.resolution_deadline,
            n.verification_started_at, n.created_at, n.updated_at, n.h3_index,
            ST_Y(n.coordinates::geometry) AS lat, ST_X(n.coordinates::geometry) AS lng,
            (SELECT image_url FROM issue_reports
             WHERE issue_node_id = n.id AND action_type = 'INITIAL_REPORT' AND image_url IS NOT NULL
             ORDER BY created_at LIMIT 1) AS "imageUrl",
            (SELECT proof_images FROM issue_reports
             WHERE issue_node_id = n.id AND action_type = 'INITIAL_REPORT' AND image_url IS NOT NULL
             ORDER BY created_at LIMIT 1) AS "proofImages"
     FROM issue_nodes n
     WHERE ${scopeClause}`,
    scopeParams,
  );
  if (nodeRes.rows.length === 0) throw new HttpError(404, 'Issue not found in your jurisdiction.');
  const node = nodeRes.rows[0];

  const [reportsRes, commentsRes, likeRes, actionsRes, ownerRes] = await Promise.all([
    pool.query(
      `SELECT action_type, image_url, created_at FROM issue_reports
       WHERE issue_node_id = $1 ORDER BY created_at ASC`,
      [id],
    ),
    pool.query(
      `SELECT id, content, created_at FROM issue_comments
       WHERE issue_node_id = $1 ORDER BY created_at ASC LIMIT 200`,
      [id],
    ),
    pool.query(`SELECT 1 FROM issue_likes WHERE issue_node_id = $1 AND user_id = $2`, [id, userId]),
    pool.query(`SELECT action_type FROM issue_reports WHERE issue_node_id = $1 AND user_id = $2`, [id, userId]),
    pool.query(
      `SELECT user_id FROM issue_reports WHERE issue_node_id = $1 AND action_type = 'INITIAL_REPORT' ORDER BY created_at LIMIT 1`,
      [id],
    ),
  ]);

  const isOwner = ownerRes.rows.length > 0 && String(ownerRes.rows[0].user_id) === String(userId);
  const myActions = actionsRes.rows.map((r) => r.action_type);
  const isOpen = [ISSUE_STATUSES.ACTIVE, ISSUE_STATUSES.NEEDS_VERIFICATION, ISSUE_STATUSES.CONTESTED].includes(node.status);

  res.status(200).json({
    ...node,
    hasLiked: likeRes.rows.length > 0,
    myActions,
    permissions: {
      canLike: isOpen,
      canComment: isOpen,
      canVerify: role === 'USER' && node.status === ISSUE_STATUSES.NEEDS_VERIFICATION,
      canAppeal: node.status === ISSUE_STATUSES.CONTESTED,
      canEdit: isOpen && isOwner,
      canDelete: isOpen && isOwner,
    },
    history: reportsRes.rows,
    comments: commentsRes.rows,
  });
});

// ---------------------------------------------------------------------------
// LIKE / COMMENT
// ---------------------------------------------------------------------------

export const toggleLike = asyncHandler(async (req, res) => {
  const { id: nodeId } = req.params;
  if (!isValidUuid(nodeId)) throw new HttpError(400, 'Invalid issue id.');
  const { id: userId, regionId } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const nodeRes = await client.query(
      'SELECT region_id, status FROM issue_nodes WHERE id = $1 FOR UPDATE',
      [nodeId],
    );
    if (nodeRes.rows.length === 0) throw new HttpError(404, 'Issue not found.');
    if (req.user.role !== 'SUPER_ADMIN' && String(nodeRes.rows[0].region_id) !== String(regionId)) {
      throw new HttpError(403, 'This issue is outside your jurisdiction.');
    }
    if (['RESOLVED', 'ARCHIVED'].includes(nodeRes.rows[0].status)) {
      throw new HttpError(400, 'This issue is closed.');
    }

    const likeRes = await client.query(
      'SELECT 1 FROM issue_likes WHERE issue_node_id = $1 AND user_id = $2',
      [nodeId, userId],
    );

    let isLiked;
    if (likeRes.rows.length > 0) {
      await client.query('DELETE FROM issue_likes WHERE issue_node_id = $1 AND user_id = $2', [nodeId, userId]);
      await client.query('UPDATE issue_nodes SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1', [nodeId]);
      isLiked = false;
    } else {
      await client.query('INSERT INTO issue_likes (issue_node_id, user_id) VALUES ($1, $2)', [nodeId, userId]);
      await client.query('UPDATE issue_nodes SET likes_count = likes_count + 1 WHERE id = $1', [nodeId]);
      isLiked = true;
    }

    await client.query('COMMIT');
    res.status(200).json({ message: isLiked ? 'Issue liked.' : 'Like removed.', isLiked });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

export const addComment = asyncHandler(async (req, res) => {
  const { id: nodeId } = req.params;
  if (!isValidUuid(nodeId)) throw new HttpError(400, 'Invalid issue id.');
  const { content } = req.body || {};
  const { id: userId, regionId } = req.user;

  const safeContent = cleanText(content, 500);
  if (!safeContent) throw new HttpError(400, 'Comment content is required (max 500 characters).');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const nodeRes = await client.query('SELECT region_id, status FROM issue_nodes WHERE id = $1 FOR UPDATE', [nodeId]);
    if (nodeRes.rows.length === 0) throw new HttpError(404, 'Issue not found.');
    if (req.user.role !== 'SUPER_ADMIN' && String(nodeRes.rows[0].region_id) !== String(regionId)) {
      throw new HttpError(403, 'This issue is outside your jurisdiction.');
    }
    if (['RESOLVED', 'ARCHIVED'].includes(nodeRes.rows[0].status)) {
      throw new HttpError(400, 'This issue is closed.');
    }

    const { rows } = await client.query(
      `INSERT INTO issue_comments (issue_node_id, user_id, content)
       VALUES ($1, $2, $3) RETURNING id, content, created_at`,
      [nodeId, userId, safeContent],
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Comment added.', comment: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// COMMUNITY MODERATION — CONFIRM_FIXED / FLAG_SPAM / STILL_EXISTS
// ---------------------------------------------------------------------------

export const submitAction = asyncHandler(async (req, res) => {
  const { id: nodeId } = req.params;
  if (!isValidUuid(nodeId)) throw new HttpError(400, 'Invalid issue id.');
  const { action, lat, lng } = req.body || {};
  const file = req.file;
  const { id: userId, role, regionId } = req.user;

  const validActions = ['CONFIRM_FIXED', 'FLAG_SPAM', 'STILL_EXISTS'];
  if (!validActions.includes(action)) throw new HttpError(400, 'Invalid action type.');
  if (action === 'FLAG_SPAM' && file) {
    throw new HttpError(400, 'Spam reports do not accept image uploads. An authority will review the issue.');
  }

  let imageUrl = null;
  let imagePublicId = null;
  if (file) {
    if (!hasValidImageSignature(file.buffer)) {
      throw new HttpError(415, 'Invalid file type. Only authentic images (JPEG, PNG, WEBP) are allowed.');
    }
    try {
      const uploadResult = await uploadImageBuffer(file.buffer);
      imageUrl = uploadResult.url;
      imagePublicId = uploadResult.publicId;
    } catch {
      throw new HttpError(502, 'Image upload failed. Please try again.');
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const nodeRes = await client.query(
      'SELECT region_id, status, density_score, title FROM issue_nodes WHERE id = $1 FOR UPDATE',
      [nodeId],
    );
    if (nodeRes.rows.length === 0) throw new HttpError(404, 'Issue not found.');
    const node = nodeRes.rows[0];

    const isSuperAdmin = role === 'SUPER_ADMIN';
    const isAuthority = role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (!isSuperAdmin && String(node.region_id) !== String(regionId)) {
      throw new HttpError(403, 'This issue is outside your authorized jurisdiction.');
    }
    if (['RESOLVED', 'ARCHIVED'].includes(node.status)) {
      throw new HttpError(400, `This issue is already ${node.status}.`);
    }
    if (node.status === ISSUE_STATUSES.CONTESTED) {
      throw new HttpError(400, 'This issue is contested and awaiting a citizen appeal.');
    }

    if (isAuthority && action === 'CONFIRM_FIXED' && node.status !== ISSUE_STATUSES.ACTIVE) {
      throw new HttpError(400, 'Only active issues can be marked as fixed by an authority.');
    }
    if (isAuthority && action === 'FLAG_SPAM') {
      throw new HttpError(400, 'Authorities review spam reports. Use “Mark as not found” if the complaint is invalid.');
    }

    // Sequential verification (feature #6): citizens verify only during the
    // authority-opened "Fixed" window.
    if (action === 'CONFIRM_FIXED' && !isAuthority && node.status !== ISSUE_STATUSES.NEEDS_VERIFICATION) {
      throw new HttpError(403, 'You can only verify a fix after an authority marks it as fixed.');
    }
    if (action === 'STILL_EXISTS' && !isAuthority && node.status !== ISSUE_STATUSES.NEEDS_VERIFICATION) {
      throw new HttpError(403, 'You can only verify this issue after an authority marks it as fixed.');
    }

    // One action of each type per user per issue (Sybil resistance).
    if (await checkSpecificActionExists(client, nodeId, userId, action)) {
      throw new HttpError(409, 'You have already recorded this action on this issue.');
    }

    await logUserAction(client, nodeId, userId, action, imageUrl);

    let updatedStatus = node.status;

    if (action === 'CONFIRM_FIXED') {
      if (isAuthority) {
        // Authority says "fixed" → open a community verification window.
        await client.query(
          `UPDATE issue_nodes
           SET status = 'NEEDS_VERIFICATION', verification_started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [nodeId],
        );
        updatedStatus = ISSUE_STATUSES.NEEDS_VERIFICATION;
        await notifyIssueParticipants(
          client,
          nodeId,
          'VERIFICATION_REQUESTED',
          'Authority marked the issue as fixed',
          `The authority marked "${node.title}" as fixed. Verify it on the ground so the community can close it.`,
          userId,
        );
      } else {
        updatedStatus = (await evaluateConsensus(client, nodeId)) || updatedStatus;
      }
    } else if (action === 'STILL_EXISTS') {
      // Citizen verification: "still exists / not fixed".
      updatedStatus = (await evaluateConsensus(client, nodeId)) || updatedStatus;
    } else if (action === 'FLAG_SPAM') {
      await client.query('UPDATE issue_nodes SET flag_count = flag_count + 1 WHERE id = $1', [nodeId]);
      await notifyRegionAdmins(
        client,
        node.region_id,
        'SPAM_REPORTED',
        'Community spam review requested',
        `A citizen flagged "${node.title}" as possible spam. Review the evidence and use “Mark as not found” only if the complaint is invalid.`,
        `/admin/issues/${nodeId}`,
      );
    }

    if (updatedStatus === ISSUE_STATUSES.RESOLVED) {
      await notifyIssueParticipants(
        client,
        nodeId,
        'ISSUE_RESOLVED',
        'Issue resolved by citizen consensus',
        `"${node.title}" was verified as fixed by the community. Thank you for your civic contribution.`,
      );
    } else if (updatedStatus === ISSUE_STATUSES.ACTIVE && node.status === ISSUE_STATUSES.NEEDS_VERIFICATION) {
      await notifyIssueParticipants(
        client,
        nodeId,
        'VERIFICATION_REJECTED',
        'Citizens report the issue still exists',
        `"${node.title}" was verified as still existing by the community and returned to the active queue.`,
      );
    }

    await client.query('COMMIT');

    // Fire-and-forget email alerts (features #8 / #9).
    const issueRegionId = node.region_id;
    if (action === 'CONFIRM_FIXED' && isAuthority) {
      notifyRegionCitizens(
        pool,
        issueRegionId,
        'Verify a reported fix',
        `The authority marked "${node.title}" as fixed. Verify it on the ground so the community can close it.`,
      ).catch(() => {});
    }
    if (updatedStatus === ISSUE_STATUSES.RESOLVED) {
      notifyRegionCitizens(
        pool,
        issueRegionId,
        `Issue ${updatedStatus.toLowerCase()}`,
        `"${node.title}" was ${updatedStatus.toLowerCase()} by the community.`,
      ).catch(() => {});
    }
    if (updatedStatus !== node.status) {
      notifyRegionAuthorities(
        pool,
        issueRegionId,
        `Issue status updated: ${updatedStatus.toLowerCase()}`,
        `"${node.title}" changed from ${node.status.toLowerCase()} to ${updatedStatus.toLowerCase()}.`,
      ).catch(() => {});
    }

    res.status(200).json({ message: 'Action recorded successfully.', status: updatedStatus, imageUrl });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (imagePublicId) await destroyImage(imagePublicId);
    throw err;
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// CREATOR APPEAL (contested → active, requires fresh photo)
// ---------------------------------------------------------------------------

export const appealIssue = asyncHandler(async (req, res) => {
  const { id: nodeId } = req.params;
  if (!isValidUuid(nodeId)) throw new HttpError(400, 'Invalid issue id.');
  const files = req.files || [];
  const { lat, lng, locationSource } = req.body || {};
  const { id: userId, regionId } = req.user;

  if (files.length < 2) throw new HttpError(400, 'At least two fresh proof photos are required to appeal an issue.');
  if (!['UPLOAD', 'CAMERA'].includes(locationSource)) {
    throw new HttpError(400, 'Appeal location must come from an uploaded-photo map pin or a live camera capture.');
  }
  if (files.some((file, index) => !hasValidImageSignature(file.buffer) || files.slice(0, index).some((other) => file.buffer.equals(other.buffer)))) {
    throw new HttpError(415, 'Upload distinct authentic JPEG, PNG, or WEBP evidence images.');
  }
  const appealCoords = parseCoordinates(lat, lng);
  if (!appealCoords) throw new HttpError(400, 'Valid evidence coordinates are required.');
  if (!(await verifyJurisdiction(regionId, appealCoords.lat, appealCoords.lng))) {
    throw new HttpError(403, 'Appeal evidence was captured outside your registered civic jurisdiction.');
  }

  const appealPreflight = await pool.query(
    'SELECT region_id, status FROM issue_nodes WHERE id = $1',
    [nodeId],
  );
  if (appealPreflight.rows.length === 0) throw new HttpError(404, 'Issue not found.');
  if (String(appealPreflight.rows[0].region_id) !== String(regionId)) {
    throw new HttpError(403, 'Outside your jurisdiction.');
  }
  if (appealPreflight.rows[0].status !== ISSUE_STATUSES.CONTESTED) {
    throw new HttpError(400, 'Only contested issues can be appealed.');
  }

  const originalEvidenceRes = await pool.query(
    `SELECT COALESCE(NULLIF(proof_images, '{}'), ARRAY[image_url]) AS proof_images
     FROM issue_reports
     WHERE issue_node_id = $1 AND action_type = 'INITIAL_REPORT' AND image_url IS NOT NULL
     ORDER BY created_at ASC LIMIT 1`,
    [nodeId],
  );
  const originalEvidence = originalEvidenceRes.rows[0]?.proof_images || [];
  const evidenceReview = await verifyAppealEvidence(originalEvidence, files);
  if (!evidenceReview.isValid) {
    throw new HttpError(422, evidenceReview.reason || 'New evidence does not match the original civic issue.');
  }

  const imagePublicIds = [];
  const imageUrls = [];
  try {
    for (const file of files) {
      const uploadResult = await uploadImageBuffer(file.buffer);
      imageUrls.push(uploadResult.url);
      imagePublicIds.push(uploadResult.publicId);
    }
  } catch {
    await Promise.all(imagePublicIds.map((publicId) => destroyImage(publicId)));
    throw new HttpError(502, 'Image upload failed. Please try again.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const nodeRes = await client.query(
      'SELECT region_id, status, title FROM issue_nodes WHERE id = $1 FOR UPDATE',
      [nodeId],
    );
    if (nodeRes.rows.length === 0) throw new HttpError(404, 'Issue not found.');
    const node = nodeRes.rows[0];

    if (String(node.region_id) !== String(regionId)) throw new HttpError(403, 'Outside your jurisdiction.');
    if (node.status !== ISSUE_STATUSES.CONTESTED) throw new HttpError(400, 'Only contested issues can be appealed.');
    if (!(await isNearIssue(client, nodeId, appealCoords.lat, appealCoords.lng))) {
      throw new HttpError(403, 'Appeal evidence must be captured within 1 km of the issue.');
    }

    if (await checkSpecificActionExists(client, nodeId, userId, 'STILL_EXISTS')) {
      throw new HttpError(409, 'You have already appealed this issue.');
    }

    await client.query(
      `UPDATE issue_nodes
       SET status = 'ACTIVE', flag_count = 0, density_score = density_score + 1,
           contested_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [nodeId],
    );

    await logUserAction(client, nodeId, userId, 'STILL_EXISTS', imageUrls[0], imageUrls);

    await notifyRegionAdmins(
      client,
      node.region_id,
      'APPEAL_ACCEPTED',
      'Contested issue re-verified with evidence',
      `"${node.title}" was re-verified by a citizen with fresh evidence and is back in the active queue.`,
      `/admin/issues/${nodeId}`,
    );

    await client.query('COMMIT');
    notifyRegionCitizens(
      pool,
      node.region_id,
      'Issue appeal accepted',
      `Fresh local evidence restored "${node.title}" to the active civic queue.`,
    ).catch(() => {});
    notifyRegionAuthorities(
      pool,
      node.region_id,
      'Issue appeal accepted',
      `Fresh local evidence restored "${node.title}" to the active civic queue.`,
    ).catch(() => {});
    res.status(200).json({
      message: 'Appeal successful — your issue is back on the map.',
      imageUrl: imageUrls[0],
      status: ISSUE_STATUSES.ACTIVE,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    await Promise.all(imagePublicIds.map((publicId) => destroyImage(publicId)));
    throw err;
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// OWNER EDIT / SMART DELETE
// ---------------------------------------------------------------------------

export const updateIssue = asyncHandler(async (req, res) => {
  const { id: nodeId } = req.params;
  if (!isValidUuid(nodeId)) throw new HttpError(400, 'Invalid issue id.');
  const { description } = req.body || {};
  const { id: userId } = req.user;

  const safeDescription = description ? cleanText(description, 1000) : null;
  if (!safeDescription) {
    throw new HttpError(400, 'Provide a description to update.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const nodeRes = await client.query('SELECT status FROM issue_nodes WHERE id = $1 FOR UPDATE', [nodeId]);
    if (nodeRes.rows.length === 0) throw new HttpError(404, 'Issue not found.');
    if (['RESOLVED', 'ARCHIVED'].includes(nodeRes.rows[0].status)) {
      throw new HttpError(403, `Cannot edit an issue that is already ${nodeRes.rows[0].status}.`);
    }

    const ownerRes = await client.query(
      'SELECT user_id FROM issue_reports WHERE issue_node_id = $1 AND action_type = $2 ORDER BY created_at LIMIT 1',
      [nodeId, 'INITIAL_REPORT'],
    );
    if (ownerRes.rows.length === 0 || String(ownerRes.rows[0].user_id) !== String(userId)) {
      throw new HttpError(403, 'Only the original reporter can edit this issue.');
    }

    await client.query(
      'UPDATE issue_nodes SET description = COALESCE($1, description), updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [safeDescription, nodeId],
    );

    await client.query('COMMIT');
    res.status(200).json({ message: 'Issue updated successfully.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

export const deleteIssue = asyncHandler(async (req, res) => {
  const { id: nodeId } = req.params;
  if (!isValidUuid(nodeId)) throw new HttpError(400, 'Invalid issue id.');
  const { id: userId } = req.user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const nodeRes = await client.query('SELECT density_score FROM issue_nodes WHERE id = $1 FOR UPDATE', [nodeId]);
    if (nodeRes.rows.length === 0) throw new HttpError(404, 'Issue not found.');

    const ownerRes = await client.query(
      'SELECT user_id, id AS report_id FROM issue_reports WHERE issue_node_id = $1 AND action_type = $2 ORDER BY created_at LIMIT 1',
      [nodeId, 'INITIAL_REPORT'],
    );
    if (ownerRes.rows.length === 0 || String(ownerRes.rows[0].user_id) !== String(userId)) {
      throw new HttpError(403, 'Only the original reporter can delete this issue.');
    }

    const density = parseInt(nodeRes.rows[0].density_score, 10);

    if (density <= 1) {
      // Nobody else is tracking it — hard delete.
      await client.query('DELETE FROM issue_nodes WHERE id = $1', [nodeId]);
      await client.query('COMMIT');
      return res.status(200).json({ message: 'Complaint deleted entirely from the map.' });
    }

    // Smart withdrawal: the community has rallied — remove the user, keep the pin.
    await client.query('DELETE FROM issue_reports WHERE id = $1', [ownerRes.rows[0].report_id]);
    await client.query(
      'UPDATE issue_nodes SET density_score = GREATEST(density_score - 1, 1) WHERE id = $1',
      [nodeId],
    );
    await client.query('COMMIT');
    res.status(200).json({ message: 'You were removed from this complaint; it remains active for the community.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// MY REPORTS
// ---------------------------------------------------------------------------

export const getMyReports = asyncHandler(async (req, res) => {
  const { id: userId } = req.user;
  const { rows } = await pool.query(
    `SELECT n.id, n.title, n.category, n.status, n.density_score, n.likes_count, n.flag_count,
            n.created_at, n.updated_at, n.contested_at, n.escalation_count,
            ST_Y(n.coordinates::geometry) AS lat, ST_X(n.coordinates::geometry) AS lng,
            (SELECT image_url FROM issue_reports
             WHERE issue_node_id = n.id AND action_type = 'INITIAL_REPORT' AND image_url IS NOT NULL
             ORDER BY created_at LIMIT 1) AS "imageUrl"
     FROM issue_reports r
     JOIN issue_nodes n ON n.id = r.issue_node_id
     WHERE r.user_id = $1 AND r.action_type = 'INITIAL_REPORT'
     ORDER BY r.created_at DESC`,
    [userId],
  );
  res.status(200).json({ items: rows });
});

/**
 * In-app notification helpers. All writes accept an open transaction client so
 * notifications fire atomically with the state change that caused them.
 */
export async function createNotification(client, userId, type, title, body, link = null) {
  if (!userId) return;
  await client.query(
    `INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, title, body, link],
  );
}

/** Notify everyone who participated on an issue (reporters, commenters). */
export async function notifyIssueParticipants(client, nodeId, type, title, body, excludeUserId = null) {
  const { rows } = await client.query(
    `SELECT DISTINCT user_id FROM (
       SELECT user_id FROM issue_reports WHERE issue_node_id = $1
       UNION
       SELECT user_id FROM issue_comments WHERE issue_node_id = $1
     ) t
     WHERE user_id IS DISTINCT FROM $2`,
    [nodeId, excludeUserId],
  );
  for (const row of rows) {
    await createNotification(client, row.user_id, type, title, body, `/issues/${nodeId}`);
  }
}

/** Notify admins governing a region (super admins always). */
export async function notifyRegionAdmins(client, regionId, type, title, body, link = null) {
  const { rows } = await client.query(
    `SELECT id FROM users
     WHERE role IN ('ADMIN', 'SUPER_ADMIN')
       AND (region_id = $1 OR role = 'SUPER_ADMIN')`,
    [regionId],
  );
  for (const row of rows) {
    await createNotification(client, row.id, type, title, body, link);
  }
}

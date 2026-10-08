import { pool } from '../config/db.js';
import { asyncHandler, HttpError, isValidUuid } from '../utils/validators.js';

export const getNotifications = asyncHandler(async (req, res) => {
  const { limit = 50, unreadOnly } = req.query;
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const params = [req.user.id, limitNum];
  let filter = '';
  if (unreadOnly === 'true') filter = 'AND read = false';

  const { rows } = await pool.query(
    `SELECT id, type, title, body, link, read, created_at
     FROM notifications
     WHERE user_id = $1 ${filter}
     ORDER BY created_at DESC
     LIMIT $2`,
    params,
  );

  res.status(200).json({ items: rows });
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read = false',
    [req.user.id],
  );
  res.status(200).json({ count: rows[0].count });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidUuid(id)) throw new HttpError(400, 'Invalid notification id.');

  const { rowCount } = await pool.query(
    'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2',
    [id, req.user.id],
  );
  if (rowCount === 0) throw new HttpError(404, 'Notification not found.');
  res.status(200).json({ message: 'Marked as read.' });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await pool.query('UPDATE notifications SET read = true WHERE user_id = $1', [req.user.id]);
  res.status(200).json({ message: 'All notifications marked as read.' });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidUuid(id)) throw new HttpError(400, 'Invalid notification id.');

  const { rowCount } = await pool.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (rowCount === 0) throw new HttpError(404, 'Notification not found.');
  res.status(200).json({ message: 'Notification removed.' });
});

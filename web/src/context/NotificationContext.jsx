import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiClient } from '../lib/axios';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [cnt, list] = await Promise.all([
        apiClient.get('/notifications/unread-count'),
        apiClient.get('/notifications', { params: { limit: 30 } }),
      ]);
      setUnread(cnt.data?.count || 0);
      setItems(list.data?.items || []);
    } catch {
      /* silent */
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      setItems([]);
      return undefined;
    }
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [user, refresh]);

  const markRead = useCallback(async (id) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await apiClient.post(`/notifications/${id}/read`);
    } catch {
      /* silent */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await apiClient.post('/notifications/read-all');
    } catch {
      /* silent */
    }
  }, []);

  const removeNotification = useCallback(async (id) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    try {
      await apiClient.delete(`/notifications/${id}`);
    } catch {
      /* silent */
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{ unread, items, open, setOpen, refresh, markRead, markAllRead, removeNotification }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);

import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck, BellOff, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { timeAgo } from '../lib/format';

function resolveLink(link) {
  if (!link) return null;
  const id = link.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  if (!id) return null;
  return link.includes('/admin/') ? `/admin/issue/${id}` : `/issue/${id}`;
}

export default function NotificationBell() {
  const { unread, items, open, setOpen, markRead, markAllRead, removeNotification } =
    useNotifications();
  const navigate = useNavigate();
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const margin = 8;
      const width = Math.min(352, window.innerWidth - 16);
      const height = panelRef.current?.getBoundingClientRect().height || Math.min(window.innerHeight - 16, 420);
      const below = rect.bottom + margin;
      const above = rect.top - margin - height;
      setPosition({
        top: below + height <= window.innerHeight - margin ? below : Math.max(margin, above),
        left: Math.min(Math.max(margin, rect.right - width), Math.max(margin, window.innerWidth - width - margin)),
        width,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  const go = (n) => {
    markRead(n.id);
    const target = resolveLink(n.link);
    setOpen(false);
    if (target) navigate(target);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-800"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              style={position || { top: 8, right: 8, width: 'min(22rem, calc(100vw - 1rem))' }}
              className="fixed z-50 max-h-[calc(100vh-1rem)] overflow-hidden rounded-[24px] bg-white shadow-[0_12px_40px_rgb(0,0,0,0.12)] ring-1 ring-gray-100 dark:bg-slate-900 dark:ring-white/10"
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-slate-800">
                <span className="text-sm font-bold text-gray-900 dark:text-white">Notifications</span>
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-gray-400 dark:text-gray-500">
                    <BellOff className="h-6 w-6" />
                    <p className="text-sm">No notifications yet</p>
                  </div>
                ) : (
                  items.map((n) => (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => go(n)}
                      className={`flex w-full cursor-pointer items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:border-slate-800/60 dark:hover:bg-slate-800/50 ${
                        !n.read ? 'bg-blue-50/40 dark:bg-blue-500/5' : ''
                      }`}
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          n.read ? 'bg-transparent' : 'bg-blue-500'
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate pr-4 text-sm font-semibold text-gray-900 dark:text-white">
                          {n.title}
                        </span>
                        {n.body && (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-gray-500 dark:text-gray-400">
                            {n.body}
                          </span>
                        )}
                        <span className="mt-1 block text-[11px] text-gray-400 dark:text-gray-500">
                          {timeAgo(n.created_at)}
                        </span>
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(n.id);
                        }}
                        className="shrink-0 rounded-full p-1 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-gray-300"
                        aria-label="Delete notification"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

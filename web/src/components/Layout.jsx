import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationBell from './NotificationBell';
import Logo from './Logo';
import {
  Map,
  PlusCircle,
  FileText,
  Settings,
  LayoutDashboard,
  ListChecks,
  LogOut,
} from 'lucide-react';
import { ROLE_LABELS } from '../lib/constants';

const NAV = {
  USER: [
    { to: '/map', label: 'Map', icon: Map, end: true },
    { to: '/report', label: 'Report', icon: PlusCircle },
    { to: '/my-reports', label: 'My Reports', icon: FileText },
    { to: '/settings', label: 'Settings', icon: Settings },
  ],
  AUTHORITY: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/queue', label: 'Queue', icon: ListChecks },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const nav = user?.role === 'USER' ? NAV.USER : NAV.AUTHORITY;
  const roleLabel = ROLE_LABELS[user?.role] || 'Member';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors ${
      isActive
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 dark:bg-blue-500'
        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-800'
    }`;

  const bottomLinkClass = ({ isActive }) =>
    `flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5 text-[11px] font-semibold transition-colors ${
      isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
    }`;

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1c1b1f] transition-colors duration-500 dark:bg-[#0f172a] dark:text-gray-50">
      {/* Desktop side rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-gray-200/60 bg-white/60 backdrop-blur-xl backdrop-saturate-150 dark:border-slate-800/60 dark:bg-slate-900/60 lg:flex">
        <div className="flex h-16 items-center gap-3 px-5">
          <Logo className="h-9 w-9" />
          <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">CivicFix</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={navLinkClass}>
              <n.icon className="h-5 w-5" />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-200/60 px-3 py-4 dark:border-slate-800/60">
          <div className="flex items-center justify-between px-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {user?.name || roleLabel}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{roleLabel}</p>
            </div>
            <NotificationBell align="left" />
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-800"
          >
            <LogOut className="h-5 w-5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-gray-200/60 bg-white/70 px-4 backdrop-blur-xl backdrop-saturate-150 dark:border-slate-800/60 dark:bg-slate-900/70 lg:hidden">
        <div className="flex items-center gap-2">
          <Logo className="h-9 w-9" />
          <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">CivicFix</span>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            {roleLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell align="right" />
          <button
            onClick={handleLogout}
            className="rounded-full px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="lg:pl-64">
        <main className="mx-auto max-w-7xl p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ type: 'spring', bounce: 0.3, duration: 0.7 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200/60 bg-white/80 backdrop-blur-xl backdrop-saturate-150 dark:border-slate-800/60 dark:bg-slate-900/80 lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={bottomLinkClass}>
              <n.icon className="h-5 w-5" />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

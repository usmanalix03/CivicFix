// Central domain constants mirrored from the backend so the UI stays in sync.

export const ISSUE_STATUSES = {
  ACTIVE: 'ACTIVE',
  CONTESTED: 'CONTESTED',
  NEEDS_VERIFICATION: 'NEEDS_VERIFICATION',
  RESOLVED: 'RESOLVED',
  ARCHIVED: 'ARCHIVED',
};

export const ACTION_TYPES = {
  INITIAL_REPORT: 'INITIAL_REPORT',
  CONFIRM_FIXED: 'CONFIRM_FIXED',
  FLAG_SPAM: 'FLAG_SPAM',
  STILL_EXISTS: 'STILL_EXISTS',
};

export const ROLES = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
};

export const ROLE_LABELS = {
  USER: 'Citizen',
  ADMIN: 'Authority',
  SUPER_ADMIN: 'Super Admin',
};

export const CATEGORIES = [
  { value: 'Pothole', emoji: '🕳️', color: '#f59e0b' },
  { value: 'Road Damage', emoji: '🚧', color: '#f97316' },
  { value: 'Water Logging', emoji: '🌊', color: '#0ea5e9' },
  { value: 'Drainage', emoji: '🌀', color: '#14b8a6' },
  { value: 'Streetlight', emoji: '💡', color: '#eab308' },
  { value: 'Electrical Hazard', emoji: '⚡', color: '#ef4444' },
  { value: 'Sanitation', emoji: '🧹', color: '#22c55e' },
  { value: 'Illegal Dumping', emoji: '🚯', color: '#84cc16' },
  { value: 'Vandalism', emoji: '🎨', color: '#a855f7' },
  { value: 'Traffic Signal', emoji: '🚦', color: '#f43f5e' },
  { value: 'Public Property Damage', emoji: '🏛️', color: '#d946ef' },
  { value: 'Other', emoji: '📍', color: '#64748b' },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

export const categoryMeta = (value) =>
  CATEGORY_MAP[value] || { value: value || 'Other', emoji: '📍', color: '#64748b' };

// Status → label + Tailwind color classes (light + dark).
export const STATUS_META = {
  ACTIVE: {
    label: 'Active',
    emoji: '🟢',
    badge: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30',
  },
  CONTESTED: {
    label: 'Contested',
    emoji: '⚖️',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  },
  NEEDS_VERIFICATION: {
    label: 'Needs Verification',
    emoji: '🔍',
    badge: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30',
  },
  RESOLVED: {
    label: 'Resolved',
    emoji: '✅',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  },
  ARCHIVED: {
    label: 'Archived',
    emoji: '🗄️',
    badge: 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/30',
  },
};

export const statusMeta = (value) => STATUS_META[value] || STATUS_META.ACTIVE;

// Turnstile dev fallback: backend accepts this token only when TURNSTILE_DEV_BYPASS=true.
export const TURNSTILE_DEV_TOKEN = 'dev_dummy_token';

// Vite-exposed client settings (optional .env at web root).
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

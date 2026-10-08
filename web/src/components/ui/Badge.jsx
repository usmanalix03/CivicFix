import { statusMeta, categoryMeta, ROLE_LABELS } from '../../lib/constants';

export default function Badge({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const meta = statusMeta(status);
  return (
    <Badge className={meta.badge}>
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </Badge>
  );
}

export function CategoryBadge({ category, showDot = true }) {
  const meta = categoryMeta(category);
  return (
    <Badge className="bg-gray-100 text-gray-700 ring-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:ring-slate-700">
      {showDot && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: meta.color }}
          aria-hidden
        />
      )}
      <span aria-hidden>{meta.emoji}</span>
      {meta.value}
    </Badge>
  );
}

export function RoleBadge({ role }) {
  return (
    <Badge className="bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:ring-blue-500/30">
      {ROLE_LABELS[role] || 'Member'}
    </Badge>
  );
}

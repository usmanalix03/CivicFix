import { Loader2, Inbox, TriangleAlert } from 'lucide-react';

export function Spinner({ className = 'h-5 w-5 text-blue-600 dark:text-blue-400' }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
      <Spinner className="h-7 w-7" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title = 'Nothing here yet',
  description,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[24px] bg-white px-6 py-16 text-center ring-1 ring-gray-100 dark:bg-slate-800/40 dark:ring-white/5">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-gray-500">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[24px] bg-red-50 px-6 py-14 text-center ring-1 ring-red-100 dark:bg-red-900/10 dark:ring-red-900/20">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400">
        <TriangleAlert className="h-7 w-7" />
      </div>
      <p className="text-sm font-semibold text-red-700 dark:text-red-300">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}

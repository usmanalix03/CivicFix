import { motion } from 'framer-motion';
import { Flame, Heart, Flag } from 'lucide-react';
import { CategoryBadge, StatusBadge } from './ui/Badge';
import { formatCount, timeAgo } from '../lib/format';

/**
 * Reusable issue card used across the citizen feed, my-reports and admin queue.
 * `issue` is a flattened node shape returned by the various list endpoints.
 */
export default function IssueCard({ issue, onClick, showImage = true, footer }) {
  const image = issue.imageUrl || issue.image_url;

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      className="group flex w-full items-stretch gap-4 overflow-hidden rounded-[24px] bg-white p-4 text-left shadow-[0_2px_20px_rgb(0,0,0,0.04)] ring-1 ring-gray-100 transition-shadow hover:shadow-[0_12px_32px_rgb(0,0,0,0.08)] dark:bg-slate-800/80 dark:ring-white/5 dark:hover:shadow-[0_12px_32px_rgb(0,0,0,0.25)]"
    >
      {showImage && image && (
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gray-100 dark:bg-slate-700">
          <img
            src={image}
            alt={issue.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <CategoryBadge category={issue.category} />
          <StatusBadge status={issue.status} />
        </div>

        <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">{issue.title}</h3>

        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            {formatCount(issue.density_score)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5 text-rose-500" />
            {formatCount(issue.likes_count)}
          </span>
          {Number(issue.flag_count) > 0 && (
            <span className="inline-flex items-center gap-1">
              <Flag className="h-3.5 w-3.5 text-amber-500" />
              {formatCount(issue.flag_count)}
            </span>
          )}
          <span className="ml-auto shrink-0 text-gray-400 dark:text-gray-500">
            {timeAgo(issue.created_at)}
          </span>
        </div>

        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </motion.button>
  );
}

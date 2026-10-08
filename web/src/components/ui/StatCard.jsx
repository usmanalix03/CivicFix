import { motion } from 'framer-motion';

export default function StatCard({ label, value, icon: Icon, highlight = false, accent }) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: 'spring', bounce: 0.4, stiffness: 300 }}
      className="flex flex-col justify-between rounded-[28px] bg-white p-6 shadow-[0_2px_20px_rgb(0,0,0,0.04)] ring-1 ring-gray-100 transition-shadow hover:shadow-[0_12px_32px_rgb(0,0,0,0.08)] dark:bg-slate-800/80 dark:ring-white/5 dark:hover:shadow-[0_12px_32px_rgb(0,0,0,0.25)]"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {label}
        </span>
        {Icon && (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ backgroundColor: accent ? `${accent}1a` : undefined }}
          >
            <Icon className="h-4 w-4" style={{ color: accent }} />
          </span>
        )}
      </div>
      <span
        className={`mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl ${
          highlight ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
        }`}
      >
        {value ?? 0}
      </span>
    </motion.div>
  );
}

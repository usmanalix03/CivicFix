import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPinOff } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f9fa] p-6 text-center dark:bg-[#0f172a]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center"
      >
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-white text-blue-600 shadow-[0_8px_40px_rgb(0,0,0,0.08)] ring-1 ring-gray-100 dark:bg-slate-800 dark:text-blue-400 dark:ring-white/5">
          <MapPinOff className="h-10 w-10" />
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">404</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-400">
          This page wandered off the map.
        </p>
        <Link
          to="/"
          className="mt-8 rounded-full bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition-colors hover:bg-blue-700 dark:bg-blue-500"
        >
          Back to home
        </Link>
      </motion.div>
    </div>
  );
}

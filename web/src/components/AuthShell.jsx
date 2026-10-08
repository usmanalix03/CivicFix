import { motion } from 'framer-motion';
import Logo from './Logo';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] p-4 transition-colors duration-500 dark:bg-[#0f172a]">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', bounce: 0.3, duration: 0.8 }}
        className="w-full max-w-md rounded-[32px] bg-white p-8 shadow-[0_8px_40px_rgb(0,0,0,0.06)] ring-1 ring-gray-100 backdrop-blur-xl sm:p-10 dark:bg-slate-800/90 dark:shadow-[0_8px_40px_rgb(0,0,0,0.3)] dark:ring-white/10"
      >
        <div className="mb-8 text-center">
          <Logo className="mx-auto mb-4 h-12 w-12 shadow-md" />
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
          )}
        </div>
        {children}
        {footer && (
          <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">{footer}</div>
        )}
      </motion.div>
    </div>
  );
}

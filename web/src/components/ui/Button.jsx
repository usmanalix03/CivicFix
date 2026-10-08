import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const variants = {
  primary:
    'bg-blue-600 text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600',
  secondary:
    'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-200 dark:hover:bg-slate-700',
  outline:
    'ring-1 ring-inset ring-gray-300 text-gray-700 hover:bg-gray-50 dark:ring-slate-700 dark:text-gray-200 dark:hover:bg-slate-800',
  ghost:
    'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-800',
  danger:
    'bg-red-600 text-white shadow-lg shadow-red-500/25 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
  success:
    'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3.5 text-sm gap-2',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  full = false,
  className = '',
  children,
  disabled,
  ...props
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-full font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-blue-500 dark:focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60 ${
        full ? 'w-full' : ''
      } ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : Icon ? (
        <Icon className="h-4 w-4" />
      ) : null}
      {children}
    </motion.button>
  );
}

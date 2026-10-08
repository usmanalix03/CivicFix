export default function Card({ className = '', children, ...props }) {
  return (
    <div
      className={`rounded-[24px] bg-white shadow-[0_2px_20px_rgb(0,0,0,0.04)] ring-1 ring-gray-100 dark:bg-slate-800/80 dark:ring-white/5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

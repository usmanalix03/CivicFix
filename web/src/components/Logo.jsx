import { useId } from 'react';

/**
 * CivicFix logo — a gradient rounded tile with a location pin and a check,
 * symbolising community-verified civic reporting.
 */
export default function Logo({ className = 'h-9 w-9' }) {
  const id = useId();
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${id})`} />
      <path
        d="M24 9c-5.5 0-10 4.5-10 10 0 7.2 10 20 10 20s10-12.8 10-20c0-5.5-4.5-10-10-10z"
        fill="#fff"
      />
      <path
        d="M20.5 19l2.4 2.4 4.6-4.6"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

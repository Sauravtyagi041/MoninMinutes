import { Link } from 'react-router-dom';

export function LogoMark({ className = 'size-8' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <path d="M9 10h14M9 16h14M9 22h8" stroke="var(--brand-ink)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 font-semibold tracking-tight text-ink">
      <LogoMark />
      <span className="text-lg">MinuteMate <span className="text-brand">AI</span></span>
    </Link>
  );
}

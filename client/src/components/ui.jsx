import { forwardRef, useEffect, useId, useRef } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

const cx = (...a) => a.filter(Boolean).join(' ');

const VARIANTS = {
  primary: 'bg-brand text-brand-ink hover:opacity-90 shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-bad-soft text-bad border border-bad/30 hover:opacity-90',
};
const SIZES = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors cursor-pointer',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant], SIZES[size], className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon && <Icon className="size-4" aria-hidden />}
      {children}
    </button>
  );
});

export const Card = ({ className, children, ...rest }) => (
  <div className={cx('rounded-xl border border-line bg-surface shadow-sm', className)} {...rest}>
    {children}
  </div>
);

export const Field = ({ label, error, hint, children, htmlFor }) => (
  <div className="space-y-1.5">
    {label && (
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
    )}
    {children}
    {hint && !error && <p className="text-xs text-muted">{hint}</p>}
    {error && (
      <p role="alert" className="text-xs text-bad">
        {error}
      </p>
    )}
  </div>
);

const inputBase =
  'w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-muted/70 transition-colors disabled:opacity-50';

export const Input = forwardRef(function Input({ label, error, hint, className, id, ...rest }, ref) {
  const auto = useId();
  const inputId = id || auto;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={inputId}>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? 'true' : undefined}
        className={cx(inputBase, 'h-10', error ? 'border-bad' : 'border-line', className)}
        {...rest}
      />
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, hint, className, id, ...rest }, ref) {
  const auto = useId();
  const tid = id || auto;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={tid}>
      <textarea
        ref={ref}
        id={tid}
        aria-invalid={error ? 'true' : undefined}
        className={cx(inputBase, 'py-2 leading-relaxed', error ? 'border-bad' : 'border-line', className)}
        {...rest}
      />
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, error, className, id, children, ...rest }, ref) {
  const auto = useId();
  const sid = id || auto;
  return (
    <Field label={label} error={error} htmlFor={sid}>
      <select
        ref={ref}
        id={sid}
        className={cx(inputBase, 'h-10 cursor-pointer', error ? 'border-bad' : 'border-line', className)}
        {...rest}
      >
        {children}
      </select>
    </Field>
  );
});

const TONES = {
  neutral: 'bg-surface-2 text-muted',
  brand: 'bg-brand-soft text-brand',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
};
export const Badge = ({ tone = 'neutral', className, children }) => (
  <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone], className)}>
    {children}
  </span>
);

export const Spinner = ({ className }) => <Loader2 className={cx('size-5 animate-spin text-brand', className)} aria-hidden />;

export const PageLoader = ({ label = 'Loading…' }) => (
  <div role="status" className="flex items-center justify-center gap-3 py-20 text-muted">
    <Spinner /> <span className="text-sm">{label}</span>
  </div>
);

export const Skeleton = ({ className }) => <div className={cx('animate-pulse rounded-md bg-surface-2', className)} />;

export const EmptyState = ({ icon: Icon, title, children, action }) => (
  <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
    {Icon && (
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon className="size-6" aria-hidden />
      </div>
    )}
    <h3 className="text-base font-semibold text-ink">{title}</h3>
    {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const ErrorState = ({ message, onRetry }) => (
  <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
    <div className="flex size-12 items-center justify-center rounded-full bg-bad-soft text-bad">
      <AlertTriangle className="size-6" aria-hidden />
    </div>
    <p className="max-w-md text-sm text-ink">{message}</p>
    {onRetry && (
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);

export function Modal({ open, onClose, title, children, footer, wide }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onMouseDown={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx('max-h-[90vh] w-full overflow-auto rounded-2xl border border-line bg-surface p-6 shadow-xl', wide ? 'max-w-2xl' : 'max-w-md')}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close dialog" className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink cursor-pointer">
            <X className="size-5" />
          </button>
        </div>
        <div className="text-sm text-muted">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export const Tabs = ({ tabs, value, onChange, label }) => (
  <div role="tablist" aria-label={label} className="inline-flex rounded-lg border border-line bg-surface-2 p-1">
    {tabs.map((t) => (
      <button
        key={t.id}
        role="tab"
        aria-selected={value === t.id}
        onClick={() => onChange(t.id)}
        className={cx(
          'flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer',
          value === t.id ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
        )}
      >
        {t.icon && <t.icon className="size-4" aria-hidden />}
        {t.label}
      </button>
    ))}
  </div>
);

export const Pagination = ({ meta, onPage }) =>
  meta && meta.totalPages > 1 ? (
    <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-muted">
      <span>
        Page {meta.page} of {meta.totalPages} · {meta.total} total
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  ) : null;

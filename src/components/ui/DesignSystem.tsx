import React from 'react';
import { X, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export function Panel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-md ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  actions,
  className = '',
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)] tracking-tight leading-snug">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'positive';
  size?: 'xs' | 'sm' | 'md';
}

export function Button({
  variant = 'secondary',
  size = 'sm',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 font-medium rounded transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2962FF] disabled:opacity-45 disabled:pointer-events-none cursor-pointer';

  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-[#2962FF] text-white hover:bg-[#1E53E5]',
    secondary:
      'bg-[var(--bg-panel)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]',
    ghost: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]',
    danger: 'bg-[#F23645]/12 text-[#F23645] border border-[#F23645]/30 hover:bg-[#F23645]/20',
    positive: 'bg-[#089981] text-white hover:bg-[#07826E]',
  };

  const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
    xs: 'h-7 px-2.5 text-xs',
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-[13px]',
  };

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-8 w-full px-2.5 text-xs bg-[var(--bg-canvas)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-[#2962FF] transition-colors ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = '',
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-8 px-2.5 text-xs bg-[var(--bg-canvas)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-[#2962FF] transition-colors cursor-pointer ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-0.5 p-0.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              active
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
            }`}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span className="ml-1.5 font-mono tabular-nums text-[11px] text-[var(--text-muted)]">
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function PriceChangeText({
  value,
  percent,
  decimals = 2,
  showPriceDelta = false,
}: {
  value: number;
  percent: number;
  decimals?: number;
  showPriceDelta?: boolean;
}) {
  const isUp = percent > 0;
  const isDown = percent < 0;
  const colorClass = isUp
    ? 'text-[#089981]'
    : isDown
    ? 'text-[#F23645]'
    : 'text-[var(--text-secondary)]';
  const sign = isUp ? '+' : '';

  return (
    <span className={`font-mono tabular-nums font-medium ${colorClass}`}>
      {showPriceDelta ? `${sign}${value.toFixed(decimals)} (${sign}${percent.toFixed(2)}%)` : `${sign}${percent.toFixed(2)}%`}
    </span>
  );
}

export function SignalLabel({
  signal,
}: {
  signal: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';
}) {
  const styles: Record<typeof signal, string> = {
    'Strong Buy': 'text-[#089981] bg-[#089981]/12 border-[#089981]/25',
    Buy: 'text-[#089981] bg-[#089981]/8 border-[#089981]/20',
    Neutral: 'text-[var(--text-secondary)] bg-[var(--bg-panel)] border-[var(--border-subtle)]',
    Sell: 'text-[#F23645] bg-[#F23645]/8 border-[#F23645]/20',
    'Strong Sell': 'text-[#F23645] bg-[#F23645]/12 border-[#F23645]/25',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-sm border whitespace-nowrap ${styles[signal]}`}
    >
      {signal}
    </span>
  );
}

export function Sparkline({
  data,
  positive,
  width = 88,
  height = 28,
}: {
  data: number[];
  positive: boolean;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const stroke = positive ? '#089981' : '#F23645';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible shrink-0">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-md shadow-xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
            {subtitle && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--bg-panel)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 border border-dashed border-[var(--border-subtle)] rounded-md bg-[var(--bg-canvas)]/50">
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: { id: string; title: string; description?: string; variant: 'info' | 'success' | 'warning' | 'error' }[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-8 right-4 z-[60] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => {
        const Icon =
          t.variant === 'success'
            ? CheckCircle2
            : t.variant === 'warning' || t.variant === 'error'
            ? AlertTriangle
            : Info;
        const iconColor =
          t.variant === 'success'
            ? 'text-[#089981]'
            : t.variant === 'warning'
            ? 'text-[#F0B90B]'
            : t.variant === 'error'
            ? 'text-[#F23645]'
            : 'text-[#2962FF]';

        return (
          <div
            key={t.id}
            className="flex items-start gap-2.5 p-3 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-md shadow-lg"
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--text-primary)] leading-snug">{t.title}</p>
              {t.description && (
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

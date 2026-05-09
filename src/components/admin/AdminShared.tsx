'use client';
import React from 'react';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/market/Button';
import { Modal } from '@/components/market/Modal';
// ===== Status Badge =====
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending: { label: 'معلق', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700', dot: 'bg-amber-400' },
  approved: { label: 'مقبول', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  active: { label: 'نشط', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  rejected: { label: 'مرفوض', bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700', dot: 'bg-rose-400' },
  inactive: { label: 'غير نشط', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600', dot: 'bg-slate-400' },
  new: { label: 'جديد', bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-400' },
  reviewing: { label: 'قيد المراجعة', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700', dot: 'bg-amber-400' },
  action_taken: { label: 'تم اتخاذ إجراء', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  closed: { label: 'مغلق', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600', dot: 'bg-slate-400' },
  banned: { label: 'محظور', bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700', dot: 'bg-rose-400' },
  featured: { label: 'مميز', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  verified: { label: 'موثق', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  hidden: { label: 'مخفي', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600', dot: 'bg-slate-400' },
  expired: { label: 'منتهي', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700', dot: 'bg-amber-400' },
  completed: { label: 'مكتمل', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700', dot: 'bg-emerald-400' },
};

export const StatusBadge: React.FC<{ status: string; label?: string }> = ({ status, label }) => {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {label || c.label}
    </span>
  );
};

// ===== Empty State =====
export const EmptyState: React.FC<{ icon: React.ReactNode; message: string; subMessage?: string }> = ({ icon, message, subMessage }) => (
  <div className="bg-[var(--color-surface)] rounded-2xl p-8 text-center shadow-sm border border-[var(--color-border)]">
    <div className="w-14 h-14 rounded-2xl bg-emerald-50/60 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-3 text-emerald-300">
      {icon}
    </div>
    <p className="text-[14px] font-bold text-[var(--color-text-tertiary)]">{message}</p>
    {subMessage && <p className="text-[12px] text-[var(--color-text-tertiary)] mt-1">{subMessage}</p>}
  </div>
);

// ===== Stat Card =====
const STAT_COLORS = {
  emerald: { border: 'border-emerald-200/60', bg: 'bg-emerald-50/40', icon: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600', num: 'text-emerald-700' },
  teal: { border: 'border-teal-200/60', bg: 'bg-teal-50 dark:bg-teal-900/20', icon: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600', num: 'text-teal-700' },
  amber: { border: 'border-amber-200/60', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600', num: 'text-amber-700' },
  rose: { border: 'border-rose-200/60', bg: 'bg-rose-50 dark:bg-rose-900/20', icon: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600', num: 'text-rose-700' },
  sky: { border: 'border-sky-200/60', bg: 'bg-sky-50/40', icon: 'bg-sky-100 text-sky-600', num: 'text-sky-700' },
  violet: { border: 'border-violet-200/60', bg: 'bg-violet-50/40', icon: 'bg-violet-100 text-violet-600', num: 'text-violet-700' },
};

export const StatCard: React.FC<{
  label: string; count: number; color: 'emerald' | 'teal' | 'amber' | 'rose' | 'sky' | 'violet';
  icon: React.ReactNode; onClick?: () => void; trend?: 'up' | 'down' | 'neutral'; trendValue?: string;
}> = ({ label, count, color, icon, onClick, trend, trendValue }) => {
  const c = STAT_COLORS[color];
  return (
    <button onClick={onClick} className={`text-right flex-1 min-w-0 rounded-2xl border p-3 transition-all ${c.border} ${c.bg} ${onClick ? 'hover:shadow-md cursor-pointer active:scale-[0.98]' : 'cursor-default'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.icon}`}>{icon}</div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-[10px] font-bold ${trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400'}`}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {trendValue}
          </div>
        )}
      </div>
      <p className={`text-xl font-black ${c.num}`}>{count.toLocaleString('ar-SY')}</p>
      <p className="text-[11px] text-[var(--color-text-secondary)] font-semibold mt-0.5">{label}</p>
    </button>
  );
};

// ===== Section Header =====
export const SectionHeader: React.FC<{ title: string; subtitle?: string; action?: { label: string; onClick: () => void } }> = ({ title, subtitle, action }) => (
  <div className="flex items-center justify-between mb-3">
    <div>
      <p className="text-[10px] font-bold text-emerald-400 dark:text-emerald-500 tracking-wide uppercase">{title}</p>
      {subtitle && <p className="text-[12px] text-[var(--color-text-tertiary)] mt-0.5">{subtitle}</p>}
    </div>
    {action && (
      <button onClick={action.onClick} className="text-[11px] font-bold text-emerald-500 hover:text-emerald-600 transition-colors">
        {action.label}
      </button>
    )}
  </div>
);

// ===== Search Bar =====
export const SearchBar: React.FC<{ value: string; onChange: (_val: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => {
  const [focused, setFocused] = React.useState(false);
  return (
    <div className="relative">
      <svg className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" strokeWidth="2" /><path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder || 'بحث...'}
        className={`w-full h-11 bg-[var(--color-surface)] border rounded-xl pr-10 pl-4 text-[13px] text-[var(--color-text)] font-medium placeholder:text-[var(--color-text-tertiary)] outline-none transition-all shadow-sm ${focused ? 'ring-2 ring-emerald-500/15 border-emerald-400' : 'border-emerald-100 dark:border-emerald-800 hover:border-emerald-200'}`}
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors">
          <svg className="w-3 h-3 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      )}
    </div>
  );
};

// ===== Filter Tabs =====
export const FilterTabs: React.FC<{ tabs: { key: string; label: string; count?: number }[]; activeKey: string; onChange: (_key: string) => void }> = ({ tabs, activeKey, onChange }) => (
  <div className="flex gap-2 bg-[var(--color-surface)] rounded-2xl p-1.5 shadow-sm border border-[var(--color-border)] overflow-x-auto scrollbar-hide">
    {tabs.map(tab => (
      <button
        key={tab.key}
        onClick={() => onChange(tab.key)}
        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] font-bold transition-all whitespace-nowrap flex-1 justify-center ${
          activeKey === tab.key
            ? 'gradient-primary text-white shadow-md shadow-emerald-500/20'
            : 'text-[var(--color-text-secondary)] hover:bg-emerald-50/60 dark:bg-emerald-900/20'
        }`}
      >
        {tab.label}
        {tab.count !== undefined && (
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-black ${
            activeKey === tab.key ? 'bg-[var(--color-surface)]/25 text-white' : 'bg-slate-100 dark:bg-slate-800 text-[var(--color-text-tertiary)]'
          }`}>
            {tab.count}
          </span>
        )}
      </button>
    ))}
  </div>
);

// ===== Confirm Dialog =====
export const ConfirmDialog: React.FC<{
  isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string;
  confirmLabel?: string; cancelLabel?: string; variant?: 'danger' | 'primary' | 'warning'; loading?: boolean;
}> = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'تأكيد', cancelLabel = 'إلغاء', variant = 'danger', loading }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
    <div className="space-y-4">
      <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">{message}</p>
      <div className="flex gap-3">
        <Button variant={variant} fullWidth onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        <Button variant="ghost" fullWidth onClick={onClose}>{cancelLabel}</Button>
      </div>
    </div>
  </Modal>
);

// ===== Data Card =====
export const DataCard: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div
    onClick={onClick}
    className={`bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)] ${onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.995] transition-all' : ''} ${className}`}
  >
    {children}
  </div>
);

// ===== Loading Spinner =====
export const LoadingSpinner: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <Loader2 className="w-8 h-8 text-emerald-400 dark:text-emerald-500 animate-spin mb-3" />
    <p className="text-[13px] text-[var(--color-text-tertiary)] font-medium">{message || 'جاري التحميل...'}</p>
  </div>
);

// ===== Action Button (small) =====
export const ActionBtn: React.FC<{
  icon: React.ReactNode; label: string; onClick: () => void;
  variant?: 'default' | 'danger' | 'success' | 'warning'; loading?: boolean;
}> = ({ icon, label, onClick, variant = 'default', loading }) => {
  const colors = {
    default: 'text-[var(--color-text-secondary)] hover:bg-emerald-50 dark:bg-emerald-900/20 hover:text-emerald-600',
    danger: 'text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:bg-rose-900/20 hover:text-rose-600',
    success: 'text-emerald-500 hover:bg-emerald-50 dark:bg-emerald-900/20 hover:text-emerald-600',
    warning: 'text-amber-500 dark:text-amber-400 hover:bg-amber-50 dark:bg-amber-900/20 hover:text-amber-600',
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${colors[variant]} ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
};

// ===== Info Row (key-value display) =====
export const InfoRow: React.FC<{ label: string; value: string | number; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)]/40 last:border-0">
    <span className="text-[12px] text-[var(--color-text-tertiary)] font-medium flex items-center gap-1.5">
      {icon && <span className="text-emerald-400">{icon}</span>}
      {label}
    </span>
    <span className="text-[13px] font-bold text-[var(--color-text)]">{value}</span>
  </div>
);

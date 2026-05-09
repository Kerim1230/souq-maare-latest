'use client';
import React, { memo } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = memo(({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const base = 'relative inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-150 overflow-hidden select-none';

  const variants = {
    primary: 'gradient-primary text-white shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 active:shadow-sm',
    secondary: 'gradient-warm text-white shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30 active:shadow-sm',
    success: 'gradient-cool text-white shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 active:shadow-sm',
    ghost: 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 active:bg-emerald-100 dark:active:bg-emerald-800/30',
    outline: 'border-2 border-emerald-200 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-300 dark:hover:border-emerald-600 active:bg-emerald-100 dark:active:bg-emerald-800/30',
    danger: 'gradient-rose text-white shadow-md shadow-rose-500/20 hover:shadow-lg hover:shadow-rose-500/30 active:shadow-sm',
    warning: 'bg-amber-500 text-white shadow-md shadow-amber-500/20 hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-500/30 active:bg-amber-700 active:shadow-sm',
  };

  const sizes = {
    sm: 'px-3.5 py-2 text-[13px] rounded-lg',
    md: 'px-5 py-3 text-sm',
    lg: 'px-6 py-3.5 text-[15px]',
  };

  return (
    <button
      aria-busy={loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
});
Button.displayName = 'Button';

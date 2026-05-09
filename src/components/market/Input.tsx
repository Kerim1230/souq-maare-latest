'use client';
import React, { useState, memo } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = memo(({
  label,
  error,
  icon,
  rightIcon,
  type,
  className = '',
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 pr-1">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-300 dark:text-emerald-600 pointer-events-none z-10">
            {icon}
          </div>
        )}
        <input
          type={inputType}
          className={`
            w-full bg-[var(--color-surface)] border rounded-xl py-3 text-[14px] text-[var(--color-text)]
            placeholder:text-[var(--color-text-tertiary)] font-medium outline-none
            focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 dark:focus:border-emerald-600
            ${error ? 'border-rose-300 dark:border-rose-600 focus:ring-rose-500/15 focus:border-rose-400' : 'border-[var(--color-border)] hover:border-emerald-300 dark:hover:border-emerald-700'}
            ${icon ? 'pr-10' : 'pr-3.5'}
            ${isPassword || rightIcon ? 'pl-10' : 'pl-3.5'}
            ${className}
          `}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-emerald-600 dark:hover:text-emerald-400 z-10"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
        {rightIcon && !isPassword && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] z-10">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="text-[11px] text-rose-500 font-semibold pr-1">{error}</p>
      )}
    </div>
  );
});
Input.displayName = 'Input';

'use client';
import React, { memo } from 'react';

export const SkeletonCard: React.FC<{ className?: string }> = memo(({ className = '' }) => (
  <div className={`bg-[var(--color-surface)] rounded-2xl overflow-hidden border border-[var(--color-border)] ${className}`}>
    <div className="skeleton aspect-square w-full" />
    <div className="p-3 space-y-2">
      <div className="h-4 skeleton rounded-lg w-3/4" />
      <div className="h-3 skeleton rounded-lg w-1/2" />
      <div className="h-5 skeleton rounded-lg w-2/3 mt-2" />
    </div>
  </div>
));
SkeletonCard.displayName = 'SkeletonCard';

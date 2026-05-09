'use client';
import React, { useEffect, memo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { lockScroll, unlockScroll, blockPointerEvents, restorePointerEvents } from '@/lib/scroll-lock';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Modal: React.FC<ModalProps> = memo(({ isOpen, onClose, title, children, size = 'md' }) => {
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' };
  // Stable ref for onClose to avoid effect re-triggering on parent re-renders
  const onCloseRef = useRef(onClose);

  // Update ref in effect (React 19 rule: no ref writes during render)
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Stable callback that reads from ref — never changes identity
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onCloseRef.current();
  }, []);

  // Single effect: only depends on isOpen (not onClose)
  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleEscape);
    lockScroll('Modal');
    blockPointerEvents('Modal');
    return () => {
      document.removeEventListener('keydown', handleEscape);
      unlockScroll('Modal');
      restorePointerEvents('Modal');
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ pointerEvents: 'auto' }}
    >
      <div
        className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]"
        onClick={() => onCloseRef.current()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={`relative w-full ${sizes[size]} bg-[var(--color-surface)] rounded-t-2xl sm:rounded-2xl shadow-xl shadow-emerald-500/8 dark:shadow-black/20 overflow-hidden z-10 max-h-[90vh] overflow-y-auto animate-[slideUp_200ms_ease-out]`}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <h3 id="modal-title" className="text-[15px] font-bold text-[var(--color-text)]">{title}</h3>
            <button onClick={() => onCloseRef.current()} aria-label="إغلاق" className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );

  // 🔥 CRITICAL FIX: Render via Portal to document.body
  // Prevents parent transform/overflow from breaking fixed positioning
  if (typeof window === 'undefined') return null;
  return createPortal(modalContent, document.body);
});
Modal.displayName = 'Modal';

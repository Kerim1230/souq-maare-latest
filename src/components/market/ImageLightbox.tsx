'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { lockScroll, unlockScroll, blockPointerEvents, restorePointerEvents } from '@/lib/scroll-lock';
import { optimizeImage } from '@/lib/image-optimize';

interface ImageLightboxProps {
  images: Array<{ src: string; alt?: string }>;
  onClose: () => void;
  initialIndex?: number;
}

const LightboxInner: React.FC<ImageLightboxProps> = ({
  images,
  onClose,
  initialIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  // Owner-based scroll lock — only locks once per lightbox instance
  useEffect(() => {
    lockScroll('ImageLightbox');
    blockPointerEvents('ImageLightbox');
    return () => {
      unlockScroll('ImageLightbox');
      restorePointerEvents('ImageLightbox');
    };
  }, []);

  const goToPrevious = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const goToNext = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => {
    if (scale <= 1) return;
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleDoubleClick = useCallback(() => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2.5);
    }
  }, [scale]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY, time: Date.now() });
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStart.x;

    if (scale <= 1 && Math.abs(diffX) > 50) {
      if (diffX > 0) goToNext();
      else goToPrevious();
      setTouchStart(null);
      return;
    }

    if (isDragging && scale > 1) {
      e.preventDefault();
      const newX = touch.clientX - dragStart.x;
      const newY = touch.clientY - dragStart.y;
      setPosition({ x: newX, y: newY });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (touchStart && Date.now() - touchStart.time < 300) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        handleDoubleClick();
      }
      lastTapRef.current = now;
    }
    setTouchStart(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- handleZoomIn/Out are stable callbacks
  }, [onClose, goToNext, goToPrevious]);

  if (images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" onClick={onClose} role="dialog" aria-modal="true" aria-label="عرض الصور" style={{ pointerEvents: 'auto' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 text-white/60 text-xs font-bold">
          <span className="text-white">{currentIndex + 1}</span>
          <span>/</span>
          <span>{images.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
            className="w-9 h-9 rounded-xl bg-[var(--color-surface)]/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-[var(--color-surface)]/20 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          {scale > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
              className="w-9 h-9 rounded-xl bg-[var(--color-surface)]/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-[var(--color-surface)]/20 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[var(--color-surface)]/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-[var(--color-surface)]/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden relative cursor-grab active:cursor-grabbing select-none"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={optimizeImage(currentImage.src)}
          alt={currentImage.alt || ''}
          className="max-w-full max-h-full object-contain transition-transform duration-200 pointer-events-none"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
          }}
          draggable={false}
        />
      </div>

      {/* Bottom navigation */}
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-4 px-4 py-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={goToNext}
            className="w-10 h-10 rounded-full bg-[var(--color-surface)]/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-[var(--color-surface)]/20 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setCurrentIndex(i);
                  setScale(1);
                  setPosition({ x: 0, y: 0 });
                }}
                className={`rounded-full transition-all duration-200 ${
                  i === currentIndex
                    ? 'w-6 h-1.5 bg-[var(--color-surface)]'
                    : 'w-1.5 h-1.5 bg-[var(--color-surface)]/40 hover:bg-[var(--color-surface)]/60'
                }`}
              />
            ))}
          </div>
          <button
            onClick={goToPrevious}
            className="w-10 h-10 rounded-full bg-[var(--color-surface)]/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-[var(--color-surface)]/20 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export const ImageLightbox: React.FC<ImageLightboxProps & { isOpen: boolean }> = ({
  images,
  isOpen,
  onClose,
  initialIndex = 0,
}) => {
  if (!isOpen) return null;

  // Stable key based on initialIndex — NOT Date.now() which forced remount on every render
  const lightboxKey = `lightbox-${initialIndex}`;

  const lightboxContent = (
    <LightboxInner
      key={lightboxKey}
      images={images}
      onClose={onClose}
      initialIndex={initialIndex}
    />
  );

  // 🔥 CRITICAL FIX: Render via Portal to document.body
  // Prevents parent transform/overflow from breaking fixed positioning
  if (typeof window === 'undefined') return null;
  return createPortal(lightboxContent, document.body);
};

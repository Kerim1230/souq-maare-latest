'use client';
import React, { useRef, useEffect, useState, memo } from 'react';

/**
 * LazySection — renders children only when the section is about to enter the viewport.
 * Uses IntersectionObserver with a rootMargin to start rendering before the element is visible.
 * Falls back to rendering children immediately if IntersectionObserver is not available.
 */
interface LazySectionProps {
  children: React.ReactNode;
  /** Distance in px to start pre-rendering before visibility (default: 400) */
  rootMargin?: string;
  /** Fallback content shown while section is not yet visible */
  fallback?: React.ReactNode;
  /** Height hint for the placeholder (default: 200) */
  placeholderHeight?: number;
}

export const LazySection: React.FC<LazySectionProps> = memo(({
  children,
  rootMargin = '400px 0px',
  fallback,
  placeholderHeight = 200,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // If IO not available, schedule state update to avoid synchronous setState in effect
    if (typeof IntersectionObserver === 'undefined') {
      const id = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(id);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  if (!isVisible) {
    return (
      <div ref={containerRef} style={{ minHeight: placeholderHeight }}>
        {fallback || null}
      </div>
    );
  }

  return <div ref={containerRef}>{children}</div>;
});

LazySection.displayName = 'LazySection';

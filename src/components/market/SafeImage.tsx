'use client';
import React, { useState, useRef, useEffect, memo } from 'react';
import { ImageIcon } from 'lucide-react';
import { optimizeImage } from '@/lib/image-optimize';

interface SafeImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
  priority?: boolean;
  /** Image width hint for optimization (default: 400) */
  widthHint?: number;
}

/**
 * SafeImage - handles image loading errors gracefully.
 * Shows a fallback (icon or custom) when src is empty or fails to load.
 * Uses IntersectionObserver for lazy loading and only loads when visible.
 * Automatically applies image optimizations to reduce payload.
 */
export const SafeImage: React.FC<SafeImageProps> = memo(({
  src,
  alt = '',
  className = '',
  fallback,
  priority = false,
  widthHint = 400,
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(priority);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !src) return;
    
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px 0px' } // Increased preload margin from 200→300
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [src, priority]);

  const optimizedSrc = src ? optimizeImage(src, { width: widthHint, crop: 'limit' }) : null;
  const hasError = !optimizedSrc || failedSrc === src;

  // Show placeholder while lazy loading
  if (!isVisible && src) {
    return (
      <div ref={containerRef} className={`bg-gradient-to-br from-emerald-50/30 to-teal-50/30 ${className}`}>
        <div className="w-full h-full skeleton" />
      </div>
    );
  }

  if (hasError) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-50/50 to-teal-50/50 ${className}`}>
        <ImageIcon className="w-6 h-6 text-emerald-300" />
      </div>
    );
  }

  return (
    <div ref={!priority ? containerRef : undefined} className={`relative ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/30 to-teal-50/30 skeleton" />
      )}
      <img
        src={optimizedSrc}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailedSrc(src!)}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
});
SafeImage.displayName = 'SafeImage';

/**
 * StoreLogo - renders a store logo with proper fallback to first letter.
 */
export const StoreLogo: React.FC<{
  src?: string | null;
  name: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}> = memo(({ src, name, className = '', size = 'md' }) => {
  const sizeClasses = {
    xs: 'w-5 h-5 text-[8px]',
    sm: 'w-10 h-10 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-14 h-14 text-lg',
  };
  const roundedClasses = {
    xs: 'rounded-md',
    sm: 'rounded-xl',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
  };

  const fallback = (
    <div className={`${sizeClasses[size]} ${roundedClasses[size]} gradient-primary flex items-center justify-center text-white font-black ${className}`}>
      {name?.[0] || 'م'}
    </div>
  );

  return (
    <div className={`${sizeClasses[size]} ${roundedClasses[size]} overflow-hidden shadow-sm flex-shrink-0 ${className}`}>
      <SafeImage
        src={src}
        alt={name}
        className="w-full h-full object-cover"
        fallback={fallback}
        priority={size === 'md' || size === 'lg'}
      />
    </div>
  );
});
StoreLogo.displayName = 'StoreLogo';

/**
 * UserAvatar - renders a user avatar with proper fallback to first letter.
 */
export const UserAvatar: React.FC<{
  src?: string | null;
  name?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}> = memo(({ src, name, className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-[72px] h-[72px] text-2xl',
  };

  const fallback = (
    <div className={`${sizeClasses[size]} rounded-full gradient-primary flex items-center justify-center text-white font-bold ${className}`}>
      {(name || 'م')[0]}
    </div>
  );

  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden flex-shrink-0 ${className}`}>
      <SafeImage
        src={src}
        alt={name || ''}
        className="w-full h-full object-cover"
        fallback={fallback}
      />
    </div>
  );
});
UserAvatar.displayName = 'UserAvatar';

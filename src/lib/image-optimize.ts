/**
 * ⚠️ STUB FILE — Image URL Optimizer
 *
 * All functions return URLs unchanged (passthrough). No external image
 * optimization service is configured. Kept because 9+ components import
 * `optimizeImage` from this module. If an optimization service is added
 * later, implement the transforms here.
 */

export interface ImageOptimizeOptions {
  width?: number;
  height?: number;
  quality?: 'auto' | 'good' | 'eco' | 'low';
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  crop?: 'fill' | 'fit' | 'limit' | 'thumb';
}

/**
 * Returns the URL unchanged (no external image optimization service).
 */
export function optimizeImage(url: string | null | undefined, _options?: ImageOptimizeOptions): string {
  if (!url) return '';
  return url;
}

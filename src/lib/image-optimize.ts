/**
 * Image URL Optimizer — Cloudinary-aware
 *
 * Transforms Cloudinary URLs by adding delivery transformation parameters
 * (width, height, crop, quality, format) directly into the URL path.
 * For non-Cloudinary URLs, ensures absolute URLs and passes through unchanged.
 *
 * Also converts relative URLs (e.g. `/uploads/abc.png`) to absolute URLs
 * using NEXT_PUBLIC_BASE_URL so they work in Open Graph meta tags.
 */

export interface ImageOptimizeOptions {
  width?: number;
  height?: number;
  quality?: 'auto' | 'good' | 'eco' | 'low' | number;
  format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
  crop?: 'fill' | 'fit' | 'limit' | 'thumb' | 'scale' | 'pad' | 'lpad' | 'mpad' | 'crop';
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://souq-maare-latest.vercel.app';

/**
 * Cloudinary URL pattern:
 * https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
 * or with existing transformations:
 * https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{version}/{public_id}.{format}
 */
const CLOUDINARY_REGEX = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/;

/**
 * Build a Cloudinary transformation string from options.
 */
function buildTransformString(options: ImageOptimizeOptions): string {
  const parts: string[] = [];

  if (options.width) parts.push(`w_${options.width}`);
  if (options.height) parts.push(`h_${options.height}`);
  if (options.crop) parts.push(`c_${options.crop}`);
  if (options.quality) {
    const q = options.quality;
    parts.push(`q_${q}`);
  }
  if (options.format && options.format !== 'auto') {
    // f_auto is handled automatically by Cloudinary when f_auto is set
    parts.push(`f_${options.format}`);
  } else if (options.format === 'auto') {
    parts.push('f_auto');
  }

  return parts.join(',');
}

/**
 * Ensures a URL is absolute. If the URL starts with `/`, prepends the BASE_URL.
 * Returns empty string for falsy values.
 */
function ensureAbsoluteUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${BASE_URL}${url}`;
  return url;
}

/**
 * Optimizes an image URL for the given dimensions and options.
 *
 * For Cloudinary URLs:
 *   Adds transformation parameters (w_, h_, c_, q_, f_) to the URL path.
 *   Example: https://res.cloudinary.com/demo/image/upload/w_1200,h_630,c_fill/v1234/image.jpg
 *
 * For other URLs:
 *   Ensures the URL is absolute (prepends BASE_URL for relative paths).
 *   Returns the URL unchanged if already absolute.
 *
 * @param url     - The original image URL (Cloudinary, relative, or absolute)
 * @param options - Optimization options (width, height, crop, quality, format)
 * @returns The optimized image URL, or empty string if input is falsy
 */
export function optimizeImage(url: string | null | undefined, options?: ImageOptimizeOptions): string {
  if (!url) return '';

  // Ensure absolute URL for relative paths
  const absoluteUrl = ensureAbsoluteUrl(url);

  // If no options, just return the absolute URL
  if (!options || Object.keys(options).length === 0) return absoluteUrl;

  // Check if this is a Cloudinary URL
  const cloudinaryMatch = absoluteUrl.match(CLOUDINARY_REGEX);

  if (cloudinaryMatch) {
    const [, baseUrl, rest] = cloudinaryMatch;
    const transformStr = buildTransformString(options);

    if (!transformStr) return absoluteUrl;

    // Check if there are existing transformations in the URL
    // Cloudinary URLs look like: .../upload/{transforms}/{version}/{public_id}.{format}
    // or: .../upload/{version}/{public_id}.{format}
    // A version starts with 'v' followed by digits (e.g., v1234567890)
    // Existing transforms don't start with 'v' + digits

    const segments = rest.split('/');

    // Check if the first segment is a version (v followed by digits) or a transformation
    const firstSegmentIsVersion = /^v\d+/.test(segments[0]);

    if (firstSegmentIsVersion) {
      // No existing transformations — insert our transforms before the version
      // .../upload/w_1200,h_630,c_fill/v1234/image.jpg
      return `${baseUrl}${transformStr}/${rest}`;
    } else {
      // There are existing transformations — append our transforms
      // .../upload/existing_transforms,w_1200,h_630,c_fill/v1234/image.jpg
      const existingTransforms = segments[0];
      const restOfPath = segments.slice(1).join('/');
      return `${baseUrl}${existingTransforms},${transformStr}/${restOfPath}`;
    }
  }

  // For non-Cloudinary URLs, just ensure absolute and return as-is
  return absoluteUrl;
}

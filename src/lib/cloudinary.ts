/**
 * Cloudinary Upload Utility
 *
 * Comprehensive module for uploading, deleting, and managing images on Cloudinary.
 * Configuration is resolved from environment variables first, then falls back
 * to encrypted settings stored in the EncryptedSetting database table.
 *
 * This module is SERVER-ONLY — never import from client components.
 */

import { v2 as cloudinary } from 'cloudinary';
import { getKeyValue } from '@/server/lib/external-keys';

// ── Types ──────────────────────────────────────────────────────────

/** Options passed to the uploadImage function */
export interface UploadOptions {
  /** Cloudinary folder to organize uploads (default: 'suq-shamel') */
  folder?: string;
  /** Cloudinary transformation string or object */
  transformation?: string | Record<string, unknown>;
  /** Custom public ID for the uploaded resource */
  publicId?: string;
  /** Overwrite an existing resource with the same public ID (default: true) */
  overwrite?: boolean;
  /** Allowed image formats (default: jpg, png, webp, gif) */
  allowedFormats?: string[];
  /** Maximum image width in pixels */
  max_width?: number;
  /** Maximum image height in pixels */
  max_height?: number;
  /** Image quality (1-100 or 'auto') */
  quality?: number | string;
  /** Crop mode (fill, fit, limit, thumb, etc.) */
  crop?: string;
}

/** Return type for successful uploads */
export interface UploadResult {
  /** HTTP URL of the uploaded image */
  url: string;
  /** HTTPS URL of the uploaded image */
  secureUrl: string;
  /** Cloudinary public ID (used for deletion & transformations) */
  publicId: string;
  /** Image format (e.g., 'jpg', 'png', 'webp') */
  format: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** File size in bytes */
  bytes: number;
}

/** Resolved Cloudinary configuration */
interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

// ── Cached configuration ───────────────────────────────────────────

let cachedConfig: CloudinaryConfig | null = null;

/**
 * Resolve Cloudinary configuration from environment variables first,
 * then from encrypted settings in the database.
 *
 * @throws Error with Arabic message if Cloudinary is not configured
 */
export async function getCloudinaryConfig(): Promise<CloudinaryConfig> {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }

  // 1) Try environment variables first
  //    Also check NEXT_PUBLIC_ prefixed variants as fallback (common on Vercel)
  let cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
  let apiKey = process.env.CLOUDINARY_API_KEY || '';
  let apiSecret = process.env.CLOUDINARY_API_SECRET || '';

  // 2) If any value is missing, fall back to encrypted settings
  if (!cloudName || !apiKey || !apiSecret) {
    try {
      const [dbCloudName, dbApiKey, dbApiSecret] = await Promise.all([
        getKeyValue('CLOUDINARY_CLOUD_NAME'),
        getKeyValue('CLOUDINARY_API_KEY'),
        getKeyValue('CLOUDINARY_API_SECRET'),
      ]);

      cloudName = cloudName || dbCloudName || '';
      apiKey = apiKey || dbApiKey || '';
      apiSecret = apiSecret || dbApiSecret || '';
    } catch (err) {
      console.error('[cloudinary] Failed to read encrypted settings:', err);
    }
  }

  // 3) Validate — all three values are required
  if (!cloudName || !apiKey || !apiSecret) {
    const missing: string[] = [];
    if (!cloudName) missing.push('CLOUDINARY_CLOUD_NAME');
    if (!apiKey) missing.push('CLOUDINARY_API_KEY');
    if (!apiSecret) missing.push('CLOUDINARY_API_SECRET');

    throw new Error(
      `إعدادات Cloudinary غير مكتملة. القيم الناقصة: ${missing.join(', ')}. ` +
      `يرجى تعيينها من خلال متغيرات البيئة أو صفحة المفاتيح في لوحة الإدارة.`
    );
  }

  const config: CloudinaryConfig = { cloudName, apiKey, apiSecret };

  // Cache the resolved config
  cachedConfig = config;

  return config;
}

/**
 * Check if Cloudinary is configured without throwing.
 * Useful for conditional logic (e.g., fallback to local uploads).
 *
 * @returns true if all three Cloudinary credentials are available
 */
export async function isCloudinaryConfigured(): Promise<boolean> {
  try {
    const config = await getCloudinaryConfig();
    return !!(config.cloudName && config.apiKey && config.apiSecret);
  } catch {
    return false;
  }
}

/**
 * Configure the Cloudinary SDK with the resolved credentials.
 * Called internally before each operation.
 */
async function configureCloudinary(): Promise<void> {
  const config = await getCloudinaryConfig();

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true, // Always use HTTPS
  });
}

// ── Upload ─────────────────────────────────────────────────────────

/**
 * Upload a base64-encoded image to Cloudinary.
 *
 * @param base64Data - Base64 data URI string (e.g., "data:image/jpeg;base64,...")
 *                     or a raw base64 string (will be prefixed automatically).
 * @param options    - Optional upload configuration.
 * @returns UploadResult with URLs, dimensions, and metadata.
 *
 * @throws Error with Arabic message on upload failure.
 *
 * @example
 * ```ts
 * const result = await uploadImage('data:image/jpeg;base64,/9j/4AAQ...', {
 *   folder: 'products',
 *   transformation: { width: 800, height: 600, crop: 'limit' },
 * });
 * console.log(result.secureUrl); // https://res.cloudinary.com/.../products/abc.jpg
 * ```
 */
export async function uploadImage(
  base64Data: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  // Validate input
  if (!base64Data || typeof base64Data !== 'string') {
    throw new Error('بيانات الصورة مطلوبة (base64)');
  }

  // Ensure the string is a proper data URI for Cloudinary
  let dataUri = base64Data;
  if (!base64Data.startsWith('data:')) {
    // Assume it's raw base64; prefix with a generic image MIME type
    dataUri = `data:image/jpeg;base64,${base64Data}`;
  }

  // Configure SDK
  await configureCloudinary();

  // Build upload parameters
  const uploadParams: Record<string, unknown> = {
    folder: options.folder || 'suq-shamel',
    overwrite: options.overwrite !== undefined ? options.overwrite : true,
    resource_type: 'image',
  };

  if (options.publicId) {
    uploadParams.public_id = options.publicId;
  }

  if (options.transformation) {
    uploadParams.transformation = options.transformation;
  }

  if (options.allowedFormats) {
    uploadParams.allowed_formats = options.allowedFormats;
  }

  // Build inline transformation from individual options if no explicit transformation
  if (!options.transformation && (options.max_width || options.max_height || options.crop || options.quality)) {
    const t: Record<string, unknown> = {};
    if (options.crop) t.crop = options.crop;
    if (options.max_width) t.width = options.max_width;
    if (options.max_height) t.height = options.max_height;
    if (options.quality) t.quality = options.quality;
    // Default crop mode if dimensions are specified without an explicit crop
    if ((options.max_width || options.max_height) && !options.crop) {
      t.crop = 'limit';
    }
    uploadParams.transformation = t;
  }

  try {
    const result = await cloudinary.uploader.upload(dataUri, uploadParams);

    return {
      url: result.url,
      secureUrl: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[cloudinary] Upload failed:', message);

    // Provide Arabic error messages for common Cloudinary errors
    if (message.includes('Invalid API Key')) {
      throw new Error('مفتاح API الخاص بـ Cloudinary غير صالح. يرجى التحقق من الإعدادات.');
    }
    if (message.includes('Invalid cloud_name')) {
      throw new Error('اسم السحابة (cloud name) الخاص بـ Cloudinary غير صالح. يرجى التحقق من الإعدادات.');
    }
    if (message.includes('File size too large')) {
      throw new Error('حجم الصورة كبير جداً. يرجى اختيار صورة أصغر.');
    }
    if (message.includes('Invalid image')) {
      throw new Error('الصورة غير صالحة أو تالفة. يرجى اختيار صورة أخرى.');
    }

    throw new Error(`فشل رفع الصورة إلى Cloudinary: ${message}`);
  }
}

// ── Delete ─────────────────────────────────────────────────────────

/**
 * Delete an image from Cloudinary by its public ID.
 *
 * @param publicId - The Cloudinary public ID of the image to delete.
 * @returns true if the image was deleted, false if not found.
 *
 * @throws Error with Arabic message on failure.
 *
 * @example
 * ```ts
 * const deleted = await deleteImage('suq-shamel/products/abc123');
 * ```
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  if (!publicId || typeof publicId !== 'string') {
    throw new Error('معرف الصورة (public ID) مطلوب للحذف');
  }

  // Don't attempt to delete local filesystem paths
  if (publicId.startsWith('/') || publicId.startsWith('http')) {
    console.warn('[cloudinary] Skipping delete — publicId looks like a local path or URL:', publicId);
    return false;
  }

  await configureCloudinary();

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
    });

    if (result.result === 'ok') {
      return true;
    }

    if (result.result === 'not found') {
      console.warn('[cloudinary] Image not found for deletion:', publicId);
      return false;
    }

    console.error('[cloudinary] Unexpected delete result:', result.result);
    throw new Error(`نتيجة حذف غير متوقعة: ${result.result}`);
  } catch (error) {
    // Re-throw our own errors
    if (error instanceof Error && error.message.startsWith('نتيجة حذف غير متوقعة')) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error('[cloudinary] Delete failed:', message);

    if (message.includes('Invalid API Key')) {
      throw new Error('مفتاح API الخاص بـ Cloudinary غير صالح. يرجى التحقق من الإعدادات.');
    }

    throw new Error(`فشل حذف الصورة من Cloudinary: ${message}`);
  }
}

// ── Configuration Management ───────────────────────────────────────

/**
 * Clear the cached Cloudinary configuration.
 * Call this after updating Cloudinary settings so the next
 * operation picks up the new values.
 */
export function clearCloudinaryCache(): void {
  cachedConfig = null;
  cloudinary.config({
    cloud_name: undefined,
    api_key: undefined,
    api_secret: undefined,
  });
}

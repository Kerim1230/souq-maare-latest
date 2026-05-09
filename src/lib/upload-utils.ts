/**
 * Client-side image upload utility.
 * Uploads a base64 image via /api/upload-image and returns the URL.
 *
 * NOTE: The caller is responsible for calling ensureCsrfReady() before
 * invoking this function (e.g. handleCreateStore, handleSaveStore).
 */
import { apiPost } from '@/lib/fetchApi';

/**
 * Upload a base64 image.
 * Returns the image URL on success, or null on failure.
 */
export async function uploadImage(base64: string | null): Promise<string | null> {
  if (!base64) return null;

  // If it's not a base64 data URL, skip upload (might be an external URL or empty)
  if (!base64.startsWith('data:image/')) {
    // Return as-is if it looks like a regular URL (already uploaded)
    if (base64.startsWith('http') || base64.startsWith('/uploads/')) return base64;
    return null;
  }

  try {
    const { data, error } = await apiPost<{ imageUrl: string }>('/api/upload-image', { image: base64 });
    if (error || !data?.imageUrl) {
      console.error('[upload] Failed to upload image:', error);
      return null;
    }
    return data.imageUrl;
  } catch (err) {
    console.error('[upload] Exception uploading image:', err);
    return null;
  }
}

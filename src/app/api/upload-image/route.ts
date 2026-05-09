export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { success, badRequest, serverError } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import { withRoute } from '@/server/lib/route-wrapper'
import { requireAuth } from '@/server/lib/auth-guard'
import { checkRateGuard } from '@/server/lib/rate-guard'
import { uploadImage, isCloudinaryConfigured } from '@/lib/cloudinary'

// ── Allowed image types ──────────────────────────────────────────

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_MB = 5

// ── POST /api/upload-image ──────────────────────────────────────
//
// Body (JSON):
//   { image: string }        ← base64 data URI  (data:image/jpeg;base64,...)
//
// Uploads to Cloudinary and returns the remote URL + metadata.
//
// Response:
//   { ok: true, data: { imageUrl, secure_url, ... } }

export const POST = withRoute(async (request: NextRequest) => {
  try {
    // ── Auth check — prevent unauthenticated uploads ────────────
    const auth = await requireAuth(request)
    if (!auth.success) return auth.response

    // ── Rate limit uploads ──────────────────────────────────────
    const rl = checkRateGuard(request, { category: 'upload' })
    if (rl) return rl

    // ── Check Cloudinary is configured ───────────────────────────
    const configured = await isCloudinaryConfigured()
    if (!configured) {
      return serverError('إعدادات Cloudinary غير مكتملة. يرجى تواصل مع المسؤول.')
    }

    // ── Parse body ───────────────────────────────────────────────
    const body = await request.json()
    const image = body.image

    if (!image || typeof image !== 'string') {
      return badRequest('الصورة مطلوبة (base64 data URI)')
    }

    // ── Extract MIME type ────────────────────────────────────────
    const mimeMatch = image.match(/^data:([^;]+);base64,/)
    if (!mimeMatch) {
      return badRequest('صيغة الصورة غير صحيحة. يجب أن تكون data:image/...;base64,...')
    }
    const mime = mimeMatch[1]
    if (!ALLOWED_TYPES.includes(mime)) {
      return badRequest('نوع الملف غير مدعوم. المسموح: JPEG, PNG, WebP, GIF')
    }

    // ── Validate size ────────────────────────────────────────────
    const base64Data = image.replace(/^data:[^;]+;base64,/, '')
    const sizeInBytes = (base64Data.length * 3) / 4
    const sizeInMB = sizeInBytes / (1024 * 1024)
    if (sizeInMB > MAX_SIZE_MB) {
      return badRequest(`حجم الصورة يجب ألا يتجاوز ${MAX_SIZE_MB} ميجابايت (الحالي: ${sizeInMB.toFixed(1)}MB)`)
    }

    // ── Upload to Cloudinary ─────────────────────────────────────
    const result = await uploadImage(image, {
      folder: 'souq-maare/uploads',
    })

    logger.info('Image uploaded to Cloudinary', 'Upload', {
      publicId: result.publicId,
      sizeKB: Math.round(result.bytes / 1024),
      format: result.format,
    })

    return success({
      imageUrl: result.secureUrl,
      secure_url: result.secureUrl,
      public_id: result.publicId,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
    })
  } catch (error) {
    logger.error('Upload failed', 'Upload', {
      error: error instanceof Error ? error.message : String(error),
    })
    return serverError(
      error instanceof Error ? error.message : 'حدث خطأ أثناء رفع الصورة'
    )
  }
})

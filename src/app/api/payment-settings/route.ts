export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { getAppSetting, setAppSetting } from '@/lib/supabase-db'
import { requireAdmin } from '@/server/lib/admin-auth'
import { ok, badRequest, serverError } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import { withRoute } from '@/server/lib/route-wrapper'

const SETTINGS_KEY = 'sham_cash'

const DEFAULT_SETTINGS = {
  recipientName: '',
  accountNumber: '',
  qrImage: '',
  pointPrice: 1,
  purchaseEnabled: true,
  minPoints: 100,
  maxPoints: 100000,
}

/**
 * GET /api/payment-settings
 * Returns ShamCash payment settings.
 * Public endpoint — sensitive fields (accountNumber, recipientName) are masked
 * unless the requester is an admin.
 */
export const GET = withRoute(async (request?: NextRequest) => {
  try {
    // Check if the requester is an admin (optional auth — non-admin still gets limited data)
    let isAdmin = false;
    if (request) {
      try {
        const adminCheck = await requireAdmin(request);
        if (adminCheck.success) isAdmin = true;
      } catch {
        // Not authenticated — still allow public access to limited settings
      }
    }

    const value = await getAppSetting(SETTINGS_KEY);

    if (!value) {
      return ok({ settings: isAdmin ? DEFAULT_SETTINGS : maskSensitiveFields(DEFAULT_SETTINGS) })
    }

    const parsed = JSON.parse(value) as Record<string, unknown>
    const settings = { ...DEFAULT_SETTINGS, ...parsed }
    return ok({ settings: isAdmin ? settings : maskSensitiveFields(settings) })
  } catch (err) {
    logger.warn('Payment settings GET error', 'PaymentSettings', { error: (err as Error)?.message })
    return ok({ settings: DEFAULT_SETTINGS })
  }
})

/** Mask sensitive payment fields for non-admin users */
function maskSensitiveFields(settings: Record<string, unknown>): Record<string, unknown> {
  return {
    ...settings,
    accountNumber: settings.accountNumber ? '****' : '',
    recipientName: settings.recipientName ? '****' : '',
  }
}

/**
 * PUT /api/payment-settings
 * Admin-only: saves ShamCash payment settings.
 */
export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const admin = await requireAdmin(request)
    if (!admin.success) return admin.response

    const body = await request.json()
    const {
      recipientName,
      accountNumber,
      qrImage,
      pointPrice,
      purchaseEnabled,
      minPoints,
      maxPoints,
    } = body as {
      recipientName?: string
      accountNumber?: string
      qrImage?: string
      pointPrice?: number
      purchaseEnabled?: boolean
      minPoints?: number
      maxPoints?: number
    }

    if (typeof recipientName !== 'string' || typeof accountNumber !== 'string') {
      return badRequest('بيانات غير صحيحة')
    }

    const value = {
      recipientName: recipientName || '',
      accountNumber: accountNumber || '',
      qrImage: typeof qrImage === 'string' ? qrImage : '',
      pointPrice: typeof pointPrice === 'number' ? pointPrice : DEFAULT_SETTINGS.pointPrice,
      purchaseEnabled: typeof purchaseEnabled === 'boolean' ? purchaseEnabled : DEFAULT_SETTINGS.purchaseEnabled,
      minPoints: typeof minPoints === 'number' ? minPoints : DEFAULT_SETTINGS.minPoints,
      maxPoints: typeof maxPoints === 'number' ? maxPoints : DEFAULT_SETTINGS.maxPoints,
    }

    await setAppSetting(SETTINGS_KEY, JSON.stringify(value))

    return ok({ settings: value })
  } catch (err) {
    logger.warn('Payment settings PUT error', 'PaymentSettings', { error: (err as Error)?.message })
    return serverError('حدث خطأ أثناء حفظ الإعدادات')
  }
})

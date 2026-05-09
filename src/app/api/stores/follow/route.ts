export const runtime = 'nodejs'
import { withRoute } from '@/server/lib/route-wrapper';
import { NextRequest } from 'next/server';
import { requireAuth } from '@/server/lib/auth-guard';
import { forbidden, success, created, badRequest, conflict, notFound, serverError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { validateId } from '@/utils/validation';
import {
  getSupabaseAdmin,
  TABLES,
  findFollow,
  createFollow,
  deleteFollow,
  countFollowers,
  findStoreById,
  findUserById,
  handleResponse,
} from '@/lib/supabase-db';
import { serverCache } from '@/lib/cache';

// GET: Check if user follows a store & get follower count
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const storeId = searchParams.get('storeId');

    const storeIdCheck = validateId(storeId, 'معرف المتجر');
    if (!storeIdCheck.valid) return badRequest(storeIdCheck.error!);
    const validatedStoreId = storeIdCheck.value!;

    if (userId && userId !== auth.userId) {
      return forbidden('ليس لديك صلاحية للتحقق من حالة متابعة مستخدم آخر');
    }

    const effectiveUserId = userId || auth.userId;

    const [followResult, followersCount] = await Promise.all([
      findFollow(effectiveUserId, validatedStoreId),
      countFollowers(validatedStoreId),
    ]);

    return success({
      isFollowing: !!followResult,
      followersCount,
    });
  } catch (error) {
    logger.error('Store follow check error', 'StoreFollow', { error: (error as Error)?.message });
    return serverError('حدث خطأ أثناء التحقق من حالة المتابعة');
  }
})

// POST: Follow a store
export const POST = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const body = await request.json();
    const { storeId } = body;

    const storeIdCheck = validateId(storeId, 'معرف المتجر');
    if (!storeIdCheck.valid) return badRequest(storeIdCheck.error!);

    // Check if already following before creating to avoid duplicate notifications
    const alreadyFollowing = await findFollow(userId, storeId);

    let follow;
    if (alreadyFollowing) {
      follow = alreadyFollowing;
    } else {
      try {
        follow = await createFollow({ user_id: userId, store_id: storeId });
      } catch (error: any) {
        // Handle unique constraint violation (23505)
        if (error?.message?.includes('23505') || error?.code === '23505') {
          return conflict('أنت بالفعل تتابع هذا المتجر');
        }
        throw error;
      }
    }

    // Only generate notification if this is a NEW follow
    let notification: any = null;
    if (!alreadyFollowing) {
      let storeOwner: string | null = null;
      let userFullName: string | null = null;

      try {
        const store = await findStoreById(storeId);
        storeOwner = store.user_id;
      } catch {
        // Store may not exist
      }

      try {
        const user = await findUserById(userId);
        userFullName = user.full_name;
      } catch {
        // User may not exist
      }

      notification = storeOwner && storeOwner !== userId
        ? {
            userId: storeOwner,
            type: 'store' as const,
            category: 'follow_store',
            title: 'متابع جديد',
            body: `قام ${userFullName || ''} بمتابعة متجرك`,
            icon: 'UserPlus',
            priority: 'medium' as const,
            deepLink: `/store/${storeId}`,
          }
        : null;
    }

    const followResponse = {
      id: follow.id,
      userId: follow.user_id,
      storeId: follow.store_id,
      createdAt: follow.created_at,
    };

    // Invalidate follower-related caches after successful follow
    serverCache.invalidateByPrefix('home:followers:');

    return created({ follow: followResponse, notification });
  } catch (error: any) {
    if (error.code === '23505') {
      return conflict('أنت بالفعل تتابع هذا المتجر');
    }
    logger.error('Store follow creation error', 'StoreFollow', { error: error?.message });
    return serverError('حدث خطأ أثناء متابعة المتجر');
  }
})

// DELETE: Unfollow a store
export const DELETE = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    const storeIdCheck = validateId(storeId, 'معرف المتجر');
    if (!storeIdCheck.valid) return badRequest(storeIdCheck.error!);
    const validatedDeleteStoreId = storeIdCheck.value!;

    try {
      const follow = await findFollow(userId, validatedDeleteStoreId);
      if (!follow) {
        return notFound('المتابعة غير موجودة');
      }
      await deleteFollow(userId, validatedDeleteStoreId);

      // Invalidate follower-related caches
      serverCache.invalidateByPrefix('home:followers:');

      return success(null);
    } catch (err) {
      logger.warn('Follow lookup failed', 'StoreFollow', { error: (err as Error)?.message });
      return notFound('المتابعة غير موجودة');
    }
  } catch (error: any) {
    logger.error('Store unfollow error', 'StoreFollow', { error: error?.message });
    return serverError('حدث خطأ أثناء إلغاء المتابعة');
  }
})

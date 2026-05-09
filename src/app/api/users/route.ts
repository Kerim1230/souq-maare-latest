export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/admin-auth';
import { serverError, success, badRequest, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { withRoute } from '@/server/lib/route-wrapper';
import { getSupabaseAdmin, findUserById, updateUser, TABLES, handleCount } from '@/lib/supabase-db';

/** Wrap result into a unified API response */
function wrapResult(data: unknown, status: number) {
  if (status >= 200 && status < 300) return success(data);
  const msg = (data as Record<string, string>)?.error || 'حدث خطأ';
  return apiError(msg, status);
}

export const GET = withRoute(async (request: NextRequest) => {
  try {
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      try {
        const user = await findUserById(id);
        const sb = getSupabaseAdmin();
        // Check if banned
        const { data: activeBan } = await sb.from(TABLES.USER_BANS)
          .select('id')
          .eq('user_id', id)
          .eq('is_active', true)
          .limit(1);

        const isBanned = activeBan && activeBan.length > 0;
        return wrapResult({
          user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            avatar_url: user.avatar_url,
            phone: user.phone,
            city: user.city,
            created_at: user.created_at,
            isBanned,
          },
        }, 200);
      } catch {
        return wrapResult({ error: 'المستخدم غير موجود' }, 404);
      }
    }

    // Get all users with stats
    const sb = getSupabaseAdmin();
    const { data: users, error } = await sb.from(TABLES.USERS)
      .select('id, email, full_name, avatar_url, created_at')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    // Batch check active bans
    const { data: activeBans } = await sb.from(TABLES.USER_BANS)
      .select('user_id')
      .eq('is_active', true);
    const bannedUserIds = new Set((activeBans || []).map((b: Record<string, unknown>) => b.user_id));

    // Batch get store/product counts
    const [storeCounts, productCounts] = await Promise.all([
      sb.from(TABLES.STORES).select('user_id'),
      sb.from(TABLES.PRODUCTS).select('user_id'),
    ]);
    const storeCountMap = new Map<string, number>();
    for (const s of (storeCounts.data || [])) {
      storeCountMap.set(s.user_id, (storeCountMap.get(s.user_id) || 0) + 1);
    }
    const productCountMap = new Map<string, number>();
    for (const p of (productCounts.data || [])) {
      productCountMap.set(p.user_id, (productCountMap.get(p.user_id) || 0) + 1);
    }

    return wrapResult({
      users: (users || []).map((u: Record<string, unknown>) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        avatar_url: u.avatar_url,
        created_at: u.created_at,
        isBanned: bannedUserIds.has(u.id as string),
        _count: {
          products: productCountMap.get(u.id as string) || 0,
          stores: storeCountMap.get(u.id as string) || 0,
          orders: 0,
        },
      })),
    }, 200);
  } catch (error: any) {
    logger.error('Users GET error', 'Users', { error: error.message });
    return serverError('حدث خطأ أثناء جلب المستخدمين');
  }
})

export const POST = withRoute(async (request: NextRequest) => {
  try {
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response;
    const body = await request.json();
    const result = await handleUserUpdate(body);
    return wrapResult(result.data, result.status);
  } catch (error: any) {
    logger.error('Users POST error', 'Users', { error: error.message });
    return serverError('حدث خطأ');
  }
})

export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response;
    const body = await request.json();
    const result = await handleUserUpdate(body);
    return wrapResult(result.data, result.status);
  } catch (error: any) {
    logger.error('Users PUT error', 'Users', { error: error.message });
    return serverError('حدث خطأ أثناء تحديث المستخدم');
  }
})

export const DELETE = withRoute(async (request: NextRequest) => {
  try {
    const admin = await requireAdmin(request);
    if (!admin.success) return admin.response;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return badRequest('معرف المستخدم مطلوب');
    }

    const sb = getSupabaseAdmin();
    const { error } = await sb.from(TABLES.USERS).delete().eq('id', userId);
    if (error) {
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        return wrapResult({ error: 'المستخدم غير موجود' }, 404);
      }
      throw new Error(error.message);
    }

    return wrapResult({ success: true }, 200);
  } catch (error: any) {
    logger.error('Users DELETE error', 'Users', { error: error.message });
    return serverError('حدث خطأ أثناء حذف المستخدم');
  }
})

/** Shared user update logic */
async function handleUserUpdate(body: {
  userId: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  city?: string;
  isBanned?: boolean;
  role?: string;
}): Promise<{ data: Record<string, unknown>; status: number }> {
  const { userId, full_name, avatar_url, phone, city, isBanned } = body;

  if (!userId) {
    throw new Error('معرف المستخدم مطلوب');
  }

  // Build update data with snake_case keys
  const updateData: Record<string, unknown> = {};
  if (full_name !== undefined) updateData.full_name = full_name;
  if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
  if (phone !== undefined) updateData.phone = phone;
  if (city !== undefined) updateData.city = city;

  let user;
  try {
    if (Object.keys(updateData).length > 0) {
      user = await updateUser(userId, updateData);
    } else {
      user = await findUserById(userId);
    }
  } catch (err) {
    const msg = (err as Error)?.message || '';
    if (msg.includes('not found') || msg.includes('does not exist') || msg.includes('No rows')) {
      return { data: { error: 'المستخدم غير موجود' }, status: 404 };
    }
    throw err;
  }

  // Handle isBanned via UserBan table
  const sb = getSupabaseAdmin();
  let banned = false;
  if (isBanned === true) {
    const { data: existingBan } = await sb.from(TABLES.USER_BANS)
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);
    if (!existingBan || existingBan.length === 0) {
      await sb.from(TABLES.USER_BANS).insert({
        user_id: userId,
        user_email: user?.email || '',
        user_name: user?.full_name || '',
        ban_type: 'full',
        duration: 'permanent',
        reason: 'Admin action',
        is_active: true,
        expires_at: '9999-12-31T23:59:59.999Z',
      });
    }
    banned = true;
  } else if (isBanned === false) {
    await sb.from(TABLES.USER_BANS).update({ is_active: false }).eq('user_id', userId).eq('is_active', true);
    banned = false;
  } else {
    const { data: activeBan } = await sb.from(TABLES.USER_BANS)
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);
    banned = !!(activeBan && activeBan.length > 0);
  }

  return {
    data: {
      user: {
        id: user?.id || userId,
        email: user?.email,
        full_name: user?.full_name,
        avatar_url: user?.avatar_url,
        phone: user?.phone,
        city: user?.city,
        created_at: user?.created_at || null,
        isBanned: banned,
      },
    },
    status: 200,
  };
}

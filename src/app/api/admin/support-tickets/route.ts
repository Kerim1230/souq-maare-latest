export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { withRoute } from '@/server/lib/route-wrapper';
import { requireAuth } from '@/server/lib/auth-guard';
import { success, badRequest, serverError, notFound } from '@/lib/api-response';
import { getSupabaseAdmin, findUserById, TABLES, handleResponse } from '@/lib/supabase-db';

// GET /api/admin/support-tickets — Get all support tickets
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    let user;
    try { user = await findUserById(auth.userId); } catch { return badRequest('غير مصرح'); }
    if (!user?.is_admin) {
      return badRequest('غير مصرح');
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const sb = getSupabaseAdmin();
    let query = sb.from(TABLES.SUPPORT_TICKETS).select('*').order('created_at', { ascending: false }).limit(100);
    if (status) query = query.eq('status', status);

    const { data: tickets, error } = await query;
    if (error) throw new Error(error.message);

    // Get user info for all tickets
    const userIds = [...new Set((tickets || []).map((t: Record<string, unknown>) => t.user_id as string))];
    let userMap = new Map<string, Record<string, unknown>>();
    if (userIds.length > 0) {
      const { data: users } = await sb.from(TABLES.USERS).select('id, full_name, email').in('id', userIds);
      for (const u of (users || [])) {
        userMap.set(u.id, u);
      }
    }

    return success({
      tickets: (tickets || []).map((t: Record<string, unknown>) => {
        const ticketUser = userMap.get(t.user_id as string);
        return {
          id: t.id,
          userId: t.user_id,
          userName: ticketUser?.full_name || '',
          userEmail: ticketUser?.email || '',
          subject: t.subject,
          message: t.message,
          status: t.status,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
        };
      }),
    });
  } catch {
    return serverError('حدث خطأ أثناء جلب التذاكر');
  }
});

// PUT /api/admin/support-tickets — Update ticket status
export const PUT = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    let user;
    try { user = await findUserById(auth.userId); } catch { return badRequest('غير مصرح'); }
    if (!user?.is_admin) {
      return badRequest('غير مصرح');
    }

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return badRequest('معرف التذكرة والحالة مطلوبان');
    }

    const sb = getSupabaseAdmin();
    const { data: existing } = await sb.from(TABLES.SUPPORT_TICKETS).select('id').eq('id', id).maybeSingle();
    if (!existing) return notFound('التذكرة غير موجودة');

    const updated = await handleResponse(
      await sb.from(TABLES.SUPPORT_TICKETS).update({ status }).eq('id', id).select().single(),
      'updateTicket'
    );

    return success({
      ticket: {
        id: updated.id,
        status: updated.status,
        updatedAt: updated.updated_at,
      },
    });
  } catch {
    return serverError('حدث خطأ أثناء تحديث التذكرة');
  }
});

// DELETE /api/admin/support-tickets?id=xxx — Delete ticket
export const DELETE = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    let user;
    try { user = await findUserById(auth.userId); } catch { return badRequest('غير مصرح'); }
    if (!user?.is_admin) {
      return badRequest('غير مصرح');
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return badRequest('معرف التذكرة مطلوب');

    const sb = getSupabaseAdmin();
    await sb.from(TABLES.SUPPORT_TICKETS).delete().eq('id', id);

    return success({ message: 'تم حذف التذكرة' });
  } catch {
    return serverError('حدث خطأ أثناء حذف التذكرة');
  }
});

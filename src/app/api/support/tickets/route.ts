export const runtime = 'nodejs';
import { NextRequest } from 'next/server';
import { withRoute } from '@/server/lib/route-wrapper';
import { getSupabaseAdmin, createSupportTicket, TABLES } from '@/lib/supabase-db';
import { requireAuth } from '@/server/lib/auth-guard';
import { success, created, badRequest, serverError } from '@/lib/api-response';

// POST /api/support/tickets — Create a support ticket
export const POST = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    const body = await request.json();
    const { userId, subject, message } = body;

    console.log('[SupportTickets] POST request', { userId, subject: subject?.substring(0, 30) });

    if (!userId || !subject || !message) {
      return badRequest('يرجى ملء جميع الحقول المطلوبة');
    }

    if (userId !== auth.userId) {
      return badRequest('غير مصرح');
    }

    const ticket = (await createSupportTicket({
      user_id: userId,
      subject,
      message,
    })) as unknown as Record<string, any>;

    console.log('[SupportTickets] Ticket created:', ticket?.id);
    return created({
      ticket: {
        id: ticket.id,
        userId: ticket.user_id,
        subject: ticket.subject,
        message: ticket.message,
        status: ticket.status,
        createdAt: ticket.created_at,
      },
    });
  } catch (error) {
    console.error('[SupportTickets] POST error:', error);
    return serverError('حدث خطأ أثناء إنشاء التذكرة');
  }
});

// GET /api/support/tickets?userId=xxx — Get user tickets
export const GET = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return badRequest('معرف المستخدم مطلوب');
    }

    const sb = getSupabaseAdmin();
    const { data: tickets, error } = await sb.from(TABLES.SUPPORT_TICKETS)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    return success({
      tickets: (tickets || []).map((t: Record<string, unknown>) => ({
        id: t.id,
        userId: t.user_id,
        subject: t.subject,
        message: t.message,
        status: t.status,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
    });
  } catch (error) {
    console.error('[SupportTickets] GET error:', error);
    return serverError('حدث خطأ أثناء جلب التذاكر');
  }
});

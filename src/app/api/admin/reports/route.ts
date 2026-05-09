export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/admin-auth';
import { checkRateLimit, getClientIp, LIMITS } from '@/server/lib/rate-limiter';
import { success, badRequest, unauthorized, forbidden, notFound, serverError, rateLimited } from '@/lib/api-response';
import { logger } from '@/lib/logger';

import { withRoute } from '@/server/lib/route-wrapper';
import { getSupabaseAdmin, createReport as sbCreateReport, logAdminActivity, TABLES, handleResponse } from '@/lib/supabase-db';

// GET /api/admin/reports — list all reports
export const GET = withRoute(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  // Rate limiting
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`admin:${ip}`, LIMITS.admin);
  if (!rateCheck.success) {
    return rateLimited();
  }

  try {
    const sb = getSupabaseAdmin();
    const { data: reports, error } = await sb
      .from(TABLES.REPORTS)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw new Error(error.message);

    const mapped = (reports || []).map((r: Record<string, unknown>) => ({
      id: r.id,
      targetId: r.target_id,
      targetType: r.target_type,
      targetName: r.target_name,
      reporterId: r.reporter_id,
      reporterName: r.reporter_name,
      reporterEmail: r.reporter_email,
      reason: r.reason,
      description: r.description,
      images: typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || []),
      status: r.status,
      adminNote: r.admin_note ?? undefined,
      actionTaken: r.action_taken ?? undefined,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at ?? undefined,
    }));

    return success({ reports: mapped, source: 'database' });
  } catch (err) {
    logger.error('Admin reports GET error', 'AdminReports', { error: (err as Error)?.message });
    return success({ reports: [], source: 'fallback' });
  }
})

// POST /api/admin/reports — create report
export const POST = withRoute(async (request: NextRequest) => {
  // Verify reporter identity first (need userId for per-user rate limiting)
  const { requireAuth } = await import('@/server/lib/auth-guard');
  const authResult = await requireAuth(request);

  // Require authentication for report creation
  if (!authResult.success) {
    return unauthorized('يجب تسجيل الدخول لإنشاء بلاغ');
  }
  const sessionUserId = authResult.userId;

  // Per-user rate limiting (5 reports per minute per user)
  const rateCheck = checkRateLimit(`report:${sessionUserId}`, LIMITS.report);
  if (!rateCheck.success) {
    return rateLimited('طلبات البلاغ كثيرة. حاول بعد دقيقة');
  }

  try {
    const body = await request.json();
    const { targetId, targetType, targetName, reporterId, reporterName, reporterEmail, reason, description, images } = body as {
      targetId: string;
      targetType: 'product' | 'store' | 'offer' | 'user' | 'contest';
      targetName: string;
      reporterId: string;
      reporterName: string;
      reporterEmail: string;
      reason: string;
      description: string;
      images?: string[];
    };

    if (!targetId || !targetType || !reporterId || !reason) {
      return badRequest('Missing required fields');
    }

    if (reporterId !== sessionUserId) {
      return forbidden('معرف المُبلِّغ لا يتطابق مع الجلسة');
    }

    // Persisted via Supabase
    const report = await sbCreateReport({
      target_id: targetId,
      target_type: targetType,
      target_name: targetName || '',
      reporter_id: reporterId,
      reporter_name: reporterName || '',
      reporter_email: reporterEmail || '',
      reason,
      description: description || '',
      images: JSON.stringify(images || []),
    });

    const mapped = {
      id: report.id,
      targetId: report.target_id,
      targetType: report.target_type,
      targetName: report.target_name,
      reporterId: report.reporter_id,
      reporterName: report.reporter_name,
      reporterEmail: report.reporter_email,
      reason: report.reason,
      description: report.description,
      images: typeof report.images === 'string' ? JSON.parse(report.images) : (report.images || []),
      status: report.status,
      createdAt: report.created_at,
    };

    return success({ report: mapped, source: 'database' });
  } catch (error) {
    logger.error('Admin reports POST error', 'AdminReports', { error: (error as Error)?.message });
    const message = process.env.NODE_ENV === 'development'
      ? (error instanceof Error ? error.message : 'Unknown error')
      : 'حدث خطأ غير متوقع';
    return serverError(message);
  }
})

// PUT /api/admin/reports — update report status
export const PUT = withRoute(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  // Rate limiting
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`admin:${ip}`, LIMITS.admin);
  if (!rateCheck.success) {
    return rateLimited();
  }

  try {
    const body = await request.json();
    const { reportId, status, adminNote, actionTaken } = body as {
      reportId: string;
      status: 'new' | 'reviewing' | 'action_taken' | 'closed';
      adminNote?: string;
      actionTaken?: string;
    };

    if (!reportId || !status) {
      return badRequest('Missing required fields');
    }

    const sb = getSupabaseAdmin();
    const { data: existing } = await sb.from(TABLES.REPORTS).select('*').eq('id', reportId).maybeSingle();
    if (!existing) return notFound('Report not found');

    const updated = await handleResponse(
      await sb.from(TABLES.REPORTS).update({
        status,
        admin_note: adminNote ?? null,
        action_taken: actionTaken ?? null,
        reviewed_at: new Date().toISOString(),
      }).eq('id', reportId).select().single(),
      'updateReportStatus'
    );

    const mapped = {
      id: updated.id,
      targetId: updated.target_id,
      targetType: updated.target_type,
      targetName: updated.target_name,
      reporterId: updated.reporter_id,
      reporterName: updated.reporter_name,
      reporterEmail: updated.reporter_email,
      reason: updated.reason,
      description: updated.description,
      images: typeof updated.images === 'string' ? JSON.parse(updated.images) : (updated.images || []),
      status: updated.status,
      adminNote: updated.admin_note ?? undefined,
      actionTaken: updated.action_taken ?? undefined,
      createdAt: updated.created_at,
      reviewedAt: updated.reviewed_at ?? undefined,
    };

    // Audit log via Supabase
    const auditAction = status === 'closed'
      ? 'إغلاق بلاغ'
      : status === 'action_taken'
        ? 'اتخاذ إجراء بلاغ'
        : 'مراجعة بلاغ';
    await logAdminActivity({
      admin_email: admin.email,
      action: auditAction,
      target_type: updated.target_type,
      target_id: updated.target_id,
      target_name: updated.target_name,
      details: actionTaken || adminNote || '',
    });

    return success({ report: mapped, source: 'database' });
  } catch (error) {
    logger.error('Admin reports PUT error', 'AdminReports', { error: (error as Error)?.message });
    const message = process.env.NODE_ENV === 'development'
      ? (error instanceof Error ? error.message : 'Unknown error')
      : 'حدث خطأ غير متوقع';
    return serverError(message);
  }
})

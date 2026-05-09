export const runtime = 'nodejs'
import { withRoute } from '@/server/lib/route-wrapper';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin, createComment, deleteComment, handleResponse, handleCount, TABLES, paginate } from '@/lib/supabase-db';
import { mapComment } from '@/lib/api-utils';
import { checkBanAsync, isActionAllowed } from '@/lib/ban-check';
import { validateId, sanitizeAndValidate } from '@/utils/validation';
import { checkRateLimit, LIMITS } from '@/server/lib/rate-limiter';
import { rateLimited, forbidden, success, created, badRequest, serverError, apiError } from '@/lib/api-response';
import { checkRateGuard } from '@/server/lib/rate-guard';
import { requireAuth } from '@/server/lib/auth-guard';
import { logger } from '@/lib/logger';
import { getErrorMessage } from '@/lib/error-utils';

export const GET = withRoute(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const offerId = searchParams.get('offerId');
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');
    const page = Math.max(pageParam ? parseInt(pageParam, 10) || 1 : 1, 1);
    const pageSize = Math.min(Math.max(pageSizeParam ? parseInt(pageSizeParam, 10) || 20 : 20, 1), 100);

    if (!productId && !offerId) {
      return badRequest('يجب تحديد productId أو offerId');
    }

    const sb = getSupabaseAdmin();

    // Build query with user join
    let query = sb
      .from(TABLES.COMMENTS)
      .select('*, user:users(full_name, avatar_url)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (productId) query = query.eq('product_id', productId);
    if (offerId) query = query.eq('offer_id', offerId);

    const { from, to } = paginate(page, pageSize);
    query = query.range(from, to);

    const result = await query;

    if (result.error) {
      logger.error('Comments fetch error', 'Comments', { error: result.error.message });
      return serverError('حدث خطأ أثناء جلب التعليقات');
    }

    const comments = result.data || [];
    const total = result.count ?? 0;

    return success({
      comments: comments.map((c: any) => mapComment(c)),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    logger.error('Comments fetch error', 'Comments', { error: getErrorMessage(error) });
    return serverError('حدث خطأ أثناء جلب التعليقات');
  }
})

export const POST = withRoute(async (request: NextRequest) => {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.userId;

    // Per-user rate limiting (10 comments per minute per user)
    const rl = checkRateLimit(`comments:${userId}`, LIMITS.comment);
    if (!rl.success) return rateLimited('طلبات تعليق كثيرة. حاول بعد دقيقة');

    const body = await request.json();
    const { content, productId, offerId } = body;

    if (!content) {
      return badRequest('محتوى التعليق مطلوب');
    }

    const contentCheck = sanitizeAndValidate(content, 1000, 'التعليق');
    if (!contentCheck.valid) {
      return badRequest(contentCheck.error!);
    }

    const sanitizedContent = contentCheck.value!;

    const banCheck = await checkBanAsync(userId);
    if (banCheck.isBanned && !isActionAllowed(banCheck.banType!, 'post')) {
      return apiError('تم حظر حسابك: ' + (banCheck.reason || ''), 403, { banned: true });
    }

    if (!productId && !offerId) {
      return badRequest('يجب تحديد productId أو offerId');
    }

    // Create comment via helper
    const comment = await createComment({
      user_id: userId,
      content: sanitizedContent,
      product_id: productId || undefined,
      offer_id: offerId || undefined,
    });

    // Fetch related data in parallel for notification building
    const sb = getSupabaseAdmin();
    const [userResult, productResult, offerResult] = await Promise.all([
      sb.from(TABLES.USERS).select('full_name, avatar_url').eq('id', userId).single(),
      comment.product_id
        ? sb.from(TABLES.PRODUCTS).select('user_id, name').eq('id', comment.product_id).single()
        : Promise.resolve({ data: null, error: null }),
      comment.offer_id
        ? sb.from(TABLES.STORE_OFFERS).select('user_id, title, store_id').eq('id', comment.offer_id).single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    // Attach user/product/offer to comment for mapComment
    const commentWithRelations = {
      ...comment,
      user: userResult.data || null,
      product: productResult?.data || null,
      offer: offerResult?.data || null,
    };

    const contentOwnerId = commentWithRelations.product?.user_id || commentWithRelations.offer?.user_id;
    const contentName = commentWithRelations.product?.name || commentWithRelations.offer?.title || '';
    const deepLink = productId
      ? `/product/${productId}`
      : offerId
        ? `/store/${commentWithRelations.offer?.store_id || ''}`
        : undefined;

    // Debug: log the notification routing decision
    console.log('[Comments] Notification routing', {
      commenterId: userId,
      contentOwnerId: contentOwnerId || 'NOT FOUND',
      isProduct: !!comment.product_id,
      isOffer: !!comment.offer_id,
      productUserId: commentWithRelations.product?.user_id,
      offerUserId: commentWithRelations.offer?.user_id,
      isSelfComment: contentOwnerId === userId,
    });

    const notificationPayload = (contentOwnerId && contentOwnerId !== userId)
      ? {
          user_id: contentOwnerId,
          type: 'interaction' as const,
          category: 'new_comment',
          title: 'تعليق جديد',
          body: contentName
            ? `قام ${commentWithRelations.user?.full_name || 'مستخدم'} بالتعليق على "${contentName}"`
            : `قام ${commentWithRelations.user?.full_name || 'مستخدم'} بإضافة تعليق جديد`,
          icon: 'MessageCircle',
          priority: 'medium' as const,
          deep_link: deepLink,
        }
      : null;

    // ── Server-first: Insert notification directly into database ──
    // Previously, the notification was only returned in the response and the
    // client was expected to create it. This was unreliable because:
    // 1. Field mapping (snake_case vs camelCase) could break
    // 2. Client might not call createNotification (network error, etc.)
    // Now we insert it server-side, guaranteeing the product owner receives it.
    if (notificationPayload) {
      try {
        const { createNotification: dbCreateNotification } = await import('@/lib/supabase-db');
        await dbCreateNotification(notificationPayload);
        console.log('[Comments] Notification created for content owner', { contentOwnerId, commentId: comment.id });
      } catch (notifErr) {
        // Non-fatal: comment was created successfully, just notification failed
        console.warn('[Comments] Notification creation failed (non-fatal)', String(notifErr));
        logger.warn('Comment notification creation failed', 'Comments', { commentId: comment.id, error: String(notifErr) });
      }
    }

    // Return comment only — notification is already created server-side above.
    // Previously, returning `notification` in the response caused the client
    // (CommentsSection.tsx) to call `createNotification` again, which:
    //   1. Created a DUPLICATE notification via /api/notifications
    //   2. Added the notification to the COMMENTER's local state (wrong person)
    //   3. Snake_case → camelCase mapping could lose `user_id`, defaulting to
    //      the session user (commenter) instead of the content owner
    // Now that the server inserts the notification directly, the client doesn't
    // need to do anything — the content owner will see it on their next fetch.
    return created({ comment: mapComment(commentWithRelations) });
  } catch (error) {
    logger.error('Comment creation error', 'Comments', { error: getErrorMessage(error) });
    return serverError('حدث خطأ أثناء إضافة التعليق');
  }
})

export const DELETE = withRoute(async (request: NextRequest) => {
  try {
    const rl = checkRateGuard(request, { category: 'mutation' });
    if (rl) return rl;

    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const sessionUserId = auth.userId;

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');

    const commentIdCheck = validateId(commentId, 'معرف التعليق');
    if (!commentIdCheck.valid) return badRequest(commentIdCheck.error!);

    const validatedCommentId = commentIdCheck.value!;
    const sb = getSupabaseAdmin();
    const { data: comment, error: commentError } = await sb
      .from(TABLES.COMMENTS)
      .select('*')
      .eq('id', validatedCommentId)
      .single();

    if (commentError || !comment) {
      return badRequest('التعليق غير موجود');
    }
    if (comment.user_id !== sessionUserId) {
      return forbidden('ليس لديك صلاحية لحذف هذا التعليق');
    }
    await deleteComment(validatedCommentId);
    return success(null);
  } catch (error) {
    logger.error('Comment deletion error', 'Comments', { error: getErrorMessage(error) });
    return serverError('حدث خطأ أثناء حذف التعليق');
  }
})

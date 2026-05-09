'use client';
import React, { useState, useEffect, useCallback, memo } from 'react';
import { Send, Loader2, Trash2 } from 'lucide-react';
import { UserAvatar } from '@/components/market/SafeImage';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { apiGet, apiPost, apiDelete } from '@/lib/fetchApi';

interface Comment {
  id: string;
  user_id: string;
  content: string;
  product_id?: string;
  offer_id?: string;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
}

interface CommentsSectionProps {
  targetId: string;
  targetType: 'product' | 'offer';
  ownerId?: string;
}

export const CommentsSection: React.FC<CommentsSectionProps> = memo(({ targetId, targetType, ownerId }) => {
  const user = useAuthStore(s => s.user);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = user?.is_admin === true;

  const canDelete = (comment: Comment) => {
    if (!user) return false;
    if (comment.user_id === user.id) return true;
    if (ownerId && user.id === ownerId) return true;
    if (isAdmin) return true;
    return false;
  };

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const param = targetType === 'product' ? `productId=${targetId}` : `offerId=${targetId}`;
      const { data } = await apiGet(`/api/comments?${param}`);
      setComments(data?.comments || []);
    } catch {
      setComments([]);
    } finally { setLoading(false); }
  }, [targetId, targetType]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleSubmit = async () => {
    if (!newComment.trim() || !user) return;
    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        userId: user.id,
        content: newComment.trim(),
      };
      if (targetType === 'product') body.productId = targetId;
      else body.offerId = targetId;

      const { data, error } = await apiPost('/api/comments', body);
      if (error) {
        toast.error('حدث خطأ أثناء إضافة التعليق');
        return;
      }
      if (data?.comment) {
        setComments(prev => [data.comment, ...prev]);
        setNewComment('');
        // Create notification for content owner
        // ⚠️ IMPORTANT: The API returns snake_case fields (user_id, deep_link)
        // but createNotification expects camelCase (userId, deepLink).
        // We must map the fields correctly, otherwise userId is undefined
        // and the notification goes to the session user (the commenter) instead
        // of the content owner.
        if (data.notification) {
          const { useNotificationStore } = await import('@/store/notificationStore');
          const n = data.notification as Record<string, unknown>;
          useNotificationStore.getState().createNotification({
            userId: (n.user_id as string) || (n.userId as string),  // snake_case → camelCase
            type: (n.type as any),
            category: (n.category as string) || '',
            title: (n.title as string) || '',
            body: (n.body as string) || '',
            icon: (n.icon as string) || undefined,
            deepLink: (n.deep_link as string) || (n.deepLink as string) || undefined,  // snake_case → camelCase
            priority: (n.priority as any) || 'medium',
          });
        }
      }
    } catch {
      toast.error('حدث خطأ');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (commentId: string) => {
    if (deletingId) return;
    setDeletingId(commentId);
    try {
      const { error } = await apiDelete(`/api/comments?commentId=${commentId}`);
      if (error) {
        toast.error('فشل حذف التعليق');
        return;
      }
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.success('تم حذف التعليق');
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setDeletingId(null);
    }
  };

  const displayComments = showAll ? comments : comments.slice(0, 3);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--color-text)]">
          التعليقات {comments.length > 0 && <span className="text-[var(--color-text-tertiary)]">({comments.length})</span>}
        </h3>
        {comments.length > 3 && (
          <button onClick={() => setShowAll(!showAll)} className="text-xs font-bold text-emerald-500">
            {showAll ? 'عرض أقل' : 'عرض الكل'}
          </button>
        )}
      </div>

      {/* Input */}
      {user && (
        <div className="flex gap-2">
          <UserAvatar src={user.avatar_url} name={user.full_name || user.email} size="sm" />
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="أضف تعليقاً..."
            maxLength={1000}
            className="flex-1 bg-[var(--color-surface)] border border-emerald-100 dark:border-emerald-800 rounded-xl px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !newComment.trim()}
            className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center text-white shadow-md disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="bg-[var(--color-surface)] rounded-xl p-3 animate-pulse">
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-20 bg-emerald-100 dark:bg-emerald-900/30 rounded" />
                  <div className="h-3 w-full bg-emerald-50 dark:bg-emerald-900/20 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : displayComments.length === 0 ? (
        <p className="text-center text-[var(--color-text-tertiary)] text-xs py-3">لا توجد تعليقات بعد</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-hide">
          {displayComments.map(c => (
            <div key={c.id} className="bg-[var(--color-surface)] rounded-xl p-3 border border-[var(--color-border)]/60 group">
              <div className="flex gap-2.5">
                <UserAvatar src={c.user_avatar} name={c.user_name || 'م'} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">{c.user_name || 'مستخدم'}</span>
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">{new Date(c.created_at).toLocaleDateString('ar-SY')}</span>
                    {canDelete(c) && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
                        className="mr-auto w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:bg-rose-900/20 transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
                        aria-label="حذف التعليق"
                      >
                        {deletingId === c.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{c.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
CommentsSection.displayName = 'CommentsSection';

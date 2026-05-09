'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Flag, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiPost } from '@/lib/fetchApi';

import { Modal } from '@/components/market/Modal';
import { Button } from '@/components/market/Button';
import { ImageUploader } from '@/components/market/ImageUploader';
import { useAdminStore, REPORT_REASONS, TARGET_TYPE_LABELS, ReportTargetType } from '@/store/adminStore';
import { useAuthStore } from '@/store/authStore';
import { canSubmit } from '@/lib/rate-limit';

interface ReportModalInnerProps {
  onClose: () => void;
  targetType: 'product' | 'store' | 'offer' | 'user';
  targetId: string;
  targetName: string;
}

/**
 * Upload a base64 image via /api/upload-image and return the imageUrl.
 * Falls back to base64 if upload fails.
 */
async function uploadImage(base64: string): Promise<string> {
  try {
    const { data, ok } = await apiPost<{ imageUrl?: string }>('/api/upload-image', {
      image: base64,
    });

    if (ok && data?.imageUrl) {
      return data.imageUrl;
    }
    // Upload failed — return original base64 as fallback
    console.warn('[ReportModal] Image upload failed, using base64 fallback');
    return base64;
  } catch {
    return base64;
  }
}

const ReportModalInner: React.FC<ReportModalInnerProps> = ({
  onClose,
  targetType,
  targetId,
  targetName,
}) => {
  const createReport = useAdminStore((s) => s.createReport);
  const user = useAuthStore((s) => s.user);

  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<(string | null)[]>([null, null, null]);
  const [errors, setErrors] = useState<{ reason?: string; description?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const targetTypeLabel = TARGET_TYPE_LABELS[targetType as ReportTargetType] || targetType;

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const handleImageChange = (index: number, base64: string | null) => {
    setImages((prev) => {
      const updated = [...prev];
      updated[index] = base64;
      return updated;
    });
  };

  const handleSubmit = async () => {
    const newErrors: { reason?: string; description?: string } = {};
    if (!reason) newErrors.reason = 'يرجى اختيار سبب البلاغ';
    if (!description.trim()) newErrors.description = 'يرجى كتابة وصف للبلاغ';
    else if (description.trim().length < 10) newErrors.description = 'يجب أن يكون الوصف 10 أحرف على الأقل';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    if (!user) {
      toast.error('يجب تسجيل الدخول لإرسال بلاغ');
      return;
    }

    if (!canSubmit()) {
      setCooldownRemaining(3000);
      toast.error('يرجى الانتظار قليلاً قبل إرسال بلاغ آخر');
      return;
    }

    setSubmitting(true);

    // Upload images
    const validImages = images.filter((img): img is string => img !== null);
    const uploadedUrls: string[] = [];

    if (validImages.length > 0) {
      setUploadProgress('جاري رفع الصور...');
      const uploadResults = await Promise.allSettled(
        validImages.map((img, _idx) => uploadImage(img))
      );
      for (const result of uploadResults) {
        if (result.status === 'fulfilled') {
          uploadedUrls.push(result.value);
        }
      }
      setUploadProgress('');
    }

    createReport({
      targetId,
      targetType: targetType as ReportTargetType,
      targetName,
      reporterId: user.id,
      reporterName: user.full_name || user.email,
      reporterEmail: user.email,
      reason,
      description: description.trim(),
      images: uploadedUrls,
    });

    toast.success('تم إرسال البلاغ بنجاح. شكراً لمساعدتنا في تحسين المنصة.');
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 p-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 rounded-xl">
        <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1">
          <p className="text-[13px] font-bold text-amber-800 dark:text-amber-200">بلاغ عن {targetTypeLabel}</p>
          <p className="text-[12px] text-amber-700 leading-relaxed">سيتم مراجعة البلاغ من قبل فريق الإدارة. يرجى تقديم معلومات دقيقة.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-emerald-50/60 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl">
        <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
          <Flag className="w-4.5 h-4.5 text-emerald-600" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[11px] font-semibold text-emerald-500">الهدف المُبلَّغ عنه</span>
          <span className="text-[13px] font-bold text-[var(--color-text)] truncate">{targetName}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 pr-1">سبب البلاغ <span className="text-rose-400">*</span></label>
        <div className="relative">
          <select
            value={reason}
            onChange={(e) => { setReason(e.target.value); if (errors.reason) setErrors((p) => ({ ...p, reason: undefined })); }}
            className={`w-full appearance-none bg-[var(--color-surface)] border rounded-xl py-3 px-3.5 text-[14px] text-[var(--color-text)] font-medium outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 transition-all ${errors.reason ? 'border-rose-300' : 'border-emerald-100 dark:border-emerald-800 hover:border-emerald-200'}`}
          >
            <option value="" disabled>اختر سبب البلاغ...</option>
            {REPORT_REASONS.map((r) => (<option key={r.value} value={r.value}>{r.label}</option>))}
          </select>
          <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {errors.reason && <p className="text-[11px] text-rose-500 dark:text-rose-400 font-semibold pr-1">{errors.reason}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 pr-1">وصف البلاغ <span className="text-rose-400">*</span></label>
        <textarea
          value={description}
          onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors((p) => ({ ...p, description: undefined })); }}
          placeholder="اشرح المشكلة بالتفصيل (10 أحرف على الأقل)..."
          rows={4}
          className={`w-full bg-[var(--color-surface)] border rounded-xl py-3 px-3.5 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] font-medium outline-none resize-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 transition-all ${errors.description ? 'border-rose-300' : 'border-emerald-100 dark:border-emerald-800 hover:border-emerald-200'}`}
        />
        {errors.description && <p className="text-[11px] text-rose-500 dark:text-rose-400 font-semibold pr-1">{errors.description}</p>}
        {!errors.description && description.length > 0 && description.length < 10 && (
          <p className="text-[11px] text-amber-500 dark:text-amber-400 font-semibold pr-1">{10 - description.length} أحرف متبقية</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 pr-1">صور إضافية <span className="text-[12px] font-normal text-[var(--color-text-tertiary)]">(اختياري)</span></label>
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, idx) => (
            <ImageUploader key={idx} value={img} onChange={(base64) => handleImageChange(idx, base64)} height="h-24" />
          ))}
        </div>
        {uploadProgress && (
          <p className="text-[11px] text-emerald-500 font-semibold pr-1">{uploadProgress}</p>
        )}
      </div>

      <Button variant="primary" fullWidth loading={submitting} disabled={cooldownRemaining > 0} onClick={handleSubmit} icon={!submitting && cooldownRemaining <= 0 ? <AlertTriangle className="w-4 h-4" /> : undefined} className="mt-1">
        {submitting ? uploadProgress || 'جاري الإرسال...' : cooldownRemaining > 0 ? `انتظر ${Math.ceil(cooldownRemaining / 1000)} ثانية` : 'إرسال البلاغ'}
      </Button>
    </div>
  );
};

// Wrapper that uses key to reset form on open
interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'product' | 'store' | 'offer' | 'user';
  targetId: string;
  targetName: string;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, targetType, targetId, targetName }) => {
  const [resetKey, setResetKey] = useState(0);
  // Track opens to reset form without Date.now() (which forced remount on every render)
  const prevOpenRef = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) setResetKey(k => k + 1);
    prevOpenRef.current = isOpen;
  });
  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`إبلاغ عن ${TARGET_TYPE_LABELS[targetType as ReportTargetType] || targetType}`} size="md">
      <ReportModalInner key={`${targetId}-${resetKey}`} onClose={onClose} targetType={targetType} targetId={targetId} targetName={targetName} />
    </Modal>
  );
};

export default ReportModal;

'use client';
import React, { useState } from 'react';
import { ArrowRight, Send, CheckCircle, Loader2, MessageSquare } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { apiPost } from '@/lib/fetchApi';
import toast from 'react-hot-toast';

const SUBJECTS = [
  { value: 'technical', label: 'مشكلة تقنية' },
  { value: 'suggestion', label: 'اقتراح' },
  { value: 'inquiry', label: 'استفسار' },
  { value: 'complaint', label: 'بلاغ' },
];

export const ContactSupportScreen: React.FC = () => {
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const user = useAuthStore(s => s.user);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!subject) { toast.error('يرجى اختيار الموضوع'); return; }
    if (!message.trim()) { toast.error('يرجى كتابة الرسالة'); return; }
    if (!user) { toast.error('يرجى تسجيل الدخول'); return; }

    setSubmitting(true);
    try {
      const { ok, error } = await apiPost('/api/support/tickets', {
        userId: user.id,
        subject,
        message: message.trim(),
      });
      if (ok) {
        setSubmitted(true);
        toast.success('تم إرسال طلبك بنجاح');
      } else {
        toast.error(error || 'حدث خطأ أثناء الإرسال');
      }
    } catch {
      toast.error('حدث خطأ أثناء الإرسال');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[100dvh] bg-[var(--color-bg)] flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl flex items-center justify-center mb-5">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        <h1 className="text-lg font-black text-[var(--color-text)] mb-2">تم استلام طلبك</h1>
        <p className="text-[13px] text-[var(--color-text-tertiary)] text-center mb-6">سنتواصل معك قريباً عبر البريد الإلكتروني أو الإشعارات.</p>
        <button onClick={() => setSubScreen('none')}
          className="px-6 py-2.5 gradient-primary text-white text-[13px] font-bold rounded-xl shadow-md shadow-emerald-500/20">
          العودة للرئيسية
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)] pb-14">
      {/* Header */}
      <div className="gradient-dark px-5 pt-8 pb-6 relative overflow-hidden">
        <div className="absolute top-[-30px] right-[-20px] w-[140px] h-[140px] rounded-full bg-teal-600/15 blur-[50px]" />
        <div className="relative z-10 flex items-center gap-3">
          <button onClick={() => setSubScreen('none')} className="w-10 h-10 bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <ArrowRight className="w-[18px] h-[18px] text-white" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20">
              <MessageSquare className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-white text-lg font-bold">تواصل معنا</h1>
              <p className="text-teal-300/60 text-[11px]">فريق الدعم في خدمتك</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="px-4 -mt-4 space-y-4">
        <div className="bg-[var(--color-surface)] rounded-2xl p-5 border border-[var(--color-border)] shadow-sm space-y-4">
          {/* Subject */}
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-2">الموضوع <span className="text-rose-400">*</span></label>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map(s => (
                <button key={s.value} onClick={() => setSubject(s.value)}
                  className={`px-3.5 py-2 rounded-xl text-[13px] font-bold transition-all ${
                    subject === s.value
                      ? 'gradient-primary text-white shadow-md shadow-emerald-500/20'
                      : 'bg-emerald-50/60 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100/60 dark:border-emerald-800/40'
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">الرسالة <span className="text-rose-400">*</span></label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="اكتب رسالتك هنا..."
              rows={5}
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl py-3 px-4 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 resize-none"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !subject || !message.trim()}
            className="w-full py-3 gradient-primary text-white text-[14px] font-bold rounded-xl shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-40 disabled:shadow-none"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                إرسال الطلب
              </>
            )}
          </button>
        </div>

        <div className="bg-emerald-50/40 dark:bg-emerald-900/10 rounded-2xl p-4 border border-emerald-100/40 dark:border-emerald-800/30">
          <p className="text-[12px] text-emerald-700 dark:text-emerald-400 font-bold mb-1">💡 نصيحة</p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-500 leading-relaxed">يمكنك أيضاً استخدام مركز المساعدة الذكي للحصول على إجابات فورية لأسئلتك.</p>
          <button onClick={() => setSubScreen('help')} className="mt-2 text-[12px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
            الانتقال لمركز المساعدة ←
          </button>
        </div>
      </div>
    </div>
  );
};

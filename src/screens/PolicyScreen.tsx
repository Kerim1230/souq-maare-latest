'use client';
import React from 'react';
import { ArrowRight, FileText, Shield, Scale, AlertTriangle, Heart, Ban } from 'lucide-react';
import { useAppStore } from '@/store/appStore';

const sections = [
  {
    icon: <Shield className="w-5 h-5 text-emerald-500" />,
    title: 'شروط الاستخدام العامة',
    content: 'يُشترط استخدام تطبيق "سوق شامل" الإلكتروني الالتزام بالشروط والأحكام التالية. باستخدامك للتطبيق، فإنك توافق على هذه الشروط. يُمنع استخدام المنصة لأي أغراض غير مشروعة أو مخالفة للقوانين السورية المعمول بها.',
  },
  {
    icon: <Scale className="w-5 h-5 text-teal-500" />,
    title: 'حساب المستخدم',
    content: 'يجب تقديم معلومات صحيحة عند إنشاء الحساب. المستخدم مسؤول عن الحفاظ على سرية بيانات حسابه. لا يجوز نقل الحساب أو مشاركته مع أي شخص آخر. يحق للإدارة تعليق أو إغلاق أي حساب يخالف الشروط.',
  },
  {
    icon: <FileText className="w-5 h-5 text-blue-500" />,
    title: 'المتاجر والمنتجات',
    content: 'يجب أن تكون المنتجات المعروضة حقيقية ومطابقة للوصف. يُمنع عرض منتجات محظورة أو مخالفة. المتاجر الموثقة تحصل على شارة توثيق بعد التحقق من معلوماتها. يحق للإدارة حذف أي منتج أو متجر مخالف.',
  },
  {
    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    title: 'المحتوى المحظور',
    content: 'يُمنع نشر أي محتوى مسيء أو عنيف أو يميز عنصرياً. يُمنع نشر معلومات مضللة أو احتيالية. يُمنع استخدام المنصة للإعلان عن منتجات أو خدمات غير مصرح بها. يُمنع إساءة استخدام نظام التقييمات والتعليقات.',
  },
  {
    icon: <Ban className="w-5 h-5 text-rose-500" />,
    title: 'العقوبات والإجراءات',
    content: 'يحق للإدارة تحذير المستخدمين المخالفين. قد يتم حظر الحساب مؤقتاً أو نهائياً حسب خطورة المخالفة. يُنظر في البلاغات المقدمة من المستخدمين بعناية. يحق للمستخدم الطعن في أي قرار عبر التواصل مع الدعم.',
  },
  {
    icon: <Heart className="w-5 h-5 text-pink-500" />,
    title: 'الخصوصية وحماية البيانات',
    content: 'نحترم خصوصية المستخدمين ولا نشارك بياناتهم مع أطراف ثالثة. يتم تخزين البيانات بشكل آمن على خوادم محمية. يمكن للمستخدم طلب حذف بياناته الشخصية في أي وقت. نلتزم بأفضل ممارسات حماية البيانات.',
  },
];

export const PolicyScreen: React.FC = () => {
  const setSubScreen = useAppStore(s => s.setSubScreen);

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
              <FileText className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-white text-lg font-bold">سياسة الاستخدام</h1>
              <p className="text-teal-300/60 text-[11px]">شروط وقواعد استخدام المنصة</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 -mt-4 space-y-3">
        {sections.map((section, index) => (
          <div key={index} className="bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border)] shadow-sm">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-9 h-9 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                {section.icon}
              </div>
              <h2 className="text-[14px] font-bold text-[var(--color-text)]">{section.title}</h2>
            </div>
            <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed pr-1">{section.content}</p>
          </div>
        ))}

        <div className="bg-emerald-50/40 dark:bg-emerald-900/10 rounded-2xl p-4 border border-emerald-100/40 dark:border-emerald-800/30 text-center">
          <p className="text-[12px] text-emerald-600 dark:text-emerald-400">آخر تحديث: مايو ٢٠٢٥</p>
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-1">في حال وجود أي استفسار، يرجى التواصل مع فريق الدعم</p>
        </div>
      </div>
    </div>
  );
};

'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench, Trash2, Clock, AlertTriangle,
  Download, Users, Package, Tag, RefreshCw, Loader2,
  Archive
} from 'lucide-react';
import { DataCard, SectionHeader, LoadingSpinner } from '@/components/admin/AdminShared';
import { Button } from '@/components/market/Button';
import toast from 'react-hot-toast';

interface MaintenanceStats {
  expiredProducts: number;
  expiredOffers: number;
  inactiveUsers: number;
  lastBackupDate: string | null;
  totalBackups: number;
}

export const MaintenancePanel: React.FC = () => {
  const [stats, setStats] = useState<MaintenanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/maintenance');
      const json = await res.json();
      if (json.success && json.data) {
        setStats(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch maintenance stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const runAction = async (action: string, successMsg: string) => {
    setActionLoading(action);
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(json.data?.message || successMsg);
        fetchStats();
      } else {
        toast.error(json.error || 'فشل تنفيذ الإجراء');
      }
    } catch {
      toast.error('حدث خطأ أثناء تنفيذ الإجراء');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <LoadingSpinner message="جاري تحميل بيانات الصيانة..." />;
  if (!stats) return <div className="text-center py-8 text-rose-500">فشل تحميل بيانات الصيانة</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h2 className="text-[16px] font-black text-[var(--color-text)]">أدوات الصيانة</h2>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">تنظيف المحتوى المنتهي والنسخ الاحتياطي</p>
          </div>
        </div>
        <button
          onClick={() => { setLoading(true); fetchStats(); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          تحديث
        </button>
      </div>

      {/* Expired Content Cleanup */}
      <DataCard>
        <SectionHeader title="تنظيف المحتوى المنتهي" subtitle="حذف المنتجات والعروض منتهية الصلاحية" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Expired Products */}
          <div className="bg-amber-50/30 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100/40 dark:border-amber-800/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Package className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-[var(--color-text)]">منتجات منتهية</p>
                <p className="text-[20px] font-black text-amber-600">{stats.expiredProducts}</p>
              </div>
            </div>
            <p className="text-[11px] text-[var(--color-text-tertiary)] mb-3">منتجات تجاوزت تاريخ الانتهاء ولم تعد ظاهرة</p>
            <Button
              variant="danger"
              fullWidth
              disabled={stats.expiredProducts === 0 || actionLoading === 'cleanExpiredProducts'}
              onClick={() => runAction('cleanExpiredProducts', 'تم حذف المنتجات المنتهية')}
              icon={actionLoading === 'cleanExpiredProducts' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            >
              {actionLoading === 'cleanExpiredProducts' ? 'جاري الحذف...' : `حذف ${stats.expiredProducts} منتج`}
            </Button>
          </div>

          {/* Expired Offers */}
          <div className="bg-rose-50/30 dark:bg-rose-900/10 rounded-xl p-4 border border-rose-100/40 dark:border-rose-800/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                <Tag className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-[var(--color-text)]">عروض منتهية</p>
                <p className="text-[20px] font-black text-rose-600">{stats.expiredOffers}</p>
              </div>
            </div>
            <p className="text-[11px] text-[var(--color-text-tertiary)] mb-3">عروض ومسابقات تجاوزت تاريخ الانتهاء</p>
            <Button
              variant="danger"
              fullWidth
              disabled={stats.expiredOffers === 0 || actionLoading === 'cleanExpiredOffers'}
              onClick={() => runAction('cleanExpiredOffers', 'تم حذف العروض المنتهية')}
              icon={actionLoading === 'cleanExpiredOffers' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            >
              {actionLoading === 'cleanExpiredOffers' ? 'جاري الحذف...' : `حذف ${stats.expiredOffers} عرض`}
            </Button>
          </div>
        </div>
      </DataCard>

      {/* Inactive Users */}
      <DataCard>
        <SectionHeader title="المستخدمون غير النشطين" subtitle="مستخدمون لم يسجلوا دخولاً منذ 90 يوماً" />
        <div className="bg-slate-50/30 dark:bg-slate-800/20 rounded-xl p-4 border border-slate-200/40 dark:border-slate-700/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <Users className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[var(--color-text)]">مستخدمون غير نشطين</p>
              <p className="text-[20px] font-black text-slate-600">{stats.inactiveUsers}</p>
            </div>
          </div>
          <p className="text-[11px] text-[var(--color-text-tertiary)] mb-3">
            هؤلاء المستخدمون لم يظهروا أي نشاط في آخر 90 يوماً. لن يتم حذف المديرين.
          </p>

          {stats.inactiveUsers > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5 mb-3 border border-amber-100/40 dark:border-amber-800/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-amber-600 dark:text-amber-400">تحذير: سيتم حذف المستخدمين نهائياً مع جميع متاجرهم ومنتجاتهم</p>
              </div>
            </div>
          )}

          <Button
            variant="danger"
            fullWidth
            disabled={stats.inactiveUsers === 0 || actionLoading === 'deleteInactiveUsers'}
            onClick={() => {
              if (confirm(`هل أنت متأكد من حذف ${stats.inactiveUsers} مستخدم غير نشط؟ هذا الإجراء لا يمكن التراجع عنه.`)) {
                runAction('deleteInactiveUsers', 'تم حذف المستخدمين غير النشطين');
              }
            }}
            icon={actionLoading === 'deleteInactiveUsers' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          >
            {actionLoading === 'deleteInactiveUsers' ? 'جاري الحذف...' : `حذف ${stats.inactiveUsers} مستخدم غير نشط`}
          </Button>
        </div>
      </DataCard>

      {/* Backup */}
      <DataCard>
        <SectionHeader title="النسخ الاحتياطي" subtitle="إنشاء نسخة احتياطية من قاعدة البيانات" />
        <div className="bg-emerald-50/30 dark:bg-emerald-900/10 rounded-xl p-4 border border-emerald-100/40 dark:border-emerald-800/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Archive className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-[var(--color-text)]">قاعدة البيانات</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                <p className="text-[11px] text-[var(--color-text-tertiary)]">
                  آخر نسخة: {stats.lastBackupDate ? new Date(stats.lastBackupDate).toLocaleString('ar-SY') : 'لا توجد نسخ'}
                </p>
              </div>
            </div>
            {stats.totalBackups > 0 && (
              <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
                {stats.totalBackups} نسخة
              </span>
            )}
          </div>

          <Button
            variant="primary"
            fullWidth
            disabled={actionLoading === 'backupDatabase'}
            onClick={() => runAction('backupDatabase', 'تم إنشاء النسخة الاحتياطية')}
            icon={actionLoading === 'backupDatabase' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          >
            {actionLoading === 'backupDatabase' ? 'جاري الإنشاء...' : 'إنشاء نسخة احتياطية'}
          </Button>
        </div>
      </DataCard>
    </div>
  );
};

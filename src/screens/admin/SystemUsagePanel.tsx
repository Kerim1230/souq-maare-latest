'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Database, Cloud, HardDrive, RefreshCw, Clock, Users, Store,
  Package, Tag, AlertTriangle, Info,
  BarChart3, ArrowRightLeft,
} from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';

// ── Types ──────────────────────────────────────────────────────────────────
interface DatabaseUsage {
  sizeBytes: number;
  sizeMB: number;
  limitMB: number;
  percent: number;
  remainingMB: number;
  plan: string;
}

interface CloudinaryStorage {
  usedBytes: number;
  usedGB: number;
  limitGB: number;
  percent: number;
  remainingGB: number;
}

interface CloudinaryTransformations {
  usage: number;
  limit: number;
  percent: number;
  remaining: number;
}

interface CloudinaryBandwidth {
  usedBytes: number;
  usedGB: number;
  limitGB: number;
  percent: number;
  remainingGB: number;
}

interface CloudinaryCredits {
  usage: number;
  limit: number;
  percent: number;
  remaining: number;
}

interface CloudinaryUsage {
  available: boolean;
  error?: string;
  storage?: CloudinaryStorage;
  transformations?: CloudinaryTransformations;
  bandwidth?: CloudinaryBandwidth;
  credits?: CloudinaryCredits;
  rateLimit?: { remaining: number | null; resetAt: string | null };
  lastUpdated?: string | null;
}

interface SystemCounts {
  users: number;
  stores: number;
  products: number;
  offers: number;
}

interface SystemUsageData {
  database: DatabaseUsage;
  cloudinary: CloudinaryUsage;
  counts: SystemCounts;
  timestamp: string;
  cached?: boolean;
  cachedAgo?: number;
}

// ── Progress Bar Component ─────────────────────────────────────────────────
const ProgressBar: React.FC<{
  percent: number;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ percent, color, size = 'md' }) => {
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const height = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-5' : 'h-3';

  const getBarColor = () => {
    if (color) return color;
    if (clampedPercent >= 90) return 'bg-red-500';
    if (clampedPercent >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full ${height} overflow-hidden`}>
      <div
        className={`${height} rounded-full transition-all duration-500 ease-out ${getBarColor()}`}
        style={{ width: `${clampedPercent}%` }}
      />
    </div>
  );
};

// ── Circular Progress Component ────────────────────────────────────────────
const CircularProgress: React.FC<{
  percent: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  sublabel?: string;
  color?: string;
}> = ({ percent, size = 100, strokeWidth = 8, label, sublabel, color }) => {
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedPercent / 100) * circumference;

  const getColor = () => {
    if (color) return color;
    if (clampedPercent >= 90) return '#ef4444';
    if (clampedPercent >= 70) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-gray-200 dark:text-gray-700"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-lg font-black" style={{ color: getColor() }}>
          {clampedPercent.toFixed(1)}%
        </span>
      </div>
      <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-2 text-center">{label}</p>
      {sublabel && <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-0.5">{sublabel}</p>}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────
export const SystemUsagePanel: React.FC = () => {
  const [data, setData] = useState<SystemUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    setRefreshing(true);
    try {
      const url = forceRefresh ? '/api/admin/system-usage?refresh=1' : '/api/admin/system-usage';
      const result = await fetchApi<SystemUsageData>(url);
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setData(result.data);
        setError(null);
      }
    } catch {
      setError('فشل في جلب بيانات النظام');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Format relative time
  const formatTimeAgo = (isoString: string) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    return `منذ ${hours} ساعة`;
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800/60 rounded-2xl shadow-sm p-5 animate-pulse">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-white dark:bg-gray-800/60 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-14 h-14 bg-rose-50 dark:bg-rose-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-7 h-7 text-rose-400" />
        </div>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">فشل في تحميل البيانات</p>
        <p className="text-xs text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => fetchData()}
          className="px-5 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!data) return null;

  const dbPercent = data.database.percent;
  const dbColor = dbPercent >= 90 ? '#ef4444' : dbPercent >= 70 ? '#f59e0b' : '#10b981';

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-500" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">استخدام الموارد</h3>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {/* Last updated */}
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
        <Clock className="w-3 h-3" />
        <span>
          {data.cached && data.cachedAgo
            ? `تم التحديث منذ ${data.cachedAgo} ثانية`
            : `آخر تحديث: ${formatTimeAgo(data.timestamp)}`}
        </span>
      </div>

      {/* ═══ 1. Database Card ═══ */}
      <div className="bg-white dark:bg-gray-800/60 rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
            <Database className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">قاعدة البيانات (Supabase)</h4>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">باقة {data.database.plan} — حد {data.database.limitMB} ميغابايت</p>
          </div>
        </div>

        {/* Circular progress */}
        <div className="flex justify-center mb-4 relative">
          <CircularProgress
            percent={dbPercent}
            size={120}
            strokeWidth={10}
            label="مساحة مستخدمة"
            sublabel={`${data.database.sizeMB} MB / ${data.database.limitMB} MB`}
            color={dbColor}
          />
        </div>

        {/* Linear progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-gray-500 dark:text-gray-400">{data.database.sizeMB} MB مستخدم</span>
            <span className="font-bold" style={{ color: dbColor }}>{dbPercent.toFixed(1)}%</span>
          </div>
          <ProgressBar percent={dbPercent} size="md" />
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{data.database.remainingMB}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">ميغابايت متبقية</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3 text-center">
            <p className="text-lg font-black text-gray-700 dark:text-gray-300">{data.database.sizeMB}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">ميغابايت مستخدمة</p>
          </div>
        </div>

        {dbPercent >= 80 && (
          <div className="mt-3 flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-100 dark:border-amber-800/30">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
              {dbPercent >= 90
                ? 'مساحة قاعدة البيانات تكاد تنفد! يرجى ترقية الباقة أو حذف بيانات قديمة.'
                : 'مساحة قاعدة البيانات تقل. فكر في ترقية الباقة قريباً.'}
            </p>
          </div>
        )}
      </div>

      {/* ═══ 2. Cloudinary Card ═══ */}
      <div className="bg-white dark:bg-gray-800/60 rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center">
            <Cloud className="w-5 h-5 text-sky-500" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">تخزين الصور (Cloudinary)</h4>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">باقة مجانية — حد 25 جيجابايت</p>
          </div>
        </div>

        {!data.cloudinary.available ? (
          <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 text-center">
            <Info className="w-5 h-5 text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-400 dark:text-gray-500">{data.cloudinary.error || 'بيانات Cloudinary غير متاحة'}</p>
          </div>
        ) : (
          <>
            {/* Circular gauges row */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {data.cloudinary.storage && (
                <div className="flex justify-center relative">
                  <CircularProgress
                    percent={data.cloudinary.storage.percent}
                    size={100}
                    strokeWidth={8}
                    label="التخزين"
                    sublabel={`${data.cloudinary.storage.usedGB} GB / ${data.cloudinary.storage.limitGB} GB`}
                  />
                </div>
              )}
              {data.cloudinary.transformations && (
                <div className="flex justify-center relative">
                  <CircularProgress
                    percent={data.cloudinary.transformations.percent}
                    size={100}
                    strokeWidth={8}
                    label="التحويلات"
                    sublabel={`${data.cloudinary.transformations.usage.toLocaleString()} / ${data.cloudinary.transformations.limit.toLocaleString()}`}
                  />
                </div>
              )}
            </div>

            {/* Linear bars */}
            <div className="space-y-3">
              {data.cloudinary.storage && (
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <HardDrive className="w-3 h-3" /> التخزين
                    </span>
                    <span className="font-bold text-gray-700 dark:text-gray-300">{data.cloudinary.storage.percent.toFixed(1)}%</span>
                  </div>
                  <ProgressBar percent={data.cloudinary.storage.percent} size="sm" />
                </div>
              )}
              {data.cloudinary.bandwidth && (
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <ArrowRightLeft className="w-3 h-3" /> النطاق الترددي
                    </span>
                    <span className="font-bold text-gray-700 dark:text-gray-300">{data.cloudinary.bandwidth.percent.toFixed(1)}%</span>
                  </div>
                  <ProgressBar percent={data.cloudinary.bandwidth.percent} size="sm" />
                </div>
              )}
              {data.cloudinary.credits && (
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-gray-500 dark:text-gray-400">الأرصدة</span>
                    <span className="font-bold text-gray-700 dark:text-gray-300">{data.cloudinary.credits.usage} / {data.cloudinary.credits.limit}</span>
                  </div>
                  <ProgressBar percent={data.cloudinary.credits.percent} size="sm" />
                </div>
              )}
            </div>

            {/* Remaining info */}
            <div className="grid grid-cols-2 gap-2 mt-3">
              {data.cloudinary.storage && (
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3 text-center">
                  <p className="text-sm font-black text-sky-600 dark:text-sky-400">{data.cloudinary.storage.remainingGB}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">جيجابايت متبقية</p>
                </div>
              )}
              {data.cloudinary.transformations && (
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3 text-center">
                  <p className="text-sm font-black text-sky-600 dark:text-sky-400">{data.cloudinary.transformations.remaining.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">تحويلات متبقية</p>
                </div>
              )}
            </div>

            {/* Rate limit */}
            {data.cloudinary.rateLimit && data.cloudinary.rateLimit.remaining !== null && (
              <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
                <Info className="w-3 h-3" />
                <span>حد API المتبقي: {data.cloudinary.rateLimit.remaining} طلب</span>
                {data.cloudinary.rateLimit.resetAt && (
                  <span>• إعادة التعيين: {new Date(Number(data.cloudinary.rateLimit.resetAt) * 1000).toLocaleTimeString('ar-SY')}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ 3. Table Counts Card ═══ */}
      <div className="bg-white dark:bg-gray-800/60 rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-violet-500" />
          </div>
          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">إحصائيات قاعدة البيانات</h4>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50/50 dark:bg-emerald-900/20 rounded-xl p-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{data.counts.users.toLocaleString('ar-SY')}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">مستخدم</p>
            </div>
          </div>
          <div className="bg-teal-50/50 dark:bg-teal-900/20 rounded-xl p-4 flex items-center gap-3">
            <Store className="w-5 h-5 text-teal-500" />
            <div>
              <p className="text-lg font-black text-teal-700 dark:text-teal-400">{data.counts.stores.toLocaleString('ar-SY')}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">متجر</p>
            </div>
          </div>
          <div className="bg-sky-50/50 dark:bg-sky-900/20 rounded-xl p-4 flex items-center gap-3">
            <Package className="w-5 h-5 text-sky-500" />
            <div>
              <p className="text-lg font-black text-sky-700 dark:text-sky-400">{data.counts.products.toLocaleString('ar-SY')}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">منتج</p>
            </div>
          </div>
          <div className="bg-amber-50/50 dark:bg-amber-900/20 rounded-xl p-4 flex items-center gap-3">
            <Tag className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-lg font-black text-amber-700 dark:text-amber-400">{data.counts.offers.toLocaleString('ar-SY')}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">عرض/مسابقة</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 4. Details Table ═══ */}
      <div className="bg-white dark:bg-gray-800/60 rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <Info className="w-5 h-5 text-gray-500" />
          </div>
          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">تفاصيل خام</h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-right py-2 px-3 font-bold text-gray-500 dark:text-gray-400">المورد</th>
                <th className="text-right py-2 px-3 font-bold text-gray-500 dark:text-gray-400">المستخدم</th>
                <th className="text-right py-2 px-3 font-bold text-gray-500 dark:text-gray-400">الحد</th>
                <th className="text-right py-2 px-3 font-bold text-gray-500 dark:text-gray-400">النسبة</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-50 dark:border-gray-700/50">
                <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Supabase DB</td>
                <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{data.database.sizeMB} MB</td>
                <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{data.database.limitMB} MB</td>
                <td className="py-2 px-3 font-bold" style={{ color: dbColor }}>{dbPercent.toFixed(2)}%</td>
              </tr>
              {data.cloudinary.available && data.cloudinary.storage && (
                <tr className="border-b border-gray-50 dark:border-gray-700/50">
                  <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Cloudinary Storage</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{data.cloudinary.storage.usedGB} GB</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{data.cloudinary.storage.limitGB} GB</td>
                  <td className="py-2 px-3 font-bold text-sky-600 dark:text-sky-400">{data.cloudinary.storage.percent.toFixed(2)}%</td>
                </tr>
              )}
              {data.cloudinary.available && data.cloudinary.transformations && (
                <tr className="border-b border-gray-50 dark:border-gray-700/50">
                  <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Cloudinary Transforms</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{data.cloudinary.transformations.usage.toLocaleString()}</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{data.cloudinary.transformations.limit.toLocaleString()}</td>
                  <td className="py-2 px-3 font-bold text-sky-600 dark:text-sky-400">{data.cloudinary.transformations.percent.toFixed(2)}%</td>
                </tr>
              )}
              {data.cloudinary.available && data.cloudinary.bandwidth && (
                <tr className="border-b border-gray-50 dark:border-gray-700/50">
                  <td className="py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Cloudinary Bandwidth</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{data.cloudinary.bandwidth.usedGB} GB</td>
                  <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{data.cloudinary.bandwidth.limitGB} GB</td>
                  <td className="py-2 px-3 font-bold text-sky-600 dark:text-sky-400">{data.cloudinary.bandwidth.percent.toFixed(2)}%</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SQL instruction note */}
      {data.database.sizeBytes === 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-100 dark:border-amber-800/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">وظيفة حجم قاعدة البيانات غير مفعّلة</p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                شغّل هذا SQL في Supabase SQL Editor لتفعيل قياس حجم قاعدة البيانات:
              </p>
              <code className="block mt-2 p-2 bg-amber-100/50 dark:bg-amber-900/30 rounded-lg text-[10px] font-mono text-amber-800 dark:text-amber-300 leading-relaxed whitespace-pre-wrap dir-ltr" dir="ltr">
{`CREATE OR REPLACE FUNCTION get_database_size()
RETURNS bigint AS $$
BEGIN
  RETURN pg_database_size(current_database());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

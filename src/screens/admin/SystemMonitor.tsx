'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Database, HardDrive, Server, Users, Store, Package,
  Tag, Flag, AlertTriangle, Trash2, RefreshCw, Clock, Cpu,
  CheckCircle2, Zap
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DataCard, SectionHeader, LoadingSpinner, StatCard } from '@/components/admin/AdminShared';

interface SystemHealthData {
  server: { status: string; uptime: number; nodeVersion: string };
  database: { status: string };
  storage: { status: string; path: string };
  activeUsers: number;
  stats: {
    totalUsers: number;
    activeUsersToday: number;
    totalStores: number;
    totalProducts: number;
    activeOffers: number;
    pendingReports: number;
    newProducts7d: number;
    newUsers7d: number;
  };
  charts: {
    productsByDay: { date: string; count: number }[];
    usersByDay: { date: string; count: number }[];
  };
  recentErrors: { id: string; time: string; type: string; message: string }[];
  memory: { rss: number; heapUsed: number; heapTotal: number };
  timestamp: string;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} يوم`);
  if (hours > 0) parts.push(`${hours} ساعة`);
  if (minutes > 0) parts.push(`${minutes} دقيقة`);
  return parts.length > 0 ? parts.join(' و') : 'أقل من دقيقة';
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return days[d.getDay()];
}

export const SystemMonitor: React.FC = () => {
  const [data, setData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system-health');
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch system health:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) return <LoadingSpinner message="جاري تحميل بيانات النظام..." />;
  if (!data) return <div className="text-center py-8 text-rose-500">فشل تحميل بيانات النظام</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
            <Activity className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-[16px] font-black text-[var(--color-text)]">مراقبة النظام</h2>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">آخر تحديث: {new Date(data.timestamp).toLocaleTimeString('ar-SY')}</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {/* Live Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatusIndicator icon={<Server className="w-4 h-4" />} label="الخادم" status={data.server.status === 'connected'} />
        <StatusIndicator icon={<Database className="w-4 h-4" />} label="قاعدة البيانات" status={data.database.status === 'connected'} />
        <StatusIndicator icon={<HardDrive className="w-4 h-4" />} label="التخزين" status={data.storage.status === 'connected'} />
        <StatusIndicator icon={<Users className="w-4 h-4" />} label="نشطون الآن" status={true} count={data.activeUsers} />
        <StatusIndicator icon={<Clock className="w-4 h-4" />} label="وقت التشغيل" status={true} uptime={formatUptime(data.server.uptime)} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="إجمالي المستخدمين" count={data.stats.totalUsers} color="emerald" icon={<Users className="w-4 h-4" />} />
        <StatCard label="نشطون اليوم" count={data.stats.activeUsersToday} color="teal" icon={<Activity className="w-4 h-4" />} />
        <StatCard label="إجمالي المتاجر" count={data.stats.totalStores} color="sky" icon={<Store className="w-4 h-4" />} />
        <StatCard label="إجمالي المنتجات" count={data.stats.totalProducts} color="amber" icon={<Package className="w-4 h-4" />} />
        <StatCard label="العروض النشطة" count={data.stats.activeOffers} color="violet" icon={<Tag className="w-4 h-4" />} />
        <StatCard label="البلاغات المعلقة" count={data.stats.pendingReports} color="rose" icon={<Flag className="w-4 h-4" />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataCard>
          <SectionHeader title="المنتجات الجديدة (آخر 7 أيام)" />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts.productsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid var(--color-border)' }} />
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} name="منتجات" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DataCard>

        <DataCard>
          <SectionHeader title="المستخدمون الجدد (آخر 7 أيام)" />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts.usersByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid var(--color-border)' }} />
                <Line type="monotone" dataKey="count" stroke="#14b8a6" strokeWidth={2} dot={{ r: 4, fill: '#14b8a6' }} name="مستخدمون" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DataCard>
      </div>

      {/* Memory & Server Info */}
      <DataCard>
        <SectionHeader title="معلومات الخادم" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-emerald-50/30 dark:bg-emerald-900/10 rounded-xl p-3 text-center">
            <Cpu className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-[11px] text-[var(--color-text-tertiary)]">Node.js</p>
            <p className="text-[13px] font-bold text-[var(--color-text)]">{data.server.nodeVersion}</p>
          </div>
          <div className="bg-teal-50/30 dark:bg-teal-900/10 rounded-xl p-3 text-center">
            <Zap className="w-5 h-5 text-teal-500 mx-auto mb-1" />
            <p className="text-[11px] text-[var(--color-text-tertiary)]">RSS الذاكرة</p>
            <p className="text-[13px] font-bold text-[var(--color-text)]">{data.memory.rss} MB</p>
          </div>
          <div className="bg-amber-50/30 dark:bg-amber-900/10 rounded-xl p-3 text-center">
            <Activity className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-[11px] text-[var(--color-text-tertiary)]">Heap مستخدم</p>
            <p className="text-[13px] font-bold text-[var(--color-text)]">{data.memory.heapUsed} MB</p>
          </div>
          <div className="bg-sky-50/30 dark:bg-sky-900/10 rounded-xl p-3 text-center">
            <Clock className="w-5 h-5 text-sky-500 mx-auto mb-1" />
            <p className="text-[11px] text-[var(--color-text-tertiary)]">وقت التشغيل</p>
            <p className="text-[13px] font-bold text-[var(--color-text)]">{formatUptime(data.server.uptime)}</p>
          </div>
        </div>
      </DataCard>

      {/* Recent Errors */}
      <DataCard>
        <div className="flex items-center justify-between mb-3">
          <SectionHeader title="سجل الأخطاء الأخيرة" />
          {data.recentErrors.length > 0 && (
            <button
              onClick={() => setData(prev => prev ? { ...prev, recentErrors: [] } : prev)}
              className="flex items-center gap-1 text-[10px] font-bold text-rose-400 hover:text-rose-500 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              مسح
            </button>
          )}
        </div>
        {data.recentErrors.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
            <p className="text-[12px] text-[var(--color-text-tertiary)]">لا توجد أخطاء مسجلة</p>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {data.recentErrors.map((err, idx) => (
              <div key={err.id || idx} className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-rose-50/30 dark:bg-rose-900/10">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-rose-500">{err.type}</span>
                    <span className="text-[9px] text-[var(--color-text-tertiary)]">{new Date(err.time).toLocaleString('ar-SY')}</span>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{err.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  );
};

// Status Indicator sub-component
const StatusIndicator: React.FC<{
  icon: React.ReactNode;
  label: string;
  status: boolean;
  count?: number;
  uptime?: string;
}> = ({ icon, label, status, count, uptime }) => (
  <div className={`bg-[var(--color-surface)] rounded-2xl border p-3 shadow-sm ${status ? 'border-emerald-200/60' : 'border-rose-200/60'}`}>
    <div className="flex items-center gap-2 mb-1.5">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${status ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600'}`}>
        {icon}
      </div>
      <span className={`w-2.5 h-2.5 rounded-full ${status ? 'bg-emerald-400' : 'bg-rose-400'} ${status ? 'animate-pulse' : ''}`} />
    </div>
    <p className="text-[11px] text-[var(--color-text-tertiary)] font-medium">{label}</p>
    <p className={`text-[14px] font-black ${status ? 'text-emerald-600' : 'text-rose-500'}`}>
      {count !== undefined ? count : uptime || (status ? 'متصل' : 'متوقف')}
    </p>
  </div>
);

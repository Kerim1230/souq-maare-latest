'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bug,
  CheckCircle2,
  Cpu,
  Database,
  Globe,
  Layers,
  MemoryStick,
  Monitor,
  Radio,
  RefreshCw,
  Shield,
  Trash2,
  Wifi,
  WifiOff,
  XCircle,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/market/Button';
import { useServiceHealthStore, type ServiceStatus } from '@/store/serviceHealthStore';

// ============================================================================
// Types
// ============================================================================

interface EventLogEntry {
  id: string;
  timestamp: number;
  source: string;
  message: string;
  type: 'info' | 'warn' | 'error';
}

interface ErrorLogEntry {
  id: string;
  timestamp: number;
  source: string;
  message: string;
  type: 'error' | 'promise';
  count: number;
}

interface FPSMetrics {
  current: number;
  average: number;
  min: number;
  max: number;
  spikeCount: number;
}

interface LongTaskEntry {
  id: string;
  timestamp: number;
  duration: number;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface StoreInfo {
  name: string;
  approxSize: number;
}

// ============================================================================
// Helpers
// ============================================================================

const STATUS_ICON: Record<ServiceStatus, React.ReactNode> = {
  connected: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  degraded: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  disconnected: <XCircle className="w-4 h-4 text-rose-400" />,
};

const STATUS_LABEL: Record<ServiceStatus, string> = {
  connected: 'متصل',
  degraded: 'تنبيه',
  disconnected: 'غير متصل',
};

const STATUS_DOT: Record<ServiceStatus, string> = {
  connected: 'bg-emerald-400',
  degraded: 'bg-amber-400',
  disconnected: 'bg-rose-400',
};

const STATUS_RING: Record<ServiceStatus, string> = {
  connected: 'ring-emerald-500/20',
  degraded: 'ring-amber-500/20',
  disconnected: 'ring-rose-500/20',
};

let _idCounter = 0;
function uid(): string {
  return `${Date.now()}-${++_idCounter}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} ث`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 1000) return 'الآن';
  if (diff < 60_000) return `منذ ${Math.floor(diff / 1000)} ث`;
  if (diff < 3_600_000) return `منذ ${Math.floor(diff / 60_000)} د`;
  return `منذ ${Math.floor(diff / 3_600_000)} س`;
}

function approximateStateSize(obj: unknown): number {
  try {
    return new Blob([JSON.stringify(obj)]).size;
  } catch {
    return 0;
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

/** A single metric tile */
const MetricTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  color?: 'emerald' | 'amber' | 'rose' | 'slate';
}> = ({ icon, label, value, sub, color = 'slate' }) => {
  const colorMap = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    slate: 'text-[var(--color-text-secondary)]',
  };
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-[var(--color-bg)]/50">
      <div className="w-8 h-8 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-[var(--color-text-tertiary)] font-medium">{label}</p>
        <p className={`text-[14px] font-bold text-[var(--color-text)] ${sub ? '' : 'mt-0.5'}`}>
          {value}
        </p>
        {sub && (
          <p className={`text-[10px] font-medium ${colorMap[color]} mt-0.5`}>{sub}</p>
        )}
      </div>
    </div>
  );
};

/** A section card wrapper */
const SectionCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, icon, children, action }) => (
  <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]/60">
      <div className="flex items-center gap-2">
        <span className="text-emerald-400">{icon}</span>
        <h3 className="text-[13px] font-bold text-[var(--color-text)]">{title}</h3>
      </div>
      {action}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const MonitoringDashboard: React.FC = () => {
  // ── Service Health Store ──
  const services = useServiceHealthStore((s) => s.services);
  const refreshAll = useServiceHealthStore((s) => s.refreshAll);

  // ── Network Status ──
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  // ── Memory Info ──
  const [memory, setMemory] = useState<MemoryInfo | null>(null);

  // ── FPS Metrics ──
  const [fps, setFps] = useState<FPSMetrics>({
    current: 0,
    average: 60,
    min: 60,
    max: 60,
    spikeCount: 0,
  });

  // ── Event Stream ──
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const eventsRef = useRef<EventLogEntry[]>([]);

  // ── Error Timeline ──
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const errorsRef = useRef<ErrorLogEntry[]>([]);

  // ── Long Tasks ──
  const [longTasks, setLongTasks] = useState<LongTaskEntry[]>([]);
  const longTasksRef = useRef<LongTaskEntry[]>([]);

  // ── Store Monitor ──
  const [storeInfo, setStoreInfo] = useState<StoreInfo[]>([]);

  // ── Refreshing state ──
  const [refreshing, setRefreshing] = useState(false);

  // ── Refs for cleanup ──
  const rafRef = useRef<number>(0);
  const fpsHistoryRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(0);
  const memoryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const storeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longTaskObserverRef = useRef<PerformanceObserver | null>(null);

  // ========================================================================
  // Helpers: push events / errors
  // ========================================================================

  const pushEvent = useCallback((source: string, message: string, type: EventLogEntry['type'] = 'info') => {
    const entry: EventLogEntry = { id: uid(), timestamp: Date.now(), source, message, type };
    eventsRef.current = [entry, ...eventsRef.current].slice(0, 20);
    setEvents([...eventsRef.current]);
  }, []);

  const pushError = useCallback((source: string, message: string, type: ErrorLogEntry['type'] = 'error') => {
    const key = `${type}:${source}:${message}`;
    const existing = errorsRef.current.find((e) => `${e.type}:${e.source}:${e.message}` === key);
    if (existing) {
      errorsRef.current = errorsRef.current.map((e) =>
        e.id === existing.id ? { ...e, count: e.count + 1, timestamp: Date.now() } : e,
      );
      setDuplicateCount((c) => c + 1);
    } else {
      const entry: ErrorLogEntry = { id: uid(), timestamp: Date.now(), source, message, type, count: 1 };
      errorsRef.current = [entry, ...errorsRef.current].slice(0, 50);
    }
    setErrors([...errorsRef.current]);
  }, []);

  // ========================================================================
  // Error Listeners
  // ========================================================================

  useEffect(() => {
    const handleOnError = (ev: ErrorEvent) => {
      pushError(ev.filename || 'غير معروف', ev.message, 'error');
    };

    const handleUnhandledRejection = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason;
      const msg = reason instanceof Error ? reason.message : String(reason);
      pushError('Promise', msg, 'promise');
    };

    window.addEventListener('error', handleOnError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleOnError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [pushError]);

  // ========================================================================
  // Network listener
  // ========================================================================

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      pushEvent('الشبكة', 'تم استعادة الاتصال بالإنترنت', 'info');
    };
    const onOffline = () => {
      setIsOnline(false);
      pushEvent('الشبكة', 'تم فقدان الاتصال بالإنترنت', 'warn');
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [pushEvent]);

  // ========================================================================
  // Memory polling
  // ========================================================================

  useEffect(() => {
    const perf = performance as Performance & { memory?: MemoryInfo };

    const readMemory = () => {
      if (perf.memory) {
        setMemory({
          usedJSHeapSize: perf.memory.usedJSHeapSize,
          totalJSHeapSize: perf.memory.totalJSHeapSize,
          jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
        });
      }
    };

    readMemory();
    memoryIntervalRef.current = setInterval(readMemory, 3000);

    return () => {
      if (memoryIntervalRef.current) clearInterval(memoryIntervalRef.current);
    };
  }, []);

  // ========================================================================
  // Long Task Observer
  // ========================================================================

  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const duration = entry.duration;
          if (duration > 50) {
            const task: LongTaskEntry = { id: uid(), timestamp: Date.now(), duration };
            longTasksRef.current = [task, ...longTasksRef.current].slice(0, 20);
            setLongTasks([...longTasksRef.current]);
            pushEvent('Long Task', `مهمة طويلة: ${formatDuration(duration)}`, duration > 200 ? 'error' : 'warn');
          }
        }
      });

      observer.observe({ type: 'longtask', buffered: true });
      longTaskObserverRef.current = observer;
    } catch {
      // longtask not supported
    }

    return () => {
      longTaskObserverRef.current?.disconnect();
    };
  }, [pushEvent]);

  // ========================================================================
  // FPS start/stop
  // ========================================================================

  useEffect(() => {
    lastFpsUpdateRef.current = performance.now();

    const tick = (now: number) => {
      frameCountRef.current += 1;

      // Update FPS display every 500ms
      if (now - lastFpsUpdateRef.current >= 500) {
        const elapsed = now - lastFpsUpdateRef.current;
        const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;

        fpsHistoryRef.current.push(currentFps);
        if (fpsHistoryRef.current.length > 120) fpsHistoryRef.current.shift();

        const avg = Math.round(fpsHistoryRef.current.reduce((a, b) => a + b, 0) / fpsHistoryRef.current.length);
        const min = Math.min(...fpsHistoryRef.current);
        const max = Math.max(...fpsHistoryRef.current);

        // Spike detection: FPS drops below 30
        const spikeThreshold = 30;
        const spikeCount = fpsHistoryRef.current.filter((f) => f < spikeThreshold).length;

        setFps({ current: currentFps, average: avg, min, max, spikeCount });
      }

      lastFrameTimeRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ========================================================================
  // Store monitoring
  // ========================================================================

  useEffect(() => {
    const detectStores = () => {
      try {
        // Zustand stores expose getState on the creator or directly
        // We look for common __store patterns on window / known stores
        const stores: StoreInfo[] = [];

        // Try to detect stores from known imports
        // We check window.__ZUSTAND_STORES__ if set, or just list known stores
        const knownStores = [
          { name: 'serviceHealthStore', getState: () => useServiceHealthStore.getState() },
        ];

        for (const store of knownStores) {
          try {
            const state = store.getState();
            const size = approximateStateSize(state);
            stores.push({ name: store.name, approxSize: size });
          } catch {
            stores.push({ name: store.name, approxSize: 0 });
          }
        }

        // Check for additional zustand stores on window
        if (typeof window !== 'undefined') {
          const win = window as unknown as Record<string, unknown>;
          for (const key of Object.keys(win)) {
            if (key.startsWith('__') && key.includes('store')) {
              const val = win[key];
              if (val && typeof val === 'object' && 'getState' in val) {
                try {
                  const state = (val as { getState: () => unknown }).getState();
                  const size = approximateStateSize(state);
                  stores.push({ name: key, approxSize: size });
                } catch {
                  // skip
                }
              }
            }
          }
        }

        setStoreInfo(stores);
      } catch {
        // Silently fail
      }
    };

    detectStores();
    storeIntervalRef.current = setInterval(detectStores, 5000);

    return () => {
      if (storeIntervalRef.current) clearInterval(storeIntervalRef.current);
    };
  }, []);

  // ========================================================================
  // Initial event
  // ========================================================================

  useEffect(() => {
    pushEvent('النظام', 'تم تفعيل لوحة المراقبة', 'info');
  }, [pushEvent]);

  // ========================================================================
  // Refresh handler
  // ========================================================================

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAll();
      pushEvent('النظام', 'تم تحديث فحص الخدمات', 'info');
    } catch {
      pushError('النظام', 'فشل تحديث فحص الخدمات');
    }
    setRefreshing(false);
  };

  // ========================================================================
  // Clear errors
  // ========================================================================

  const clearErrors = () => {
    errorsRef.current = [];
    setErrors([]);
    setDuplicateCount(0);
    pushEvent('النظام', 'تم مسح سجل الأخطاء', 'info');
  };

  // ========================================================================
  // Derived: Overall health
  // ========================================================================

  const overallHealth = useMemo(() => {
    const statuses = Object.values(services).map((s) => s.status);
    if (statuses.every((s) => s === 'connected')) return 'healthy';
    if (statuses.every((s) => s === 'disconnected')) return 'error';
    if (statuses.some((s) => s === 'disconnected')) return 'warning';
    return 'degraded';
  }, [services]);

  const overallConfig = useMemo(() => {
    switch (overallHealth) {
      case 'healthy':
        return { label: 'جميع الخدمات تعمل', dot: 'bg-emerald-400', ring: 'ring-emerald-500/20', color: 'text-emerald-400' };
      case 'warning':
        return { label: 'تنبيه: بعض الخدمات متعطلة', dot: 'bg-amber-400', ring: 'ring-amber-500/20', color: 'text-amber-400' };
      case 'error':
        return { label: 'خطأ: جميع الخدمات متعطلة', dot: 'bg-rose-400', ring: 'ring-rose-500/20', color: 'text-rose-400' };
      default:
        return { label: 'بعض الخدمات تعمل ببطء', dot: 'bg-amber-400', ring: 'ring-amber-500/20', color: 'text-amber-400' };
    }
  }, [overallHealth]);

  // FPS color
  const fpsColor = useMemo(() => {
    if (fps.current >= 50) return 'text-emerald-400';
    if (fps.current >= 30) return 'text-amber-400';
    return 'text-rose-400';
  }, [fps]);

  // Memory percentage
  const memoryPercent = useMemo(() => {
    if (!memory) return null;
    return Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100);
  }, [memory]);

  const memoryColor = useMemo(() => {
    if (memoryPercent === null) return 'text-[var(--color-text-secondary)]';
    if (memoryPercent < 60) return 'text-emerald-400';
    if (memoryPercent < 85) return 'text-amber-400';
    return 'text-rose-400';
  }, [memoryPercent]);

  // Error counts grouped by source
  const errorGroups = useMemo(() => {
    const groups = new Map<string, { count: number; latest: ErrorLogEntry }>();
    for (const err of errors) {
      const existing = groups.get(err.source);
      if (existing) {
        existing.count += err.count;
        if (err.timestamp > existing.latest.timestamp) existing.latest = err;
      } else {
        groups.set(err.source, { count: err.count, latest: err });
      }
    }
    return Array.from(groups.entries())
      .map(([source, data]) => ({ source, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [errors]);

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div dir="rtl" className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] ring-4 ${overallConfig.ring} flex items-center justify-center`}>
            <Monitor className={`w-5 h-5 ${overallConfig.color}`} />
          </div>
          <div>
            <h2 className="text-[16px] font-black text-[var(--color-text)]">لوحة المراقبة المباشرة</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${overallConfig.dot} animate-pulse`} />
              <span className="text-[11px] text-[var(--color-text-secondary)] font-medium">{overallConfig.label}</span>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          فحص الخدمات
        </Button>
      </div>

      {/* ── Quick Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* FPS */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] text-[var(--color-text-tertiary)] font-medium">FPS</span>
          </div>
          <p className={`text-2xl font-black ${fpsColor}`}>{fps.current}</p>
          <p className="text-[10px] text-[var(--color-text-tertiary)] font-medium mt-0.5">
            متوسط {fps.average} • أدنى {fps.min}
          </p>
        </div>

        {/* Memory */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <MemoryStick className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] text-[var(--color-text-tertiary)] font-medium">الذاكرة</span>
          </div>
          <p className={`text-2xl font-black ${memoryColor}`}>
            {memoryPercent !== null ? `${memoryPercent}%` : 'N/A'}
          </p>
          <p className="text-[10px] text-[var(--color-text-tertiary)] font-medium mt-0.5">
            {memory ? formatBytes(memory.usedJSHeapSize) : 'غير متاح'}
          </p>
        </div>

        {/* Errors */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <Bug className="w-4 h-4 text-rose-400" />
            <span className="text-[11px] text-[var(--color-text-tertiary)] font-medium">الأخطاء</span>
          </div>
          <p className="text-2xl font-black text-rose-400">{errors.length}</p>
          <p className="text-[10px] text-[var(--color-text-tertiary)] font-medium mt-0.5">
            {duplicateCount > 0 ? `${duplicateCount} مكرر` : 'لا توجد أخطاء'}
          </p>
        </div>

        {/* Network */}
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1.5">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-rose-400" />
            )}
            <span className="text-[11px] text-[var(--color-text-tertiary)] font-medium">الشبكة</span>
          </div>
          <p className={`text-2xl font-black ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isOnline ? 'متصل' : 'غير متصل'}
          </p>
          <p className="text-[10px] text-[var(--color-text-tertiary)] font-medium mt-0.5">
            {isOnline ? 'الاتصال سليم' : 'فقد الاتصال'}
          </p>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ═══ System Health Panel ═══ */}
        <SectionCard
          title="صحة النظام"
          icon={<Shield className="w-4 h-4" />}
          action={
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${overallConfig.dot} animate-pulse`} />
              <span className="text-[11px] font-bold text-[var(--color-text-secondary)]">
                {overallConfig.label}
              </span>
            </span>
          }
        >
          <div className="space-y-2">
            {Object.entries(services).map(([key, svc]) => {
              const serviceIcon = <Database className="w-4 h-4" />;

              return (
                <div
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-xl border bg-[var(--color-bg)]/50 transition-all ${
                    STATUS_RING[svc.status]
                  } ${
                    svc.status === 'connected'
                      ? 'border-emerald-500/10'
                      : svc.status === 'degraded'
                        ? 'border-amber-500/10'
                        : 'border-rose-500/10'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    svc.status === 'connected'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'
                      : svc.status === 'degraded'
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500'
                        : 'bg-rose-50 dark:bg-rose-900/20 text-rose-500'
                  }`}>
                    {serviceIcon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-[var(--color-text)]">{svc.name}</span>
                      {STATUS_ICON[svc.status]}
                    </div>
                    <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 truncate">{svc.details}</p>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      svc.status === 'connected'
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                        : svc.status === 'degraded'
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'
                          : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[svc.status]}`} />
                      {STATUS_LABEL[svc.status]}
                    </span>
                    {svc.lastCheckedAt && (
                      <p className="text-[9px] text-[var(--color-text-tertiary)] mt-1">
                        {timeAgo(svc.lastCheckedAt)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Additional System Metrics */}
          <div className="mt-3 pt-3 border-t border-[var(--color-border)]/40 space-y-2">
            <MetricTile
              icon={<Globe className="w-4 h-4 text-emerald-400" />}
              label="حالة الشبكة"
              value={isOnline ? 'متصل بالإنترنت' : 'غير متصل'}
              color={isOnline ? 'emerald' : 'rose'}
            />
            <MetricTile
              icon={<Cpu className="w-4 h-4 text-amber-400" />}
              label="استخدام الذاكرة"
              value={memory ? `${formatBytes(memory.usedJSHeapSize)} / ${formatBytes(memory.jsHeapSizeLimit)}` : 'غير متاح'}
              sub={memoryPercent !== null ? `${memoryPercent}% مستخدم` : undefined}
              color={memoryPercent === null ? 'slate' : memoryPercent < 60 ? 'emerald' : memoryPercent < 85 ? 'amber' : 'rose'}
            />
          </div>
        </SectionCard>

        {/* ═══ UI Freeze Detector ═══ */}
        <SectionCard title="كاشف تجميد الواجهة" icon={<Zap className="w-4 h-4" />}>
          {/* FPS Display */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[var(--color-text-tertiary)] font-medium">FPS الحالي</span>
                <span className={`text-[20px] font-black ${fpsColor}`}>{fps.current}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--color-bg)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    fps.current >= 50 ? 'bg-emerald-400' : fps.current >= 30 ? 'bg-amber-400' : 'bg-rose-400'
                  }`}
                  style={{ width: `${Math.min(100, (fps.current / 60) * 100)}%` }}
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[var(--color-text-tertiary)] font-medium">المتوسط</span>
                <span className="text-[20px] font-black text-[var(--color-text)]">{fps.average}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--color-bg)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    fps.average >= 50 ? 'bg-emerald-400' : fps.average >= 30 ? 'bg-amber-400' : 'bg-rose-400'
                  }`}
                  style={{ width: `${Math.min(100, (fps.average / 60) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* FPS Stats */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center p-2 rounded-xl bg-[var(--color-bg)]/50">
              <p className="text-[10px] text-[var(--color-text-tertiary)] font-medium">أدنى FPS</p>
              <p className="text-[16px] font-black text-rose-400">{fps.min}</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-[var(--color-bg)]/50">
              <p className="text-[10px] text-[var(--color-text-tertiary)] font-medium">أعلى FPS</p>
              <p className="text-[16px] font-black text-emerald-400">{fps.max}</p>
            </div>
            <div className="text-center p-2 rounded-xl bg-[var(--color-bg)]/50">
              <p className="text-[10px] text-[var(--color-text-tertiary)] font-medium">انخفادات</p>
              <p className={`text-[16px] font-black ${fps.spikeCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {fps.spikeCount}
              </p>
            </div>
          </div>

          {/* Long Tasks */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold text-[var(--color-text-secondary)]">
                المهام الطويلة (آخر {longTasks.length})
              </span>
            </div>
            {longTasks.length === 0 ? (
              <p className="text-[11px] text-[var(--color-text-tertiary)] text-center py-3">لا توجد مهام طويلة مكتشفة</p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5">
                {longTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[var(--color-bg)]/50">
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">{timeAgo(task.timestamp)}</span>
                    <span className={`text-[11px] font-bold ${task.duration > 200 ? 'text-rose-400' : 'text-amber-400'}`}>
                      {formatDuration(task.duration)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* ═══ Event Stream Monitor ═══ */}
        <SectionCard
          title="مجرى الأحداث"
          icon={<Radio className="w-4 h-4" />}
          action={
            <span className="text-[10px] text-[var(--color-text-tertiary)] font-medium">
              {duplicateCount > 0 && `${duplicateCount} مكرر`}
            </span>
          }
        >
          <div className="max-h-72 overflow-y-auto space-y-1.5">
            {events.length === 0 ? (
              <p className="text-[11px] text-[var(--color-text-tertiary)] text-center py-6">لا توجد أحداث حتى الآن</p>
            ) : (
              events.map((evt) => (
                <div key={evt.id} className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-[var(--color-bg)]/50">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                    evt.type === 'error' ? 'bg-rose-400' : evt.type === 'warn' ? 'bg-amber-400' : 'bg-emerald-400'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[var(--color-text)]">{evt.source}</span>
                      <span className="text-[9px] text-[var(--color-text-tertiary)]">{timeAgo(evt.timestamp)}</span>
                    </div>
                    <p className={`text-[10px] mt-0.5 ${
                      evt.type === 'error' ? 'text-rose-400' : evt.type === 'warn' ? 'text-amber-400' : 'text-[var(--color-text-secondary)]'
                    }`}>
                      {evt.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        {/* ═══ Error Timeline ═══ */}
        <SectionCard
          title="سجل الأخطاء"
          icon={<Bug className="w-4 h-4" />}
          action={
            errors.length > 0 ? (
              <button
                onClick={clearErrors}
                className="flex items-center gap-1 text-[10px] font-bold text-rose-400 hover:text-rose-500 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                مسح
              </button>
            ) : undefined
          }
        >
          {/* Error Groups Summary */}
          {errorGroups.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {errorGroups.map((g) => (
                <span
                  key={g.source}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-900/20 text-rose-500"
                >
                  {g.source}
                  <span className="bg-rose-200 dark:bg-rose-800 rounded px-1">{g.count}</span>
                </span>
              ))}
            </div>
          )}

          {/* Error List */}
          <div className="max-h-72 overflow-y-auto space-y-1.5">
            {errors.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-6 h-6 text-emerald-300 mx-auto mb-2" />
                <p className="text-[11px] text-[var(--color-text-tertiary)]">لا توجد أخطاء مسجلة 🎉</p>
              </div>
            ) : (
              errors.map((err) => (
                <div key={err.id} className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-[var(--color-bg)]/50">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-rose-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        err.type === 'promise'
                          ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500'
                          : 'bg-rose-50 dark:bg-rose-900/20 text-rose-500'
                      }`}>
                        {err.type === 'promise' ? 'Promise' : 'Error'}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-tertiary)]">{err.source}</span>
                      {err.count > 1 && (
                        <span className="text-[9px] text-rose-400 font-bold">×{err.count}</span>
                      )}
                      <span className="text-[9px] text-[var(--color-text-tertiary)] mr-auto">{timeAgo(err.timestamp)}</span>
                    </div>
                    <p className="text-[10px] text-rose-400 mt-0.5 break-all">{err.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      {/* ═══ Zustand Store Monitor ═══ */}
      <SectionCard
        title="مراقب المخازن (Zustand)"
        icon={<BarChart3 className="w-4 h-4" />}
        action={
          <span className="text-[10px] text-[var(--color-text-tertiary)] font-medium">
            {storeInfo.length} مخزن متصل
          </span>
        }
      >
        {storeInfo.length === 0 ? (
          <p className="text-[11px] text-[var(--color-text-tertiary)] text-center py-4">لا توجد مخازن مكتشفة</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {storeInfo.map((store) => (
              <div key={store.name} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[var(--color-bg)]/50">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-[var(--color-text)] truncate">{store.name}</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)]">{formatBytes(store.approxSize)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
};

export default MonitoringDashboard;

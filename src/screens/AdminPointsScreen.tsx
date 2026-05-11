'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight, Check, X, Settings, Shield, Clock, CreditCard,
  AlertTriangle, Image as ImageIcon, ChevronDown, ChevronUp, User, Mail,
  Wallet, Coins, ToggleLeft, ToggleRight, Save, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/market/Button';
import { Input } from '@/components/market/Input';
import { Modal } from '@/components/market/Modal';
import { ImageUploader } from '@/components/market/ImageUploader';
import { usePointsStore, PointOrder, ShamCashSettings } from '@/store/pointsStore';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import toast from 'react-hot-toast';
import { apiGet, apiPost, apiPut } from '@/lib/fetchApi';

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected';

// ─── Status Badge ───
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    pending: { label: 'معلق', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700', dot: 'bg-amber-400' },
    approved: { label: 'مقبول', bg: 'bg-emerald-50 dark:bg-emerald-900/20 dark:bg-emerald-900/20', text: 'text-emerald-700', dot: 'bg-emerald-400' },
    rejected: { label: 'مرفوض', bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700', dot: 'bg-rose-400' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

// ─── Stat Card ───
const StatCard: React.FC<{ label: string; count: number; color: string; icon: React.ReactNode }> = ({ label, count, color, icon }) => {
  const borderMap: Record<string, string> = {
    amber: 'border-amber-200/60 bg-amber-50/ dark:bg-amber-900/20/40',
    green: 'border-emerald-200/60 bg-emerald-50/40',
    red: 'border-rose-200/60 bg-rose-50/ dark:bg-rose-900/20/40',
  };
  const iconMap: Record<string, string> = {
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600',
    green: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
    red: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600',
  };
  const numMap: Record<string, string> = {
    amber: 'text-amber-700',
    green: 'text-emerald-700',
    red: 'text-rose-700',
  };
  return (
    <div className={`flex-1 min-w-0 rounded-2xl border p-3 ${borderMap[color]}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconMap[color]}`}>{icon}</div>
      </div>
      <p className={`text-xl font-black ${numMap[color]}`}>{count.toLocaleString('ar-SY')}</p>
      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{label}</p>
    </div>
  );
};

// ─── Main Component ───
export const AdminPointsScreen: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const shamCashSettings = usePointsStore(s => s.shamCashSettings);
  const isAdmin = (u: { is_admin?: boolean; role?: string | null } | null) => u?.is_admin === true || u?.role === 'admin';

  // Local state
  const [orders, setOrders] = useState<PointOrder[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageModalSrc, setImageModalSrc] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ShamCashSettings>(() => usePointsStore.getState().getAdminSettings());
  const [savingSettings, setSavingSettings] = useState(false);

  // Initialize store & load server settings on mount
  useEffect(() => {
    const controller = new AbortController();
    usePointsStore.getState().initialize();
    // Also load fresh settings from server
    apiGet<{ settings: Partial<ShamCashSettings> }>('/api/payment-settings', { signal: controller.signal })
      .then(result => {
        if (controller.signal.aborted) return;
        if (result.data?.settings) {
          const server = result.data.settings;
          setSettings(prev => ({ ...prev, ...server }));
          usePointsStore.getState().updateAdminSettings(server);
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      });
    return () => controller.abort();
  }, []);

  // Sync orders from store
  useEffect(() => {
    setOrders(usePointsStore.getState().getOrders());
  }, [shamCashSettings]);

  // Computed counts (before any conditional returns)
  const hasAccess = user && isAdmin(user);
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const approvedCount = orders.filter(o => o.status === 'approved').length;
  const rejectedCount = orders.filter(o => o.status === 'rejected').length;

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (activeFilter === 'all') return orders;
    return orders.filter(o => o.status === activeFilter);
  }, [orders, activeFilter]);

  // Access guard
  if (!hasAccess) {
    return (
      <div className="min-h-[100dvh] bg-[var(--color-bg)] flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 rounded-3xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mb-5">
          <Shield className="w-10 h-10 text-rose-400" />
        </div>
        <h1 className="text-lg font-black text-[var(--color-text)] mb-2">ليس لديك صلاحية الوصول</h1>
        <p className="text-[13px] text-slate-400 text-center mb-6">هذه الصفحة متاحة للمسؤول فقط</p>
        <Button variant="primary" onClick={() => setSubScreen('none')} icon={<ArrowRight className="w-4 h-4" />}>
          العودة
        </Button>
      </div>
    );
  }

  // ─── Actions ───
  const handleApprove = (orderId: string) => {
    setApprovingId(orderId);
    try {
      usePointsStore.getState().approveOrder(orderId);
      setOrders(usePointsStore.getState().getOrders());
      toast.success('تم قبول الطلب بنجاح ✅');
    } catch {
      toast.error('حدث خطأ أثناء قبول الطلب');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectClick = (orderId: string) => {
    setRejectingOrderId(orderId);
    setRejectionReason('');
    setShowRejectionModal(true);
  };

  const handleRejectConfirm = () => {
    if (!rejectingOrderId) return;
    if (!rejectionReason.trim()) {
      toast.error('يرجى كتابة سبب الرفض');
      return;
    }
    setRejectingId(rejectingOrderId);
    try {
      usePointsStore.getState().rejectOrder(rejectingOrderId, rejectionReason.trim());
      setOrders(usePointsStore.getState().getOrders());
      toast.success('تم رفض الطلب ❌');
      setShowRejectionModal(false);
      setRejectingOrderId(null);
      setRejectionReason('');
    } catch {
      toast.error('حدث خطأ أثناء رفض الطلب');
    } finally {
      setRejectingId(null);
    }
  };

  const handleImageClick = (src: string) => {
    setImageModalSrc(src);
    setShowImageModal(true);
  };

  const handleSaveSettings = async () => {
    if (!settings.recipientName.trim()) {
      toast.error('يرجى إدخال اسم المستلم');
      return;
    }
    if (!settings.accountNumber.trim()) {
      toast.error('يرجى إدخال رقم الحساب');
      return;
    }
    if (settings.pointPrice <= 0) {
      toast.error('سعر النقطة يجب أن يكون أكبر من صفر');
      return;
    }
    if (settings.minPoints <= 0) {
      toast.error('الحد الأدنى يجب أن يكون أكبر من صفر');
      return;
    }
    if (settings.maxPoints <= 0 || settings.maxPoints < settings.minPoints) {
      toast.error('الحد الأقصى يجب أن يكون أكبر من الحد الأدنى');
      return;
    }
    setSavingSettings(true);
    try {
      // Upload QR image if it's a base64 data URL
      let finalQrImage = settings.qrImage || '';
      if (finalQrImage && finalQrImage.startsWith('data:')) {
        const { data: uploadData, error: uploadError } = await apiPost<{ imageUrl: string }>('/api/upload-image', { image: finalQrImage });
        if (uploadError) {
          toast.error('فشل رفع صورة QR');
          setSavingSettings(false);
          return;
        }
        finalQrImage = uploadData?.imageUrl || finalQrImage;
      }

      // Save to server (Supabase)
      const { error } = await apiPut('/api/payment-settings', {
        recipientName: settings.recipientName.trim(),
        accountNumber: settings.accountNumber.trim(),
        qrImage: finalQrImage,
        pointPrice: settings.pointPrice,
        purchaseEnabled: settings.purchaseEnabled,
        minPoints: settings.minPoints,
        maxPoints: settings.maxPoints,
      });

      if (error) {
        toast.error(error || 'فشل حفظ الإعدادات');
        setSavingSettings(false);
        return;
      }

      // Update local store for UI consistency
      usePointsStore.getState().updateAdminSettings({ ...settings, qrImage: finalQrImage });
      toast.success('تم حفظ الإعدادات بنجاح ✅');
    } catch {
      toast.error('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRefresh = () => {
    setOrders(usePointsStore.getState().getOrders());
    setSettings(usePointsStore.getState().getAdminSettings());
    toast.success('تم التحديث');
  };

  // ─── Filter tabs config ───
  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'كل الطلبات', count: orders.length },
    { key: 'pending', label: 'معلقة', count: pendingCount },
    { key: 'approved', label: 'مقبولة', count: approvedCount },
    { key: 'rejected', label: 'مرفوضة', count: rejectedCount },
  ];

  // ─── Render ───
  return (
    <div className="pb-14 min-h-[100dvh] bg-[var(--color-bg)]">
      {/* ─── Header ─── */}
      <div className="gradient-dark px-5 pt-8 pb-[4.5rem] relative overflow-hidden">
        <div className="absolute top-[-40px] right-[-30px] w-[180px] h-[180px] rounded-full bg-teal-600/15 blur-[60px]" />
        <div className="absolute bottom-[-30px] left-[-20px] w-[120px] h-[120px] rounded-full bg-emerald-600/10 blur-[50px]" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setSubScreen('none')}
              className="w-10 h-10 bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-[var(--color-surface)]/20 transition-colors"
            >
              <ArrowRight className="w-[18px] h-[18px] text-white" />
            </button>
            <button
              onClick={handleRefresh}
              className="w-10 h-10 bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-[var(--color-surface)]/20 transition-colors"
            >
              <RefreshCw className="w-[18px] h-[18px] text-teal-300 dark:text-teal-600/70" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-500/20 backdrop-blur-sm flex items-center justify-center border border-teal-400/20">
              <Shield className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h1 className="text-white text-[20px] font-black">لوحة تحكم المدير</h1>
              <p className="text-teal-300 dark:text-teal-600/50 text-[12px] mt-0.5">إدارة طلبات شراء النقاط</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Stats Bar ─── */}
      <div className="px-4 -mt-10 relative z-10 mb-4">
        <div className="flex gap-3">
          <StatCard label="الطلبات المعلقة" count={pendingCount} color="amber" icon={<Clock className="w-4 h-4" />} />
          <StatCard label="الطلبات المقبولة" count={approvedCount} color="green" icon={<Check className="w-4 h-4" />} />
          <StatCard label="الطلبات المرفوضة" count={rejectedCount} color="red" icon={<X className="w-4 h-4" />} />
        </div>
      </div>

      {/* ─── Filter Tabs ─── */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 bg-[var(--color-surface)] rounded-2xl p-1.5 shadow-sm border border-[var(--color-border)]">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex-1 py-2.5 px-2 rounded-xl text-[12px] font-bold transition-all ${
                activeFilter === tab.key
                  ? 'gradient-primary text-white shadow-md shadow-emerald-500/20'
                  : 'text-slate-500 hover:bg-emerald-50/60 dark:bg-emerald-900/20'
              }`}
            >
              {tab.label}
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-black mr-1 ${
                activeFilter === tab.key ? 'bg-[var(--color-surface)]/25 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Orders List ─── */}
      <div className="px-4 space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-[var(--color-surface)] rounded-2xl p-8 text-center shadow-sm border border-[var(--color-border)]">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50/60 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-7 h-7 text-emerald-300" />
            </div>
            <p className="text-[14px] font-bold text-slate-400">لا توجد طلبات</p>
            <p className="text-[12px] text-slate-300 mt-1">لم يتم تقديم أي طلبات بعد</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onApprove={handleApprove}
              onReject={handleRejectClick}
              onImageClick={handleImageClick}
              approvingId={approvingId}
              rejectingId={rejectingId}
            />
          ))
        )}
      </div>

      {/* ─── Admin Settings Section ─── */}
      <div className="px-4 mt-6 mb-4">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center justify-between bg-[var(--color-surface)] rounded-2xl px-5 py-4 shadow-sm border border-[var(--color-border)] hover:bg-emerald-50/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500">
              <Settings className="w-4.5 h-4.5" />
            </div>
            <div className="text-right">
              <p className="text-[14px] font-bold text-[var(--color-text)]">إعدادات شام كاش</p>
              <p className="text-[11px] text-slate-400 mt-0.5">تكلفة النقطة: {settings.pointPrice.toLocaleString('ar-SY')} ل.س</p>
            </div>
          </div>
          <div className={`w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-400 dark:text-emerald-500 transition-transform ${showSettings ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </button>

        {showSettings && (
          <div className="bg-[var(--color-surface)] rounded-2xl px-5 py-5 mt-2 shadow-sm border border-[var(--color-border)] space-y-4">
            <p className="text-[10px] font-bold text-emerald-300 dark:text-emerald-600 tracking-wide uppercase">إعدادات الدفع</p>

            <Input
              label="اسم المستلم"
              value={settings.recipientName}
              onChange={(e) => setSettings({ ...settings, recipientName: e.target.value })}
              placeholder="أدخل اسم المستلم"
              icon={<User className="w-4 h-4" />}
            />

            <Input
              label="رقم الحساب"
              value={settings.accountNumber}
              onChange={(e) => setSettings({ ...settings, accountNumber: e.target.value })}
              placeholder="أدخل رقم الحساب"
              icon={<CreditCard className="w-4 h-4" />}
            />

            <ImageUploader
              label="صورة QR"
              value={settings.qrImage || null}
              onChange={(val) => setSettings({ ...settings, qrImage: val || '' })}
              height="h-32"
            />

            <div className="h-px bg-emerald-50/80" />
            <p className="text-[10px] font-bold text-emerald-300 dark:text-emerald-600 tracking-wide uppercase">إعدادات النقاط</p>

            <Input
              label="سعر النقطة (ل.س)"
              type="number"
              value={settings.pointPrice.toString()}
              onChange={(e) => setSettings({ ...settings, pointPrice: parseFloat(e.target.value) || 0 })}
              placeholder="1"
              icon={<Coins className="w-4 h-4" />}
            />

            <Input
              label="الحد الأدنى للشراء (نقاط)"
              type="number"
              value={settings.minPoints.toString()}
              onChange={(e) => setSettings({ ...settings, minPoints: parseInt(e.target.value) || 0 })}
              placeholder="100"
              icon={<ChevronDown className="w-4 h-4" />}
            />

            <Input
              label="الحد الأقصى للشراء (نقاط)"
              type="number"
              value={settings.maxPoints.toString()}
              onChange={(e) => setSettings({ ...settings, maxPoints: parseInt(e.target.value) || 0 })}
              placeholder="100000"
              icon={<ChevronUp className="w-4 h-4" />}
            />

            {/* Toggle purchase */}
            <div className="flex items-center justify-between bg-emerald-50/30 rounded-xl p-3.5 border border-emerald-100/40 dark:border-emerald-800/30">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${settings.purchaseEnabled ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400'}`}>
                  {settings.purchaseEnabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[var(--color-text)]">تفعيل شراء النقاط</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {settings.purchaseEnabled ? 'الشراء مفعّل حالياً' : 'الشراء معطّل حالياً'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSettings({ ...settings, purchaseEnabled: !settings.purchaseEnabled })}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  settings.purchaseEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              >
                <span className={`absolute top-0.5 w-6 h-6 bg-[var(--color-surface)] rounded-full shadow-sm transition-all ${
                  settings.purchaseEnabled ? 'left-0.5' : 'left-5'
                }`} />
              </button>
            </div>

            <Button
              fullWidth
              onClick={handleSaveSettings}
              loading={savingSettings}
              icon={<Save className="w-4 h-4" />}
            >
              حفظ الإعدادات
            </Button>
          </div>
        )}
      </div>

      {/* ─── Rejection Modal ─── */}
      <Modal isOpen={showRejectionModal} onClose={() => { setShowRejectionModal(false); setRejectionReason(''); }} title="رفض الطلب">
        <div className="space-y-4">
          <div className="bg-rose-50/ dark:bg-rose-900/20/60 rounded-xl p-3.5 border border-rose-100/40">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-[13px] font-bold">تأكيد رفض الطلب</p>
            </div>
            <p className="text-[12px] text-slate-500">سيتم إشعار المستخدم بسبب الرفض</p>
          </div>
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 dark:text-emerald-600 block mb-1.5">سبب الرفض</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="اكتب سبب رفض الطلب هنا..."
              rows={4}
              className="w-full bg-[var(--color-surface)] border border-emerald-100 dark:border-emerald-800 rounded-xl py-3 px-4 text-[14px] text-[var(--color-text)] placeholder:text-slate-400 font-medium outline-none focus:ring-2 focus:ring-rose-500/15 focus:border-rose-400 hover:border-emerald-200 dark:border-emerald-700 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="danger"
              fullWidth
              onClick={handleRejectConfirm}
              loading={!!rejectingId}
              icon={<X className="w-4 h-4" />}
            >
              تأكيد الرفض
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => { setShowRejectionModal(false); setRejectionReason(''); }}
            >
              إلغاء
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Image Modal ─── */}
      <Modal isOpen={showImageModal} onClose={() => { setShowImageModal(false); setImageModalSrc(''); }} title="صورة الإيصال" size="lg">
        <div className="rounded-xl overflow-hidden border border-emerald-100/60">
          <img src={imageModalSrc} alt="صورة الإيصال" className="w-full h-auto max-h-[70vh] object-contain bg-slate-50 dark:bg-slate-800/50" />
        </div>
      </Modal>
    </div>
  );
};

// ─── Order Card Sub-component ───
interface OrderCardProps {
  order: PointOrder;
  onApprove: (_id: string) => void;
  onReject: (_id: string) => void;
  onImageClick: (_src: string) => void;
  approvingId: string | null;
  rejectingId: string | null;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onApprove, onReject, onImageClick, approvingId, rejectingId }) => {
  const formattedDate = new Date(order.createdAt).toLocaleDateString('ar-SY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-[var(--color-text)] truncate">{order.userName || 'مستخدم'}</p>
            <p className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
              <Mail className="w-3 h-3 flex-shrink-0" />
              {order.userEmail}
            </p>
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-emerald-50/30 rounded-xl p-2.5 border border-emerald-100/30">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Coins className="w-3 h-3" />
            <p className="text-[10px] font-semibold">النقاط</p>
          </div>
          <p className="text-[15px] font-black text-[var(--color-text)]">{order.points.toLocaleString('ar-SY')}</p>
        </div>
        <div className="bg-amber-50/ dark:bg-amber-900/20/30 rounded-xl p-2.5 border border-amber-100/30">
          <div className="flex items-center gap-1.5 text-slate-400 mb-1">
            <Wallet className="w-3 h-3" />
            <p className="text-[10px] font-semibold">المبلغ</p>
          </div>
          <p className="text-[15px] font-black text-[var(--color-text)]">{order.amount.toLocaleString('ar-SY')} ل.س</p>
        </div>
      </div>

      {/* Payment Code */}
      <div className="bg-slate-50/60 rounded-xl p-2.5 mb-3 border border-slate-100/60">
        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
          <CreditCard className="w-3 h-3" />
          <p className="text-[10px] font-semibold">رمز الدفع</p>
        </div>
        <p className="text-[13px] font-bold text-slate-700 font-mono tracking-wider">{order.paymentCode}</p>
      </div>

      {/* Receipt Image */}
      {order.receiptImage && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            صورة الإيصال
          </p>
          <button
            onClick={() => onImageClick(order.receiptImage!)}
            className="w-full h-24 rounded-xl overflow-hidden border border-emerald-100/60 hover:border-emerald-300 transition-colors"
          >
            <img
              src={order.receiptImage}
              alt="صورة الإيصال"
              className="w-full h-full object-cover"
            />
          </button>
        </div>
      )}

      {/* Rejection Reason */}
      {order.status === 'rejected' && order.rejectionReason && (
        <div className="bg-rose-50/ dark:bg-rose-900/20/50 rounded-xl p-2.5 mb-3 border border-rose-100/40">
          <div className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400 mb-1">
            <AlertTriangle className="w-3 h-3" />
            <p className="text-[10px] font-bold">سبب الرفض</p>
          </div>
          <p className="text-[12px] text-rose-600 dark:text-rose-400 font-medium">{order.rejectionReason}</p>
        </div>
      )}

      {/* Time */}
      <div className="flex items-center gap-1.5 text-slate-300 mb-3">
        <Clock className="w-3 h-3" />
        <p className="text-[11px]">{formattedDate}</p>
      </div>

      {/* Action Buttons (only for pending) */}
      {order.status === 'pending' && (
        <div className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
          <Button
            variant="success"
            fullWidth
            size="sm"
            onClick={() => onApprove(order.id)}
            loading={approvingId === order.id}
            icon={<Check className="w-4 h-4" />}
          >
            قبول الطلب
          </Button>
          <Button
            variant="danger"
            fullWidth
            size="sm"
            onClick={() => onReject(order.id)}
            loading={rejectingId === order.id}
            icon={<X className="w-4 h-4" />}
          >
            رفض الطلب
          </Button>
        </div>
      )}
    </div>
  );
};

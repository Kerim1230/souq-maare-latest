'use client';
import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight, ShoppingCart, Shield, PlusCircle, AlertCircle,
  RotateCcw, Calendar, ChevronDown, ChevronUp, Search, X,
  TrendingUp, TrendingDown, Hash, Wallet
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { usePointsStore, Transaction, TransactionType } from '@/store/pointsStore';
import { useAppStore } from '@/store/appStore';
import toast from 'react-hot-toast';

// ===== Transaction Type Helpers =====
const TYPE_LABELS: Record<TransactionType, string> = {
  purchase: 'شراء نقاط',
  verification_deduct: 'خصم توثيق',
  admin_add: 'إضافة نقاط',
  admin_reject: 'رفض طلب',
  refund: 'استرداد',
};

const TYPE_ICONS: Record<TransactionType, React.ReactNode> = {
  purchase: <ShoppingCart className="w-[18px] h-[18px]" />,
  verification_deduct: <Shield className="w-[18px] h-[18px]" />,
  admin_add: <PlusCircle className="w-[18px] h-[18px]" />,
  admin_reject: <AlertCircle className="w-[18px] h-[18px]" />,
  refund: <RotateCcw className="w-[18px] h-[18px]" />,
};

const TYPE_COLORS: Record<TransactionType, string> = {
  purchase: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
  verification_deduct: 'text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
  admin_add: 'text-green-500 bg-green-50',
  admin_reject: 'text-red-500 bg-red-50',
  refund: 'text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
};

// ===== Date Grouping Helper =====
function getDateGroupLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const txDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (txDate.getTime() === today.getTime()) return 'اليوم';
  if (txDate.getTime() === yesterday.getTime()) return 'أمس';
  return date.toLocaleDateString('ar-SY', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ===== Main Component =====
export const TransactionsScreen: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const initPoints = usePointsStore(s => s.initialize);
  // Reactive transactions selector — subscribes to the transactions array
  const rawTransactions = usePointsStore(s => s.transactions);

  // State
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<TransactionType | ''>('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<{
    type: TransactionType | '';
    from: string;
    to: string;
  }>({ type: '', from: '', to: '' });

  // Initialize store on mount
  useEffect(() => {
    initPoints(user?.id);
  }, [initPoints, user?.id]);

  const userId = user?.id || '';

  // Fetch transactions with applied filters (reactive via rawTransactions dep)
  const transactions = useMemo(() => {
    return rawTransactions.filter(t => {
      if (t.userId !== userId) return false;
      if (appliedFilters.type && t.type !== appliedFilters.type) return false;
      if (appliedFilters.from && new Date(t.createdAt) < new Date(appliedFilters.from)) return false;
      if (appliedFilters.to && new Date(t.createdAt) > new Date(appliedFilters.to + 'T23:59:59')) return false;
      return true;
    });
  }, [userId, rawTransactions, appliedFilters.type, appliedFilters.from, appliedFilters.to]);

  // Summary stats from ALL transactions (no filters, reactive)
  const allTransactions = useMemo(() => {
    return rawTransactions.filter(t => t.userId === userId);
  }, [userId, rawTransactions]);

  const summaryStats = useMemo(() => {
    let totalPurchased = 0;
    let totalUsed = 0;

    allTransactions.forEach((t) => {
      if (t.type === 'purchase' || t.type === 'admin_add') {
        totalPurchased += t.amount;
      }
      if (t.type === 'verification_deduct') {
        totalUsed += Math.abs(t.amount);
      }
    });

    return {
      totalPurchased,
      totalUsed,
      count: allTransactions.length,
      net: totalPurchased - totalUsed,
    };
  }, [allTransactions]);

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { label: string; items: Transaction[] }[] = [];
    let currentLabel = '';

    const sorted = [...transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    sorted.forEach((t) => {
      const label = getDateGroupLabel(t.createdAt);
      if (label !== currentLabel) {
        groups.push({ label, items: [t] });
        currentLabel = label;
      } else {
        groups[groups.length - 1].items.push(t);
      }
    });

    return groups;
  }, [transactions]);

  // Filter handlers
  const handleSearch = () => {
    setAppliedFilters({ type: filterType, from: filterFrom, to: filterTo });
    toast.success('تم تطبيق الفلتر');
  };

  const handleClearFilter = () => {
    setFilterType('');
    setFilterFrom('');
    setFilterTo('');
    setAppliedFilters({ type: '', from: '', to: '' });
    toast.success('تم مسح الفلتر');
  };

  const isFiltered = appliedFilters.type || appliedFilters.from || appliedFilters.to;

  return (
    <div className="pb-24 min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <div className="gradient-dark px-5 pt-8 pb-[4.5rem] relative overflow-hidden">
        <div className="absolute top-[-40px] right-[-30px] w-[180px] h-[180px] rounded-full bg-teal-600/15 blur-[60px]" />
        <div className="absolute bottom-[-30px] left-[-20px] w-[140px] h-[140px] rounded-full bg-emerald-600/10 blur-[50px]" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-white text-[20px] font-black">سجل العمليات</h1>
            <p className="text-teal-300 dark:text-teal-600/50 text-[12px] mt-0.5">جميع عمليات محفظتك</p>
          </div>
          <button
            onClick={() => setSubScreen('none')}
            className="w-10 h-10 bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center justify-center active:scale-95"
          >
            <ArrowRight className="w-[18px] h-[18px] text-teal-300 dark:text-teal-600/70" />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="px-4 -mt-10 relative z-10">
        <div className="grid grid-cols-2 gap-2.5">
          {/* إجمالي المشتريات */}
          <div className="bg-[var(--color-surface)] rounded-2xl p-3.5 shadow-sm border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)]">إجمالي المشتريات</span>
            </div>
            <p className="text-[16px] font-black text-green-600">
              {summaryStats.totalPurchased.toLocaleString('ar-SY')}
            </p>
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">نقطة</p>
          </div>

          {/* إجمالي المستخدم */}
          <div className="bg-[var(--color-surface)] rounded-2xl p-3.5 shadow-sm border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)]">إجمالي المستخدم</span>
            </div>
            <p className="text-[16px] font-black text-red-500">
              {summaryStats.totalUsed.toLocaleString('ar-SY')}
            </p>
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">نقطة</p>
          </div>

          {/* عدد العمليات */}
          <div className="bg-[var(--color-surface)] rounded-2xl p-3.5 shadow-sm border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <Hash className="w-4 h-4 text-blue-500 dark:text-blue-400" />
              </div>
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)]">عدد العمليات</span>
            </div>
            <p className="text-[16px] font-black text-blue-600 dark:text-blue-400">
              {summaryStats.count.toLocaleString('ar-SY')}
            </p>
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">عملية</p>
          </div>

          {/* صافي النقاط */}
          <div className="bg-[var(--color-surface)] rounded-2xl p-3.5 shadow-sm border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-emerald-500" />
              </div>
              <span className="text-[10px] font-bold text-[var(--color-text-tertiary)]">صافي النقاط</span>
            </div>
            <p className={`text-[16px] font-black ${summaryStats.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {summaryStats.net.toLocaleString('ar-SY')}
            </p>
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">نقطة</p>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="px-4 mt-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full bg-[var(--color-surface)] rounded-2xl px-4 py-3 shadow-sm border border-[var(--color-border)] flex items-center justify-between active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <Search className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-[13px] font-bold text-[var(--color-text)]">تصفية العمليات</span>
          </div>
          <div className="flex items-center gap-2">
            {isFiltered && (
              <span className="text-[10px] font-bold text-white bg-emerald-500 rounded-full px-2 py-0.5">
                مُفلتر
              </span>
            )}
            {showFilters ? (
              <ChevronUp className="w-4 h-4 text-[var(--color-text-tertiary)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
            )}
          </div>
        </button>

        {showFilters && (
          <div className="bg-[var(--color-surface)] rounded-2xl mt-2 p-4 shadow-sm border border-[var(--color-border)] space-y-3" style={{ animation: 'fadeIn 0.2s ease-out' }}>
            {/* نوع العملية */}
            <div>
              <label className="text-[11px] font-bold text-[var(--color-text-secondary)] mb-1.5 block">نوع العملية</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as TransactionType | '')}
                className="w-full h-11 bg-[var(--color-bg)] border border-emerald-100 dark:border-emerald-800 rounded-xl px-3 text-[13px] text-[var(--color-text)] font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-200 appearance-none"
              >
                <option value="">الكل</option>
                <option value="purchase">شراء نقاط</option>
                <option value="verification_deduct">خصم توثيق</option>
                <option value="admin_add">إضافة نقاط</option>
                <option value="admin_reject">رفض طلب</option>
                <option value="refund">استرداد</option>
              </select>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-[var(--color-text-secondary)] mb-1.5 block">من تاريخ</label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="w-full h-11 bg-[var(--color-bg)] border border-emerald-100 dark:border-emerald-800 rounded-xl px-3 text-[13px] text-[var(--color-text)] font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[var(--color-text-secondary)] mb-1.5 block">إلى تاريخ</label>
                <input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="w-full h-11 bg-[var(--color-bg)] border border-emerald-100 dark:border-emerald-800 rounded-xl px-3 text-[13px] text-[var(--color-text)] font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={handleSearch}
                className="h-11 gradient-primary rounded-xl text-white text-[13px] font-bold flex items-center justify-center gap-2 active:scale-95"
              >
                <Search className="w-4 h-4" />
                بحث
              </button>
              <button
                onClick={handleClearFilter}
                className="h-11 bg-slate-100 dark:bg-slate-800 rounded-xl text-[var(--color-text-secondary)] text-[13px] font-bold flex items-center justify-center gap-2 active:scale-95"
              >
                <X className="w-4 h-4" />
                مسح الفلتر
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transactions List */}
      <div className="px-4 mt-3 space-y-3">
        {groupedTransactions.length === 0 ? (
          /* Empty State */
          <div className="bg-[var(--color-surface)] rounded-2xl p-8 shadow-sm border border-[var(--color-border)] text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-7 h-7 text-emerald-300" />
            </div>
            <p className="text-[14px] font-bold text-[var(--color-text)]">لا توجد عمليات</p>
            <p className="text-[12px] text-[var(--color-text-tertiary)] mt-1">
              {isFiltered ? 'لا توجد عمليات تطابق الفلتر المحدد' : 'لم تقم بأي عملية بعد'}
            </p>
          </div>
        ) : (
          groupedTransactions.map((group) => (
            <div key={group.label}>
              {/* Date Group Header */}
              <div className="flex items-center gap-2 px-1 pt-2 pb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <p className="text-[11px] font-bold text-[var(--color-text-tertiary)]">{group.label}</p>
                <div className="flex-1 h-px bg-emerald-100/60" />
                <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)]">
                  {group.items.length} {group.items.length === 1 ? 'عملية' : 'عمليات'}
                </span>
              </div>

              {/* Transaction Cards */}
              <div className="space-y-2">
                {group.items.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-[var(--color-surface)] rounded-2xl p-3.5 shadow-sm border border-[var(--color-border)] flex items-center gap-3 active:scale-[0.99]"
                  >
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_COLORS[tx.type]}`}>
                      {TYPE_ICONS[tx.type]}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold text-[var(--color-text-tertiary)] bg-slate-50 dark:bg-slate-800/50 rounded-md px-1.5 py-0.5">
                          {TYPE_LABELS[tx.type]}
                        </span>
                      </div>
                      <p className="text-[12px] font-semibold text-[var(--color-text)] truncate">{tx.description}</p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                        {new Date(tx.createdAt).toLocaleDateString('ar-SY', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                        {' · '}
                        {new Date(tx.createdAt).toLocaleTimeString('ar-SY', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    {/* Amount */}
                    <div className="flex-shrink-0 text-left">
                      <p className={`text-[15px] font-black ${tx.amount > 0 ? 'text-green-600' : tx.amount < 0 ? 'text-red-500' : 'text-[var(--color-text-tertiary)]'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('ar-SY')}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-tertiary)]">نقطة</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

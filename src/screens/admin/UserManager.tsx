'use client';
import React, { useState, useMemo } from 'react';
import {
  Users, Ban, Trash2, ShieldOff, CheckSquare, Square,
  ChevronDown, ChevronUp, Mail, Shield, Clock, Store, Package,
  Coins, UserX, Filter
} from 'lucide-react';
import { StatusBadge, SearchBar, ActionBtn, EmptyState, ConfirmDialog } from '@/components/admin/AdminShared';
import { type AdminDashboardState, type AdminUser } from '@/store/adminDashboardStore';
import { Modal } from '@/components/market/Modal';
import toast from 'react-hot-toast';
import { timeAgo } from '@/lib/date-utils';

type StoreType = AdminDashboardState;

interface UserManagerProps {
  store: StoreType;
  searchQuery: string;
}

type SortField = 'createdAt' | 'fullName' | 'email' | 'status';
type FilterStatus = 'all' | 'active' | 'banned' | 'admin';

export const UserManager: React.FC<UserManagerProps> = ({ store, searchQuery }) => {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmBulkBan, setConfirmBulkBan] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const q = (localSearch || searchQuery).toLowerCase().trim();

  const filtered = useMemo(() => {
    let data = store.users;

    // Filter
    if (filter === 'active') data = data.filter(u => u.status === 'active');
    else if (filter === 'banned') data = data.filter(u => u.status === 'banned');
    else if (filter === 'admin') data = data.filter(u => u.email === 'bkbd098@gmail.com');

    // Search
    if (q) {
      data = data.filter(u =>
        (u.fullName || '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    }

    // Sort
    data = [...data].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'fullName':
          cmp = (a.fullName || '').localeCompare(b.fullName || '');
          break;
        case 'email':
          cmp = a.email.localeCompare(b.email);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'createdAt':
        default:
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return data;
  }, [store.users, filter, q, sortField, sortAsc]);

  const toggleSelect = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filtered.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filtered.map(u => u.id)));
    }
  };

  const handleBulkBan = async () => {
    let count = 0;
    for (const userId of selectedUsers) {
      const user = store.users.find(u => u.id === userId);
      if (user && user.status === 'active') {
        store.banUser(userId, '7 أيام', 'حظر جماعي من المدير');
        count++;
      }
    }
    toast.success(`تم حظر ${count} مستخدم`);
    setSelectedUsers(new Set());
    setConfirmBulkBan(false);
  };

  const handleBulkDelete = async () => {
    let count = 0;
    for (const userId of selectedUsers) {
      try {
        await store.deleteUser(userId);
        count++;
      } catch { /* skip */ }
    }
    toast.success(`تم حذف ${count} مستخدم`);
    setSelectedUsers(new Set());
    setConfirmBulkDelete(false);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const filterTabs = [
    { key: 'all', label: 'الكل', count: store.users.length },
    { key: 'active', label: 'نشط', count: store.users.filter(u => u.status === 'active').length },
    { key: 'banned', label: 'محظور', count: store.users.filter(u => u.status === 'banned').length },
    { key: 'admin', label: 'ادمن', count: store.users.filter(u => u.email === 'bkbd098@gmail.com').length },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-sky-500" />
          </div>
          <div>
            <h2 className="text-[16px] font-black text-[var(--color-text)]">إدارة المستخدمين</h2>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">{store.users.length} مستخدم مسجل</p>
          </div>
        </div>
      </div>

      {/* Search + Filter */}
      <SearchBar value={localSearch} onChange={setLocalSearch} placeholder="بحث بالاسم أو البريد..." />

      <div className="flex gap-2 bg-[var(--color-surface)] rounded-2xl p-1.5 shadow-sm border border-[var(--color-border)] overflow-x-auto scrollbar-hide">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as FilterStatus)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] font-bold transition-all whitespace-nowrap flex-1 justify-center ${
              filter === tab.key
                ? 'gradient-primary text-white shadow-md shadow-emerald-500/20'
                : 'text-[var(--color-text-secondary)] hover:bg-emerald-50/60 dark:bg-emerald-900/20'
            }`}
          >
            {tab.label}
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-black ${
              filter === tab.key ? 'bg-[var(--color-surface)]/25 text-white' : 'bg-slate-100 dark:bg-slate-800 text-[var(--color-text-tertiary)]'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Bulk Actions */}
      {selectedUsers.size > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-3 border border-amber-200/40">
          <span className="text-[12px] font-bold text-amber-700 dark:text-amber-400">
            تم تحديد {selectedUsers.size} مستخدم
          </span>
          <div className="flex gap-2 mr-auto">
            <button
              onClick={() => setConfirmBulkBan(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 transition-colors"
            >
              <UserX className="w-3.5 h-3.5" />
              حظر جماعي
            </button>
            <button
              onClick={() => setConfirmBulkDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              حذف جماعي
            </button>
            <button
              onClick={() => setSelectedUsers(new Set())}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-[var(--color-text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--color-text-tertiary)]">
        <Filter className="w-3.5 h-3.5" />
        <span>ترتيب حسب:</span>
        {[
          { field: 'createdAt' as SortField, label: 'التاريخ' },
          { field: 'fullName' as SortField, label: 'الاسم' },
          { field: 'email' as SortField, label: 'البريد' },
          { field: 'status' as SortField, label: 'الحالة' },
        ].map(s => (
          <button
            key={s.field}
            onClick={() => handleSort(s.field)}
            className={`flex items-center gap-0.5 px-2 py-1 rounded-md transition-colors ${
              sortField === s.field ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {s.label}
            <SortIcon field={s.field} />
          </button>
        ))}
      </div>

      {/* Select All */}
      <div className="flex items-center gap-2">
        <button onClick={toggleSelectAll} className="text-emerald-500 hover:text-emerald-600">
          {selectedUsers.size === filtered.length && filtered.length > 0 ? (
            <CheckSquare className="w-4 h-4" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </button>
        <span className="text-[11px] text-[var(--color-text-tertiary)]">تحديد الكل</span>
      </div>

      {/* Users List */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="w-7 h-7" />} message="لا يوجد مستخدمين" />
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.map(u => (
            <div
              key={u.id}
              className={`bg-[var(--color-surface)] rounded-2xl p-3 shadow-sm border transition-all cursor-pointer ${
                selectedUsers.has(u.id) ? 'border-emerald-300 bg-emerald-50/30' : 'border-[var(--color-border)] hover:shadow-md'
              }`}
              onClick={() => setSelectedUser(u)}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelect(u.id); }}
                  className="text-emerald-500 hover:text-emerald-600 flex-shrink-0"
                >
                  {selectedUsers.has(u.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </button>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-600 font-black text-[14px] flex-shrink-0">
                  {(u.fullName || '?').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold text-[var(--color-text)] truncate">{u.fullName || 'بدون اسم'}</p>
                    {u.status === 'banned' && <StatusBadge status="banned" />}
                    {u.email === 'bkbd098@gmail.com' && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
                        <Shield className="w-2.5 h-2.5" /> ادمن
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-[12px] font-black text-emerald-600">{u._count?.stores ?? 0}</p>
                    <p className="text-[9px] text-[var(--color-text-tertiary)]">متجر</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[12px] font-black text-teal-600">{u._count?.products ?? 0}</p>
                    <p className="text-[9px] text-[var(--color-text-tertiary)]">منتج</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[12px] font-black text-amber-600">{(u.points ?? 0).toLocaleString('ar-SY')}</p>
                    <p className="text-[9px] text-[var(--color-text-tertiary)]">نقطة</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* User Detail Modal */}
      <Modal isOpen={!!selectedUser} onClose={() => setSelectedUser(null)} title="تفاصيل المستخدم" size="lg">
        {selectedUser && (
          <div className="space-y-4">
            {/* User Header */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-600 font-black text-[24px]">
                {(selectedUser.fullName || '?').charAt(0)}
              </div>
              <div>
                <h3 className="text-[18px] font-black text-[var(--color-text)]">{selectedUser.fullName || 'بدون اسم'}</h3>
                <p className="text-[13px] text-[var(--color-text-tertiary)]">{selectedUser.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={selectedUser.status} />
                  {selectedUser.email === 'bkbd098@gmail.com' && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
                      <Shield className="w-3 h-3" /> مدير
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-emerald-50/30 dark:bg-emerald-900/10 rounded-xl p-3 text-center">
                <Store className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                <p className="text-[18px] font-black text-emerald-700">{selectedUser._count?.stores ?? 0}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)]">متجر</p>
              </div>
              <div className="bg-teal-50/30 dark:bg-teal-900/10 rounded-xl p-3 text-center">
                <Package className="w-4 h-4 text-teal-500 mx-auto mb-1" />
                <p className="text-[18px] font-black text-teal-700">{selectedUser._count?.products ?? 0}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)]">منتج</p>
              </div>
              <div className="bg-amber-50/30 dark:bg-amber-900/10 rounded-xl p-3 text-center">
                <Coins className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                <p className="text-[18px] font-black text-amber-700">{(selectedUser.points ?? 0).toLocaleString('ar-SY')}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)]">نقطة</p>
              </div>
              <div className="bg-sky-50/30 dark:bg-sky-900/10 rounded-xl p-3 text-center">
                <Clock className="w-4 h-4 text-sky-500 mx-auto mb-1" />
                <p className="text-[14px] font-black text-sky-700">{timeAgo(selectedUser.createdAt)}</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)]">الانضمام</p>
              </div>
            </div>

            {/* Info */}
            <div className="bg-[var(--color-bg)]/50 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--color-text-tertiary)] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> البريد الإلكتروني
                </span>
                <span className="text-[12px] font-bold text-[var(--color-text)]" dir="ltr">{selectedUser.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--color-text-tertiary)] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> تاريخ التسجيل
                </span>
                <span className="text-[12px] font-bold text-[var(--color-text)]">{new Date(selectedUser.createdAt).toLocaleDateString('ar-SY')}</span>
              </div>
              {selectedUser.status === 'banned' && selectedUser.banReason && (
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-rose-500 flex items-center gap-1.5">
                    <Ban className="w-3.5 h-3.5" /> سبب الحظر
                  </span>
                  <span className="text-[12px] font-bold text-rose-500">{selectedUser.banReason}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
              {selectedUser.status === 'active' ? (
                <ActionBtn
                  icon={<Ban className="w-3.5 h-3.5" />}
                  label="حظر"
                  onClick={() => {
                    store.banUser(selectedUser.id, '7 أيام', 'حظر من إدارة المستخدمين');
                    toast.success('تم حظر المستخدم');
                    setSelectedUser(null);
                  }}
                  variant="danger"
                />
              ) : (
                <ActionBtn
                  icon={<ShieldOff className="w-3.5 h-3.5" />}
                  label="فك الحظر"
                  onClick={() => {
                    store.unbanUser(selectedUser.id);
                    toast.success('تم فك الحظر');
                    setSelectedUser(null);
                  }}
                  variant="success"
                />
              )}
              <ActionBtn
                icon={<Trash2 className="w-3.5 h-3.5" />}
                label="حذف"
                onClick={async () => {
                  if (confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
                    try {
                      await store.deleteUser(selectedUser.id);
                      toast.success('تم حذف المستخدم');
                      setSelectedUser(null);
                    } catch {
                      toast.error('فشل حذف المستخدم');
                    }
                  }
                }}
                variant="danger"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Ban Confirm */}
      <ConfirmDialog
        isOpen={confirmBulkBan}
        onClose={() => setConfirmBulkBan(false)}
        onConfirm={handleBulkBan}
        title="حظر جماعي"
        message={`هل أنت متأكد من حظر ${selectedUsers.size} مستخدم؟`}
        variant="danger"
      />

      {/* Bulk Delete Confirm */}
      <ConfirmDialog
        isOpen={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={handleBulkDelete}
        title="حذف جماعي"
        message={`هل أنت متأكد من حذف ${selectedUsers.size} مستخدم؟ سيتم حذف جميع بياناتهم نهائياً.`}
        variant="danger"
      />
    </div>
  );
};

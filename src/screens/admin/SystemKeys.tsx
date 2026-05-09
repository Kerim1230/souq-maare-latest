'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Key, Shield, Mail, Database, Eye, EyeOff, Pencil, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Save } from 'lucide-react';
import { DataCard, SectionHeader, LoadingSpinner } from '@/components/admin/AdminShared';
import { Modal } from '@/components/market/Modal';
import { Button } from '@/components/market/Button';
import toast from 'react-hot-toast';

interface SystemKey {
  key: string;
  label: string;
  displayValue: string;
  isSet: boolean;
  isValid: boolean;
  validationMessage: string;
  isSecret: boolean;
}

export const SystemKeys: React.FC = () => {
  const [keys, setKeys] = useState<SystemKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState<SystemKey | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system-keys');
      const json = await res.json();
      if (json.success && json.data?.keys) {
        setKeys(json.data.keys);
      }
    } catch (err) {
      console.error('Failed to fetch system keys:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleSave = async () => {
    if (!editKey || !editValue.trim()) {
      toast.error('يرجى إدخال قيمة المفتاح');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/system-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: editKey.key, value: editValue.trim() }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(`تم تحديث ${editKey.label} بنجاح`);
        setEditKey(null);
        setEditValue('');
        fetchKeys();
      } else {
        toast.error(json.error || 'فشل تحديث المفتاح');
      }
    } catch {
      toast.error('حدث خطأ أثناء التحديث');
    } finally {
      setSaving(false);
    }
  };

  const getKeyIcon = (keyName: string) => {
    if (keyName === 'DATABASE_URL') return <Database className="w-4 h-4" />;
    if (keyName === 'SESSION_SECRET') return <Shield className="w-4 h-4" />;
    if (keyName === 'ADMIN_EMAIL') return <Mail className="w-4 h-4" />;
    return <Key className="w-4 h-4" />;
  };

  if (loading) return <LoadingSpinner message="جاري تحميل المفاتيح..." />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
            <Key className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-[16px] font-black text-[var(--color-text)]">مفاتيح النظام</h2>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">إدارة مفاتيح البيئة والإعدادات الحساسة</p>
          </div>
        </div>
        <button
          onClick={() => { setLoading(true); fetchKeys(); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          تحديث
        </button>
      </div>

      {/* Warning */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-200/40 dark:border-amber-800/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-bold text-amber-700 dark:text-amber-400">تحذير</p>
            <p className="text-[12px] text-amber-600 dark:text-amber-300 mt-1">تعديل هذه المفاتيح قد يؤثر على عمل النظام. تأكد من معرفة القيمة الصحيحة قبل التعديل. بعض التغييرات قد تتطلب إعادة تشغيل الخادم.</p>
          </div>
        </div>
      </div>

      {/* Keys Table */}
      <DataCard>
        <SectionHeader title="جميع المفاتيح" subtitle={`${keys.length} مفتاح`} />
        
        {/* Header Row */}
        <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 bg-[var(--color-bg)]/50 rounded-lg mb-2">
          <span className="col-span-3 text-[10px] font-bold text-[var(--color-text-tertiary)]">المفتاح</span>
          <span className="col-span-4 text-[10px] font-bold text-[var(--color-text-tertiary)]">القيمة</span>
          <span className="col-span-3 text-[10px] font-bold text-[var(--color-text-tertiary)]">الحالة</span>
          <span className="col-span-2 text-[10px] font-bold text-[var(--color-text-tertiary)]">إجراء</span>
        </div>

        {/* Key Rows */}
        <div className="space-y-2">
          {keys.map(k => (
            <div key={k.key} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-2 items-center px-3 py-3 rounded-xl bg-[var(--color-bg)]/30 hover:bg-[var(--color-bg)]/60 transition-colors">
              {/* Key Name */}
              <div className="sm:col-span-3 flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${k.isValid ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-500'}`}>
                  {getKeyIcon(k.key)}
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-[var(--color-text)] truncate">{k.label}</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)]">{k.key}</p>
                </div>
              </div>

              {/* Value */}
              <div className="sm:col-span-4">
                <div className="flex items-center gap-2">
                  <code className="text-[11px] text-[var(--color-text-secondary)] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded font-mono truncate max-w-[200px]">
                    {k.displayValue}
                  </code>
                  {k.isSecret && (
                    <span className="text-[9px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 px-1.5 py-0.5 rounded">سري</span>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="sm:col-span-3">
                <div className="flex items-center gap-1.5">
                  {k.isValid ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                  )}
                  <span className={`text-[11px] font-bold ${k.isValid ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {k.validationMessage}
                  </span>
                </div>
                {!k.isSet && (
                  <span className="text-[10px] text-rose-400">غير محدد</span>
                )}
              </div>

              {/* Action */}
              <div className="sm:col-span-2 flex justify-end sm:justify-start">
                <button
                  onClick={() => { setEditKey(k); setEditValue(''); setShowValue(false); }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  تغيير
                </button>
              </div>
            </div>
          ))}
        </div>
      </DataCard>

      {/* Edit Modal */}
      <Modal isOpen={!!editKey} onClose={() => setEditKey(null)} title={`تعديل ${editKey?.label}`}>
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-100/40">
            <p className="text-[12px] text-amber-600 dark:text-amber-400">
              <span className="font-bold">تحذير:</span> تغيير هذا المفتاح سيؤثر على عمل النظام فوراً.
            </p>
          </div>

          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">
              مفتاح: <span className="text-[var(--color-text-tertiary)]">{editKey?.key}</span>
            </label>
            <div className="relative">
              <input
                type={editKey?.isSecret && !showValue ? 'password' : 'text'}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                placeholder={editKey?.isSecret ? 'أدخل القيمة الجديدة...' : editKey?.displayValue}
                className="w-full h-11 bg-[var(--color-surface)] border border-emerald-100 dark:border-emerald-800 rounded-xl px-4 text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] outline-none focus:ring-2 focus:ring-emerald-500/15"
                dir="ltr"
              />
              {editKey?.isSecret && (
                <button
                  onClick={() => setShowValue(!showValue)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
                >
                  {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          <Button
            variant="primary"
            fullWidth
            onClick={handleSave}
            loading={saving}
            icon={<Save className="w-4 h-4" />}
          >
            حفظ التغيير
          </Button>
        </div>
      </Modal>
    </div>
  );
};

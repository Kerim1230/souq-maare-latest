import { create } from 'zustand';

// ===== STORE THEME COLOR SYSTEM =====

export interface StoreGradientColor {
  id: string;
  name: string;
  icon: string;
  // Main gradient
  from: string;
  to: string;
  // Shadow colors
  shadow: string;
  shadowLight: string;
  // Badge / accent
  badge: string;
  // Light mode tints
  lightFrom: string;
  lightTo: string;
  lightBg: string;
  lightBorder: string;
  lightText: string;
  // Dark mode tints
  darkFrom: string;
  darkTo: string;
  darkBg: string;
  darkBorder: string;
  darkText: string;
  // Solid versions
  solid: string;
  solidLight: string;
  solidDark: string;
}

export const STORE_COLORS: StoreGradientColor[] = [
  {
    id: 'royal-blue',
    name: 'أزرق ملكي',
    icon: '👑',
    from: '#1e40af',
    to: '#3b82f6',
    shadow: 'rgba(37, 99, 235, 0.3)',
    shadowLight: 'rgba(37, 99, 235, 0.15)',
    badge: 'bg-blue-500',
    lightFrom: '#dbeafe',
    lightTo: '#bfdbfe',
    lightBg: 'bg-blue-50',
    lightBorder: 'border-blue-200',
    lightText: 'text-blue-700',
    darkFrom: '#1e3a5f',
    darkTo: '#1e40af',
    darkBg: 'bg-blue-900/20',
    darkBorder: 'border-blue-700/40',
    darkText: 'text-blue-400',
    solid: '#2563eb',
    solidLight: '#3b82f6',
    solidDark: '#60a5fa',
  },
  {
    id: 'emerald',
    name: 'أخضر زمردي',
    icon: '💎',
    from: '#047857',
    to: '#10b981',
    shadow: 'rgba(16, 185, 129, 0.3)',
    shadowLight: 'rgba(16, 185, 129, 0.15)',
    badge: 'bg-emerald-500',
    lightFrom: '#d1fae5',
    lightTo: '#a7f3d0',
    lightBg: 'bg-emerald-50',
    lightBorder: 'border-emerald-200',
    lightText: 'text-emerald-700',
    darkFrom: '#064e3b',
    darkTo: '#047857',
    darkBg: 'bg-emerald-900/20',
    darkBorder: 'border-emerald-700/40',
    darkText: 'text-emerald-400',
    solid: '#059669',
    solidLight: '#10b981',
    solidDark: '#34d399',
  },
  {
    id: 'luxury-purple',
    name: 'بنفسجي فاخر',
    icon: '🔮',
    from: '#7c3aed',
    to: '#a78bfa',
    shadow: 'rgba(139, 92, 246, 0.3)',
    shadowLight: 'rgba(139, 92, 246, 0.15)',
    badge: 'bg-violet-500',
    lightFrom: '#ede9fe',
    lightTo: '#ddd6fe',
    lightBg: 'bg-violet-50',
    lightBorder: 'border-violet-200',
    lightText: 'text-violet-700',
    darkFrom: '#3b0764',
    darkTo: '#7c3aed',
    darkBg: 'bg-violet-900/20',
    darkBorder: 'border-violet-700/40',
    darkText: 'text-violet-400',
    solid: '#8b5cf6',
    solidLight: '#a78bfa',
    solidDark: '#c4b5fd',
  },
  {
    id: 'golden',
    name: 'ذهبي راقٍ',
    icon: '🏆',
    from: '#b45309',
    to: '#f59e0b',
    shadow: 'rgba(245, 158, 11, 0.3)',
    shadowLight: 'rgba(245, 158, 11, 0.15)',
    badge: 'bg-amber-500',
    lightFrom: '#fef3c7',
    lightTo: '#fde68a',
    lightBg: 'bg-amber-50',
    lightBorder: 'border-amber-200',
    lightText: 'text-amber-700',
    darkFrom: '#78350f',
    darkTo: '#b45309',
    darkBg: 'bg-amber-900/20',
    darkBorder: 'border-amber-700/40',
    darkText: 'text-amber-400',
    solid: '#d97706',
    solidLight: '#f59e0b',
    solidDark: '#fbbf24',
  },
  {
    id: 'cherry-red',
    name: 'أحمر كرزي',
    icon: '🍒',
    from: '#be123c',
    to: '#f43f5e',
    shadow: 'rgba(244, 63, 94, 0.3)',
    shadowLight: 'rgba(244, 63, 94, 0.15)',
    badge: 'bg-rose-500',
    lightFrom: '#ffe4e6',
    lightTo: '#fecdd3',
    lightBg: 'bg-rose-50',
    lightBorder: 'border-rose-200',
    lightText: 'text-rose-700',
    darkFrom: '#4c0519',
    darkTo: '#be123c',
    darkBg: 'bg-rose-900/20',
    darkBorder: 'border-rose-700/40',
    darkText: 'text-rose-400',
    solid: '#e11d48',
    solidLight: '#f43f5e',
    solidDark: '#fb7185',
  },
  {
    id: 'modern-teal',
    name: 'تركواز عصري',
    icon: '🌊',
    from: '#0f766e',
    to: '#14b8a6',
    shadow: 'rgba(20, 184, 166, 0.3)',
    shadowLight: 'rgba(20, 184, 166, 0.15)',
    badge: 'bg-teal-500',
    lightFrom: '#ccfbf1',
    lightTo: '#99f6e4',
    lightBg: 'bg-teal-50',
    lightBorder: 'border-teal-200',
    lightText: 'text-teal-700',
    darkFrom: '#042f2e',
    darkTo: '#0f766e',
    darkBg: 'bg-teal-900/20',
    darkBorder: 'border-teal-700/40',
    darkText: 'text-teal-400',
    solid: '#0d9488',
    solidLight: '#14b8a6',
    solidDark: '#2dd4bf',
  },
  {
    id: 'warm-orange',
    name: 'برتقالي دافئ',
    icon: '🔥',
    from: '#c2410c',
    to: '#f97316',
    shadow: 'rgba(249, 115, 22, 0.3)',
    shadowLight: 'rgba(249, 115, 22, 0.15)',
    badge: 'bg-orange-500',
    lightFrom: '#ffedd5',
    lightTo: '#fed7aa',
    lightBg: 'bg-orange-50',
    lightBorder: 'border-orange-200',
    lightText: 'text-orange-700',
    darkFrom: '#431407',
    darkTo: '#c2410c',
    darkBg: 'bg-orange-900/20',
    darkBorder: 'border-orange-700/40',
    darkText: 'text-orange-400',
    solid: '#ea580c',
    solidLight: '#f97316',
    solidDark: '#fb923c',
  },
  {
    id: 'elegant-pink',
    name: 'وردي أنيق',
    icon: '🌸',
    from: '#be185d',
    to: '#ec4899',
    shadow: 'rgba(236, 72, 153, 0.3)',
    shadowLight: 'rgba(236, 72, 153, 0.15)',
    badge: 'bg-pink-500',
    lightFrom: '#fce7f3',
    lightTo: '#fbcfe8',
    lightBg: 'bg-pink-50',
    lightBorder: 'border-pink-200',
    lightText: 'text-pink-700',
    darkFrom: '#500724',
    darkTo: '#be185d',
    darkBg: 'bg-pink-900/20',
    darkBorder: 'border-pink-700/40',
    darkText: 'text-pink-400',
    solid: '#db2777',
    solidLight: '#ec4899',
    solidDark: '#f472b6',
  },
  {
    id: 'professional',
    name: 'رمادي احترافي',
    icon: '💼',
    from: '#374151',
    to: '#6b7280',
    shadow: 'rgba(107, 114, 128, 0.3)',
    shadowLight: 'rgba(107, 114, 128, 0.15)',
    badge: 'bg-gray-500',
    lightFrom: '#f3f4f6',
    lightTo: '#e5e7eb',
    lightBg: 'bg-gray-50',
    lightBorder: 'border-gray-300',
    lightText: 'text-gray-700',
    darkFrom: '#1f2937',
    darkTo: '#374151',
    darkBg: 'bg-gray-800/40',
    darkBorder: 'border-gray-600/40',
    darkText: 'text-gray-300',
    solid: '#4b5563',
    solidLight: '#6b7280',
    solidDark: '#9ca3af',
  },
  {
    id: 'sky-blue',
    name: 'سماوي صافٍ',
    icon: '☁️',
    from: '#0369a1',
    to: '#38bdf8',
    shadow: 'rgba(56, 189, 248, 0.3)',
    shadowLight: 'rgba(56, 189, 248, 0.15)',
    badge: 'bg-sky-500',
    lightFrom: '#e0f2fe',
    lightTo: '#bae6fd',
    lightBg: 'bg-sky-50',
    lightBorder: 'border-sky-200',
    lightText: 'text-sky-700',
    darkFrom: '#0c4a6e',
    darkTo: '#0369a1',
    darkBg: 'bg-sky-900/20',
    darkBorder: 'border-sky-700/40',
    darkText: 'text-sky-400',
    solid: '#0284c7',
    solidLight: '#38bdf8',
    solidDark: '#7dd3fc',
  },
  {
    id: 'lime-fresh',
    name: 'ليموني طازج',
    icon: '🍋',
    from: '#4d7c0f',
    to: '#84cc16',
    shadow: 'rgba(132, 204, 22, 0.3)',
    shadowLight: 'rgba(132, 204, 22, 0.15)',
    badge: 'bg-lime-500',
    lightFrom: '#ecfccb',
    lightTo: '#d9f99d',
    lightBg: 'bg-lime-50',
    lightBorder: 'border-lime-200',
    lightText: 'text-lime-700',
    darkFrom: '#365314',
    darkTo: '#4d7c0f',
    darkBg: 'bg-lime-900/20',
    darkBorder: 'border-lime-700/40',
    darkText: 'text-lime-400',
    solid: '#65a30d',
    solidLight: '#84cc16',
    solidDark: '#a3e635',
  },
  {
    id: 'coral-warm',
    name: 'مرجاني دافئ',
    icon: '🪸',
    from: '#c2410c',
    to: '#fb923c',
    shadow: 'rgba(251, 146, 60, 0.3)',
    shadowLight: 'rgba(251, 146, 60, 0.15)',
    badge: 'bg-orange-400',
    lightFrom: '#fff7ed',
    lightTo: '#ffedd5',
    lightBg: 'bg-orange-50',
    lightBorder: 'border-orange-200',
    lightText: 'text-orange-700',
    darkFrom: '#431407',
    darkTo: '#9a3412',
    darkBg: 'bg-orange-900/20',
    darkBorder: 'border-orange-700/40',
    darkText: 'text-orange-400',
    solid: '#ea580c',
    solidLight: '#fb923c',
    solidDark: '#fdba74',
  },
  {
    id: 'indigo-night',
    name: 'نيلي ليلي',
    icon: '🌙',
    from: '#4338ca',
    to: '#818cf8',
    shadow: 'rgba(129, 140, 248, 0.3)',
    shadowLight: 'rgba(129, 140, 248, 0.15)',
    badge: 'bg-indigo-500',
    lightFrom: '#e0e7ff',
    lightTo: '#c7d2fe',
    lightBg: 'bg-indigo-50',
    lightBorder: 'border-indigo-200',
    lightText: 'text-indigo-700',
    darkFrom: '#312e81',
    darkTo: '#4338ca',
    darkBg: 'bg-indigo-900/20',
    darkBorder: 'border-indigo-700/40',
    darkText: 'text-indigo-400',
    solid: '#6366f1',
    solidLight: '#818cf8',
    solidDark: '#a5b4fc',
  },
  {
    id: 'mint-cool',
    name: 'نعناعي منعش',
    icon: '🌿',
    from: '#0f766e',
    to: '#5eead4',
    shadow: 'rgba(94, 234, 212, 0.3)',
    shadowLight: 'rgba(94, 234, 212, 0.15)',
    badge: 'bg-teal-400',
    lightFrom: '#f0fdfa',
    lightTo: '#ccfbf1',
    lightBg: 'bg-teal-50',
    lightBorder: 'border-teal-200',
    lightText: 'text-teal-700',
    darkFrom: '#042f2e',
    darkTo: '#0f766e',
    darkBg: 'bg-teal-900/20',
    darkBorder: 'border-teal-700/40',
    darkText: 'text-teal-400',
    solid: '#14b8a6',
    solidLight: '#5eead4',
    solidDark: '#99f6e4',
  },
  {
    id: 'burgundy-wine',
    name: 'عنابي كلاسيكي',
    icon: '🍷',
    from: '#881337',
    to: '#e11d48',
    shadow: 'rgba(225, 29, 72, 0.3)',
    shadowLight: 'rgba(225, 29, 72, 0.15)',
    badge: 'bg-rose-700',
    lightFrom: '#fff1f2',
    lightTo: '#ffe4e6',
    lightBg: 'bg-rose-50',
    lightBorder: 'border-rose-200',
    lightText: 'text-rose-700',
    darkFrom: '#4c0519',
    darkTo: '#881337',
    darkBg: 'bg-rose-900/20',
    darkBorder: 'border-rose-700/40',
    darkText: 'text-rose-400',
    solid: '#be123c',
    solidLight: '#e11d48',
    solidDark: '#fb7185',
  },
  {
    id: 'luxury-black',
    name: 'أسود فاخر',
    icon: '🖤',
    from: '#18181b',
    to: '#3f3f46',
    shadow: 'rgba(63, 63, 70, 0.4)',
    shadowLight: 'rgba(63, 63, 70, 0.2)',
    badge: 'bg-zinc-600',
    lightFrom: '#f4f4f5',
    lightTo: '#e4e4e7',
    lightBg: 'bg-zinc-100',
    lightBorder: 'border-zinc-300',
    lightText: 'text-zinc-800',
    darkFrom: '#18181b',
    darkTo: '#27272a',
    darkBg: 'bg-zinc-900/30',
    darkBorder: 'border-zinc-700/40',
    darkText: 'text-zinc-300',
    solid: '#27272a',
    solidLight: '#3f3f46',
    solidDark: '#71717a',
  },
];

// ===== IN-MEMORY STATE (resets on page refresh) =====

interface ColorChangeRecord {
  storeId: string;
  colorId: string;
  changedAt: string;
}

interface StoreColorState {
  colorChanges: Record<string, ColorChangeRecord>;
  initialized: boolean;

  initialize: () => void;
  canChangeColor: (_storeId: string) => { allowed: boolean; remainingMs: number; remainingText: string };
  setStoreColor: (_storeId: string, _colorId: string) => void;
  getStoreColor: (_storeId: string) => StoreGradientColor | null;
  getStoreColorById: (_colorId: string) => StoreGradientColor | undefined;
}

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

function getTimeRemainingText(ms: number): string {
  if (ms <= 0) return '';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  if (hours > 0) return `${hours} ساعة و ${minutes} دقيقة`;
  if (minutes > 0) return `${minutes} دقيقة و ${seconds} ثانية`;
  return `${seconds} ثانية`;
}

export const useStoreColorStore = create<StoreColorState>((set, get) => ({
  colorChanges: {},
  initialized: false,

  initialize: () => {
    if (typeof window === 'undefined') return;
    if (get().initialized) return;
    set({ initialized: true });
  },

  canChangeColor: (storeId) => {
    const record = get().colorChanges[storeId];
    if (!record) return { allowed: true, remainingMs: 0, remainingText: '' };
    const elapsed = Date.now() - new Date(record.changedAt).getTime();
    const remaining = COOLDOWN_MS - elapsed;
    if (remaining <= 0) return { allowed: true, remainingMs: 0, remainingText: '' };
    return {
      allowed: false,
      remainingMs: remaining,
      remainingText: getTimeRemainingText(remaining),
    };
  },

  setStoreColor: (storeId, colorId) => {
    const changes = { ...get().colorChanges };
    changes[storeId] = { storeId, colorId, changedAt: new Date().toISOString() };
    set({ colorChanges: changes });
  },

  getStoreColor: (storeId) => {
    const record = get().colorChanges[storeId];
    if (!record) return null;
    return STORE_COLORS.find(c => c.id === record.colorId) || null;
  },

  getStoreColorById: (colorId) => {
    return STORE_COLORS.find(c => c.id === colorId);
  },

}));

import { create } from 'zustand';
import { apiPost } from '@/lib/fetchApi';

// ===== TYPES =====
export type ShareableType = 'store' | 'product' | 'offer' | 'contest';

interface ShareRecord {
  id: string;
  itemType: ShareableType;
  itemId: string;
  itemName: string;
  itemNameAr: string;
  storeId?: string;
  storeName?: string;
  imageUrl?: string;
  platform: string;
  createdAt: string;
}

interface VisitRecord {
  id: string;
  itemType: ShareableType;
  itemId: string;
  itemName: string;
  itemNameAr: string;
  referrer: string;
  createdAt: string;
}

// ===== STORE =====
interface ShareState {
  shareRecords: ShareRecord[];
  visitRecords: VisitRecord[];
  initialized: boolean;
  error: string | null;

  initialize: () => void;

  // Generate share URL
  getShareUrl: (_type: ShareableType, _id: string) => string;

  // Record a share action
  recordShare: (_params: {
    itemType: ShareableType;
    itemId: string;
    itemName: string;
    itemNameAr: string;
    storeId?: string;
    storeName?: string;
    imageUrl?: string;
    platform: string;
  }) => Promise<void>;

}

export const useShareStore = create<ShareState>((set, get) => ({
  shareRecords: [],
  visitRecords: [],
  initialized: false,
  error: null,

  initialize: () => {
    if (typeof window === 'undefined') return;
    if (get().initialized) return;
    set({ initialized: true });
  },

  getShareUrl: (type, id) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/share/${type}/${id}`;
  },

  recordShare: async ({ itemType, itemId, itemName, itemNameAr, storeId, storeName, imageUrl, platform }) => {
    try {
      // Track share on the server
      await apiPost('/api/share/track', { itemType, itemId });

      // Update local in-memory state
      const record: ShareRecord = {
        id: `shr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        itemType,
        itemId,
        itemName: itemName || itemNameAr,
        itemNameAr,
        storeId,
        storeName,
        imageUrl,
        platform,
        createdAt: new Date().toISOString(),
      };
      const records = [record, ...get().shareRecords].slice(0, 500);
      set({ shareRecords: records });
    } catch {
      // Silent fail
    }
  },

}));

import { create } from 'zustand';
import type { Product, Store, Favorite, SubScreen } from '@/types';
import { apiGet } from '@/lib/fetchApi';
import { isHydrated, markHydrated } from '@/lib/hydration';
import { ttlCache } from '@/lib/ttlCache';

export type { Product, Store, Favorite };

interface HomeData {
  featured_products: any[];
  new_products: any[];
  featured_stores: any[];
  offers: any[];
  featured_total?: number;
  new_total?: number;
}

interface AppState {
  // UI State
  activeTab: number;
  subScreen: SubScreen;
  selectedStoreId: string | null;
  selectedProductId: string | null;
  selectedOfferId: string | null;
  searchQuery: string;

  // Data (populated from API or other stores)
  favorites: Favorite[];
  followedStores: Store[];
  myStore: Store | null;
  myProducts: Product[];

  // Home page data
  homeData: HomeData | null;
  homeDataLoading: boolean;

  // Loading & Error
  myProductsLoading: boolean;

  // UI Actions
  setActiveTab: (_tab: number) => void;
  setSubScreen: (_screen: SubScreen) => void;
  setSelectedStoreId: (_id: string | null) => void;
  setSelectedProductId: (_id: string | null) => void;
  setSelectedOfferId: (_id: string | null) => void;
  setSearchQuery: (_query: string) => void;
  openProductDetail: (_productId: string) => void;
  openOfferDetail: (_offerId: string) => void;
  openStoreDetail: (_storeId: string) => void;
  goBack: () => void;

  // Data Actions (optimistic — UI only)
  setFavorites: (_favorites: Favorite[]) => void;
  addFavorite: (_favorite: Favorite) => void;
  removeFavorite: (_id: string) => void;
  setFollowedStores: (_stores: Store[]) => void;
  removeFollowedStore: (_storeId: string) => void;
  setMyStore: (_store: Store | null) => void;
  setMyProducts: (_products: Product[]) => void;
  setMyProductsLoading: (_loading: boolean) => void;

  // Centralized fetch actions (single source of truth for data loading)
  fetchFavorites: (_userId: string) => Promise<void>;
  fetchFollowedStores: (_userId: string) => Promise<void>;

  // Home page data actions
  fetchHomePage: (_userId?: string) => Promise<HomeData | null>;
  loadHomeFromCache: () => HomeData | null;
  saveHomeToCache: (_data: HomeData) => void;

}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 0,
  favorites: [],
  followedStores: [],
  myStore: null,
  myProducts: [],
  homeData: null,
  homeDataLoading: false,
  subScreen: 'none',
  selectedStoreId: null,
  selectedProductId: null,
  selectedOfferId: null,
  searchQuery: '',
  myProductsLoading: false,

  setActiveTab: (tab) => set({ activeTab: tab, subScreen: 'none' }),
  setFavorites: (favorites) => set({ favorites }),
  addFavorite: (favorite) => {
    ttlCache.invalidateByPrefix('favorites:');
    return set((state) => ({
      favorites: [favorite, ...state.favorites],
    }));
  },
  removeFavorite: (id) => {
    ttlCache.invalidateByPrefix('favorites:');
    return set((state) => ({
      favorites: state.favorites.filter((f) => f.id !== id),
    }));
  },
  setFollowedStores: (stores) => set({ followedStores: stores }),
  removeFollowedStore: (storeId) => {
    ttlCache.invalidateByPrefix('followedStores:');
    return set((state) => ({
      followedStores: state.followedStores.filter((s) => s.id !== storeId),
    }));
  },
  setMyStore: (store) => set({ myStore: store }),
  setMyProducts: (products) => set({ myProducts: products, myProductsLoading: false }),
  setMyProductsLoading: (loading) => set({ myProductsLoading: loading }),
  setSubScreen: (screen) => set({ subScreen: screen }),
  setSelectedStoreId: (id) => set({ selectedStoreId: id }),
  setSelectedProductId: (id) => set({ selectedProductId: id }),
  setSelectedOfferId: (id) => set({ selectedOfferId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  openProductDetail: (productId) => set({
    selectedProductId: productId,
    subScreen: 'product-detail',
  }),
  openOfferDetail: (offerId) => set({
    selectedOfferId: offerId,
    subScreen: 'offer-detail',
  }),
  openStoreDetail: (storeId) => set({
    selectedStoreId: storeId,
    subScreen: 'store-detail',
  }),
  goBack: () => set({ subScreen: 'none' }),
  // ── Centralized fetch: favorites (hydration-tracked) ──
  fetchFavorites: async (userId) => {
    if (isHydrated('favorites')) return;
    try {
      const { data, error } = await apiGet<{ favorites: Favorite[] }>(
        `/api/favorites?userId=${userId}`
      );
      if (!error && data) {
        const favorites = data.favorites || [];
        set({ favorites });
      }
    } catch {
      // Non-critical: screens can retry
    } finally {
      markHydrated('favorites');
    }
  },

  // ── Centralized fetch: followed stores (hydration-tracked) ──
  fetchFollowedStores: async (userId) => {
    if (isHydrated('followedStores')) return;
    try {
      const { data, error } = await apiGet<{ stores: Store[] }>(
        `/api/stores/followed?userId=${userId}`
      );
      if (!error && data) {
        const stores = data.stores || [];
        set({ followedStores: stores });
      }
    } catch {
      // Non-critical: screens can retry
    } finally {
      markHydrated('followedStores');
    }
  },

  // ── Home page data: fetch from API ──
  fetchHomePage: async (userId?: string) => {
    set({ homeDataLoading: true });
    try {
      const url = `/api/home?userId=${userId || ''}&fpPage=1&npPage=1`;
      const { data, error } = await apiGet<HomeData>(url);
      if (!error && data) {
        set({ homeData: data, homeDataLoading: false });
        // Save to localStorage for instant next load
        get().saveHomeToCache(data);
        return data;
      }
      set({ homeDataLoading: false });
      return null;
    } catch {
      set({ homeDataLoading: false });
      return null;
    }
  },

  // ── Home page data: load from localStorage cache ──
  loadHomeFromCache: () => {
    try {
      const raw = localStorage.getItem('homepage_cache');
      if (!raw) return null;
      const cached = JSON.parse(raw);
      // Cache expires after 10 minutes
      if (Date.now() - cached.ts > 10 * 60 * 1000) return null;
      set({ homeData: cached.data });
      return cached.data;
    } catch {
      return null;
    }
  },

  // ── Home page data: save to localStorage cache ──
  saveHomeToCache: (data) => {
    try {
      localStorage.setItem('homepage_cache', JSON.stringify({ data, ts: Date.now() }));
    } catch {
      // localStorage quota exceeded
    }
  },
}));

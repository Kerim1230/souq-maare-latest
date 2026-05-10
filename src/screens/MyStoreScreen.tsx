'use client';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Plus, Store, Package, Image as ImageIcon, Loader2, Trash2,
  ShoppingBag, Users, Star, Gift, Trophy, MessageCircle, MessageSquare,
  Edit3, ChevronDown, ChevronUp, ChevronLeft, AlertTriangle, Eye, Clock,
  ShieldCheck, Lock, Crown, Share2, PenLine
} from 'lucide-react';
import { Button } from '@/components/market/Button';
import { Input } from '@/components/market/Input';
import { Modal } from '@/components/market/Modal';
import { ImageUploader } from '@/components/market/ImageUploader';
import { CommentsSection } from '@/components/market/CommentsSection';
import { SafeImage, StoreLogo } from '@/components/market/SafeImage';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { CATEGORY_META } from '@/components/market/CategoryGrid';
import type { Product } from '@/store/appStore';
import { getTimeRemaining, getUrgencyColors, getExpiryDate, type DurationDays } from '@/store/autoDeleteStore';
import { useVerificationStore } from '@/store/verificationStore';
import { getPlan, getDurationOptions as getDurationOptionsForTier } from '@/lib/constants';
import { ShareSheet } from '@/components/market/ShareSheet';
import { StoreColorPicker } from '@/components/market/StoreColorPicker';
import { useStoreColorStore } from '@/store/storeColorStore';
import { useChatStore } from '@/store/chatStore';
import toast from 'react-hot-toast';
import { apiGet, apiPost, apiPut, apiDelete, ensureCsrfReady, fetchApi } from '@/lib/fetchApi';
import { useStoreTheme } from '@/hooks/useStoreTheme';
import { uploadImage } from '@/lib/upload-utils';
import { getGovernorateNames, getCitiesForGovernorate } from '@/lib/syria-data';

// Sorted category list from CATEGORY_META (same source as CategoryGrid on home page)
const SORTED_CATEGORIES: string[] = Object.keys(CATEGORY_META).sort((a, b) => a.localeCompare(b, 'ar'));
const DEFAULT_CATEGORY = SORTED_CATEGORIES[0] || 'عام';

// ===== Chat Unread Badge =====
const ChatUnreadBadge: React.FC<{ storeId: string }> = ({ storeId }) => {
  const unread = useChatStore((s) => s.conversations.reduce((sum, c) => sum + (c.storeId === storeId ? (c.unreadCount || 0) : 0), 0));

  useEffect(() => {
    useChatStore.getState().initialize();
  }, []);

  if (unread === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-rose-500 rounded-full flex items-center justify-center text-[8px] font-black text-white px-0.5 z-10">
      {unread > 99 ? '99+' : unread}
    </span>
  );
};

interface StoreOffer {
  id: string;
  store_id: string;
  user_id: string;
  title: string;
  description?: string;
  image_url?: string;
  type: string;
  discount?: string;
  expires_at?: string | null;
  created_at: string;
  comments_count: number;
}

export const MyStoreScreen: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const myStore = useAppStore(s => s.myStore);
  const myProducts = useAppStore(s => s.myProducts);
  const setMyStore = useAppStore(s => s.setMyStore);
  const setMyProducts = useAppStore(s => s.setMyProducts);
  const setSelectedStoreId = useAppStore(s => s.setSelectedStoreId);
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const verificationInitialized = useVerificationStore(s => s.initialized);
  const storeTier = useVerificationStore(s => myStore ? s.getStoreTier(myStore.id) : 'unverified');
  const isStoreVerified = storeTier !== 'unverified';
  const getStoreColorById = useStoreColorStore(s => s.getStoreColorById);
  const theme = useStoreTheme();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'offers' | 'settings'>('products');

  // Categories sourced from CATEGORY_META (unified with home page CategoryGrid)
  const firstCategory = DEFAULT_CATEGORY;

  // Create Store
  const [showCreateStore, setShowCreateStore] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeDesc, setStoreDesc] = useState('');
  const [storeCategory, setStoreCategory] = useState(DEFAULT_CATEGORY);
  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const [storeCover, setStoreCover] = useState<string | null>(null);
  const [storeGovernorate, setStoreGovernorate] = useState('');
  const [storeCity, setStoreCity] = useState('');
  const [storeDistrict, setStoreDistrict] = useState('');
  const [storeLocation, setStoreLocation] = useState('');
  const [creatingStore, setCreatingStore] = useState(false);

  // Add Product
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productCategory, setProductCategory] = useState(DEFAULT_CATEGORY);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [productDuration, setProductDuration] = useState<DurationDays>(7);
  const [addingProduct, setAddingProduct] = useState(false);

  // AI Description Writer
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiDescLoading, setAiDescLoading] = useState(false);

  // Edit Product
  const [showEditProduct, setShowEditProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editProductName, setEditProductName] = useState('');
  const [editProductDesc, setEditProductDesc] = useState('');
  const [editProductPrice, setEditProductPrice] = useState('');
  const [editProductCategory, setEditProductCategory] = useState(DEFAULT_CATEGORY);
  const [editProductImage, setEditProductImage] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Add Offer
  const [showAddOffer, setShowAddOffer] = useState(false);
  const [offerTitle, setOfferTitle] = useState('');
  const [offerDesc, setOfferDesc] = useState('');
  const [offerType, setOfferType] = useState<'offer' | 'contest'>('offer');
  const [offerDiscount, setOfferDiscount] = useState('');
  const [offerImage, setOfferImage] = useState<string | null>(null);
  const [offerDuration, setOfferDuration] = useState<DurationDays>(7);
  const [addingOffer, setAddingOffer] = useState(false);

  // Edit Offer
  const [showEditOffer, setShowEditOffer] = useState(false);
  const [editingOffer, setEditingOffer] = useState<StoreOffer | null>(null);
  const [editOfferTitle, setEditOfferTitle] = useState('');
  const [editOfferDesc, setEditOfferDesc] = useState('');
  const [editOfferType, setEditOfferType] = useState<'offer' | 'contest'>('offer');
  const [editOfferDiscount, setEditOfferDiscount] = useState('');
  const [editOfferImage, setEditOfferImage] = useState<string | null>(null);
  const [editOfferExpiresAt, setEditOfferExpiresAt] = useState('');
  const [savingOffer, setSavingOffer] = useState(false);

  const [offers, setOffers] = useState<StoreOffer[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [togglingFeatured, setTogglingFeatured] = useState(false);
  const [togglingChat, setTogglingChat] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showCommentsProduct, setShowCommentsProduct] = useState<string | null>(null);
  const [showCommentsOffer, setShowCommentsOffer] = useState<string | null>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ type: 'store' | 'product' | 'offer' | 'contest'; id: string; name: string; description?: string; price?: string; storeName?: string; imageUrl?: string; discount?: string } | null>(null);

  // Edit Store
  const [showEditStore, setShowEditStore] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editLogo, setEditLogo] = useState<string | null>(null);
  const [editCover, setEditCover] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState(DEFAULT_CATEGORY);
  const [editGovernorate, setEditGovernorate] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [savingStore, setSavingStore] = useState(false);

  // Delete Store
  const [showDeleteStore, setShowDeleteStore] = useState(false);
  const [deletingStore, setDeletingStore] = useState(false);

  // ── In-flight guard for loadData (ref persists across renders, not in dependency arrays) ──
  // Check if AI assistant is enabled on mount
  useEffect(() => {
    fetchApi<{ enabled: boolean }>('/api/help/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '__check__' }),
    })
      .then(({ data }) => {
        if (data?.enabled) setAiEnabled(true);
      })
      .catch(() => {});
  }, []);

  const loadDataInFlight = useRef(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    // In-flight guard: prevent duplicate fetches on Strict Mode or rapid re-renders
    if (loadDataInFlight.current) return;
    loadDataInFlight.current = true;
    setLoading(true);
    try {
      const { data } = await apiGet<{ store: any; products: any[]; offers: any[] }>(`/api/my-store?userId=${user.id}&products=true`);
      const store = data?.store || null;
      setMyStore(store);
      setMyProducts(data?.products || []);
      setOffers(data?.offers || []);
      setFollowersCount(store?.followers_count || 0);
      if (store) {
        setEditName(store.name);
        setEditDesc(store.description || '');
        setEditLogo(store.logo_url || null);
        setEditCover(store.cover_url || null);
        setEditCategory(store.category || firstCategory);
        setEditGovernorate(store.governorate || '');
        setEditCity(store.city || '');
        setEditDistrict(store.district || '');
        setEditLocation(store.location || '');
      }
    } catch (err) {
      // API failure (e.g. stores table missing) — treat as "no store yet"
      console.error('MyStoreScreen: failed to load store data:', err);
      setMyStore(null);
      setMyProducts([]);
      setOffers([]);
      setFollowersCount(0);
    } finally { setLoading(false); loadDataInFlight.current = false; }
  }, [user, setMyStore, setMyProducts, firstCategory]);

  useEffect(() => { loadData(); }, [loadData]);

  // Initialize verification store and load this store's verification data
  useEffect(() => {
    useVerificationStore.getState().initialize();
  }, []);
  useEffect(() => {
    if (myStore) {
      useVerificationStore.getState().loadStoreVerification(myStore.id);
    }
  }, [myStore?.id]);

  // Sync verification status — the verificationStore (verifications table) is
  // the SINGLE SOURCE OF TRUTH. The store's is_verified flag may become stale
  // if a verification expires without a cron job to reset it, so we reconcile
  // the two here.
  useEffect(() => {
    if (!myStore || !verificationInitialized) return;
    const clientVerified = isStoreVerified; // from verificationStore (verifications table)
    const dbVerified = myStore.is_verified;  // from stores table (may be stale)

    if (clientVerified === dbVerified) return; // already in sync

    if (dbVerified && !clientVerified) {
      // stores.is_verified = true BUT verification record is expired/missing.
      // This happens when a previous verification expired but is_verified was
      // never reset.  The verificationStore is authoritative → sync store flag.
      setMyStore({ ...myStore, is_verified: false });
    } else if (clientVerified && !dbVerified) {
      // verificationStore says verified but store flag is false (rare edge-case
      // after a race).  Sync DB from verification state.
      apiPut('/api/stores/verify', { storeId: myStore.id, isVerified: true }).catch(() => {});
      setMyStore({ ...myStore, is_verified: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setMyStore is stable (Zustand)
  }, [myStore, verificationInitialized, isStoreVerified]);

  // Auto-adjust duration when store verification tier changes
  const storeDurationOptions = useMemo(() => {
    if (!myStore) return getDurationOptionsForTier('diamond');
    return useVerificationStore.getState().getDurationOptionsForStore(myStore.id);
    // storeTier and verificationInitialized trigger recomputation when verification changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStore, storeTier, verificationInitialized]);

  useEffect(() => {
    if (myStore) {
      const maxDays = useVerificationStore.getState().getLimits(myStore.id).maxDurationDays;
      if (productDuration > maxDays) setProductDuration(maxDays as DurationDays);
      if (offerDuration > maxDays) setOfferDuration(maxDays as DurationDays);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- verification state is reactive
  }, [myStore, storeTier, verificationInitialized]);

  // === STORE HANDLERS ===
  const handleCreateStore = async () => {
    if (!storeName.trim() || !user) return;
    setCreatingStore(true);
    try {
      // Ensure CSRF cookie is available before any mutating request
      await ensureCsrfReady();

      // Upload images before saving
      const [logoUrl, coverUrl] = await Promise.all([
        uploadImage(storeLogo),
        uploadImage(storeCover),
      ]);
      // Warn if image upload failed but user had selected an image
      if (storeLogo && !logoUrl) {
        toast.error('فشل رفع شعار المتجر. حاول مرة أخرى.');
        setCreatingStore(false);
        return;
      }
      if (storeCover && !coverUrl) {
        toast.error('فشل رفع صورة الغلاف. حاول مرة أخرى.');
        setCreatingStore(false);
        return;
      }
      const { data, error } = await apiPost('/api/my-store', { userId: user.id, name: storeName, description: storeDesc, category: storeCategory, governorate: storeGovernorate, city: storeCity, district: storeDistrict, location: storeLocation, logoUrl, coverUrl });
      if (error) {
        console.error('Store API error:', error);
        toast.error(error);
        return;
      }
      if (data?.store) { setMyStore(data.store); }
      setShowCreateStore(false);
      setStoreName(''); setStoreDesc(''); setStoreLogo(null); setStoreCover(null); setStoreGovernorate(''); setStoreCity(''); setStoreDistrict(''); setStoreLocation('');
      toast.success('تم إنشاء متجرك بنجاح!');
    } catch (err) {
      console.error('Store creation error:', err);
      toast.error('حدث خطأ أثناء إنشاء المتجر');
    } finally { setCreatingStore(false); }
  };

  const handleSaveStore = async () => {
    if (!myStore || !user) return;
    // Verification check for store edits
    const editCheck = useVerificationStore.getState().canEditStore(myStore.id);
    if (!editCheck.allowed) {
      toast.error(editCheck.message || 'لا يمكنك تعديل المتجر حالياً');
      return;
    }
    setSavingStore(true);
    try {
      // Ensure CSRF cookie is available before any mutating request
      await ensureCsrfReady();

      // Upload images before saving
      const [logoUrl, coverUrl] = await Promise.all([
        uploadImage(editLogo),
        uploadImage(editCover),
      ]);
      const { data, error } = await apiPut('/api/my-store', { storeId: myStore.id, name: editName, description: editDesc, logoUrl, coverUrl, category: editCategory, governorate: editGovernorate, city: editCity, district: editDistrict, location: editLocation });
      if (error) {
        toast.error(error);
        return;
      }
      if (data?.store) { setMyStore(data.store); setShowEditStore(false); toast.success('تم تحديث المتجر بنجاح!'); useVerificationStore.getState().recordStoreEdit(myStore.id, myStore.name); }
    } catch { toast.error('حدث خطأ'); } finally { setSavingStore(false); }
  };

  const handleDeleteStore = async () => {
    if (!myStore) return;
    setDeletingStore(true);
    try {
      const { error } = await apiDelete(`/api/my-store?storeId=${myStore.id}`);
      if (error) throw new Error(error);
      setMyStore(null);
      setMyProducts([]);
      setOffers([]);
      setShowDeleteStore(false);
      toast.success('تم حذف المتجر بنجاح');
    } catch { toast.error('حدث خطأ أثناء حذف المتجر'); } finally { setDeletingStore(false); }
  };

  const handleToggleStoreFeatured = async () => {
    if (!myStore) return;
    // If trying to ADD featured, check permission
    if (!myStore.is_featured) {
      const check = useVerificationStore.getState().canToggleFeaturedStore(myStore.id);
      if (!check.allowed) {
        toast.error(check.message || 'لا يمكنك إضافة متجرك للمميزة');
        useVerificationStore.getState().recordLimitReached(myStore.id, myStore.name, 'إضافة متجر مميز');
        return;
      }
    }
    setTogglingFeatured(true);
    const newStatus = !myStore.is_featured;
    try {
      const { data, error } = await apiPut('/api/stores/toggle-featured', { storeId: myStore.id, isFeatured: newStatus });
      if (error) { toast.error(error); return; }
      if (data?.store) {
        setMyStore({ ...myStore, is_featured: newStatus });
        toast.success(newStatus ? 'تم إضافة متجرك للمميزة!' : 'تم إزالة متجرك من المميزة');
      }
    } catch { toast.error('حدث خطأ'); } finally { setTogglingFeatured(false); }
  };

  const handleToggleChat = async () => {
    if (!myStore) return;
    // Client-side check: chat can only be enabled for verified stores (check both sources)
    const isVerified = isStoreVerified || myStore.is_verified;
    if (!myStore.chat_enabled && !isVerified) {
      toast.error('يجب توثيق المتجر أولاً لتفعيل الدردشة');
      return;
    }
    setTogglingChat(true);
    const newStatus = !myStore.chat_enabled;
    try {
      // Step 1: Ensure DB isVerified is in sync before toggling chat
      if (isVerified) {
        try {
          await apiPut('/api/stores/verify', { storeId: myStore.id, isVerified: true });
        } catch {
          // Verification sync failed silently
        }
      }

      // Step 2: Toggle chat
      const { data, error } = await apiPut('/api/my-store', { storeId: myStore.id, chatEnabled: newStatus });

      if (error) {
        // If 403 due to verification, try syncing and retry once
        if (error.includes('توثيق')) {
          await apiPut('/api/stores/verify', { storeId: myStore.id, isVerified: true });
          const retry = await apiPut('/api/my-store', { storeId: myStore.id, chatEnabled: newStatus });
          if (!retry.error) {
            setMyStore({ ...myStore, chat_enabled: newStatus });
            toast.success(newStatus ? 'تم تفعيل الدردشة! 🎉' : 'تم إيقاف الدردشة');
            return;
          }
        }
        toast.error(error);
        return;
      }
      if (data?.store) {
        setMyStore({ ...myStore, chat_enabled: newStatus });
        toast.success(newStatus ? 'تم تفعيل الدردشة! 🎉' : 'تم إيقاف الدردشة');
      }
    } catch { toast.error('حدث خطأ'); } finally { setTogglingChat(false); }
  };

  const handleViewStore = () => {
    if (!myStore) return;
    setSelectedStoreId(myStore.id);
    setSubScreen('store-detail');
  };

  // === PRODUCT HANDLERS ===
  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setEditProductName(product.name);
    setEditProductDesc(product.description || '');
    setEditProductPrice(String(product.price));
    setEditProductCategory(product.category || firstCategory);
    setEditProductImage(product.image_url || null);
    setShowEditProduct(true);
  };

  const handleAddProduct = async () => {
    if (!productName.trim() || !user || !myStore) return;
    // Verification check for product creation
    const productCheck = useVerificationStore.getState().canCreateProduct(myStore.id);
    if (!productCheck.allowed) {
      toast.error(productCheck.message || 'لا يمكنك إنشاء المزيد من المنتجات هذا الشهر');
      useVerificationStore.getState().recordLimitReached(myStore.id, myStore.name, 'إنشاء منتج');
      return;
    }
    // Duration check
    const maxDurationDays = useVerificationStore.getState().getLimits(myStore.id).maxDurationDays;
    if (productDuration > maxDurationDays) {
      toast.error(`الحد الأقصى لمدة المحتوى في خطتك الحالية هو ${maxDurationDays} أيام. قم بالترقية للحصول على مدة أطول.`);
      return;
    }
    setAddingProduct(true);
    try {
      // Upload image before saving
      const imageUrl = await uploadImage(productImage);
      const { data, error: addError } = await apiPost('/api/products', { userId: user.id, storeId: myStore.id, name: productName, description: productDesc, price: parseFloat(productPrice) || 0, category: productCategory, imageUrl, expiresAt: getExpiryDate(productDuration) });
      if (addError) { toast.error(addError); return; }
      if (data?.product) { setMyProducts([data.product, ...myProducts]); useVerificationStore.getState().recordProductCreation(myStore.id, myStore.name); }
      // Create notifications for store followers
      if (data?.notifications?.length > 0) {
        const { useNotificationStore } = await import('@/store/notificationStore');
        data.notifications.forEach((n: any) => useNotificationStore.getState().createNotification(n));
      }
      setShowAddProduct(false); setProductName(''); setProductDesc(''); setProductPrice(''); setProductImage(null); setProductDuration(7);
      toast.success('تمت إضافة المنتج بنجاح!');
    } catch { toast.error('حدث خطأ'); } finally { setAddingProduct(false); }
  };

  const handleSaveProduct = async () => {
    if (!editingProduct || !editProductName.trim()) return;
    setSavingProduct(true);
    try {
      // Upload image before saving
      const imageUrl = await uploadImage(editProductImage);
      const { data: saveData, error: saveError } = await apiPut('/api/products', { productId: editingProduct.id, name: editProductName, description: editProductDesc, price: parseFloat(editProductPrice) || 0, category: editProductCategory, imageUrl });
      if (saveError) { toast.error(saveError); return; }
      if (saveData?.product) {
        setMyProducts(myProducts.map(p => p.id === editingProduct.id ? { ...p, name: saveData.product.name, description: saveData.product.description, price: saveData.product.price, category: saveData.product.category, image_url: saveData.product.image_url } : p));
        setShowEditProduct(false);
        toast.success('تم تحديث المنتج بنجاح!');
      }
    } catch { toast.error('حدث خطأ'); } finally { setSavingProduct(false); }
  };

  const handleToggleProductFeatured = async (product: Product) => {
    const newStatus = !product.is_featured;
    // Check permission when adding to featured
    if (newStatus && myStore) {
      const check = useVerificationStore.getState().canToggleFeaturedProduct(myStore.id);
      if (!check.allowed) {
        toast.error(check.message || 'لا يمكنك إضافة منتجات مميزة. قم بالترقية إلى متجر موثق.');
        if (myStore) useVerificationStore.getState().recordLimitReached(myStore.id, myStore.name, 'إضافة منتج مميز');
        return;
      }
    }
    try {
      const { data: toggleData, error: toggleError } = await apiPut('/api/products/toggle-featured', { productId: product.id, isFeatured: newStatus });
      if (toggleError) { toast.error(toggleError); return; }
      if (toggleData?.product) {
        setMyProducts(myProducts.map(p => p.id === product.id ? { ...p, is_featured: newStatus } : p));
        toast.success(newStatus ? 'تم إضافة المنتج للمميزة!' : 'تم إزالة المنتج من المميزة');
        if (newStatus && myStore) useVerificationStore.getState().recordFeaturedProduct(myStore.id, myStore.name);
      }
    } catch { toast.error('حدث خطأ'); }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    const previous = myProducts;
    setMyProducts(myProducts.filter(p => p.id !== productId));
    try {
      await apiDelete(`/api/my-store?productId=${productId}`);
      toast.success('تم حذف المنتج');
    } catch {
      setMyProducts(previous);
      toast.error('حدث خطأ أثناء حذف المنتج');
    }
  };

  // === OFFER HANDLERS ===
  const openEditOffer = (offer: StoreOffer) => {
    setEditingOffer(offer);
    setEditOfferTitle(offer.title);
    setEditOfferDesc(offer.description || '');
    setEditOfferType(offer.type as 'offer' | 'contest');
    setEditOfferDiscount(offer.discount || '');
    setEditOfferImage(offer.image_url || null);
    setEditOfferExpiresAt(offer.expires_at ? offer.expires_at.split('T')[0] : '');
    setShowEditOffer(true);
  };

  const handleAddOffer = async () => {
    if (!offerTitle.trim() || !user || !myStore) return;
    // Verification check for offer creation
    const offerCheck = useVerificationStore.getState().canCreateOffer(myStore.id, offerType);
    if (!offerCheck.allowed) {
      toast.error(offerCheck.message || `لا يمكنك إنشاء المزيد من ${offerType === 'offer' ? 'العروض' : 'المسابقات'}`);
      useVerificationStore.getState().recordLimitReached(myStore.id, myStore.name, `إنشاء ${offerType === 'offer' ? 'عرض' : 'مسابقة'}`);
      return;
    }
    // Duration check
    const offerMaxDurationDays = useVerificationStore.getState().getLimits(myStore.id).maxDurationDays;
    if (offerDuration > offerMaxDurationDays) {
      toast.error(`الحد الأقصى لمدة المحتوى في خطتك الحالية هو ${offerMaxDurationDays} أيام. قم بالترقية للحصول على مدة أطول.`);
      return;
    }
    setAddingOffer(true);
    try {
      // Upload image before saving
      const imageUrl = await uploadImage(offerImage);
      const { data: offerData, error: offerError } = await apiPost('/api/my-store/offers', { storeId: myStore.id, userId: user.id, title: offerTitle, description: offerDesc, type: offerType, discount: offerDiscount || null, imageUrl: imageUrl || null, expiresAt: getExpiryDate(offerDuration) });
      if (offerError) { toast.error(offerError); return; }
      if (offerData?.offer) { setOffers([offerData.offer, ...offers]); useVerificationStore.getState().recordOfferCreation(myStore.id, myStore.name, offerType); }
      // Create notifications for store followers
      if (offerData?.notifications?.length > 0) {
        const { useNotificationStore } = await import('@/store/notificationStore');
        offerData.notifications.forEach((n: any) => useNotificationStore.getState().createNotification(n));
      }
      setShowAddOffer(false); setOfferTitle(''); setOfferDesc(''); setOfferDiscount(''); setOfferImage(null); setOfferDuration(7);
      toast.success(offerType === 'offer' ? 'تمت إضافة العرض!' : 'تمت إضافة المسابقة!');
    } catch { toast.error('حدث خطأ'); } finally { setAddingOffer(false); }
  };

  const handleSaveOffer = async () => {
    if (!editingOffer || !editOfferTitle.trim()) return;
    setSavingOffer(true);
    try {
      // Upload image before saving
      const imageUrl = await uploadImage(editOfferImage);
      const { data: saveOfferData, error: saveOfferError } = await apiPut('/api/my-store/offers', { offerId: editingOffer.id, title: editOfferTitle, description: editOfferDesc, type: editOfferType, discount: editOfferDiscount || null, imageUrl, expiresAt: editOfferExpiresAt || null });
      if (saveOfferError) { toast.error(saveOfferError); return; }
      if (saveOfferData?.offer) {
        setOffers(offers.map(o => o.id === editingOffer.id ? { ...o, title: saveOfferData.offer.title, description: saveOfferData.offer.description, type: saveOfferData.offer.type, discount: saveOfferData.offer.discount, image_url: saveOfferData.offer.image_url, expires_at: saveOfferData.offer.expires_at } : o));
        setShowEditOffer(false);
        toast.success('تم تحديث العرض بنجاح!');
      }
    } catch { toast.error('حدث خطأ'); } finally { setSavingOffer(false); }
  };

  const handleDeleteOffer = async (offerId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
    const previous = offers;
    setOffers(offers.filter(o => o.id !== offerId));
    try {
      await apiDelete(`/api/my-store/offers?offerId=${offerId}`);
      toast.success('تم حذف العرض');
    } catch {
      setOffers(previous);
      toast.error('حدث خطأ أثناء حذف العرض');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></div>;
  }

  const storeTabs = [
    { id: 'products' as const, label: 'المنتجات', icon: ShoppingBag, count: myProducts.length },
    { id: 'offers' as const, label: 'العروض', icon: Gift, count: offers.filter(o => o.type === 'offer').length },
    { id: 'settings' as const, label: 'الإعدادات', icon: Edit3 },
  ];

  return (
    <div className="bg-[var(--color-bg)] min-h-screen top-nav-safe relative z-10">
      {/* Header */}
      <div className="gradient-dark px-5 pt-8 pb-6 relative overflow-hidden">
        <div className="absolute top-[-30px] right-[-20px] w-[140px] h-[140px] rounded-full bg-teal-600/15 blur-[50px]" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20" style={myStore?.theme_color ? (() => { const c = getStoreColorById(myStore.theme_color); return c ? { background: `linear-gradient(135deg, ${c.from}, ${c.to})`, boxShadow: `0 4px 14px ${c.shadowLight}` } : undefined; })() : undefined}>
            <Store className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-white text-lg font-bold">متجري</h1>
            <p className="text-teal-300 dark:text-teal-600/50 text-[11px] mt-0.5">إدارة متجرك ومنتجاتك</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-3.5">
        {!myStore ? (
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 text-center border border-[var(--color-border)] shadow-sm">
            <div className="w-16 h-16 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-[16px] font-bold text-[var(--color-text)] mb-1.5">لا يوجد لديك متجر بعد</h2>
            <p className="text-[var(--color-text-secondary)] text-[13px] mb-5 leading-relaxed">أنشئ متجرك الآن وابدأ في بيع منتجاتك</p>
            <Button onClick={() => setShowCreateStore(true)} fullWidth icon={<Plus className="w-5 h-5" />}>إنشاء متجر جديد</Button>
          </div>
        ) : (
          <>
            {/* Store Profile Card */}
            <div className="bg-[var(--color-surface)] rounded-2xl overflow-hidden border border-[var(--color-border)] shadow-sm">
              <div className="h-28 gradient-primary relative overflow-hidden" style={myStore.theme_color ? (() => { const c = getStoreColorById(myStore.theme_color); return c ? { background: `linear-gradient(135deg, ${c.from}, ${c.to})` } : undefined; })() : undefined}>
                <SafeImage src={myStore.cover_url} alt="" className="w-full h-full object-cover" fallback={null} />
                <div className="absolute inset-0 bg-black/10" />
                <button aria-label="تعديل المتجر" onClick={() => setShowEditStore(true)} className="absolute top-2 left-2 w-8 h-8 bg-[var(--color-surface)]/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-white hover:bg-[var(--color-surface)]/30 transition-colors">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button aria-label="معاينة المتجر" onClick={handleViewStore} className="absolute top-2 right-2 w-8 h-8 bg-[var(--color-surface)]/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-white hover:bg-[var(--color-surface)]/30 transition-colors">
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="px-4 pb-4 relative">
                <div className="-mt-7 mb-3">
                  <StoreLogo src={myStore.logo_url} name={myStore.name} size="lg" className="border-[3px] border-[var(--color-surface)] shadow-md" />
                </div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-bold text-[var(--color-text)]">{myStore.name}</h2>
                  {isStoreVerified && (() => {
                    const plan = getPlan(storeTier);
                    return (
                      <span className={`inline-flex items-center gap-1 bg-gradient-to-r ${plan.gradientClass} text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm`}>
                        <ShieldCheck className="w-3 h-3" />
                        {plan.emoji} {plan.nameAr}
                      </span>
                    );
                  })()}
                  {myStore.is_featured && <Star className="w-4 h-4 text-amber-500 dark:text-amber-400 fill-amber-500" />}
                </div>
                <p className="text-[var(--color-text-tertiary)] text-[12px] mt-0.5 line-clamp-2">{myStore.description || 'لا يوجد وصف'}</p>
                <span className="inline-block bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[11px] font-bold px-2.5 py-0.5 rounded-lg mt-2" style={theme.hasTheme ? theme.badgeStyle : undefined}>{myStore.category || 'عام'}</span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'المنتجات', value: myProducts.length, icon: <ShoppingBag className="w-4 h-4" />, color: 'text-emerald-600' },
                { label: 'العروض', value: offers.length, icon: <Gift className="w-4 h-4" />, color: 'text-amber-600' },
                { label: 'المتابعين', value: followersCount, icon: <Users className="w-4 h-4" />, color: 'text-blue-600' },
              ].map((stat) => (
                <div key={stat.label} className="bg-[var(--color-surface)] rounded-2xl p-3 border border-[var(--color-border)] shadow-sm">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${theme.hasTheme ? '' : 'bg-emerald-50/60 dark:bg-emerald-900/20 text-emerald-400 dark:text-emerald-500'}`} style={theme.hasTheme ? theme.iconBgStyle : undefined}>{stat.icon}</div>
                  <p className={`text-lg font-bold ${stat.color}`}>{stat.value.toLocaleString('ar-SY')}</p>
                  <p className="text-[var(--color-text-tertiary)] text-[10px] font-medium">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Verification Status Card */}
            <button
              onClick={() => setSubScreen('verification')}
              className={`w-full rounded-2xl p-3.5 border flex items-center gap-3 transition-all hover:shadow-md ${
                isStoreVerified
                  ? 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-200/60 dark:border-amber-800/30'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] shadow-sm'
              }`}
            >
              {isStoreVerified ? (() => {
                const plan = getPlan(storeTier);
                return (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${plan.gradientClass} shadow-md shadow-amber-500/20`}>
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                );
              })() : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                  <Lock className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                </div>
              )}
              <div className="text-right flex-1">
                <p className="text-[13px] font-bold text-[var(--color-text)]">
                  {isStoreVerified ? (() => {
                    const plan = getPlan(storeTier);
                    return `${plan.emoji} خطة ${plan.nameAr}`;
                  })() : 'ترقية إلى متجر موثق'}
                </p>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">
                  {isStoreVerified
                    ? 'اضغط لمشاهدة التفاصيل والاستخدام'
                    : 'احصل على مزايا إضافية وشارة التوثيق'
                  }
                </p>
              </div>
              {isStoreVerified && (() => {
                const plan = getPlan(storeTier);
                return (
                  <span className={`bg-gradient-to-r ${plan.lightGradientClass} ${plan.colorClass} text-[10px] font-black px-2 py-0.5 rounded-full border border-white/40`}>
                    {plan.emoji} {plan.nameAr}
                  </span>
                );
              })()}
              {!isStoreVerified && (
                <Crown className="w-5 h-5 text-emerald-300" />
              )}
            </button>

            {/* Store Featured Toggle */}
            <button onClick={handleToggleStoreFeatured} disabled={togglingFeatured}
              className={`w-full rounded-2xl p-3.5 border flex items-center gap-3 transition-all ${
                myStore.is_featured ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200/60 dark:border-amber-800/30' : 'bg-[var(--color-surface)] border-[var(--color-border)] shadow-sm'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${togglingFeatured ? 'animate-pulse' : ''} ${
                myStore.is_featured ? 'gradient-warm shadow-md shadow-amber-500/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                <Star className={`w-5 h-5 ${myStore.is_featured ? 'text-white fill-white' : 'text-emerald-400'}`} />
              </div>
              <div className="text-right flex-1">
                <p className="text-[13px] font-bold text-[var(--color-text)]">{myStore.is_featured ? 'متجرك في المتاجر المميزة' : 'أضف متجرك للمتاجر المميزة'}</p>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">{myStore.is_featured ? 'سيظهر متجرك في قسم المتاجر المميزة' : 'اجعل متجرك يظهر في القسم المميز'}</p>
              </div>
              <div className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-all ${myStore.is_featured ? 'bg-amber-500 justify-end' : 'bg-slate-200 dark:bg-slate-700 justify-start'}`}>
                <div className="w-5 h-5 bg-[var(--color-surface)] rounded-full shadow-sm" />
              </div>
            </button>

            {/* Chat Toggle */}
            {(isStoreVerified || myStore.is_verified) ? (
              <button onClick={handleToggleChat} disabled={togglingChat}
                className={`w-full rounded-2xl p-3.5 border flex items-center gap-3 transition-all ${
                  myStore.chat_enabled
                    ? theme.hasTheme ? '' : 'bg-gradient-to-r from-emerald-50 dark:from-emerald-900/20 to-teal-50 dark:to-teal-900/20 border-emerald-200/60'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] shadow-sm'
                }`} style={myStore.chat_enabled && theme.hasTheme ? { background: theme.themeBgLight, borderColor: theme.color?.solidLight + '40' } : undefined}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${togglingChat ? 'animate-pulse' : ''} ${
                  myStore.chat_enabled
                    ? theme.hasTheme ? '' : 'gradient-primary shadow-md shadow-emerald-500/20'
                    : 'bg-slate-100 dark:bg-slate-800'
                }`} style={myStore.chat_enabled && theme.hasTheme ? theme.gradientStyle : undefined}>
                  <MessageCircle className={`w-5 h-5 ${myStore.chat_enabled ? 'text-white' : 'text-[var(--color-text-tertiary)]'}`} />
                </div>
                <div className="text-right flex-1">
                  <p className="text-[13px] font-bold text-[var(--color-text)]">{myStore.chat_enabled ? 'الدردشة مفعّلة ✅' : 'تفعيل الدردشة'}</p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)]">{myStore.chat_enabled ? 'يمكن للعملاء التواصل معك عبر الدردشة' : 'اسمح للعملاء بالتواصل معك مباشرة'}</p>
                </div>
                <div className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-all ${myStore.chat_enabled ? 'bg-emerald-500 justify-end' : 'bg-slate-200 dark:bg-slate-700 justify-start'}`}>
                  <div className="w-5 h-5 bg-[var(--color-surface)] rounded-full shadow-sm" />
                </div>
              </button>
            ) : (
              <div className="w-full rounded-2xl p-3.5 border flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-200/50 dark:bg-slate-700/50">
                  <Lock className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                </div>
                <div className="text-right flex-1">
                  <p className="text-[13px] font-bold text-[var(--color-text-tertiary)]">تفعيل الدردشة 🔒</p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)]">يتطلب توثيق المتجر أولاً</p>
                </div>
                <button onClick={() => setSubScreen('verification')}
                  className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg hover:bg-emerald-100 dark:bg-emerald-900/30 transition-colors">
                  توثيق الآن
                </button>
              </div>
            )}

            {/* Customer Messages Inbox — always visible to store owner */}
            {(isStoreVerified || myStore.is_verified) && (
              <button
                onClick={() => setSubScreen('store-messages')}
                className={`w-full rounded-2xl p-4 border flex items-center gap-3 transition-all ${theme.hasTheme ? '' : 'bg-gradient-to-l from-emerald-50/60 to-teal-50/60 dark:from-emerald-900/15 dark:to-teal-900/15 border-emerald-200/60 dark:border-emerald-800/40 hover:shadow-lg hover:border-emerald-300 dark:hover:border-emerald-700/60'} active:scale-[0.98] duration-150`}
                style={theme.hasTheme ? { background: theme.themeBgLight, borderColor: theme.color?.solidLight + '40' } : undefined}
              >
                <div className={`w-11 h-11 rounded-xl ${theme.hasTheme ? '' : 'gradient-primary'} flex items-center justify-center relative ${theme.hasTheme ? '' : 'shadow-md shadow-emerald-500/20'}`} style={theme.hasTheme ? theme.gradientStyle : undefined}>
                  <MessageSquare className="w-5 h-5 text-white" />
                  <ChatUnreadBadge storeId={myStore.id} />
                </div>
                <div className="text-right flex-1">
                  <p className="text-[14px] font-bold text-[var(--color-text)]">الرسائل</p>
                  <p className={`text-[11px] font-medium ${theme.hasTheme ? '' : 'text-emerald-600 dark:text-emerald-400'}`} style={theme.hasTheme ? { color: theme.themeSolid } : undefined}>تتبع محادثات العملاء وتواصل معهم</p>
                </div>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${theme.hasTheme ? '' : 'bg-emerald-100 dark:bg-emerald-900/30'}`} style={theme.hasTheme ? theme.iconBgStyle : undefined}>
                  <ChevronLeft className={`w-4 h-4 ${theme.hasTheme ? '' : 'text-emerald-600 dark:text-emerald-400'}`} style={theme.hasTheme ? { color: theme.themeSolid } : undefined} />
                </div>
              </button>
            )}

            {/* Tabs */}
            <div className="bg-[var(--color-surface)] rounded-2xl p-1 flex border border-[var(--color-border)] shadow-sm">
              {storeTabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const myTc = myStore.theme_color ? getStoreColorById(myStore.theme_color) : null;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${isActive ? 'text-white shadow-md' : 'text-[var(--color-text-tertiary)] hover:text-emerald-600'}`}
                    style={isActive && myTc ? { background: `linear-gradient(135deg, ${myTc.from}, ${myTc.to})`, boxShadow: `0 2px 8px ${myTc.shadowLight}` } : undefined}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-[var(--color-surface)]/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>{tab.count}</span>}
                  </button>
                );
              })}
            </div>

            {/* Products Tab */}
            {activeTab === 'products' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] font-bold text-[var(--color-text)]">منتجاتي ({myProducts.length})</h2>
                  <Button size="sm" onClick={() => setShowAddProduct(true)} icon={<Plus className="w-4 h-4" />}>إضافة</Button>
                </div>
                {myProducts.length === 0 ? (
                  <div className="bg-[var(--color-surface)] rounded-2xl p-8 text-center border border-[var(--color-border)] shadow-sm">
                    <div className="w-14 h-14 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center mx-auto mb-3"><Package className="w-7 h-7 text-emerald-300" /></div>
                    <p className="text-emerald-900 dark:text-emerald-300 font-bold text-[14px]">لا توجد منتجات بعد</p>
                    <p className="text-[var(--color-text-tertiary)] text-[12px] mt-0.5">أضف منتجاتك لتظهر للعملاء</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {myProducts.map((product) => (
                      <div key={product.id} className="bg-[var(--color-surface)] rounded-2xl overflow-hidden border border-[var(--color-border)] shadow-sm">
                        <div className="flex gap-3 p-3">
                          <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-emerald-50/50 to-teal-50/50 flex-shrink-0 overflow-hidden relative">
                            <SafeImage
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              fallback={<div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-5 h-5 text-emerald-300" /></div>}
                            />
                            {product.is_featured && (<div className="absolute top-1 right-1 bg-amber-500 rounded-md px-1.5 py-0.5 flex items-center gap-0.5"><Star className="w-2.5 h-2.5 text-white fill-white" /></div>)}
                            {product.is_new && (<div className="absolute bottom-1 left-1 gradient-primary rounded-md px-1.5 py-0.5"><span className="text-white text-[9px] font-bold">جديد</span></div>)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-[var(--color-text)] line-clamp-1">{product.name}</p>
                            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">{product.category}</p>
                            <p className="text-[13px] font-bold gradient-text-primary mt-1">{product.price.toLocaleString('ar-SY')} ل.س</p>
                            {(() => {
                              const timeInfo = getTimeRemaining(product.expires_at);
                              if (!timeInfo.isExpired && timeInfo.text && product.expires_at) {
                                const colors = getUrgencyColors(timeInfo.urgencyLevel);
                                return (
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg mt-1 ${colors.bg} ${colors.text}`}>
                                    <Clock className="w-3 h-3" />
                                    {timeInfo.text}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                        <div className="flex border-t border-[var(--color-border)]/60">
                          <button onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)} className="flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-50/50 border-l border-[var(--color-border)]/60">
                            {expandedProduct === product.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} التفاصيل
                          </button>
                          <button onClick={() => openEditProduct(product)} className="flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/ dark:bg-blue-900/20/50 border-l border-[var(--color-border)]/60">
                            <Edit3 className="w-3.5 h-3.5" /> تعديل
                          </button>
                          <button onClick={() => handleToggleProductFeatured(product)} className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-bold border-l border-[var(--color-border)]/60 ${product.is_featured ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50/ dark:bg-amber-900/20/50' : 'text-emerald-600 hover:bg-emerald-50/50'}`}>
                            <Star className={`w-3.5 h-3.5 ${product.is_featured ? 'fill-amber-500' : ''}`} /> تمييز
                          </button>
                          <button onClick={() => setShowCommentsProduct(showCommentsProduct === product.id ? null : product.id)} className="flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50/50 border-l border-[var(--color-border)]/60">
                            <MessageCircle className="w-3.5 h-3.5" /> تعليقات
                          </button>
                          <button onClick={() => { setShareTarget({ type: 'product', id: product.id, name: product.name, price: `${product.price.toLocaleString('ar-SY')} ل.س`, storeName: myStore?.name, imageUrl: product.image_url }); setShowShareSheet(true); }} className="flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-bold text-emerald-500 hover:bg-emerald-50/50 border-l border-[var(--color-border)]/60">
                            <Share2 className="w-3.5 h-3.5" /> مشاركة
                          </button>
                          <button onClick={() => handleDeleteProduct(product.id)} className="flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-bold text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:bg-rose-900/20/50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {expandedProduct === product.id && (
                          <div className="px-4 py-3 bg-[var(--color-bg)] border-t border-[var(--color-border)]/60">
                            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{product.description || 'لا يوجد وصف'}</p>
                            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-2">{new Date(product.created_at).toLocaleDateString('ar-SY')}</p>
                          </div>
                        )}
                        {showCommentsProduct === product.id && (
                          <div className="px-4 py-3 border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]">
                            <CommentsSection targetId={product.id} targetType="product" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Offers Tab */}
            {activeTab === 'offers' && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] font-bold text-[var(--color-text)]">العروض والمسابقات ({offers.length})</h2>
                  <Button size="sm" onClick={() => setShowAddOffer(true)} icon={<Plus className="w-4 h-4" />}>إضافة</Button>
                </div>
                {offers.length === 0 ? (
                  <div className="bg-[var(--color-surface)] rounded-2xl p-8 text-center border border-[var(--color-border)] shadow-sm">
                    <div className="w-14 h-14 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center mx-auto mb-3"><Gift className="w-7 h-7 text-emerald-300" /></div>
                    <p className="text-emerald-900 dark:text-emerald-300 font-bold text-[14px]">لا توجد عروض بعد</p>
                    <p className="text-[var(--color-text-tertiary)] text-[12px] mt-0.5">أضف عروض ومسابقات لجذب العملاء</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {offers.map((offer) => (
                      <div key={offer.id} className="bg-[var(--color-surface)] rounded-2xl overflow-hidden border border-[var(--color-border)] shadow-sm">
                        {offer.image_url && (
                          <div className="h-32 bg-gradient-to-br from-emerald-50 dark:from-emerald-900/20 to-teal-50 dark:to-teal-900/20 overflow-hidden">
                            <SafeImage src={offer.image_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-1.5">
                            {offer.type === 'offer' ? (
                              <div className="w-7 h-7 gradient-warm rounded-lg flex items-center justify-center"><Gift className="w-3.5 h-3.5 text-white" /></div>
                            ) : (
                              <div className="w-7 h-7 gradient-rose rounded-lg flex items-center justify-center"><Trophy className="w-3.5 h-3.5 text-white" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-bold text-[var(--color-text)] line-clamp-1">{offer.title}</p>
                              <p className="text-[10px] text-[var(--color-text-tertiary)]">{offer.type === 'offer' ? 'عرض' : 'مسابقة'}{offer.discount && ` • خصم ${offer.discount}`}</p>
                            </div>
                            {offer.expires_at && (() => {
                              const timeInfo = getTimeRemaining(offer.expires_at);
                              const colors = getUrgencyColors(timeInfo.urgencyLevel);
                              return (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg ${colors.bg} ${colors.text}`}>
                                  <Clock className="w-3 h-3" />
                                  {timeInfo.isExpired ? 'منتهي' : timeInfo.text}
                                </span>
                              );
                            })()}
                          </div>
                          {offer.description && <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-1">{offer.description}</p>}
                          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--color-border)]/60">
                            <button onClick={() => setShowCommentsOffer(showCommentsOffer === offer.id ? null : offer.id)} className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                              <MessageCircle className="w-3.5 h-3.5" /> {offer.comments_count} تعليق
                            </button>
                            <button onClick={() => openEditOffer(offer)} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <Edit3 className="w-3.5 h-3.5" /> تعديل
                            </button>
                            <button onClick={() => { setShareTarget({ type: offer.type as 'offer' | 'contest', id: offer.id, name: offer.title, description: offer.description, storeName: myStore?.name, imageUrl: offer.image_url, discount: offer.discount }); setShowShareSheet(true); }} className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                              <Share2 className="w-3.5 h-3.5" /> مشاركة
                            </button>
                            <div className="flex-1" />
                            <button onClick={() => handleDeleteOffer(offer.id)} className="text-[11px] font-bold text-rose-500 dark:text-rose-400 flex items-center gap-1"><Trash2 className="w-3 h-3" /> حذف</button>
                          </div>
                          {showCommentsOffer === offer.id && (
                            <div className="mt-3"><CommentsSection targetId={offer.id} targetType="offer" /></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-2.5">
                {/* View Store */}
                <button onClick={handleViewStore} className="w-full bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border)] shadow-sm flex items-center gap-3 text-right">
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-500"><Eye className="w-5 h-5" /></div>
                  <div className="flex-1"><p className="text-[13px] font-bold text-[var(--color-text)]">معاينة المتجر</p><p className="text-[11px] text-[var(--color-text-tertiary)]">شاهد المتجر كما يراه الزبائن</p></div>
                </button>

                {/* Edit Store */}
                <button onClick={() => setShowEditStore(true)} className="w-full bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border)] shadow-sm flex items-center gap-3 text-right">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme.hasTheme ? '' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400'}`} style={theme.hasTheme ? theme.iconBgStyle : undefined}><Edit3 className="w-5 h-5" /></div>
                  <div className="flex-1"><p className="text-[13px] font-bold text-[var(--color-text)]">تعديل بيانات المتجر</p><p className="text-[11px] text-[var(--color-text-tertiary)]">تعديل الاسم والوصف والصور</p></div>
                </button>

                {/* Store Theme Color - requires verified tier */}
                {isStoreVerified ? (
                  <StoreColorPicker />
                ) : (
                  <button
                    onClick={() => toast.error('لا يمكنك استخدام إعدادات المتجر. قم بالترقية إلى خطة موثّقة.')}
                    className="w-full bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border)] shadow-sm flex items-center gap-3 text-right opacity-60"
                  >
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-[var(--color-text-tertiary)]"><Lock className="w-5 h-5" /></div>
                    <div className="flex-1"><p className="text-[13px] font-bold text-[var(--color-text-tertiary)]">لون المتجر</p><p className="text-[11px] text-[var(--color-text-tertiary)]">يتطلب خطة موثّقة</p></div>
                  </button>
                )}

                {/* Chat */}
                <div className="w-full bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border)] shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 dark:bg-purple-900/20 rounded-xl flex items-center justify-center text-purple-500 dark:text-purple-400"><MessageCircle className="w-5 h-5" /></div>
                  <div className="flex-1"><p className="text-[13px] font-bold text-[var(--color-text)]">الدردشة</p><p className="text-[11px] text-[var(--color-text-tertiary)]">العملاء يمكنهم التحدث معك مباشرة</p></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>

                {/* Store Info */}
                <div className="bg-[var(--color-surface)] rounded-2xl p-4 border border-[var(--color-border)] shadow-sm">
                  <p className="text-[13px] font-bold text-[var(--color-text)] mb-3">معلومات المتجر</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[var(--color-text-tertiary)]">معرف المتجر</span>
                      <span className="text-[11px] text-[var(--color-text-secondary)] font-mono bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-lg select-all">{myStore.id.slice(0, 12)}...</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[var(--color-text-tertiary)]">تاريخ الإنشاء</span>
                      <span className="text-[12px] text-[var(--color-text-secondary)] font-medium">{new Date(myStore.created_at).toLocaleDateString('ar-SY')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[var(--color-text-tertiary)]">عدد المنتجات</span>
                      <span className="text-[12px] text-[var(--color-text-secondary)] font-medium">{myProducts.length} منتج</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[var(--color-text-tertiary)]">عدد العروض</span>
                      <span className="text-[12px] text-[var(--color-text-secondary)] font-medium">{offers.length} عرض</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[var(--color-text-tertiary)]">خطة التوثيق</span>
                      <span className={`text-[12px] font-bold ${getPlan(storeTier).colorClass}`}>{getPlan(storeTier).emoji} {getPlan(storeTier).nameAr}</span>
                    </div>
                  </div>
                </div>

                {/* Delete Store */}
                <button onClick={() => setShowDeleteStore(true)} className="w-full bg-[var(--color-surface)] rounded-2xl p-4 border border-rose-100 shadow-sm flex items-center gap-3 text-right">
                  <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/20 rounded-xl flex items-center justify-center text-rose-500 dark:text-rose-400"><Trash2 className="w-5 h-5" /></div>
                  <div className="flex-1"><p className="text-[13px] font-bold text-rose-600 dark:text-rose-400">حذف المتجر</p><p className="text-[11px] text-[var(--color-text-tertiary)]">سيتم حذف المتجر وجميع منتجاته وعروضه</p></div>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== MODALS ===== */}

      {/* Create Store Modal */}
      <Modal isOpen={showCreateStore} onClose={() => { setShowCreateStore(false); setStoreName(''); setStoreDesc(''); setStoreLogo(null); setStoreCover(null); setStoreGovernorate(''); setStoreCity(''); }} title="إنشاء متجر جديد" size="lg">
        <div className="space-y-4">
          <ImageUploader label="شعار المتجر (اختياري)" value={storeLogo} onChange={setStoreLogo} height="h-28" />
          <ImageUploader label="صورة الغلاف (اختياري)" value={storeCover} onChange={setStoreCover} height="h-32" />
          <Input label="اسم المتجر *" placeholder="مثال: متجر الإلكترونيات" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          <Input label="وصف المتجر" placeholder="اكتب وصفاً مختصراً..." value={storeDesc} onChange={(e) => setStoreDesc(e.target.value)} />
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">فئة المتجر</label>
            <select value={storeCategory} onChange={(e) => setStoreCategory(e.target.value)} className="w-full border border-emerald-100 dark:border-emerald-800 rounded-xl px-3.5 py-3 text-[13px] text-[var(--color-text)] font-medium focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 outline-none bg-[var(--color-surface)]">
              {SORTED_CATEGORIES.map(name => (<option key={name} value={name}>{CATEGORY_META[name].emoji} {name}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">المحافظة</label>
            <select value={storeGovernorate} onChange={(e) => { setStoreGovernorate(e.target.value); setStoreCity(''); }} className="w-full border border-emerald-100 dark:border-emerald-800 rounded-xl px-3.5 py-3 text-[13px] text-[var(--color-text)] font-medium focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 outline-none bg-[var(--color-surface)]">
              <option value="">اختر المحافظة</option>
              {getGovernorateNames().map(name => (<option key={name} value={name}>{name}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">المدينة</label>
            <select value={storeCity} onChange={(e) => setStoreCity(e.target.value)} disabled={!storeGovernorate} className="w-full border border-emerald-100 dark:border-emerald-800 rounded-xl px-3.5 py-3 text-[13px] text-[var(--color-text)] font-medium focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 outline-none bg-[var(--color-surface)] disabled:opacity-50 disabled:cursor-not-allowed">
              <option value="">اختر المدينة</option>
              {storeGovernorate && getCitiesForGovernorate(storeGovernorate).map(city => (<option key={city} value={city}>{city}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">🏘️ المنطقة</label>
            <Input placeholder="أدخل اسم المنطقة (اختياري)" value={storeDistrict} onChange={(e) => setStoreDistrict(e.target.value)} />
          </div>
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">📍 الموقع الدقيق</label>
            <Input placeholder="أدخل تفاصيل موقع متجرك بالضبط (اختياري)" value={storeLocation} onChange={(e) => setStoreLocation(e.target.value)} />
          </div>
          <Button fullWidth onClick={handleCreateStore} loading={creatingStore} disabled={!storeName.trim()} icon={<Store className="w-5 h-5" />}>إنشاء المتجر</Button>
        </div>
      </Modal>

      {/* Edit Store Modal */}
      <Modal isOpen={showEditStore} onClose={() => setShowEditStore(false)} title="تعديل بيانات المتجر" size="lg">
        <div className="space-y-4">
          <ImageUploader label="شعار المتجر" value={editLogo} onChange={setEditLogo} height="h-28" />
          <ImageUploader label="صورة الغلاف" value={editCover} onChange={setEditCover} height="h-32" />
          <Input label="اسم المتجر" placeholder="اسم المتجر" value={editName} onChange={(e) => setEditName(e.target.value)} />
          <Input label="الوصف" placeholder="وصف المتجر" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">فئة المتجر</label>
            <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full border border-emerald-100 dark:border-emerald-800 rounded-xl px-3.5 py-3 text-[13px] text-[var(--color-text)] font-medium focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 outline-none bg-[var(--color-surface)]">
              {SORTED_CATEGORIES.map(name => (<option key={name} value={name}>{CATEGORY_META[name].emoji} {name}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">المحافظة</label>
            <select value={editGovernorate} onChange={(e) => { setEditGovernorate(e.target.value); setEditCity(''); }} className="w-full border border-emerald-100 dark:border-emerald-800 rounded-xl px-3.5 py-3 text-[13px] text-[var(--color-text)] font-medium focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 outline-none bg-[var(--color-surface)]">
              <option value="">اختر المحافظة</option>
              {getGovernorateNames().map(name => (<option key={name} value={name}>{name}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">المدينة</label>
            <select value={editCity} onChange={(e) => setEditCity(e.target.value)} disabled={!editGovernorate} className="w-full border border-emerald-100 dark:border-emerald-800 rounded-xl px-3.5 py-3 text-[13px] text-[var(--color-text)] font-medium focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 outline-none bg-[var(--color-surface)] disabled:opacity-50 disabled:cursor-not-allowed">
              <option value="">اختر المدينة</option>
              {editGovernorate && getCitiesForGovernorate(editGovernorate).map(city => (<option key={city} value={city}>{city}</option>))}
            </select>
          </div>
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">🏘️ المنطقة</label>
            <Input placeholder="أدخل اسم المنطقة (اختياري)" value={editDistrict} onChange={(e) => setEditDistrict(e.target.value)} />
          </div>
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">📍 الموقع الدقيق</label>
            <Input placeholder="أدخل تفاصيل موقع متجرك بالضبط (اختياري)" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
          </div>
          <Button fullWidth onClick={handleSaveStore} loading={savingStore} icon={<Edit3 className="w-5 h-5" />}>حفظ التغييرات</Button>
        </div>
      </Modal>

      {/* Add Product Modal */}
      <Modal isOpen={showAddProduct} onClose={() => { setShowAddProduct(false); setProductName(''); setProductDesc(''); setProductPrice(''); setProductImage(null); setProductCategory(firstCategory); setProductDuration(7); }} title="إضافة منتج جديد" size="lg">
        <div className="space-y-4">
          <ImageUploader label="صورة المنتج (اختياري)" value={productImage} onChange={setProductImage} />
          <Input label="اسم المنتج *" placeholder="اسم المنتج" value={productName} onChange={(e) => setProductName(e.target.value)} />
          <div className="relative">
            <Input label="الوصف" placeholder="وصف المنتج" value={productDesc} onChange={(e) => setProductDesc(e.target.value)} />
            {aiEnabled && (
              <button
                type="button"
                onClick={async () => {
                  if (!productName.trim()) {
                    toast.error('أدخل اسم المنتج أولاً');
                    return;
                  }
                  setAiDescLoading(true);
                  try {
                    const { data, error } = await fetchApi<{ reply: string }>('/api/help/ai-chat', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        message: `اكتب وصفاً تسويقياً جذاباً بالعربية لمنتج "${productName}" في فئة "${productCategory}". 3-4 جمل. أعد الوصف فقط بدون أي نص إضافي.`,
                      }),
                    });
                    if (error) {
                      toast.error('فشل كتابة الوصف');
                      return;
                    }
                    if (data?.reply) {
                      setProductDesc(data.reply.replace(/["']/g, '').trim());
                      toast.success('تم اقتراح وصف للمنتج! ✍️');
                    }
                  } catch {
                    toast.error('فشل كتابة الوصف');
                  } finally {
                    setAiDescLoading(false);
                  }
                }}
                disabled={aiDescLoading || !productName.trim()}
                className="absolute left-2 top-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {aiDescLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <PenLine className="w-3 h-3" />
                )}
                {aiDescLoading ? 'جارٍ الكتابة...' : 'اقتراح وصف'}
              </button>
            )}
          </div>
          <Input label="السعر (ل.س) *" type="number" placeholder="0" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} />
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">الفئة</label>
            <select value={productCategory} onChange={(e) => setProductCategory(e.target.value)} className="w-full border border-emerald-100 dark:border-emerald-800 rounded-xl px-3.5 py-3 text-[13px] text-[var(--color-text)] font-medium focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 outline-none bg-[var(--color-surface)]">
              {SORTED_CATEGORIES.map(name => (<option key={name} value={name}>{CATEGORY_META[name].emoji} {name}</option>))}
            </select>
          </div>
          {/* مدة الإعلان */}
          <div className="bg-emerald-50/40 dark:bg-emerald-900/20 rounded-xl p-3.5 border border-emerald-100/40 dark:border-emerald-800/30">
            <div className="flex items-center gap-2 mb-2.5">
              <Clock className="w-4 h-4 text-emerald-600" />
              <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300">مدة الإعلان <span className="text-rose-500 dark:text-rose-400">*</span></label>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {storeDurationOptions.map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setProductDuration(days as DurationDays)}
                  className={`py-2 rounded-lg text-[11px] font-bold transition-all ${
                    productDuration === days
                      ? 'gradient-primary text-white shadow-sm shadow-emerald-500/20'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100/40 dark:border-emerald-800/30'
                  }`}
                >
                  {days} يوم
                </button>
              ))}
            </div>
            {myStore && storeTier !== 'diamond' && (
              <div className="flex items-center gap-1.5 mt-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2.5 py-1.5 border border-amber-100/40">
                <Lock className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">للمد أطول، قم بترقية خطتك</p>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">سيتم حذف المنتج تلقائياً بعد انتهاء المدة المحددة</p>
            </div>
          </div>
          <Button fullWidth onClick={handleAddProduct} loading={addingProduct} disabled={!productName.trim() || !productPrice || parseFloat(productPrice) <= 0} icon={<Package className="w-5 h-5" />}>إضافة المنتج</Button>
        </div>
      </Modal>

      {/* Edit Product Modal */}
      <Modal isOpen={showEditProduct} onClose={() => { setShowEditProduct(false); setEditingProduct(null); }} title="تعديل المنتج" size="lg">
        <div className="space-y-4">
          <ImageUploader label="صورة المنتج" value={editProductImage} onChange={setEditProductImage} />
          <Input label="اسم المنتج *" placeholder="اسم المنتج" value={editProductName} onChange={(e) => setEditProductName(e.target.value)} />
          <div className="relative">
            <Input label="الوصف" placeholder="وصف المنتج" value={editProductDesc} onChange={(e) => setEditProductDesc(e.target.value)} />
            {aiEnabled && (
              <button
                type="button"
                onClick={async () => {
                  if (!editProductName.trim()) {
                    toast.error('أدخل اسم المنتج أولاً');
                    return;
                  }
                  setAiDescLoading(true);
                  try {
                    const { data, error } = await fetchApi<{ reply: string }>('/api/help/ai-chat', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        message: `اكتب وصفاً تسويقياً جذاباً بالعربية لمنتج "${editProductName}" في فئة "${editProductCategory}". 3-4 جمل. أعد الوصف فقط بدون أي نص إضافي.`,
                      }),
                    });
                    if (error) {
                      toast.error('فشل كتابة الوصف');
                      return;
                    }
                    if (data?.reply) {
                      setEditProductDesc(data.reply.replace(/["']/g, '').trim());
                      toast.success('تم اقتراح وصف للمنتج! ✍️');
                    }
                  } catch {
                    toast.error('فشل كتابة الوصف');
                  } finally {
                    setAiDescLoading(false);
                  }
                }}
                disabled={aiDescLoading || !editProductName.trim()}
                className="absolute left-2 top-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {aiDescLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <PenLine className="w-3 h-3" />
                )}
                {aiDescLoading ? 'جارٍ الكتابة...' : 'اقتراح وصف'}
              </button>
            )}
          </div>
          <Input label="السعر (ل.س) *" type="number" placeholder="0" value={editProductPrice} onChange={(e) => setEditProductPrice(e.target.value)} />
          <div>
            <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300 block mb-1.5">الفئة</label>
            <select value={editProductCategory} onChange={(e) => setEditProductCategory(e.target.value)} className="w-full border border-emerald-100 dark:border-emerald-800 rounded-xl px-3.5 py-3 text-[13px] text-[var(--color-text)] font-medium focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-400 outline-none bg-[var(--color-surface)]">
              {SORTED_CATEGORIES.map(name => (<option key={name} value={name}>{CATEGORY_META[name].emoji} {name}</option>))}
            </select>
          </div>
          <Button fullWidth onClick={handleSaveProduct} loading={savingProduct} disabled={!editProductName.trim()} icon={<Edit3 className="w-5 h-5" />}>حفظ التغييرات</Button>
        </div>
      </Modal>

      {/* Add Offer Modal */}
      <Modal isOpen={showAddOffer} onClose={() => { setShowAddOffer(false); setOfferTitle(''); setOfferDesc(''); setOfferDiscount(''); setOfferImage(null); setOfferType('offer'); setOfferDuration(7); }} title="إضافة عرض / مسابقة" size="lg">
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setOfferType('offer')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${offerType === 'offer' ? 'gradient-warm text-white shadow-md' : 'bg-emerald-50 dark:bg-emerald-900/20 text-[var(--color-text-secondary)]'}`}>
              <Gift className="w-4 h-4" /> عرض
            </button>
            <button onClick={() => setOfferType('contest')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${offerType === 'contest' ? 'gradient-rose text-white shadow-md' : 'bg-emerald-50 dark:bg-emerald-900/20 text-[var(--color-text-secondary)]'}`}>
              <Trophy className="w-4 h-4" /> مسابقة
            </button>
          </div>
          <Input label="العنوان *" placeholder={offerType === 'offer' ? 'مثال: خصم 50% على جميع المنتجات' : 'مثال: سحب على جائزة قيمة'} value={offerTitle} onChange={(e) => setOfferTitle(e.target.value)} />
          <Input label="الوصف" placeholder="تفاصيل العرض أو المسابقة..." value={offerDesc} onChange={(e) => setOfferDesc(e.target.value)} />
          {offerType === 'offer' && <Input label="نسبة الخصم" placeholder="مثال: 50%" value={offerDiscount} onChange={(e) => setOfferDiscount(e.target.value)} />}
          {/* مدة العرض */}
          <div className="bg-emerald-50/40 dark:bg-emerald-900/20 rounded-xl p-3.5 border border-emerald-100/40 dark:border-emerald-800/30">
            <div className="flex items-center gap-2 mb-2.5">
              <Clock className="w-4 h-4 text-emerald-600" />
              <label className="text-[13px] font-bold text-emerald-900 dark:text-emerald-300">مدة العرض <span className="text-rose-500 dark:text-rose-400">*</span></label>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {storeDurationOptions.map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setOfferDuration(days as DurationDays)}
                  className={`py-2 rounded-lg text-[11px] font-bold transition-all ${
                    offerDuration === days
                      ? 'gradient-primary text-white shadow-sm shadow-emerald-500/20'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100/40 dark:border-emerald-800/30'
                  }`}
                >
                  {days} يوم
                </button>
              ))}
            </div>
            {myStore && storeTier !== 'diamond' && (
              <div className="flex items-center gap-1.5 mt-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2.5 py-1.5 border border-amber-100/40">
                <Lock className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">للمد أطول، قم بترقية خطتك</p>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">سيتم حذف العرض تلقائياً بعد انتهاء المدة المحددة</p>
            </div>
          </div>
          <ImageUploader label="صورة العرض (اختياري)" value={offerImage} onChange={setOfferImage} />
          <Button fullWidth onClick={handleAddOffer} loading={addingOffer} disabled={!offerTitle.trim()} icon={offerType === 'offer' ? <Gift className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}>
            {offerType === 'offer' ? 'إضافة العرض' : 'إضافة المسابقة'}
          </Button>
        </div>
      </Modal>

      {/* Edit Offer Modal */}
      <Modal isOpen={showEditOffer} onClose={() => { setShowEditOffer(false); setEditingOffer(null); setEditOfferExpiresAt(''); }} title="تعديل العرض / المسابقة" size="lg">
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setEditOfferType('offer')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${editOfferType === 'offer' ? 'gradient-warm text-white shadow-md' : 'bg-emerald-50 dark:bg-emerald-900/20 text-[var(--color-text-secondary)]'}`}>
              <Gift className="w-4 h-4" /> عرض
            </button>
            <button onClick={() => setEditOfferType('contest')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${editOfferType === 'contest' ? 'gradient-rose text-white shadow-md' : 'bg-emerald-50 dark:bg-emerald-900/20 text-[var(--color-text-secondary)]'}`}>
              <Trophy className="w-4 h-4" /> مسابقة
            </button>
          </div>
          <Input label="العنوان *" placeholder="عنوان العرض" value={editOfferTitle} onChange={(e) => setEditOfferTitle(e.target.value)} />
          <Input label="الوصف" placeholder="تفاصيل العرض..." value={editOfferDesc} onChange={(e) => setEditOfferDesc(e.target.value)} />
          {editOfferType === 'offer' && <Input label="نسبة الخصم" placeholder="مثال: 50%" value={editOfferDiscount} onChange={(e) => setEditOfferDiscount(e.target.value)} />}
          <Input label="تاريخ الانتهاء (اختياري)" type="date" value={editOfferExpiresAt} onChange={(e) => setEditOfferExpiresAt(e.target.value)} />
          <ImageUploader label="صورة العرض" value={editOfferImage} onChange={setEditOfferImage} />
          <Button fullWidth onClick={handleSaveOffer} loading={savingOffer} disabled={!editOfferTitle.trim()} icon={<Edit3 className="w-5 h-5" />}>
            حفظ التغييرات
          </Button>
        </div>
      </Modal>

      {/* Delete Store Confirmation Modal */}
      <Modal isOpen={showDeleteStore} onClose={() => setShowDeleteStore(false)} title="حذف المتجر" size="sm">
        <div className="space-y-4">
          <div className="bg-rose-50 dark:bg-rose-900/20 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-bold text-rose-700">هل أنت متأكد؟</p>
              <p className="text-[12px] text-rose-500 dark:text-rose-400 mt-1 leading-relaxed">سيتم حذف متجرك "{myStore?.name}" وجميع المنتجات والعروض والتعليقات المرتبطة به. لا يمكن التراجع عن هذا الإجراء.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button fullWidth variant="outline" onClick={() => setShowDeleteStore(false)}>إلغاء</Button>
            <Button fullWidth variant="danger" onClick={handleDeleteStore} loading={deletingStore} icon={<Trash2 className="w-4 h-4" />}>حذف المتجر</Button>
          </div>
        </div>
      </Modal>

      {/* Share Sheet */}
      {shareTarget && (
        <ShareSheet
          isOpen={showShareSheet}
          onClose={() => { setShowShareSheet(false); setShareTarget(null); }}
          itemType={shareTarget.type}
          itemId={shareTarget.id}
          itemName={shareTarget.name}
          itemDescription={shareTarget.description}
          itemPrice={shareTarget.price}
          storeName={shareTarget.storeName}
          imageUrl={shareTarget.imageUrl}
          discount={shareTarget.discount}
        />
      )}
    </div>
  );
};


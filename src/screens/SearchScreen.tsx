'use client';
import React, { useState, useCallback, useRef, useEffect, useMemo, useTransition } from 'react';
import { Search, X, Package, Store as StoreIcon, Loader2, Verified, Sparkles, ImageIcon, Tag, Bot, MapPin } from 'lucide-react';
import { SafeImage, StoreLogo } from '@/components/market/SafeImage';
import { useAppStore } from '@/store/appStore';
import type { Product, Store } from '@/store/appStore';
import { useDebounce } from '@/hooks/useNetwork';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';
import { fetchApi } from '@/lib/fetchApi';

interface OfferItem {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  type: string; // 'offer' or 'contest'
  discount?: string;
  store_name?: string;
}

type Tab = 'products' | 'stores' | 'offers';

const DEFAULT_LIMIT = 20;

export const SearchScreen: React.FC = () => {
  const setSubScreen = useAppStore(s => s.setSubScreen);
  const setSelectedStoreId = useAppStore(s => s.setSelectedStoreId);
  const openProductDetail = useAppStore(s => s.openProductDetail);
  const openOfferDetail = useAppStore(s => s.openOfferDetail);
  const searchQuery = useAppStore(s => s.searchQuery);
  const setSearchQuery = useAppStore(s => s.setSearchQuery);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [_productsPage, setProductsPage] = useState(1);
  const [_storesPage, setStoresPage] = useState(1);
  const [_offersPage, setOffersPage] = useState(1);
  const PAGE_SIZE = 10;
  const abortRef = useRef<AbortController | null>(null);
  const initialDataRef = useRef<{ products: Product[]; stores: Store[]; offers: OfferItem[] } | null>(null);
  const [, startTransition] = useTransition();

  // ── AI Smart Search State ──
  const [aiSearchEnabled, setAiSearchEnabled] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false); // whether AI is configured in admin
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);

  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);

  // Check if AI is enabled on mount
  useEffect(() => {
    fetchApi<{ enabled: boolean; provider: string }>('/api/help/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '__check__' }),
    })
      .then(({ data }) => {
        if (data?.enabled) setAiEnabled(true);
      })
      .catch(() => {});
  }, []);

  // ── Fetch default data on mount ──
  useEffect(() => {
    let cancelled = false;

    async function fetchDefaultData() {
      setInitialLoading(true);
      try {
        const [productsRes, storesRes, offersRes] = await Promise.all([
          fetchApi<{ products: Product[] }>(`/api/products?limit=${DEFAULT_LIMIT}`),
          fetchApi<{ stores: Store[] }>(`/api/stores?limit=${DEFAULT_LIMIT}`),
          fetchApi<{ offers: OfferItem[] }>(`/api/offers?limit=${DEFAULT_LIMIT}`),
        ]);

        if (cancelled) return;

        const defaultProducts = productsRes.data?.products || [];
        const defaultStores = storesRes.data?.stores || [];
        const defaultOffers = offersRes.data?.offers || [];

        initialDataRef.current = { products: defaultProducts, stores: defaultStores, offers: defaultOffers };

        startTransition(() => {
          setProducts(defaultProducts);
          setStores(defaultStores);
          setOffers(defaultOffers);
          setProductsPage(1);
          setStoresPage(1);
          setOffersPage(1);
        });
      } catch {
        // Silently handle errors — page will show empty state
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
        }
      }
    }

    fetchDefaultData();

    return () => { cancelled = true; };
  }, []);

  // ── AI Smart Search: analyze natural language query ──
  useEffect(() => {
    aiAbortRef.current?.abort();

    if (!aiSearchEnabled || !debouncedQuery.trim() || debouncedQuery.trim().length <= 3) {
      setAiExplanation(null);
      return;
    }

    const controller = new AbortController();
    aiAbortRef.current = controller;
    setAiLoading(true);
    setAiExplanation(null);

    const aiPrompt = `أنت مساعد بحث ذكي في تطبيق "سوق شامل" السوري للتجارة الإلكترونية.
حلل طلب المستخدم التالي وأعد JSON فقط بدون أي نص إضافي:
{
  "keywords": ["كلمة1", "كلمة2", "كلمة3"],
  "explanation": "شرح قصير بالعربية لما وجدته"
}

قواعد:
- keywords: كلمات بحثية عربية مناسبة لقاعدة بيانات منتجات سورية (أسماء منتجات، فئات، أوصاف)
- explanation: شرح قصير بالعربية (3-8 كلمات) لنتائج البحث
- أعد JSON فقط، لا نص قبله أو بعده

طلب المستخدم: "${debouncedQuery}"`;

    fetchApi<{ reply: string }>('/api/help/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: aiPrompt }),
      signal: controller.signal,
    })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        const reply = data?.reply || '';
        try {
          // Try to extract JSON from the reply (AI might wrap it in markdown)
          const jsonMatch = reply.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.keywords && Array.isArray(parsed.keywords) && parsed.keywords.length > 0) {
              const searchKeywords = parsed.keywords.join(' ');
              setAiExplanation(parsed.explanation || null);

              // Search using the extracted keywords
              fetchApi<{
                products: Product[];
                stores: Store[];
                offers: OfferItem[];
              }>(`/api/search?q=${encodeURIComponent(searchKeywords)}&limit=${PAGE_SIZE}&type=all`)
                .then(({ data: searchData }) => {
                  if (controller.signal.aborted) return;
                  setProducts(searchData?.products || []);
                  setStores(searchData?.stores || []);
                  setOffers(searchData?.offers || []);
                  setProductsPage(1);
                  setStoresPage(1);
                  setOffersPage(1);
                })
                .catch(() => {});
            }
          }
        } catch {
          // AI returned non-JSON — fall back to regular search with the original query
          setAiExplanation(null);
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setAiExplanation(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setAiLoading(false);
        }
      });

    return () => { controller.abort(); };
  }, [debouncedQuery, aiSearchEnabled]);

  // ── Search effect: fetch via aggregated endpoint when query exists (normal search) ──
  useEffect(() => {
    // Skip normal search if AI search is active (AI effect handles it)
    if (aiSearchEnabled) return;

    abortRef.current?.abort();

    if (!debouncedQuery.trim()) {
      // When query is cleared, restore initial data
      if (initialDataRef.current) {
        startTransition(() => {
          setProducts(initialDataRef.current!.products);
          setStores(initialDataRef.current!.stores);
          setOffers(initialDataRef.current!.offers);
        });
      }
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    startTransition(() => { setLoading(true); });

    fetchApi<{
      products: Product[];
      stores: Store[];
      offers: OfferItem[];
    }>(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=${PAGE_SIZE}&type=all`, {
      signal: controller.signal,
    })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        setProducts(data?.products || []);
        setStores(data?.stores || []);
        setOffers(data?.offers || []);
        setProductsPage(1);
        setStoresPage(1);
        setOffersPage(1);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, aiSearchEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); aiAbortRef.current?.abort(); };
  }, []);

  // Auto-trigger search if searchQuery was set from another screen (e.g. HomeScreen category click)
  useEffect(() => {
    if (searchQuery) {
      startTransition(() => {
        setQuery(searchQuery);
        setSearchQuery('');
      });
    }
  }, [searchQuery, setSearchQuery, startTransition]);

  const handleSearchChange = useCallback((value: string) => {
    setQuery(value);
    // Instant clear when input is emptied, restore initial data
    if (!value.trim()) {
      abortRef.current?.abort();
      aiAbortRef.current?.abort();
      setAiExplanation(null);
      if (initialDataRef.current) {
        setProducts(initialDataRef.current.products);
        setStores(initialDataRef.current.stores);
        setOffers(initialDataRef.current.offers);
      }
      setLoading(false);
      setAiLoading(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    abortRef.current?.abort();
    aiAbortRef.current?.abort();
    setQuery('');
    setAiExplanation(null);
    setAiLoading(false);
    if (initialDataRef.current) {
      setProducts(initialDataRef.current.products);
      setStores(initialDataRef.current.stores);
      setOffers(initialDataRef.current.offers);
    }
  }, []);

  const suggestions = useMemo(() => ['آيفون', 'لابتوب', 'ملابس', 'أحذية', 'إلكترونيات', 'ساعة ذكية'], []);

  const aiSuggestions = useMemo(() => [
    'أريد هدية عيد ميلاد لصديقتي لا تتجاوز 50 ألف',
    'جوال بسعر أقل من 200 ألف',
    'أحذية رياضية للجري',
    'لابتوب للتصميم والبرمجة',
  ], []);

  // Load more products with pagination
  const handleLoadMoreProducts = useCallback(async () => {
    const nextPage = _productsPage + 1;
    const offset = nextPage * PAGE_SIZE;
    try {
      const endpoint = debouncedQuery
        ? `/api/products?search=${encodeURIComponent(debouncedQuery)}&limit=${PAGE_SIZE}&offset=${offset}`
        : `/api/products?limit=${PAGE_SIZE}&offset=${offset}`;
      const { data } = await fetchApi<{ products: Product[] }>(endpoint);
      if (data?.products) {
        setProducts(prev => [...prev, ...data.products]);
        setProductsPage(nextPage);
      }
    } catch { /* pagination failed — silently ignore */ }
  }, [debouncedQuery, _productsPage]);

  // Use all results (already paginated from API)
  const displayedProducts = products;
  const displayedStores = stores.slice(0, 30);
  const displayedOffers = offers.slice(0, 30);

  const hasMoreProducts = products.length % PAGE_SIZE === 0 && products.length > 0;

  return (
    <div className="bg-[var(--color-bg)] min-h-screen pb-24">
      {/* Header */}
      <div className="gradient-dark px-5 pt-8 pb-6 relative overflow-hidden">
        <div className="absolute top-[-30px] right-[-20px] w-[140px] h-[140px] rounded-full bg-teal-600/15 blur-[50px]" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Search className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-white text-lg font-bold">البحث</h1>
              <p className="text-teal-300 dark:text-teal-600/50 text-[11px] mt-0.5">ابحث عن منتجات ومتاجر وعروض</p>
            </div>
          </div>
          <div className="bg-[var(--color-surface)]/10 backdrop-blur-sm rounded-xl flex items-center gap-3 px-3.5 min-h-[48px] border border-white/10">
            <Search className="w-4 h-4 text-teal-300 dark:text-teal-600/60 flex-shrink-0" />
            <input type="text" value={query} onChange={(e) => handleSearchChange(e.target.value)} placeholder={aiSearchEnabled ? "صِف ما تبحث عنه باللغة الطبيعية..." : "ابحث عن منتجات أو متاجر..."}
              className="flex-1 bg-transparent text-white placeholder-teal-300/50 font-medium text-[16px] outline-none min-w-0" />
            {aiLoading && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin flex-shrink-0" />}
            {query && (
              <button onClick={clearSearch} className="w-6 h-6 rounded-lg bg-[var(--color-surface)]/15 flex items-center justify-center hover:bg-[var(--color-surface)]/25">
                <X className="w-3 h-3 text-white/70" />
              </button>
            )}
          </div>

          {/* AI Smart Search Toggle */}
          {aiEnabled && (
            <div className="mt-3 flex items-center gap-2.5">
              <button
                onClick={() => {
                  const newEnabled = !aiSearchEnabled;
                  setAiSearchEnabled(newEnabled);
                  if (!newEnabled) {
                    setAiExplanation(null);
                    setAiLoading(false);
                    // Restore normal search results for current query
                    if (debouncedQuery.trim()) {
                      fetchApi<{
                        products: Product[];
                        stores: Store[];
                        offers: OfferItem[];
                      }>(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=${PAGE_SIZE}&type=all`)
                        .then(({ data }) => {
                          setProducts(data?.products || []);
                          setStores(data?.stores || []);
                          setOffers(data?.offers || []);
                        })
                        .catch(() => {});
                    }
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all duration-200 ${
                  aiSearchEnabled
                    ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-purple-500/30'
                    : 'bg-white/10 text-teal-200 hover:bg-white/20 border border-white/10'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                البحث الذكي 🤖
              </button>
              {aiSearchEnabled && (
                <span className="text-teal-300/60 text-[10px]">اكتب ما تريد بلغتك الطبيعية</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-3.5">
        {/* Tab Switcher */}
        <div className="bg-[var(--color-surface)] rounded-xl p-1 border border-[var(--color-border)] shadow-sm">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {([
              { key: 'products' as Tab, label: 'المنتجات', icon: <Package className="w-3.5 h-3.5 flex-shrink-0" />, count: products.length },
              { key: 'stores' as Tab, label: 'المتاجر', icon: <StoreIcon className="w-3.5 h-3.5 flex-shrink-0" />, count: stores.length },
              { key: 'offers' as Tab, label: 'العروض', icon: <Tag className="w-3.5 h-3.5 flex-shrink-0" />, count: offers.length },
            ]).map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 py-2.5 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all duration-150 whitespace-nowrap min-w-fit px-2 ${
                  tab === t.key ? 'gradient-primary text-white shadow-md shadow-emerald-500/20' : 'text-[var(--color-text-tertiary)] hover:text-emerald-700'
                }`}>
                {t.icon}
                {t.label}
                {t.count > 0 && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${tab === t.key ? 'bg-[var(--color-surface)]/20' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'}`}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* AI Explanation Card */}
        {aiExplanation && !loading && !initialLoading && (
          <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-2xl p-3.5 border border-violet-200/60 dark:border-violet-800/30 flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <p className="text-[13px] text-violet-800 dark:text-violet-300 font-medium leading-relaxed">
              🤖 وجدنا لك: {aiExplanation}
            </p>
          </div>
        )}

        {/* Initial Loading */}
        {initialLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
            <p className="text-[13px] font-medium text-[var(--color-text-secondary)]">جاري تحميل البيانات...</p>
          </div>
        )}

        {/* Search Loading */}
        {loading && !initialLoading && !aiSearchEnabled && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
            <p className="text-[13px] font-medium text-[var(--color-text-secondary)]">جاري البحث...</p>
          </div>
        )}

        {/* AI Search Loading */}
        {aiLoading && aiSearchEnabled && !initialLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center animate-pulse shadow-md shadow-purple-500/30">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <p className="text-[13px] font-medium text-violet-600 dark:text-violet-400">جارٍ تحليل طلبك...</p>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">المساعد الذكي يفهم ما تبحث عنه</p>
          </div>
        )}

        {/* AI Smart Suggestions - show when AI is enabled and no query */}
        {aiSearchEnabled && !query && !loading && !initialLoading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Bot className="w-4 h-4 text-violet-500" />
              <p className="text-[13px] font-bold text-[var(--color-text)]">جرّب البحث الذكي</p>
            </div>
            <div className="flex flex-col gap-2">
              {aiSuggestions.map((s) => (
                <button key={s} onClick={() => handleSearchChange(s)}
                  className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/15 dark:to-purple-900/15 border border-violet-100/80 dark:border-violet-800/40 text-violet-700 dark:text-violet-300 text-[12px] font-medium px-3.5 py-2.5 rounded-xl hover:border-violet-300 hover:from-violet-100 hover:to-purple-100 transition-colors shadow-sm text-right">
                  ✨ {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Regular Suggestions - show only when not loading, no query, and AI is off */}
        {!aiSearchEnabled && !query && !loading && !initialLoading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <p className="text-[13px] font-bold text-[var(--color-text)]">عمليات بحث شائعة</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => handleSearchChange(s)}
                  className="bg-[var(--color-surface)] border border-emerald-100/80 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 text-[13px] font-medium px-3.5 py-2 rounded-xl hover:border-emerald-300 hover:text-emerald-700 transition-colors shadow-sm">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Product Results - show when not loading (either initial or search) */}
        {!loading && !aiLoading && !initialLoading && tab === 'products' && (
          <div className="space-y-3">
            {displayedProducts.length === 0 ? (
              <div className="bg-[var(--color-surface)] rounded-2xl p-8 text-center border border-[var(--color-border)] shadow-sm">
                <div className="w-14 h-14 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center mx-auto mb-3"><Package className="w-7 h-7 text-emerald-300" /></div>
                <p className="text-emerald-900 dark:text-emerald-300 font-bold text-[14px] mb-0.5">لا توجد نتائج</p>
                <p className="text-[var(--color-text-tertiary)] text-[12px]">{aiSearchEnabled ? 'جرّب صياغة طلبك بطريقة مختلفة' : 'جرّب كلمة بحث مختلفة'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
              {displayedProducts.map((product) => (
                <div key={product.id} onClick={() => openProductDetail(product.id)}
                  className="bg-[var(--color-surface)] rounded-2xl overflow-hidden border border-[var(--color-border)] shadow-sm hover:shadow-md hover:shadow-emerald-500/8 transition-shadow cursor-pointer active:scale-[0.98]">
                  <div className="aspect-square bg-gradient-to-br from-emerald-50/50 to-teal-50/50 overflow-hidden relative">
                    <SafeImage
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      fallback={<div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-6 h-6 text-emerald-300" /></div>}
                    />
                    {product.is_new && <span className="absolute top-1.5 right-1.5 bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md">جديد</span>}
                    {product.is_featured && <span className="absolute top-1.5 left-1.5 bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md">مميز</span>}
                  </div>
                  <div className="p-2.5">
                    <p className="font-bold text-[var(--color-text)] text-[12px] line-clamp-2 min-h-[32px]">{product.name}</p>
                    <p className="text-[13px] font-black gradient-text-primary mt-1">{product.price.toLocaleString('ar-SY')} <span className="text-[9px] font-medium text-[var(--color-text-tertiary)]">ل.س</span></p>
                  </div>
                </div>
              ))}
              </div>
            )}
            {hasMoreProducts && (
              <div className="py-3 text-center">
                <button onClick={handleLoadMoreProducts} disabled={loading}
                  className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[13px] font-bold rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors border border-emerald-100/60">
                  تحميل المزيد ({displayedProducts.length} منتج)
                </button>
              </div>
            )}
          </div>
        )}

        {/* Store Results - show when not loading */}
        {!loading && !aiLoading && !initialLoading && tab === 'stores' && (
          <div className="space-y-2.5">
            {stores.length === 0 ? (
              <div className="bg-[var(--color-surface)] rounded-2xl p-8 text-center border border-[var(--color-border)] shadow-sm">
                <div className="w-14 h-14 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center mx-auto mb-3"><StoreIcon className="w-7 h-7 text-emerald-300" /></div>
                <p className="text-emerald-900 dark:text-emerald-300 font-bold text-[14px] mb-0.5">لا توجد متاجر</p>
                <p className="text-[var(--color-text-tertiary)] text-[12px]">جرّب كلمة بحث مختلفة</p>
              </div>
            ) : (
              displayedStores.map((store) => {
                const handleOpenStore = () => {
                  setSelectedStoreId(store.id);
                  setSubScreen('store-detail');
                };
                return (
                  <div key={store.id} onClick={handleOpenStore}
                    className="bg-[var(--color-surface)] rounded-2xl flex items-center gap-3.5 p-3.5 border border-[var(--color-border)] shadow-sm hover:shadow-md hover:shadow-emerald-500/8 transition-shadow cursor-pointer active:scale-[0.98]">
                    <StoreLogo src={store.logo_url} name={store.name} size="md" className="shadow-sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-[var(--color-text)] text-[13px] line-clamp-1">{store.name}</p>
                        {store.is_verified && <Verified className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                      </div>
                      <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 line-clamp-1">{store.description || 'متجر إلكتروني'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-block bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-md">{store.category || 'عام'}</span>
                        {store.is_following && <span className="inline-block bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-md">متابَع</span>}
                        {(store.location || store.governorate || store.district) && (
                          <span className="flex items-center gap-0.5 text-[10px] text-[var(--color-text-tertiary)]">
                            <MapPin className="w-3 h-3" />
                            <span className="line-clamp-1">{store.location || [store.governorate, store.city, store.district].filter(Boolean).join(' - ')}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {stores.length > 30 && (
              <div className="py-4 text-center">
                <p className="text-[var(--color-text-tertiary)] text-[12px]">عرض {displayedStores.length} من {stores.length} متجر — حدّث البحث لتضييق النتائج</p>
              </div>
            )}
          </div>
        )}

        {/* Offers Results - show when not loading */}
        {!loading && !aiLoading && !initialLoading && tab === 'offers' && (
          <div className="space-y-2.5">
            {offers.length === 0 ? (
              <div className="bg-[var(--color-surface)] rounded-2xl p-8 text-center border border-[var(--color-border)] shadow-sm">
                <div className="w-14 h-14 bg-emerald-50/60 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center mx-auto mb-3"><Tag className="w-7 h-7 text-emerald-300" /></div>
                <p className="text-emerald-900 dark:text-emerald-300 font-bold text-[14px] mb-0.5">لا توجد عروض</p>
                <p className="text-[var(--color-text-tertiary)] text-[12px]">جرّب كلمة بحث مختلفة</p>
              </div>
            ) : (
              displayedOffers.map((offer) => (
                <div key={offer.id} onClick={() => openOfferDetail(offer.id)}
                  className="bg-[var(--color-surface)] rounded-2xl flex items-center gap-3.5 p-3.5 border border-[var(--color-border)] shadow-sm hover:shadow-md hover:shadow-emerald-500/8 transition-shadow cursor-pointer active:scale-[0.98]">
                  <div className="w-[72px] h-[72px] rounded-xl bg-gradient-to-br from-emerald-50/50 to-teal-50/50 overflow-hidden flex-shrink-0">
                    <SafeImage
                      src={offer.image_url}
                      alt={offer.title}
                      className="w-full h-full object-cover"
                      fallback={<div className="w-full h-full flex items-center justify-center"><Tag className="w-6 h-6 text-emerald-300" /></div>}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[var(--color-text)] text-[13px] line-clamp-1">{offer.title}</p>
                    {offer.store_name && (
                      <p className="text-[10px] text-emerald-600 font-bold mt-0.5 line-clamp-1">{offer.store_name}</p>
                    )}
                    {offer.description && (
                      <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 line-clamp-1">{offer.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        offer.type === 'contest'
                          ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                          : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {offer.type === 'contest' ? 'مسابقة' : 'عرض'}
                      </span>
                      {offer.discount && (
                        <span className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-md">{offer.discount}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            {offers.length > 30 && (
              <div className="py-4 text-center">
                <p className="text-[var(--color-text-tertiary)] text-[12px]">عرض {displayedOffers.length} من {offers.length} عرض — حدّث البحث لتضييق النتائج</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

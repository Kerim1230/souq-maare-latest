// Shared mapping utilities to avoid duplication across API routes

export interface ProductData {
  id: string;
  store_id: string;
  user_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  is_featured: boolean;
  is_new: boolean;
  is_real_photo: boolean;
  views: number;
  expires_at: string | null;
  created_at: string;
}

export interface StoreData {
  id: string;
  user_id: string;
  name: string;
  description: string;
  logo_url: string;
  cover_url: string;
  category: string;
  is_verified: boolean;
  chat_enabled: boolean;
  governorate: string | null;
  city: string | null;
  district: string | null;
  location: string | null;
  created_at: string;
}

export function mapProduct(product: any): ProductData {
  return {
    id: product.id,
    store_id: product.store_id ?? product.storeId,
    user_id: product.user_id ?? product.userId,
    name: product.name,
    description: product.description,
    price: product.price,
    image_url: product.image_url ?? product.imageUrl,
    category: product.category,
    is_featured: product.is_featured ?? product.isFeatured,
    is_new: product.is_new ?? product.isNew,
    is_real_photo: product.is_real_photo ?? product.isRealPhoto ?? false,
    views: product.views ?? 0,
    expires_at: typeof product.expires_at === 'string' ? product.expires_at : product.expiresAt?.toISOString?.() ?? product.expires_at ?? null,
    created_at: typeof product.created_at === 'string' ? product.created_at : product.createdAt?.toISOString?.() ?? product.created_at,
  };
}

export interface MappedStore extends StoreData {
  is_featured?: boolean;
  followers_count?: number;
  is_following?: boolean;
  theme_color?: string | null;
  theme_color_changed_at?: string | null;
}

export function mapStore(store: any): MappedStore {
  return {
    id: store.id,
    user_id: store.user_id ?? store.userId,
    name: store.name,
    description: store.description,
    logo_url: store.logo_url ?? store.logoUrl,
    cover_url: store.cover_url ?? store.coverUrl,
    category: store.category,
    is_verified: store.is_verified ?? store.isVerified,
    chat_enabled: store.chat_enabled ?? store.chatEnabled ?? false,
    governorate: store.governorate ?? null,
    city: store.city ?? null,
    district: store.district ?? null,
    location: store.location ?? null,
    theme_color: (store.theme_color ?? store.themeColor) || null,
    theme_color_changed_at: store.theme_color_changed_at?.toISOString?.() ?? store.themeColorChangedAt?.toISOString?.() ?? store.theme_color_changed_at ?? store.themeColorChangedAt ?? null,
    is_featured: (store.is_featured ?? store.isFeatured) || false,
    followers_count: store.followers_count ?? store._count?.follows ?? 0,
    is_following: store.is_following ?? store.isFollowing ?? false,
    created_at: store.created_at?.toISOString?.() ?? store.createdAt?.toISOString?.() ?? store.created_at,
  };
}

export function mapFavorite(fav: any) {
  return {
    id: fav.id,
    user_id: fav.user_id ?? fav.userId,
    product_id: fav.product_id ?? fav.productId,
    store_id: fav.store_id ?? fav.storeId,
    created_at: fav.created_at?.toISOString?.() ?? fav.createdAt?.toISOString?.() ?? fav.created_at,
    product: fav.product ? mapProduct(fav.product) : null,
    store: fav.store ? mapStore(fav.store) : null,
  };
}

// ═══════════════════════════════════════════════════════════
// 🇸🇾 Syrian Marketplace Category Taxonomy (13 Groups)
// ═══════════════════════════════════════════════════════════

export interface Subcategory {
  name: string;
  emoji: string;
}

export interface CategoryGroup {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
  subcategories: readonly Subcategory[];
}

export const CATEGORY_GROUPS: readonly CategoryGroup[] = [
  // ── 1. تجارة التجزئة اليومية ──
  {
    id: 'retail',
    name: 'تجارة التجزئة',
    emoji: '🛍️',
    gradient: 'from-emerald-400 to-teal-600',
    subcategories: [
      { name: 'بقاليات', emoji: '🛍️' },
      { name: 'سوبر ماركت', emoji: '🏪' },
      { name: 'ميني ماركت', emoji: '🧃' },
      { name: 'مواد غذائية جملة', emoji: '🏬' },
      { name: 'مواد غذائية مجففة', emoji: '🌾' },
      { name: 'منتجات ريفية', emoji: '🧺' },
      { name: 'زيت زيتون', emoji: '🫒' },
      { name: 'أجبان بلدية', emoji: '🧀' },
      { name: 'معلبات', emoji: '🥫' },
      { name: 'مكسرات وتمور', emoji: '🌰' },
      { name: 'بهارات ومواد طبخ', emoji: '🧂' },
      { name: 'لحوم طازجة', emoji: '🥩' },
      { name: 'لحوم مجمدة', emoji: '❄️' },
      { name: 'أسماك طازجة', emoji: '🐟' },
    ] as const,
  },
  // ── 2. أكل ومطاعم ──
  {
    id: 'food',
    name: 'أكل ومطاعم',
    emoji: '🍽️',
    gradient: 'from-red-400 to-rose-600',
    subcategories: [
      { name: 'مطاعم', emoji: '🍽️' },
      { name: 'مطاعم شعبية سورية', emoji: '🍲' },
      { name: 'مشاوي', emoji: '🔥' },
      { name: 'فلافل وشاورما', emoji: '🌯' },
      { name: 'وجبات سريعة', emoji: '🍔' },
      { name: 'حلويات شامية', emoji: '🍯' },
      { name: 'حلويات غربية', emoji: '🍰' },
      { name: 'مخابز', emoji: '🍞' },
      { name: 'كافيهات', emoji: '☕' },
      { name: 'عصائر طبيعية', emoji: '🧃' },
      { name: 'آيس كريم', emoji: '🍦' },
      { name: 'مطاعم بيتية', emoji: '🏠' },
    ] as const,
  },
  // ── 3. البناء والعمران ──
  {
    id: 'construction',
    name: 'البناء والعمران',
    emoji: '🏗️',
    gradient: 'from-amber-400 to-orange-600',
    subcategories: [
      { name: 'مواد بناء', emoji: '🧱' },
      { name: 'إسمنت وحديد', emoji: '🧲' },
      { name: 'بلاط وسيراميك', emoji: '🧩' },
      { name: 'دهانات وديكور', emoji: '🎨' },
      { name: 'عزل مائي وحراري', emoji: '🧯' },
      { name: 'خشب وألواح', emoji: '🪵' },
      { name: 'أدوات صحية', emoji: '🚿' },
      { name: 'سباكة وأدوات مواسير', emoji: '🔩' },
      { name: 'أدوات كهرباء', emoji: '⚡' },
      { name: 'معدات ورشات', emoji: '🛠️' },
      { name: 'إكسسوارات بناء', emoji: '🏗️' },
    ] as const,
  },
  // ── 4. خدمات حرفية ──
  {
    id: 'crafts',
    name: 'خدمات حرفية',
    emoji: '🔧',
    gradient: 'from-slate-500 to-zinc-700',
    subcategories: [
      { name: 'كهربائي منازل', emoji: '⚡' },
      { name: 'كهربائي صناعي', emoji: '🏭' },
      { name: 'سباك', emoji: '🚿' },
      { name: 'نجار', emoji: '🪵' },
      { name: 'حداد', emoji: '🔩' },
      { name: 'ميكانيك سيارات', emoji: '🚗' },
      { name: 'ميكانيك دراجات', emoji: '🏍️' },
      { name: 'تصليح أجهزة كهربائية', emoji: '🔧' },
      { name: 'تكييف وتبريد', emoji: '❄️' },
      { name: 'ألومنيوم وشبابيك', emoji: '🪟' },
      { name: 'صيانة عامة', emoji: '🧰' },
    ] as const,
  },
  // ── 5. خدمات شخصية ──
  {
    id: 'personal',
    name: 'خدمات شخصية',
    emoji: '💇',
    gradient: 'from-pink-400 to-rose-600',
    subcategories: [
      { name: 'حلاقة رجالية', emoji: '💈' },
      { name: 'صالونات نسائية', emoji: '💇‍♀️' },
      { name: 'مكياج وتجميل', emoji: '💄' },
      { name: 'خياطة وتفصيل', emoji: '🧵' },
      { name: 'تصميم أزياء', emoji: '👗' },
      { name: 'تنظيف منازل', emoji: '🧹' },
      { name: 'رعاية أطفال', emoji: '👶' },
      { name: 'تصوير حفلات', emoji: '📸' },
      { name: 'تنظيم مناسبات', emoji: '🎉' },
    ] as const,
  },
  // ── 6. نقل وشحن ──
  {
    id: 'logistics',
    name: 'نقل وشحن',
    emoji: '🚚',
    gradient: 'from-sky-400 to-blue-600',
    subcategories: [
      { name: 'نقل أثاث', emoji: '🛋️' },
      { name: 'نقل وشحن', emoji: '🚚' },
      { name: 'توصيل طلبات', emoji: '🛵' },
      { name: 'شحن بين المحافظات', emoji: '📦' },
      { name: 'سيارات أجرة', emoji: '🚕' },
      { name: 'تأجير سيارات', emoji: '🚗' },
    ] as const,
  },
  // ── 7. صحة وطب ──
  {
    id: 'health',
    name: 'صحة وطب',
    emoji: '💊',
    gradient: 'from-teal-500 to-green-600',
    subcategories: [
      { name: 'صيدليات', emoji: '💊' },
      { name: 'مستلزمات طبية', emoji: '🏥' },
      { name: 'عيادات طبية', emoji: '🧑‍⚕️' },
      { name: 'مختبرات تحاليل', emoji: '🔬' },
      { name: 'طب أسنان', emoji: '🦷' },
      { name: 'بصريات ونظارات', emoji: '👓' },
      { name: 'معدات طبية', emoji: '🩺' },
    ] as const,
  },
  // ── 8. تقنية وإلكترونيات ──
  {
    id: 'tech',
    name: 'تقنية وإلكترونيات',
    emoji: '📱',
    gradient: 'from-violet-400 to-purple-600',
    subcategories: [
      { name: 'هواتف', emoji: '📲' },
      { name: 'حواسيب', emoji: '💻' },
      { name: 'إكسسوارات موبايل', emoji: '🎧' },
      { name: 'إصلاح إلكترونيات', emoji: '🔧' },
      { name: 'كاميرات مراقبة', emoji: '📷' },
      { name: 'إنترنت وشبكات', emoji: '🌐' },
      { name: 'برمجة وخدمات تقنية', emoji: '👨‍💻' },
    ] as const,
  },
  // ── 9. منزل وأثاث ──
  {
    id: 'home',
    name: 'منزل وأثاث',
    emoji: '🏠',
    gradient: 'from-yellow-500 to-amber-700',
    subcategories: [
      { name: 'أثاث منزلي', emoji: '🛋️' },
      { name: 'ديكور داخلي', emoji: '🪞' },
      { name: 'إضاءة', emoji: '💡' },
      { name: 'سجاد ومفروشات', emoji: '🧶' },
      { name: 'أدوات مطبخ', emoji: '🍽️' },
      { name: 'أجهزة منزلية', emoji: '⚡' },
    ] as const,
  },
  // ── 10. أزياء وجمال ──
  {
    id: 'fashion',
    name: 'أزياء وجمال',
    emoji: '👗',
    gradient: 'from-fuchsia-400 to-pink-600',
    subcategories: [
      { name: 'ملابس رجالية', emoji: '👕' },
      { name: 'ملابس نسائية', emoji: '👗' },
      { name: 'ملابس أطفال', emoji: '👶' },
      { name: 'أحذية', emoji: '👟' },
      { name: 'عطور ومستحضرات', emoji: '💄' },
      { name: 'إكسسوارات', emoji: '🎁' },
    ] as const,
  },
  // ── 11. إنتاج وصناعة ──
  {
    id: 'industry',
    name: 'إنتاج وصناعة',
    emoji: '🏭',
    gradient: 'from-gray-400 to-gray-600',
    subcategories: [
      { name: 'مصانع', emoji: '🏭' },
      { name: 'معامل', emoji: '🔬' },
      { name: 'ورشات إنتاج', emoji: '🧰' },
      { name: 'منتجات غذائية محلية', emoji: '🥖' },
      { name: 'منتجات حرفية', emoji: '🪡' },
    ] as const,
  },
  // ── 12. طاقة وخدمات عامة ──
  {
    id: 'energy',
    name: 'طاقة وخدمات عامة',
    emoji: '⛽',
    gradient: 'from-orange-500 to-red-600',
    subcategories: [
      { name: 'محطات وقود', emoji: '⛽' },
      { name: 'غاز منزلي', emoji: '🔥' },
      { name: 'كازيات', emoji: '🏪' },
      { name: 'خدمات كهرباء', emoji: '⚡' },
    ] as const,
  },
  // ── 13. خدمات مالية ──
  {
    id: 'finance',
    name: 'خدمات مالية',
    emoji: '💵',
    gradient: 'from-green-500 to-emerald-700',
    subcategories: [
      { name: 'صرافة وتحويل أموال', emoji: '💵' },
      { name: 'محاسبة', emoji: '📊' },
      { name: 'خدمات مالية', emoji: '📑' },
      { name: 'تأمينات', emoji: '🛡️' },
    ] as const,
  },
] as const;

// ── Flat lookup: subcategory name → emoji ──
const _emojiMap = new Map<string, string>();
for (const group of CATEGORY_GROUPS) {
  for (const sub of group.subcategories) {
    _emojiMap.set(sub.name, sub.emoji);
  }
}

// ── Flat list of all subcategory names (for backward compat / dropdowns) ──
export const ALL_SUBCATEGORY_NAMES: readonly string[] = CATEGORY_GROUPS.flatMap(g => g.subcategories.map(s => s.name));

// ── Backward compat aliases ──
/** @deprecated Use CATEGORY_GROUPS instead */
export const CATEGORIES = CATEGORY_GROUPS;
/** @deprecated Use ALL_SUBCATEGORY_NAMES instead */
export const STORE_CATEGORIES = ALL_SUBCATEGORY_NAMES;

export function mapOffer(offer: any) {
  return {
    id: offer.id,
    store_id: offer.store_id ?? offer.storeId,
    user_id: offer.user_id ?? offer.userId,
    title: offer.title,
    description: offer.description,
    image_url: offer.image_url ?? offer.imageUrl,
    type: offer.type,
    discount: offer.discount,
    views: offer.views ?? 0,
    expires_at: typeof offer.expires_at === 'string' ? offer.expires_at : offer.expiresAt?.toISOString?.() ?? offer.expires_at ?? null,
    created_at: typeof offer.created_at === 'string' ? offer.created_at : offer.createdAt?.toISOString?.() ?? offer.created_at,
    comments_count: offer.comments_count ?? offer._count?.comments ?? 0,
  };
}

export function mapComment(comment: any) {
  return {
    id: comment.id,
    user_id: comment.user_id ?? comment.userId,
    content: comment.content,
    product_id: comment.product_id ?? comment.productId,
    offer_id: comment.offer_id ?? comment.offerId,
    created_at: comment.created_at ?? comment.createdAt ?? new Date().toISOString(),
    user_name: (comment.user?.full_name ?? comment.user?.fullName) || null,
    user_avatar: (comment.user?.avatar_url ?? comment.user?.avatarUrl) || null,
  };
}

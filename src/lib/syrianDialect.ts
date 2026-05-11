/**
 * 🇸🇾 Syrian Dialect Dictionary for Search Expansion
 * 
 * Maps Syrian colloquial terms to their Modern Standard Arabic (فصحى) equivalents.
 * When a user searches using a Syrian term, the search API expands the query
 * to include both the dialect term and its formal equivalent, ensuring
 * products are found regardless of which language variant was used.
 * 
 * Usage:
 *   import { expandSyrianQuery, SYRIAN_DIALECT_MAP } from '@/lib/syrianDialect';
 *   const expanded = expandSyrianQuery('بسطال'); 
 *   // → ['بسطال', 'حذاء رياضي']
 */

/**
 * Syrian dialect → Standard Arabic mapping
 * Key: Syrian colloquial term (lowercase for matching)
 * Value: Array of standard Arabic equivalents
 */
export const SYRIAN_DIALECT_MAP: Record<string, string[]> = {
  // ── Clothing & Fashion ──
  'بسطال': ['حذاء رياضي', 'حذاء', 'سنيكرز'],
  'كندرة': ['حذاء نسائي', 'حذاء', 'كعب'],
  'أواعي': ['ملابس', 'ألبسة', 'ثياب'],
  'طربوش': ['قبعة', 'طاقية'],
  'شماغ': ['غطاء رأس', 'حطّة', 'كوفية'],
  'دلّاعة': ['حقيبة يد', 'شنطة', 'حقيبة'],
  'فرّاجة': ['نظارة', 'نظارات طبية'],
  'مريول': ['مريلة', 'فوقانية', 'مئزر'],

  // ── Food & Kitchen ──
  'فول مدمس': ['فول', 'بقوليات'],
  'حمص بطحينة': ['حمص', 'مقبلات'],
  'محمرة': ['مقبلات', 'صلصة فلفل'],
  'متبل': ['مقبلات', 'بابا غنوج'],
  'كبة': ['كبة سورية', 'مقبلات', 'أطباق تقليدية'],
  'يبرق': ['يبرق سوري', 'ورق عنب', 'أطباق تقليدية'],
  'ششبرك': ['ششبرك سوري', 'أطباق تقليدية'],
  'فتوش': ['سلطة', 'مقبلات'],
  'تبولة': ['سلطة', 'مقبلات'],
  'بيرة': ['عصير', 'مشروبات'],
  'عرقسوس': ['مشروبات', 'عرق سوس'],
  'تمر هندي': ['مشروبات'],
  'جبنة بلدية': ['أجبان', 'جبنة', 'منتجات ألبان'],
  'لبنة': ['أجبان', 'منتجات ألبان'],
  'بندورة': ['طماطم', 'خضار', 'خضروات'],
  'بطاطا': ['بطاطس', 'خضار'],
  'بازلاء': ['بسلة', 'خضار', 'بقوليات'],
  'فول أخضر': ['بقوليات', 'خضار'],

  // ── Home & Furniture ──
  'طبلية': ['طاولة', 'منضدة'],
  'كنبة': ['أريكة', 'كنبة'],
  'لحاف': ['بطانية', 'غطاء سرير', 'مفروشات'],
  'مرتبة': ['فراش', 'مطرز', 'سرير'],
  'سجادة': ['سجاد', 'موكيت', 'مفروشات'],
  'مشربية': ['شرفة', 'بلكونة'],
  'سخان': ['مدفأة', 'سخان ماء', 'تدفئة'],
  'صوبة': ['مدفأة', 'تدفئة', 'موقد'],
  'ماسورة': ['أنبوب', 'مواسير', 'سباكة'],

  // ── Tools & Hardware ──
  'مفتاح': ['قفل', 'مفتاح باب'],
  'براغي': ['مسامير', 'فوطة', 'مسامير تثبيت'],
  'شنيور': ['مثقاب كهربائي', 'دريل'],
  'عتلة': ['مفتاح ربط', 'أدوات'],
  'فأس': ['أدوات زراعية', 'أدوات'],
  'منشار': ['أدوات نجارة', 'أدوات'],

  // ── Vehicles & Transport ──
  'موتور': ['محرك', 'سيارة'],
  'طنبر': ['شاحنة', 'نقل'],
  'بوسطة': ['حافلة', 'نقل عام'],
  'سرفيس': ['تاكسي', 'سيارة أجرة', 'نقل'],
  'ميكرو': ['حافلة صغيرة', 'نقل عام'],
  'وانيت': ['شاحنة صغيرة', 'نقل'],

  // ── People & Professions ──
  'حلاق': ['صالون حلاقة', 'حلاقة'],
  'خياط': ['خياطة', 'تفصيل'],
  'سباك': ['سباكة', 'صيانة مواسير'],
  'نجار': ['نجارة', 'أعمال خشب'],
  'حداد': ['أعمال معدن', 'لحام'],
  'بائع': ['تجارة', 'متجر'],
  'صنايعي': ['حرفي', 'عمالة ماهرة'],

  // ── Money & Commerce ──
  'ليرة': ['عملة', 'سعر'],
  'صرفة': ['صرافة', 'تحويل أموال'],
  'حوالة': ['تحويل أموال', 'تحويل'],
  'قسط': ['تقسيط', 'دفعات'],
  'مخزن': ['مستودع', 'مخزون'],
  'جملة': ['بيع بالجملة', 'جملة'],
  'مفرق': ['بيع بالمفرق', 'تجزئة'],

  // ── Daily Life ──
  'شباك': ['نافذة', 'ألومنيوم'],
  'درب': ['شارع', 'طريق'],
  'حارة': ['حي', 'منطقة'],
  'سوق': ['سوق', 'بازار', 'متجر'],
  'دكّان': ['متجر', 'محل', 'حانوت'],
  'حانوت': ['متجر', 'محل', 'دكّان'],
  'بزّة': ['بدلة', 'طقم رسمي'],
  'شبشب': ['نعال', 'شبشب', 'حذاء منزلي'],
  'طرشي': ['مخللات', 'مقبلات'],
  'لبن': ['زبادي', 'منتجات ألبان'],
  'سمنة': ['زبدة', 'سمن', 'منتجات ألبان'],
  'جبلة': ['قفازات', 'قفاز'],
  'كاسة': ['كوب', 'كأس', 'أواني'],
  'صحن': ['طبق', 'أواني'],
  'طنجرة': ['قدر', 'حلة', 'أواني طبخ'],
  'مهلّبية': ['أواني', 'حلة ضغط'],
  'محمصة': ['أواني', 'مقلاة'],
};

/**
 * Reverse map: Standard Arabic → Syrian dialect terms
 * Used to expand formal search queries to include dialect equivalents
 */
const _reverseMap = new Map<string, string[]>();
for (const [dialect, standardArr] of Object.entries(SYRIAN_DIALECT_MAP)) {
  for (const standard of standardArr) {
    const existing = _reverseMap.get(standard) || [];
    if (!existing.includes(dialect)) existing.push(dialect);
    _reverseMap.set(standard, existing);
  }
}

/**
 * Expand a search query to include Syrian dialect synonyms.
 * 
 * Example:
 *   expandSyrianQuery('بسطال') → ['بسطال', 'حذاء رياضي', 'حذاء', 'سنيكرز']
 *   expandSyrianQuery('حذاء') → ['حذاء', 'بسطال', 'كندرة']
 *   expandSyrianQuery('هاتف') → ['هاتف'] // no Syrian equivalent mapped
 * 
 * @param query - The search query (single word or short phrase)
 * @returns Array of expanded terms including the original query
 */
export function expandSyrianQuery(query: string): string[] {
  const terms = new Set<string>();
  terms.add(query); // Always include original query

  // Direct match: query IS a Syrian term
  const normalizedQuery = query.trim();
  const synonyms = SYRIAN_DIALECT_MAP[normalizedQuery];
  if (synonyms) {
    for (const s of synonyms) terms.add(s);
  }

  // Reverse match: query IS a standard Arabic term with dialect equivalents
  const dialectTerms = _reverseMap.get(normalizedQuery);
  if (dialectTerms) {
    for (const d of dialectTerms) terms.add(d);
  }

  // Partial match: check if query appears in any key or value
  for (const [dialect, standardArr] of Object.entries(SYRIAN_DIALECT_MAP)) {
    if (dialect.includes(normalizedQuery) || normalizedQuery.includes(dialect)) {
      terms.add(dialect);
      for (const s of standardArr) terms.add(s);
    }
    for (const standard of standardArr) {
      if (standard.includes(normalizedQuery) || normalizedQuery.includes(standard)) {
        terms.add(standard);
        terms.add(dialect);
      }
    }
  }

  return Array.from(terms);
}

/**
 * Build an expanded ILIKE OR filter for Supabase search.
 * Takes a base query and returns additional search terms that should
 * be OR'd with the original query.
 * 
 * @param query - Original search query
 * @param fields - Database fields to search (e.g. ['name', 'description', 'category'])
 * @returns Additional ILIKE filter strings to OR with the original search
 */
export function getSyrianExpandedFilters(
  query: string,
  fields: string[] = ['name', 'description', 'category']
): string[] {
  const expandedTerms = expandSyrianQuery(query);
  // Remove the original query since it's already included in the search
  const additionalTerms = expandedTerms.filter(t => t !== query);
  
  const filters: string[] = [];
  for (const term of additionalTerms) {
    const escaped = term.replace(/%/g, '\\%').replace(/_/g, '\\_');
    const fieldFilters = fields.map(f => `${f}.ilike.%${escaped}%`);
    filters.push(...fieldFilters);
  }
  
  return filters;
}

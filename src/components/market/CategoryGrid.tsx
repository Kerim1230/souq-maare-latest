'use client';
import React, { memo, useCallback, useState, useEffect } from 'react';

interface CategoryGridProps {
  onCategoryClick: (_catName: string) => void;
}

// ═══════════════════════════════════════════════════════════
// Color Palette — Soft background + border per named color
// Colors: emerald, rose, amber, sky, violet, slate,
//         pink, teal, orange, green, yellow, fuchsia, red, gray
// ═══════════════════════════════════════════════════════════
const COLOR_PALETTE: Record<string, { iconBg: string; border: string }> = {
  emerald: { iconBg: 'bg-gradient-to-br from-emerald-400/20 to-emerald-600/10 dark:from-emerald-400/15 dark:to-emerald-600/5',  border: 'border-emerald-500/25' },
  rose:    { iconBg: 'bg-gradient-to-br from-rose-400/20 to-rose-600/10 dark:from-rose-400/15 dark:to-rose-600/5',        border: 'border-rose-500/25' },
  amber:   { iconBg: 'bg-gradient-to-br from-amber-400/20 to-amber-600/10 dark:from-amber-400/15 dark:to-amber-600/5',     border: 'border-amber-500/25' },
  sky:     { iconBg: 'bg-gradient-to-br from-sky-400/20 to-sky-600/10 dark:from-sky-400/15 dark:to-sky-600/5',         border: 'border-sky-500/25' },
  violet:  { iconBg: 'bg-gradient-to-br from-violet-400/20 to-violet-600/10 dark:from-violet-400/15 dark:to-violet-600/5',   border: 'border-violet-500/25' },
  slate:   { iconBg: 'bg-gradient-to-br from-slate-300/20 to-slate-500/10 dark:from-slate-300/15 dark:to-slate-500/5',     border: 'border-slate-400/25' },
  pink:    { iconBg: 'bg-gradient-to-br from-pink-400/20 to-pink-600/10 dark:from-pink-400/15 dark:to-pink-600/5',       border: 'border-pink-500/25' },
  teal:    { iconBg: 'bg-gradient-to-br from-teal-400/20 to-teal-600/10 dark:from-teal-400/15 dark:to-teal-600/5',       border: 'border-teal-500/25' },
  orange:  { iconBg: 'bg-gradient-to-br from-orange-400/20 to-orange-600/10 dark:from-orange-400/15 dark:to-orange-600/5',   border: 'border-orange-500/25' },
  green:   { iconBg: 'bg-gradient-to-br from-green-400/20 to-green-600/10 dark:from-green-400/15 dark:to-green-600/5',     border: 'border-green-500/25' },
  yellow:  { iconBg: 'bg-gradient-to-br from-yellow-400/20 to-yellow-600/10 dark:from-yellow-400/15 dark:to-yellow-600/5',   border: 'border-yellow-500/25' },
  fuchsia: { iconBg: 'bg-gradient-to-br from-fuchsia-400/20 to-fuchsia-600/10 dark:from-fuchsia-400/15 dark:to-fuchsia-600/5', border: 'border-fuchsia-500/25' },
  red:     { iconBg: 'bg-gradient-to-br from-red-400/20 to-red-600/10 dark:from-red-400/15 dark:to-red-600/5',         border: 'border-red-500/25' },
  gray:    { iconBg: 'bg-gradient-to-br from-gray-300/20 to-gray-500/10 dark:from-gray-300/15 dark:to-gray-500/5',       border: 'border-gray-400/25' },
};

// ═══════════════════════════════════════════════════════════
// CATEGORY_META — All 242 categories with emoji + color
// ═══════════════════════════════════════════════════════════
export const CATEGORY_META: Record<string, { emoji: string; color: string }> = {
  // ══════ إلكترونيات وتقنية (sky) ════════
  'إلكترونيات': { emoji: '📱', color: 'sky' },
  'موبايلات': { emoji: '📲', color: 'sky' },
  'لابتوبات': { emoji: '💻', color: 'sky' },
  'كاميرات مراقبة': { emoji: '📹', color: 'sky' },
  'أنظمة إنذار': { emoji: '🚨', color: 'sky' },
  'أقفال': { emoji: '🔐', color: 'sky' },
  'خزن': { emoji: '🗃️', color: 'sky' },
  'أدوات أمان': { emoji: '🛡️', color: 'sky' },
  'أجهزة GPS': { emoji: '📍', color: 'sky' },
  'إلكترونيات سيارات': { emoji: '🔌', color: 'sky' },
  'مسجلات': { emoji: '🎙️', color: 'sky' },
  'سماعات': { emoji: '🎧', color: 'sky' },
  'سماعات أذن': { emoji: '🎧', color: 'sky' },
  'مكبرات صوت': { emoji: '🔊', color: 'sky' },
  'بروجيكتور': { emoji: '📽️', color: 'sky' },
  'تلفزيونات': { emoji: '📺', color: 'sky' },
  'رسيفرات': { emoji: '📡', color: 'sky' },
  'اشتراكات IPTV': { emoji: '📺', color: 'sky' },
  'إنترنت': { emoji: '🌐', color: 'sky' },
  'راوترات': { emoji: '📡', color: 'sky' },
  'أجهزة شبكات': { emoji: '📡', color: 'sky' },
  'سيرفرات': { emoji: '🖥️', color: 'sky' },
  'برمجيات': { emoji: '💾', color: 'sky' },
  'برمجة مواقع': { emoji: '💻', color: 'sky' },
  'تطبيقات جوال': { emoji: '📲', color: 'sky' },
  'بيع وصيانة كمبيوتر': { emoji: '🖥️', color: 'sky' },
  'شبكات واي فاي': { emoji: '📶', color: 'sky' },
  'صيانة جوالات': { emoji: '🔧', color: 'sky' },
  'تركيب ستلايت': { emoji: '📡', color: 'sky' },
  'أجهزة إنذار حريق': { emoji: '🚨', color: 'sky' },
  'آلات تصوير': { emoji: '📷', color: 'sky' },
  'أجهزة عرض': { emoji: '📽️', color: 'sky' },
  'أجهزة ألعاب': { emoji: '🎮', color: 'sky' },

  // ══════ ملابس وأزياء وجمال (pink) ════════
  'ملابس رجالية': { emoji: '👔', color: 'pink' },
  'ملابس نسائية': { emoji: '👗', color: 'pink' },
  'ملابس أطفال': { emoji: '👶', color: 'pink' },
  'أحذية': { emoji: '👟', color: 'pink' },
  'حقائب': { emoji: '👜', color: 'pink' },
  'إكسسوارات': { emoji: '💎', color: 'pink' },
  'عطور': { emoji: '🌸', color: 'pink' },
  'مكياج': { emoji: '💄', color: 'pink' },
  'عناية بالبشرة': { emoji: '🧖', color: 'pink' },
  'شعر وأدوات تجميل': { emoji: '💇', color: 'pink' },
  'ذهب ومجوهرات': { emoji: '💍', color: 'pink' },
  'ساعات': { emoji: '⌚', color: 'pink' },
  'نظارات': { emoji: '👓', color: 'pink' },
  'صالونات حلاقة': { emoji: '💈', color: 'pink' },
  'صالونات تجميل': { emoji: '💇‍♀️', color: 'pink' },
  'خياطة': { emoji: '✂️', color: 'pink' },

  // ══════ أثاث ومنزل وديكور (amber) ════════
  'أجهزة منزلية': { emoji: '🏠', color: 'amber' },
  'أثاث منزلي': { emoji: '🛋️', color: 'amber' },
  'أثاث مكتبي': { emoji: '🪑', color: 'amber' },
  'أثاث حدائق': { emoji: '🌿', color: 'amber' },
  'سجاد': { emoji: '🧶', color: 'amber' },
  'موكيت': { emoji: '🟫', color: 'amber' },
  'ستائر': { emoji: '🪟', color: 'amber' },
  'مفارش': { emoji: '🛏️', color: 'amber' },
  'أطقم حمام': { emoji: '🚿', color: 'amber' },
  'أدوات مطبخ': { emoji: '🍽️', color: 'amber' },
  'أواني': { emoji: '🍳', color: 'amber' },
  'سكاكين': { emoji: '🔪', color: 'amber' },
  'أجهزة مطبخ': { emoji: '🍳', color: 'amber' },
  'ثلاجات': { emoji: '🧊', color: 'amber' },
  'غسالات': { emoji: '🫧', color: 'amber' },
  'مكيفات': { emoji: '❄️', color: 'amber' },
  'مدافئ': { emoji: '🌡️', color: 'amber' },
  'سخانات': { emoji: '♨️', color: 'amber' },
  'مراوح': { emoji: '🌀', color: 'amber' },
  'خلاطات': { emoji: '🫧', color: 'amber' },
  'ميكروويف': { emoji: '🔲', color: 'amber' },
  'أفران': { emoji: '🔥', color: 'amber' },
  'دفايات': { emoji: '🌡️', color: 'amber' },
  'غسالات صحون': { emoji: '🫧', color: 'amber' },
  'مطابخ': { emoji: '🍳', color: 'amber' },
  'خزائن': { emoji: '🗃️', color: 'amber' },
  'رفوف': { emoji: '🗄️', color: 'amber' },
  'ديكور': { emoji: '🪞', color: 'amber' },
  'جبس بورد': { emoji: '🧱', color: 'amber' },
  'دهانات ديكورية': { emoji: '🎨', color: 'amber' },
  'أرضيات': { emoji: '🔲', color: 'amber' },
  'أبواب': { emoji: '🚪', color: 'amber' },
  'شبابيك': { emoji: '🪟', color: 'amber' },
  'مظلات': { emoji: '⛱️', color: 'amber' },
  'مكاتب': { emoji: '🪑', color: 'amber' },
  'كراسي بلاستيك': { emoji: '🪑', color: 'amber' },
  'نوافير': { emoji: '⛲', color: 'amber' },
  'تحف': { emoji: '🏺', color: 'amber' },
  'أنتيكات': { emoji: '🏺', color: 'amber' },
  'مصابيح وإنارة': { emoji: '💡', color: 'amber' },
  'طاقة شمسية': { emoji: '☀️', color: 'amber' },
  'تكييف مركزي': { emoji: '❄️', color: 'amber' },
  'تركيب وصيانة تكييف': { emoji: '❄️', color: 'amber' },

  // ══════ سيارات وقطع غيار ونقل (sky) ════════
  'سيارات': { emoji: '🚗', color: 'sky' },
  'قطع سيارات': { emoji: '🔩', color: 'sky' },
  'إطارات': { emoji: '🛞', color: 'sky' },
  'زيوت محركات': { emoji: '🛢️', color: 'sky' },
  'دهانات سيارات': { emoji: '🎨', color: 'sky' },
  'ورشة سيارات': { emoji: '🔧', color: 'sky' },
  'كهرباء سيارات': { emoji: '🔋', color: 'sky' },
  'ميكانيك': { emoji: '🔧', color: 'sky' },
  'سمكرة ودهان': { emoji: '🔧', color: 'sky' },
  'غيارات زيوت': { emoji: '🛢️', color: 'sky' },
  'بنشر': { emoji: '🛞', color: 'sky' },
  'زجاج سيارات': { emoji: '🪟', color: 'sky' },
  'مفاتيح وكوالين': { emoji: '🔑', color: 'sky' },
  'دراجات هوائية': { emoji: '🚲', color: 'sky' },
  'تعليم قيادة': { emoji: '🚗', color: 'sky' },
  'تأجير سيارات': { emoji: '🚗', color: 'sky' },
  'نقل أثاث': { emoji: '🚚', color: 'sky' },
  'خدمات توصيل': { emoji: '🛵', color: 'sky' },
  'شحن': { emoji: '📦', color: 'sky' },
  'تذاكر طيران': { emoji: '✈️', color: 'sky' },
  'حجوزات فنادق': { emoji: '🏨', color: 'sky' },
  'خدمات سياحية': { emoji: '🗺️', color: 'sky' },
  'رحلات بحرية': { emoji: '🚤', color: 'sky' },
  'أدوات بحرية': { emoji: '🚤', color: 'sky' },

  // ══════ أغذية ومواد غذائية (red) ════════
  'مواد غذائية': { emoji: '🛒', color: 'red' },
  'خضار وفواكه': { emoji: '🥬', color: 'red' },
  'لحوم طازجة': { emoji: '🥩', color: 'red' },
  'دواجن مجمدة': { emoji: '🍗', color: 'red' },
  'دواجن': { emoji: '🍗', color: 'red' },
  'أسماك طازجة': { emoji: '🐟', color: 'red' },
  'ألبان وأجبان': { emoji: '🧀', color: 'red' },
  'معلبات': { emoji: '🥫', color: 'red' },
  'مشروبات': { emoji: '🥤', color: 'red' },
  'عصائر': { emoji: '🧃', color: 'red' },
  'شاي وقهوة': { emoji: '☕', color: 'red' },
  'توابل وبهارات': { emoji: '🌶️', color: 'red' },
  'زيوت نباتية': { emoji: '🫒', color: 'red' },
  'معجنات': { emoji: '🥐', color: 'red' },
  'حلويات': { emoji: '🍬', color: 'red' },
  'شوكولا': { emoji: '🍫', color: 'red' },
  'مكسرات': { emoji: '🌰', color: 'red' },
  'تمور': { emoji: '🌴', color: 'red' },
  'عسل': { emoji: '🍯', color: 'red' },
  'مربيات': { emoji: '🫙', color: 'red' },
  'منتجات عضوية': { emoji: '🌿', color: 'red' },
  'أغذية أطفال': { emoji: '🍼', color: 'red' },
  'حفاضات': { emoji: '🧷', color: 'red' },
  'شواء وفحم': { emoji: '🔥', color: 'red' },

  // ══════ عقارات (teal) ════════
  'عقارات': { emoji: '🏢', color: 'teal' },
  'أراضي': { emoji: '🏗️', color: 'teal' },
  'شقق': { emoji: '🏠', color: 'teal' },
  'محلات تجارية': { emoji: '🏬', color: 'teal' },
  'مستودعات': { emoji: '🏭', color: 'teal' },
  'تسويق عقاري': { emoji: '🏘️', color: 'teal' },
  'بناء وتشييد': { emoji: '🏗️', color: 'teal' },

  // ══════ خدمات واستشارات وتعليم (violet) ════════
  'دروس خصوصية': { emoji: '📖', color: 'violet' },
  'دورات تدريبية': { emoji: '🎓', color: 'violet' },
  'استشارات': { emoji: '🧠', color: 'violet' },
  'محاماة': { emoji: '⚖️', color: 'violet' },
  'محاسبة': { emoji: '📊', color: 'violet' },
  'هندسة': { emoji: '📐', color: 'violet' },
  'تصميم داخلي': { emoji: '🏡', color: 'violet' },
  'تصميم معماري': { emoji: '🏛️', color: 'violet' },
  'تصميم جرافيك': { emoji: '🎨', color: 'violet' },
  'تسويق إلكتروني': { emoji: '📊', color: 'violet' },
  'إدارة صفحات': { emoji: '📱', color: 'violet' },
  'كتابة محتوى': { emoji: '✍️', color: 'violet' },
  'ترجمة': { emoji: '🌍', color: 'violet' },
  'خدمات استشارية': { emoji: '🧠', color: 'violet' },
  'دور حضانة': { emoji: '👶', color: 'violet' },
  'روضة أطفال': { emoji: '🧒', color: 'violet' },
  'دعاية وإعلان': { emoji: '📢', color: 'violet' },
  'خدمات طباعة': { emoji: '🖨️', color: 'violet' },
  'تغليف هدايا': { emoji: '🎁', color: 'violet' },
  'مقاولات': { emoji: '🏗️', color: 'violet' },
  'تأمين': { emoji: '🛡️', color: 'violet' },
  'صرافة': { emoji: '💵', color: 'violet' },
  'خدمات مالية': { emoji: '🏦', color: 'violet' },

  // ══════ صحة وطب ورياضة (green) ════════
  'أجهزة طبية': { emoji: '🩺', color: 'green' },
  'معدات رياضية': { emoji: '⚽', color: 'green' },
  'نوادي رياضية': { emoji: '🏋️', color: 'green' },

  // ══════ أدوات وبناء وحرف يدوية (orange) ════════
  'مواد بناء': { emoji: '🧱', color: 'orange' },
  'أدوات كهربائية': { emoji: '⚡', color: 'orange' },
  'أسلاك وكابلات': { emoji: '🔌', color: 'orange' },
  'بطاريات': { emoji: '🔋', color: 'orange' },
  'إسمنت': { emoji: '🏗️', color: 'orange' },
  'حديد': { emoji: '⛓️', color: 'orange' },
  'خشب': { emoji: '🪵', color: 'orange' },
  'مواد عزل': { emoji: '🧯', color: 'orange' },
  'كهرباء بناء': { emoji: '⚡', color: 'orange' },
  'سباكة': { emoji: '🪠', color: 'orange' },
  'كهربائي': { emoji: '⚡', color: 'orange' },
  'سمكري': { emoji: '🔧', color: 'orange' },
  'دهين': { emoji: '🎨', color: 'orange' },
  'معلم بناء': { emoji: '👷', color: 'orange' },
  'عمال تحميل': { emoji: '👷', color: 'orange' },
  'حدادة': { emoji: '🔨', color: 'orange' },
  'نجارة': { emoji: '🪚', color: 'orange' },
  'نجارين': { emoji: '🪚', color: 'orange' },
  'حدادين': { emoji: '🔨', color: 'orange' },
  'PVC': { emoji: '🧱', color: 'orange' },
  'ألمنيوم': { emoji: '🪟', color: 'orange' },
  'بلاط': { emoji: '🧩', color: 'orange' },
  'سيراميك': { emoji: '🧩', color: 'orange' },
  'رخام': { emoji: '🪨', color: 'orange' },
  'غرانيت': { emoji: '🪨', color: 'orange' },
  'زجاج ومرايا': { emoji: '🪞', color: 'orange' },
  'ألمنيوم وستائر': { emoji: '🪟', color: 'orange' },
  'مصاعد': { emoji: '🛗', color: 'orange' },
  'صيانة منازل': { emoji: '🔧', color: 'orange' },
  'عقود صيانة': { emoji: '🔧', color: 'orange' },
  'أدوات تنظيف': { emoji: '🧹', color: 'orange' },

  // ══════ أطفال وألعاب وكتب (yellow) ════════
  'ألعاب أطفال': { emoji: '🧸', color: 'yellow' },
  'ألعاب فيديو': { emoji: '🎮', color: 'yellow' },
  'أفلام': { emoji: '🎬', color: 'yellow' },
  'موسيقى': { emoji: '🎵', color: 'yellow' },
  'آلات موسيقية': { emoji: '🎵', color: 'yellow' },
  'فنون تشكيلية': { emoji: '🎨', color: 'yellow' },
  'لوحات فنية': { emoji: '🖼️', color: 'yellow' },
  'كتب': { emoji: '📚', color: 'yellow' },
  'روايات': { emoji: '📖', color: 'yellow' },
  'قصص أطفال': { emoji: '🧒', color: 'yellow' },
  'أدوات مدرسية': { emoji: '📝', color: 'yellow' },
  'قرطاسية': { emoji: '✏️', color: 'yellow' },

  // ══════ حيوانات وزراعة ونباتات (emerald) ════════
  'أسمدة ومبيدات': { emoji: '🌱', color: 'emerald' },
  'بذور زراعية': { emoji: '🌾', color: 'emerald' },
  'أدوات زراعية': { emoji: '🌾', color: 'emerald' },
  'أعلاف حيوانية': { emoji: '🌾', color: 'emerald' },
  'مواشي': { emoji: '🐄', color: 'emerald' },
  'طيور زينة': { emoji: '🦜', color: 'emerald' },
  'أسماك زينة': { emoji: '🐠', color: 'emerald' },
  'حيوانات أليفة': { emoji: '🐾', color: 'emerald' },
  'خدمات حدائق': { emoji: '🌳', color: 'emerald' },
  'مكافحة حشرات': { emoji: '🪲', color: 'emerald' },
  'خيم': { emoji: '⛺', color: 'emerald' },
  'أكياس نوم': { emoji: '🛏️', color: 'emerald' },
  'معدات تخييم': { emoji: '⛺', color: 'emerald' },
  'أدوات صيد': { emoji: '🎣', color: 'emerald' },
  'أدوات رحلات': { emoji: '🧳', color: 'emerald' },

  // ══════ تنظيف وعناية (slate) ════════
  'منظفات منزلية': { emoji: '🧴', color: 'slate' },
  'صابون': { emoji: '🧴', color: 'slate' },
  'شامبو': { emoji: '🧴', color: 'slate' },
  'معقمات': { emoji: '🧴', color: 'slate' },
  'أكياس نايلون': { emoji: '🛍️', color: 'slate' },
  'ورقيات': { emoji: '📄', color: 'slate' },
  'تنظيف منازل': { emoji: '🧹', color: 'slate' },
  'تنظيف جاف': { emoji: '🧹', color: 'slate' },
  'مغاسل': { emoji: '🧺', color: 'slate' },

  // ══════ متنوع وفئات إضافية (fuchsia) ════════
  'لوازم مكتبية': { emoji: '📝', color: 'fuchsia' },
  'مدافئ حطب': { emoji: '🔥', color: 'fuchsia' },

  // ══════ فئات مضافة — مطابقة لقاعدة البيانات الفعلية ════════

  // أطعمة ومشروبات إضافية (red)
  'آيس كريم': { emoji: '🍦', color: 'red' },
  'أجبان بلدية': { emoji: '🧀', color: 'red' },
  'بقاليات': { emoji: '🏪', color: 'red' },
  'بهارات ومواد طبخ': { emoji: '🧂', color: 'red' },
  'حلويات شامية': { emoji: '🍰', color: 'red' },
  'حلويات غربية': { emoji: '🧁', color: 'red' },
  'زيت زيتون': { emoji: '🫒', color: 'red' },
  'عصائر طبيعية': { emoji: '🧃', color: 'red' },
  'فلافل وشاورما': { emoji: '🥙', color: 'red' },
  'كازيات': { emoji: '🛢️', color: 'red' },
  'لحوم مجمدة': { emoji: '🥩', color: 'red' },
  'مخابز': { emoji: '🍞', color: 'red' },
  'مكسرات وتمور': { emoji: '🌰', color: 'red' },
  'مشاوي': { emoji: '🍖', color: 'red' },
  'مواد غذائية جملة': { emoji: '📦', color: 'red' },
  'مواد غذائية مجففة': { emoji: '🫘', color: 'red' },
  'منتجات غذائية محلية': { emoji: '🛒', color: 'red' },

  // مطاعم ومقاهي (red)
  'مطاعم': { emoji: '🍽️', color: 'red' },
  'مطاعم بيتية': { emoji: '🏠', color: 'red' },
  'مطاعم شعبية سورية': { emoji: '🥘', color: 'red' },
  'كافيهات': { emoji: '☕', color: 'red' },
  'وجبات سريعة': { emoji: '🍔', color: 'red' },
  'سوبر ماركت': { emoji: '🏬', color: 'red' },
  'ميني ماركت': { emoji: '🏪', color: 'red' },

  // صحة وطب (green)
  'أدوات رياضية': { emoji: '⚽', color: 'green' },
  'صيدليات': { emoji: '💊', color: 'green' },
  'عيادات طبية': { emoji: '🏥', color: 'green' },
  'مختبرات تحاليل': { emoji: '🔬', color: 'green' },
  'طب أسنان': { emoji: '🦷', color: 'green' },
  'مستلزمات طبية': { emoji: '🩺', color: 'green' },
  'معدات طبية': { emoji: '🏥', color: 'green' },

  // تجميل وعناية (pink)
  'أدوات تجميل': { emoji: '💄', color: 'pink' },
  'عطور ومستحضرات': { emoji: '🌸', color: 'pink' },
  'عناية بالشعر': { emoji: '💇', color: 'pink' },
  'مكياج وتجميل': { emoji: '💄', color: 'pink' },
  'حلاقة رجالية': { emoji: '💈', color: 'pink' },
  'صالونات نسائية': { emoji: '💇‍♀️', color: 'pink' },
  'تصميم أزياء': { emoji: '👗', color: 'pink' },
  'خياطة وتفصيل': { emoji: '✂️', color: 'pink' },

  // إلكترونيات إضافية (sky)
  'إصلاح إلكترونيات': { emoji: '🔧', color: 'sky' },
  'إكسسوارات موبايل': { emoji: '📱', color: 'sky' },
  'إنترنت وشبكات': { emoji: '🌐', color: 'sky' },
  'برمجة وخدمات تقنية': { emoji: '💻', color: 'sky' },
  'تصميم وبرمجة': { emoji: '💻', color: 'sky' },
  'حواسيب': { emoji: '🖥️', color: 'sky' },
  'هواتف': { emoji: '📱', color: 'sky' },
  'أقفال ذكية': { emoji: '🔐', color: 'sky' },
  'ألواح طاقة شمسية': { emoji: '☀️', color: 'sky' },
  'كاميرات مراقبة وأمان': { emoji: '📹', color: 'sky' },

  // منزل وديكور إضافي (amber)
  'أبواب وشبابيك': { emoji: '🚪', color: 'amber' },
  'أجهزة منزلية صغيرة': { emoji: '🔌', color: 'amber' },
  'أدوات صحية': { emoji: '🚿', color: 'amber' },
  'إضاءة': { emoji: '💡', color: 'amber' },
  'تصليح أجهزة كهربائية': { emoji: '🔧', color: 'amber' },
  'تكييف وتبريد': { emoji: '❄️', color: 'amber' },
  'ديكور داخلي': { emoji: '🪞', color: 'amber' },
  'دهان وديكورات': { emoji: '🎨', color: 'amber' },
  'دهانات وديكور': { emoji: '🎨', color: 'amber' },
  'سجاد ومفروشات': { emoji: '🛋️', color: 'amber' },
  'سجاد وموكيت': { emoji: '🧶', color: 'amber' },
  'غاز منزلي': { emoji: '🔥', color: 'amber' },
  'رخام وغرانيت': { emoji: '🪨', color: 'amber' },
  'تحف وأنتيكات': { emoji: '🏺', color: 'amber' },
  'ألومنيوم وشبابيك': { emoji: '🪟', color: 'amber' },

  // سيارات ونقل إضافي (sky)
  'توصيل طلبات': { emoji: '🛵', color: 'sky' },
  'سيارات أجرة': { emoji: '🚕', color: 'sky' },
  'شحن بين المحافظات': { emoji: '🚛', color: 'sky' },
  'ميكانيك سيارات': { emoji: '🔧', color: 'sky' },
  'محطات وقود': { emoji: '⛽', color: 'sky' },
  'نقل وشحن': { emoji: '🚚', color: 'sky' },
  'دراجات': { emoji: '🚲', color: 'sky' },
  'ميكانيك دراجات': { emoji: '🔧', color: 'sky' },

  // بناء وحرف إضافية (orange)
  'إسمنت وحديد': { emoji: '⛓️', color: 'orange' },
  'أدوات كهرباء': { emoji: '⚡', color: 'orange' },
  'بلاط وسيراميك': { emoji: '🧩', color: 'orange' },
  'خشب وألواح': { emoji: '🪵', color: 'orange' },
  'سباك': { emoji: '🪠', color: 'orange' },
  'سباكة ومواسير': { emoji: '🔧', color: 'orange' },
  'حداد': { emoji: '🔨', color: 'orange' },
  'نجار': { emoji: '🪚', color: 'orange' },
  'نجارة وأثاث مخصص': { emoji: '🪚', color: 'orange' },
  'عزل مائي وحراري': { emoji: '🧯', color: 'orange' },
  'كهربائي صناعي': { emoji: '⚡', color: 'orange' },
  'كهربائي منازل': { emoji: '⚡', color: 'orange' },
  'خدمات كهرباء': { emoji: '⚡', color: 'orange' },
  'صيانة عامة': { emoji: '🔧', color: 'orange' },
  'معدات ورشات': { emoji: '🧰', color: 'orange' },
  'ورشات إنتاج': { emoji: '🏭', color: 'orange' },
  'مصانع': { emoji: '🏭', color: 'orange' },
  'معامل': { emoji: '🏭', color: 'orange' },

  // خدمات إضافية (violet)
  'تأمينات': { emoji: '🛡️', color: 'violet' },
  'تنظيم مناسبات': { emoji: '🎉', color: 'violet' },
  'تصوير حفلات': { emoji: '📸', color: 'violet' },
  'صرافة وتحويل أموال': { emoji: '💱', color: 'violet' },
  'رعاية أطفال': { emoji: '👶', color: 'violet' },
  'بصريات ونظارات': { emoji: '👓', color: 'violet' },

  // زراعة وحيوانات إضافية (emerald)
  'بذور': { emoji: '🌱', color: 'emerald' },
  'طيور': { emoji: '🐦', color: 'emerald' },
  'منتجات حرفية': { emoji: '🧶', color: 'emerald' },
  'منتجات ريفية': { emoji: '🌾', color: 'emerald' },

  // فنون وترفيه إضافية (yellow)
  'لوحات': { emoji: '🖼️', color: 'yellow' },

  // تنظيف (slate)
  'منظفات': { emoji: '🧴', color: 'slate' },
  'صابون وشامبو': { emoji: '🧴', color: 'slate' },
};

// ═══════════════════════════════════════════════════════════
// Fallback keyword matching for categories not in CATEGORY_META
// ═══════════════════════════════════════════════════════════
const KEYWORD_FALLBACK: Array<{ keywords: string[]; emoji: string; color: string }> = [
  { keywords: ['إلكترون', 'موبايل', 'لابتوب', 'كامير', 'مراقب', 'شبك', 'برمج', 'سماع', 'إنترنت', 'راوتر', 'سيرفر', 'ستلايت', 'تلفزيون', 'رسيفر', 'ألعاب'], emoji: '📱', color: 'sky' },
  { keywords: ['ملابس', 'أزياء', 'أحذية', 'حقائب', 'عطور', 'مكياج', 'بشرة', 'شعر', 'صالون', 'حلاق', 'تجميل', 'خياط', 'ذهب', 'مجوهر', 'ساعات', 'نظارات'], emoji: '👗', color: 'pink' },
  { keywords: ['أثاث', 'منزل', 'منازل', 'مفروش', 'مطبخ', 'سجاد', 'ديكور', 'ستائر', 'مفرش', 'غسالة', 'ثلاج', 'مكيف', 'تكييف', 'أفران', 'مظلات', 'نوافير', 'إنارة', 'مصابيح'], emoji: '🏠', color: 'amber' },
  { keywords: ['سيار', 'دراج', 'بنشر', 'ميكانيك', 'زيوت', 'إطارات', 'قطع غيار', 'نقل', 'شحن', 'طيران', 'فندق', 'سياح'], emoji: '🚗', color: 'sky' },
  { keywords: ['غذائ', 'مأكول', 'طعام', 'خبز', 'لحم', 'دجاج', 'سمك', 'حليب', 'جبن', 'حلو', 'شوكولا', 'معجن', 'عسل', 'تمر', 'قهوة', 'شاي', 'توابل', 'حفاضات'], emoji: '🍽️', color: 'red' },
  { keywords: ['عقار', 'شقق', 'أراض', 'مكاتب', 'مستودع', 'بناء', 'تشييد'], emoji: '🏢', color: 'teal' },
  { keywords: ['استشار', 'تعليم', 'تدريب', 'دورات', 'محام', 'محاسب', 'ترجم', 'تصميم', 'هندس', 'مقاول', 'تأمين', 'صراف', 'مالي'], emoji: '💼', color: 'violet' },
  { keywords: ['طبي', 'صيدل', 'دواء', 'رياض', 'نادي', 'تمرين', 'معدة'], emoji: '💊', color: 'green' },
  { keywords: ['بناء', 'إسمنت', 'حديد', 'بلاط', 'سيراميك', 'رخام', 'دهان', 'عزل', 'خشب', 'سباك', 'كهرب', 'نجار', 'حداد', 'ألمنيوم', 'زجاج', 'مصعد', 'صيان'], emoji: '🧱', color: 'orange' },
  { keywords: ['أطفال', 'ألعاب', 'كتب', 'روايات', 'قرطاس', 'مدرس', 'حضان', 'فنون', 'لوحات', 'موسيق', 'أفلام'], emoji: '🧸', color: 'yellow' },
  { keywords: ['زراع', 'بذور', 'سماد', 'مزارع', 'مواشي', 'حيوان', 'طيور', 'سمك', 'تخييم', 'صيد', 'رحل', 'حشر'], emoji: '🌾', color: 'emerald' },
  { keywords: ['تنظيف', 'منظف', 'صابون', 'شامبو', 'معقم', 'نايلون', 'ورق', 'مغسل'], emoji: '🧹', color: 'slate' },
];

// ═══════════════════════════════════════════════════════════
// Category Group Sorting — 12 groups for logical ordering
// ═══════════════════════════════════════════════════════════
const CATEGORY_GROUPS: Record<number, Set<string>> = {
  1: new Set([
    'خضار وفواكه', 'لحوم طازجة', 'دواجن', 'أسماك طازجة', 'ألبان وأجبان',
    'معلبات', 'مشروبات', 'عصائر', 'شاي وقهوة', 'توابل وبهارات',
    'زيوت نباتية', 'معجنات', 'حلويات', 'شوكولا', 'مكسرات',
    'تمور', 'عسل', 'مربيات', 'منتجات عضوية', 'أغذية أطفال',
    'مواد غذائية', 'دواجن مجمدة', 'أعلاف حيوانية', 'حبوب', 'سكاكر',
  ]),
  2: new Set([
    'أجهزة طبية', 'أدوية', 'نظارات', 'عناية بالبشرة', 'مكياج',
    'عطور', 'شعر وأدوات تجميل', 'صابون', 'شامبو', 'معقمات',
    'منظفات منزلية', 'أدوات تنظيف', 'حفاضات', 'صالونات حلاقة',
    'صالونات تجميل', 'مغاسل', 'تنظيف جاف', 'عيادات', 'مستشفيات',
  ]),
  3: new Set([
    'إلكترونيات', 'موبايلات', 'لابتوبات', 'أجهزة منزلية', 'أجهزة مطبخ',
    'ثلاجات', 'غسالات', 'مكيفات', 'تلفزيونات', 'رسيفرات',
    'سماعات', 'سماعات أذن', 'مكبرات صوت', 'بروجيكتور', 'كاميرات مراقبة',
    'أنظمة إنذار', 'أجهزة GPS', 'أجهزة ألعاب', 'ألعاب فيديو',
    'أجهزة شبكات', 'راوترات', 'سيرفرات', 'برمجيات', 'تصميم جرافيك',
    'تسويق إلكتروني', 'برمجة مواقع', 'تطبيقات جوال', 'شبكات واي فاي',
    'بيع وصيانة كمبيوتر', 'صيانة جوالات', 'اشتراكات IPTV', 'إنترنت',
  ]),
  4: new Set([
    'ملابس رجالية', 'ملابس نسائية', 'ملابس أطفال', 'أحذية', 'حقائب',
    'إكسسوارات', 'ساعات', 'ذهب ومجوهرات', 'أقمشة', 'خياطة', 'نظارات شمسية',
  ]),
  5: new Set([
    'أثاث منزلي', 'أثاث مكتبي', 'أثاث حدائق', 'سجاد', 'موكيت',
    'ستائر', 'مفارش', 'أطقم حمام', 'أدوات مطبخ', 'أواني',
    'سكاكين', 'ديكور', 'تصميم داخلي', 'جبس بورد', 'دهانات ديكورية',
    'أرضيات', 'بلاط', 'سيراميك', 'رخام', 'غرانيت', 'زجاج ومرايا',
    'ألمنيوم', 'PVC', 'أبواب', 'شبابيك', 'مطابخ', 'خزائن',
    'رفوف', 'كراسي بلاستيك', 'نوافير', 'مدافئ', 'مدافئ حطب',
    'سخانات', 'مراوح', 'دفايات', 'غسالات صحون', 'ميكروويف',
    'أفران', 'خلاطات',
  ]),
  6: new Set([
    'سيارات', 'قطع سيارات', 'إطارات', 'زيوت محركات', 'دهانات سيارات',
    'كهرباء سيارات', 'زجاج سيارات', 'إلكترونيات سيارات', 'مسجلات',
    'ورشة سيارات', 'ميكانيك', 'سمكرة ودهان', 'بنشر', 'غيارات زيوت',
    'مفاتيح وكوالين', 'دراجات هوائية', 'تأجير سيارات', 'شحن',
    'خدمات توصيل', 'نقل أثاث', 'عمال تحميل',
  ]),
  7: new Set([
    'عقارات', 'أراضي', 'شقق', 'مكاتب', 'محلات تجارية', 'مستودعات',
    'بناء وتشييد', 'مقاولات', 'تصميم معماري', 'إسمنت', 'حديد',
    'خشب', 'مواد بناء', 'مواد عزل', 'كهرباء بناء', 'سباكة',
    'تكييف مركزي', 'مصاعد', 'أجهزة إنذار حريق', 'دهانات',
    'أدوات كهربائية', 'أسلاك وكابلات', 'مصابيح وإنارة', 'طاقة شمسية',
    'بطاريات',
  ]),
  8: new Set([
    'محاماة', 'محاسبة', 'هندسة', 'استشارات', 'خدمات استشارية',
    'كتابة محتوى', 'ترجمة', 'إدارة صفحات', 'دعاية وإعلان', 'خدمات مالية',
    'صرافة', 'تأمين', 'عقود صيانة', 'تنظيف منازل', 'مكافحة حشرات',
    'خدمات حدائق', 'صيانة منازل', 'تركيب وصيانة تكييف', 'تركيب ستلايت',
    'كهربائي', 'سمكري', 'دهين', 'معلم بناء', 'نجارين', 'حدادين',
    'ألمنيوم وستائر',
  ]),
  9: new Set([
    'دروس خصوصية', 'دورات تدريبية', 'كتب', 'روايات', 'قصص أطفال',
    'أدوات مدرسية', 'قرطاسية', 'تعليم قيادة', 'دور حضانة', 'روضة أطفال',
  ]),
  10: new Set([
    'معدات رياضية', 'نوادي رياضية', 'أدوات صيد', 'أدوات بحرية',
    'رحلات بحرية', 'أدوات رحلات', 'خيم', 'أكياس نوم', 'معدات تخييم',
    'شواء وفحم', 'ألعاب أطفال', 'أفلام', 'موسيقى', 'آلات موسيقية',
    'فنون تشكيلية', 'لوحات فنية', 'تحف', 'أنتيكات',
  ]),
  11: new Set([
    'أسمدة ومبيدات', 'بذور زراعية', 'أدوات زراعية', 'مواشي', 'طيور زينة',
    'أسماك زينة', 'حيوانات أليفة', 'مظلات', 'نوافير حدائق',
  ]),
};

function getCategoryGroup(categoryName: string): number {
  for (const [group, names] of Object.entries(CATEGORY_GROUPS)) {
    if (names.has(categoryName)) return Number(group);
  }
  return 12; // أخرى — everything else
}

function getCategoryMeta(name: string): { emoji: string; color: string } {
  const exact = CATEGORY_META[name];
  if (exact) return exact;

  for (const entry of KEYWORD_FALLBACK) {
    for (const keyword of entry.keywords) {
      if (name.includes(keyword)) {
        return { emoji: entry.emoji, color: entry.color };
      }
    }
  }

  return { emoji: '🏷️', color: 'gray' };
}

// ═══════════════════════════════════════════════════════════
// Category Item
// ═══════════════════════════════════════════════════════════
interface CategoryItem {
  name: string;
  emoji: string;
  color: string;
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════
export const CategoryGrid: React.FC<CategoryGridProps> = memo(({ onCategoryClick }) => {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(json => {
        const apiData = json?.data ?? json;
        const cats: CategoryItem[] = (apiData?.categories || []).map((c: { id: number; name: string }) => {
          const { emoji, color } = getCategoryMeta(c.name);
          return { name: c.name, emoji, color };
        });
        // Sort by group priority, then alphabetically within each group
        const sorted = cats.sort((a, b) => {
          const groupA = getCategoryGroup(a.name);
          const groupB = getCategoryGroup(b.name);
          if (groupA !== groupB) return groupA - groupB;
          return a.name.localeCompare(b.name, 'ar');
        });
        setCategories(sorted);
      })
      .catch(err => {
        console.error('خطأ في جلب الفئات:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleClick = useCallback((catName: string) => {
    onCategoryClick(catName);
  }, [onCategoryClick]);

  const VISIBLE_COUNT = 12;
  const displayedCategories = showAll ? categories : categories.slice(0, VISIBLE_COUNT);

  if (loading) {
    return (
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            <div className="h-3 w-12 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (categories.length === 0) return null;

  return (
    <div>
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-y-5 gap-x-3">
        {displayedCategories.map((cat) => {
          const palette = COLOR_PALETTE[cat.color] ?? COLOR_PALETTE.gray;
          return (
            <button
              key={cat.name}
              onClick={() => handleClick(cat.name)}
              className="flex flex-col items-center gap-2 cursor-pointer group flex-shrink-0 w-full"
              aria-label={cat.name}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center
                  ${palette.iconBg} ${palette.border} border
                  group-hover:scale-105 group-hover:shadow-md transition-all duration-200`}
              >
                <span className="text-2xl">{cat.emoji}</span>
              </div>
              <p className="text-[11px] font-medium text-center leading-tight text-gray-700 dark:text-gray-300 line-clamp-1 mt-1.5">
                {cat.name}
              </p>
            </button>
          );
        })}
      </div>

      {categories.length > VISIBLE_COUNT && (
        <div className="flex justify-center mt-3">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs font-bold text-emerald-500 hover:text-emerald-600
              bg-emerald-50 dark:bg-emerald-900/20 px-5 py-2.5 rounded-full
              hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
          >
            {showAll ? 'عرض أقل' : `عرض الكل (${categories.length})`}
          </button>
        </div>
      )}
    </div>
  );
});

CategoryGrid.displayName = 'CategoryGrid';

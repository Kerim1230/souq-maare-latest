'use client';
import { useMemo } from 'react';
import { useStoreColorStore, type StoreGradientColor } from '@/store/storeColorStore';
import { useAppStore } from '@/store/appStore';

/**
 * Reusable hook to access a store's theme color and computed style helpers.
 * Works with any store — pass a storeId to look up a specific store,
 * or call with no arguments to use the authenticated user's own store (myStore).
 *
 * When `themeColorId` is provided, it is used directly to look up the color,
 * bypassing the store object entirely. This lets visitors pass the viewed
 * store's `theme_color` field directly without needing the full store in memory.
 */
export function useStoreTheme(storeId?: string, themeColorId?: string | null) {
  const getStoreColorById = useStoreColorStore(s => s.getStoreColorById);
  const myStore = useAppStore(s => s.myStore);

  // Find the right store object
  const store = useMemo(() => {
    if (storeId && myStore && myStore.id === storeId) return myStore;
    return myStore; // For now, we only have myStore in memory. External stores pass theme_color directly.
  }, [storeId, myStore]);

  const color: StoreGradientColor | null = useMemo(() => {
    // If an explicit themeColorId is given, use it directly (visitor viewing another store)
    if (themeColorId) return getStoreColorById(themeColorId) || null;
    // Otherwise fall back to the store object's theme_color
    const colorId = store?.theme_color;
    if (!colorId) return null;
    return getStoreColorById(colorId) || null;
  }, [themeColorId, store?.theme_color, getStoreColorById]);

  const hasTheme = !!color;

  // ===== Computed CSS Values =====
  const themeBg = color ? `linear-gradient(135deg, ${color.from}, ${color.to})` : undefined;
  const themeBgLight = color ? `linear-gradient(135deg, ${color.lightFrom}, ${color.lightTo})` : undefined;
  const themeShadow = color ? `0 4px 14px ${color.shadow}` : undefined;
  const themeShadowSm = color ? `0 2px 8px ${color.shadowLight}` : undefined;
  const themeSolid = color?.solid;
  const themeSolidLight = color?.solidLight;


  // ===== Ready-to-use style objects =====
  const gradientStyle: React.CSSProperties | undefined = color
    ? { background: themeBg, boxShadow: themeShadow }
    : undefined;

  const gradientStyleSm: React.CSSProperties | undefined = color
    ? { background: themeBg, boxShadow: themeShadowSm }
    : undefined;

  const iconBgStyle: React.CSSProperties | undefined = color
    ? { background: color.solidLight + '18', color: color.solid }
    : undefined;

  const badgeStyle: React.CSSProperties | undefined = color
    ? { background: color.solidLight + '18', color: color.solid }
    : undefined;

  return {
    color,
    hasTheme,
    // Raw CSS values
    themeBg,
    themeBgLight,
    themeShadow,
    themeShadowSm,
    themeSolid,
    themeSolidLight,
    // Ready-to-use style objects
    gradientStyle,
    gradientStyleSm,
    iconBgStyle,
    badgeStyle,
  };
}

/**
 * ⚡ Hydration Coordinator Layer
 *
 * Module-level guard that ensures each global entity is loaded exactly once
 * per user session. Unlike Zustand flags, this survives HMR and prevents
 * duplicate initialization from race conditions.
 *
 * Usage:
 *   if (!isHydrated('favorites')) {
 *     await appStore.fetchFavorites(userId);
 *     markHydrated('favorites');
 *   }
 */

export type HydrationKey =
  | 'favorites'
  | 'wallet'
  | 'notifications'
  | 'followedStores'
  | 'chat';

const hydrationState: Record<HydrationKey, boolean> = {
  favorites: false,
  wallet: false,
  notifications: false,
  followedStores: false,
  chat: false,
};

export function isHydrated(key: HydrationKey): boolean {
  return hydrationState[key];
}

export function markHydrated(key: HydrationKey): void {
  hydrationState[key] = true;
}

/**
 * Reset all hydration flags — called on logout to allow
 * fresh initialization for the next user session.
 */
export function resetHydration(): void {
  (Object.keys(hydrationState) as HydrationKey[]).forEach((k) => {
    hydrationState[k] = false;
  });
}

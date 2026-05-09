/**
 * Global type declarations for window-level debug utilities.
 * These are used by scroll-lock and overlay debug components.
 */
export {};

declare global {
  interface Window {
    /** Overlay debug flag — set to true to enable the OverlayDebugMonitor */
    __overlayDebug?: boolean;
    /** Returns current scroll-lock debug state (lock count, owners, overlays) */
    __scrollLockState?: () => Record<string, unknown>;
    /** Force-unlocks all scroll locks (emergency reset) */
    __forceUnlockScroll?: () => void;
  }
}

/**
 * ⚡ Reference-counted scroll lock utility.
 * Prevents double-scroll-lock conflicts when multiple modals/sheets are open.
 * Only restores body scroll when ALL consumers release their lock.
 *
 * v2: Removed the problematic force-unlock timer that reset on every lock().
 * Instead, uses a simple periodic health-check that logs warnings but never
 * interferes with normal lock/unlock flow.
 *
 * Debug: window.__scrollLockState() shows lock count + all fixed overlays in DOM
 */

let _lockCount = 0;
let _originalOverflow = '';
const _lockOwners = new Set<string>();

/**
 * Lock scroll. Pass an optional owner name for debugging.
 * Uses Set to prevent duplicate locks from the same owner.
 */
export function lockScroll(owner: string = 'unknown'): void {
  const key = owner;
  if (_lockOwners.has(key)) return; // Already locked by this owner

  if (_lockCount === 0) {
    _originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  _lockCount++;
  _lockOwners.add(key);
}

/**
 * Unlock scroll. Pass the same owner name used for lockScroll.
 * Only decrements if this owner actually holds a lock.
 */
export function unlockScroll(owner: string = 'unknown'): void {
  const key = owner;
  if (!_lockOwners.has(key)) return; // Not locked by this owner

  _lockOwners.delete(key);
  _lockCount = Math.max(0, _lockCount - 1);

  if (_lockCount === 0) {
    document.body.style.overflow = _originalOverflow;
  }
}


export function getScrollLockCount(): number {
  return _lockCount;
}

/**
 * Emergency force-reset scroll lock.
 */
export function forceResetScrollLock(): void {
  console.warn(`[scroll-lock] 🔴 FORCE RESET — count was ${_lockCount}, owners:`, [..._lockOwners]);
  _lockCount = 0;
  _lockOwners.clear();
  document.body.style.overflow = '';
  // Also reset pointer events
  _pointerRefCount = 0;
  _pointerOwners.clear();
  document.body.style.pointerEvents = '';
}

// ===== Pointer-events safety (ref-counted, mirrors scroll-lock pattern) =====

let _pointerEventsOriginal = '';
let _pointerRefCount = 0;
const _pointerOwners = new Set<string>();

/**
 * Block pointer events on body (safety net for overlay systems).
 * Ref-counted: only restores when ALL consumers release.
 * Should be called alongside lockScroll when opening an overlay.
 */
export function blockPointerEvents(owner: string = 'unknown'): void {
  if (_pointerOwners.has(owner)) return; // Already blocked by this owner

  if (_pointerRefCount === 0) {
    _pointerEventsOriginal = document.body.style.pointerEvents || '';
    document.body.style.pointerEvents = 'none';
  }
  _pointerRefCount++;
  _pointerOwners.add(owner);
}

/**
 * Restore pointer events on body.
 * Only decrements if this owner actually holds a lock.
 * Should be called alongside unlockScroll when closing an overlay.
 */
export function restorePointerEvents(owner: string = 'unknown'): void {
  if (!_pointerOwners.has(owner)) return; // Not blocked by this owner

  _pointerOwners.delete(owner);
  _pointerRefCount = Math.max(0, _pointerRefCount - 1);

  if (_pointerRefCount === 0) {
    document.body.style.pointerEvents = _pointerEventsOriginal || '';
  }
}

// ===== Debug helpers — exposed on window =====

function getDebugState() {
  const overlays = document.querySelectorAll(
    'div[class*="fixed"][class*="inset-0"], div[style*="position: fixed"][style*="inset"]'
  );
  const overlayList = Array.from(overlays).map((el) => {
    const style = getComputedStyle(el);
    return {
      tag: el.tagName,
      class: (el.className as string).substring(0, 120),
      zIndex: style.zIndex,
      display: style.display,
      opacity: style.opacity,
      pointerEvents: style.pointerEvents,
      visibility: style.visibility,
      rect: el.getBoundingClientRect(),
    };
  });

  // Find potentially blocking overlays: fixed, covers viewport, has pointer-events: auto, opacity < 1 or hidden
  const blocking = overlayList.filter(o => {
    if (o.pointerEvents === 'none') return false;
    if (o.display === 'none') return false;
    if (o.visibility === 'hidden') return false;
    const r = o.rect;
    if (r.width < window.innerWidth * 0.8 || r.height < window.innerHeight * 0.8) return false;
    return true;
  });

  return {
    scrollLockCount: _lockCount,
    scrollLockOwners: [..._lockOwners],
    bodyOverflow: document.body.style.overflow,
    bodyPointerEvents: document.body.style.pointerEvents,
    pointerEventsLocked: _pointerRefCount > 0,
    pointerEventOwners: [..._pointerOwners],
    overlayCount: overlays.length,
    blockingOverlays: blocking,
    allOverlays: overlayList,
  };
}

// Expose debug function on window (client-side only)
if (typeof window !== 'undefined') {
  window.__scrollLockState = getDebugState;
  window.__forceUnlockScroll = forceResetScrollLock;

  // Periodic health check — only logs warnings, never modifies state
  if (typeof setInterval !== 'undefined') {
    setInterval(() => {
      if (_lockCount > 2) {
        console.warn(
          `[scroll-lock] ⚠️ Unusually high lock count: ${_lockCount}`,
          'Owners:', [..._lockOwners]
        );
      }
    }, 5000);
  }
}

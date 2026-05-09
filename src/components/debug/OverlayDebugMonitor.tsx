'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getScrollLockCount, forceResetScrollLock } from '@/lib/scroll-lock';

/**
 * Overlay Debug Monitor
 * 
 * Runtime component that:
 * 1. Counts overlays (fixed + inset-0) in the DOM every 500ms
 * 2. Detects invisible overlays blocking pointer events
 * 3. Shows scroll-lock state
 * 4. Provides a one-click "Fix" button to force-unlock
 * 
 * Access via: window.__overlayDebug = true (before component mount)
 * Or toggle with: triple-tap on the debug indicator
 */

interface OverlayInfo {
  tag: string;
  class: string;
  zIndex: string;
  display: string;
  opacity: string;
  pointerEvents: string;
  visibility: string;
  width: number;
  height: number;
}

interface DebugState {
  overlayCount: number;
  blockingCount: number;
  blockingOverlays: OverlayInfo[];
  scrollLockCount: number;
  bodyOverflow: string;
  bodyPointerEvents: string;
  fps: number;
  tickAlive: boolean;
}

function scanOverlays(): { overlays: OverlayInfo[]; blocking: OverlayInfo[] } {
  const elements = document.querySelectorAll(
    'div[class*="fixed"][class*="inset-0"], div[style*="position: fixed"][style*="inset"]'
  );

  const overlays: OverlayInfo[] = Array.from(elements).map((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      class: (el.className as string).substring(0, 150),
      zIndex: style.zIndex,
      display: style.display,
      opacity: style.opacity,
      pointerEvents: style.pointerEvents,
      visibility: style.visibility,
      width: rect.width,
      height: rect.height,
    };
  });

  // Find blocking overlays: covers >70% of viewport, pointer-events: auto, visible
  const blocking = overlays.filter(o => {
    if (o.pointerEvents === 'none') return false;
    if (o.display === 'none') return false;
    if (o.visibility === 'hidden') return false;
    if (o.width < window.innerWidth * 0.7 && o.height < window.innerHeight * 0.7) return false;
    return true;
  });

  return { overlays, blocking };
}

export const OverlayDebugMonitor: React.FC = () => {
  const [state, setState] = useState<DebugState>({
    overlayCount: 0,
    blockingCount: 0,
    blockingOverlays: [],
    scrollLockCount: 0,
    bodyOverflow: '',
    bodyPointerEvents: '',
    fps: 0,
    tickAlive: true,
  });
  const [visible, setVisible] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const tickAliveRef = useRef(true);

  useEffect(() => {
    const isDebugEnabled = window.__overlayDebug === true;
    if (!isDebugEnabled) return;

    // FPS counter
    let rafId: number;
    const measureFps = () => {
      frameCountRef.current++;
      const now = performance.now();
      if (now - lastFpsTimeRef.current >= 1000) {
        const fps = Math.round(frameCountRef.current * 1000 / (now - lastFpsTimeRef.current));
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
        setState(prev => ({ ...prev, fps }));
      }
      rafId = requestAnimationFrame(measureFps);
    };
    rafId = requestAnimationFrame(measureFps);

    // Main thread alive check
    const tickInterval = setInterval(() => {
      tickAliveRef.current = true;
    }, 1000);

    // Scan overlays every 500ms
    const scanInterval = setInterval(() => {
      const { overlays, blocking } = scanOverlays();
      const bodyStyle = document.body.style;

      setState(prev => ({
        ...prev,
        overlayCount: overlays.length,
        blockingCount: blocking.length,
        blockingOverlays: blocking,
        scrollLockCount: getScrollLockCount(),
        bodyOverflow: bodyStyle.overflow,
        bodyPointerEvents: bodyStyle.pointerEvents,
        tickAlive: tickAliveRef.current,
      }));

      setTimeout(() => { tickAliveRef.current = false; }, 100);
    }, 500);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(tickInterval);
      clearInterval(scanInterval);
    };
  }, []);

  // Triple-tap to toggle visibility
  const handleTap = useCallback(() => {
    tapCountRef.current++;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, 500);
    if (tapCountRef.current >= 3) {
      setVisible(v => !v);
      tapCountRef.current = 0;
    }
  }, []);

  const handleFix = useCallback(() => {
    forceResetScrollLock();
    document.body.style.pointerEvents = '';
    document.body.style.overflow = '';
  }, []);

  // Don't render if debug not enabled
  if (typeof window === 'undefined' || !window.__overlayDebug) return null;

  const isFrozen = !state.tickAlive;
  const hasBlocking = state.blockingCount > 0;
  const hasStaleLock = state.scrollLockCount > 0 && state.overlayCount === 0;

  return (
    <>
      {/* Debug indicator — small dot */}
      <div
        onClick={handleTap}
        className="fixed bottom-16 left-2 z-[9999] w-3 h-3 rounded-full cursor-pointer transition-colors"
        style={{
          backgroundColor: isFrozen ? '#ef4444' : hasBlocking ? '#f59e0b' : hasStaleLock ? '#8b5cf6' : '#22c55e',
          boxShadow: '0 0 4px rgba(0,0,0,0.3)',
        }}
        title="Triple-tap to toggle debug panel"
      />

      {/* Debug panel */}
      {visible && (
        <div
          className="fixed bottom-20 left-2 right-2 z-[9999] bg-black/90 text-white rounded-xl p-3 text-[10px] font-mono max-h-[60vh] overflow-y-auto"
          style={{ pointerEvents: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-emerald-400">🔍 Overlay Debug</span>
            <div className="flex gap-2">
              <button onClick={handleFix} className="px-2 py-0.5 bg-rose-600 rounded text-[9px] font-bold hover:bg-rose-500">
                🔧 Fix
              </button>
              <button onClick={() => setVisible(false)} className="px-2 py-0.5 bg-slate-600 rounded text-[9px] font-bold hover:bg-slate-500">
                ✕
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 mb-2">
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${state.tickAlive ? 'bg-green-400' : 'bg-red-400'}`} />
              <span>Thread: {state.tickAlive ? 'alive' : 'FROZEN'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${state.fps > 30 ? 'bg-green-400' : state.fps > 15 ? 'bg-yellow-400' : 'bg-red-400'}`} />
              <span>FPS: {state.fps}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${state.scrollLockCount === 0 ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span>Scroll Lock: {state.scrollLockCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${state.overlayCount === 0 ? 'bg-green-400' : 'bg-blue-400'}`} />
              <span>Overlays: {state.overlayCount}</span>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded p-1.5 mb-2">
            <span className="text-slate-400">body.overflow: </span>
            <span className={state.bodyOverflow === 'hidden' ? 'text-rose-400' : 'text-green-400'}>{state.bodyOverflow || '(empty)'}</span>
            <span className="text-slate-400 ml-2">body.pointerEvents: </span>
            <span className={state.bodyPointerEvents === 'none' ? 'text-rose-400' : 'text-green-400'}>{state.bodyPointerEvents || '(empty)'}</span>
          </div>

          {hasBlocking && (
            <div className="mb-2">
              <div className="text-[10px] font-bold text-rose-400 mb-1">⚠️ Blocking ({state.blockingCount}):</div>
              {state.blockingOverlays.map((o, i) => (
                <div key={i} className="bg-rose-900/30 rounded p-1 mb-1 text-[9px]">
                  <div>z:{o.zIndex} opacity:{o.opacity} pe:{o.pointerEvents}</div>
                  <div className="text-slate-400 truncate">{o.class}</div>
                </div>
              ))}
            </div>
          )}

          {hasStaleLock && (
            <div className="bg-amber-900/30 rounded p-1.5 text-amber-400 text-[10px]">
              ⚠️ Stale lock (count={state.scrollLockCount}) with 0 overlays. Click Fix.
            </div>
          )}

          {isFrozen && (
            <div className="bg-rose-900/30 rounded p-1.5 text-rose-400 text-[10px] font-bold">
              🔴 MAIN THREAD FROZEN!
            </div>
          )}
        </div>
      )}
    </>
  );
};

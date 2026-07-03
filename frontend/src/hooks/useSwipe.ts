import { useEffect, useRef } from 'react';

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** CSS selector; gestures that start inside a matching ancestor are ignored. */
  exclude?: string;
}

/** Minimum horizontal displacement (px) to count as a swipe. */
const HORIZONTAL_THRESHOLD = 60;
/** Maximum vertical drift (px) before the gesture is treated as a scroll. */
const VERTICAL_TOLERANCE = 40;

/**
 * Dependency-free horizontal swipe detection via touchstart/touchend deltas.
 *
 * Listens on `document` while the calling component is mounted, so the whole
 * screen is the swipe target regardless of how far down any container
 * stretches (page content usually stops short of the viewport bottom, but
 * swipes there should still work). Use `exclude` to opt regions out, e.g. a
 * top navbar.
 *
 * Deliberately does NOT listen to touchmove or call preventDefault, so
 * native vertical scrolling stays intact. Multi-touch gestures are ignored.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, exclude }: UseSwipeOptions): void {
  // Track the latest callbacks without re-binding the document listeners.
  const callbacks = useRef({ onSwipeLeft, onSwipeRight });
  callbacks.current = { onSwipeLeft, onSwipeRight };

  useEffect(() => {
    let start: { x: number; y: number } | null = null;

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) {
        // Multi-touch (pinch/zoom) — not a swipe.
        start = null;
        return;
      }
      if (exclude && e.target instanceof Element && e.target.closest(exclude)) {
        start = null;
        return;
      }
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    function onTouchEnd(e: TouchEvent) {
      const origin = start;
      start = null;
      if (!origin) return;
      // Fingers still on screen → multi-touch gesture, ignore.
      if (e.touches.length > 0) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;
      if (Math.abs(dx) <= HORIZONTAL_THRESHOLD || Math.abs(dy) >= VERTICAL_TOLERANCE) return;
      if (dx < 0) callbacks.current.onSwipeLeft?.();
      else callbacks.current.onSwipeRight?.();
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [exclude]);
}

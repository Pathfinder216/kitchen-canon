import { useRef } from 'react';
import type { TouchEvent } from 'react';

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

/** Minimum horizontal displacement (px) to count as a swipe. */
const HORIZONTAL_THRESHOLD = 60;
/** Maximum vertical drift (px) before the gesture is treated as a scroll. */
const VERTICAL_TOLERANCE = 40;

/**
 * Dependency-free horizontal swipe detection via touchstart/touchend deltas.
 * Spread the returned handlers onto the swipeable container.
 *
 * Deliberately does NOT listen to touchmove or call preventDefault, so
 * native vertical scrolling stays intact. Multi-touch gestures are ignored.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight }: UseSwipeOptions): {
  onTouchStart: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
} {
  const start = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) {
      // Multi-touch (pinch/zoom) — not a swipe.
      start.current = null;
      return;
    }
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function onTouchEnd(e: TouchEvent) {
    const origin = start.current;
    start.current = null;
    if (!origin) return;
    // Fingers still on screen → multi-touch gesture, ignore.
    if (e.touches.length > 0) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;
    if (Math.abs(dx) <= HORIZONTAL_THRESHOLD || Math.abs(dy) >= VERTICAL_TOLERANCE) return;
    if (dx < 0) onSwipeLeft?.();
    else onSwipeRight?.();
  }

  return { onTouchStart, onTouchEnd };
}

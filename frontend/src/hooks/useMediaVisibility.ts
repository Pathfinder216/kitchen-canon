import { useCallback, useSyncExternalStore } from 'react';

/**
 * Device-local media visibility preference (spec §2: "Toggle media on/off to
 * avoid screen clutter when not needed").
 *
 * Persisted in localStorage under `ltc:showMedia` ('true'/'false', default true).
 * Deliberately NOT a server-side UserPreference — cook mode on a phone and
 * editing on a desktop legitimately differ per device.
 *
 * Backed by a module-level subscriber set + useSyncExternalStore so every
 * mounted consumer (toggle buttons, media components) updates together.
 */

const STORAGE_KEY = 'ltc:showMedia';

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    // localStorage unavailable (privacy mode etc.) — default to visible.
    return true;
  }
}

function setShowMedia(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Persistence failed; still notify so the in-memory snapshot readers re-run.
  }
  for (const listener of listeners) listener();
}

export function useMediaVisibility(): { showMedia: boolean; toggle: () => void } {
  const showMedia = useSyncExternalStore(subscribe, getSnapshot);
  const toggle = useCallback(() => setShowMedia(!getSnapshot()), []);
  return { showMedia, toggle };
}

import { useEffect, useState } from 'react';

/**
 * Keeps the screen awake while the calling component is mounted.
 *
 * The Screen Wake Lock API requires a secure context (HTTPS or localhost);
 * on a plain-HTTP connection `navigator.wakeLock` is undefined or `request`
 * rejects. In that case the hook reports `supported: false` instead of
 * throwing, so callers can show a notice.
 *
 * The browser auto-releases the lock when the tab is hidden, so the hook
 * re-acquires it on `visibilitychange` → visible, and releases on unmount.
 */
export function useWakeLock(): { supported: boolean } {
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      if (!navigator.wakeLock) {
        setSupported(false);
        return;
      }
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        setSupported(true);
      } catch {
        // Insecure context, permission denied, or battery saver.
        setSupported(false);
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void acquire();
    }

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, []);

  return { supported };
}

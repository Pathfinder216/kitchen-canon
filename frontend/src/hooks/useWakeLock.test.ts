import { renderHook, waitFor } from '@testing-library/react';
import { useWakeLock } from './useWakeLock';

function mockWakeLock() {
  const release = vi.fn().mockResolvedValue(undefined);
  const sentinel = { release };
  const request = vi.fn().mockResolvedValue(sentinel);
  Object.defineProperty(navigator, 'wakeLock', {
    value: { request },
    configurable: true,
  });
  return { request, release };
}

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  });
}

describe('useWakeLock', () => {
  afterEach(() => {
    // jsdom has no wakeLock by default — remove whatever a test defined.
    delete (navigator as { wakeLock?: unknown }).wakeLock;
    setVisibilityState('visible');
  });

  it('requests a screen wake lock on mount and reports supported', async () => {
    const { request } = mockWakeLock();
    const { result } = renderHook(() => useWakeLock());
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
    expect(request).toHaveBeenCalledTimes(1);
    expect(result.current.supported).toBe(true);
  });

  it('re-requests the lock when the page becomes visible again', async () => {
    const { request } = mockWakeLock();
    renderHook(() => useWakeLock());
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it('does not re-request while the page is hidden', async () => {
    const { request } = mockWakeLock();
    renderHook(() => useWakeLock());
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    setVisibilityState('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('releases the lock on unmount', async () => {
    const { request, release } = mockWakeLock();
    const { unmount } = renderHook(() => useWakeLock());
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    unmount();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('reports unsupported when navigator.wakeLock is absent', async () => {
    const { result } = renderHook(() => useWakeLock());
    await waitFor(() => expect(result.current.supported).toBe(false));
  });

  it('reports unsupported when the request rejects (insecure context)', async () => {
    const request = vi.fn().mockRejectedValue(new DOMException('NotAllowedError'));
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request },
      configurable: true,
    });
    const { result } = renderHook(() => useWakeLock());
    await waitFor(() => expect(result.current.supported).toBe(false));
  });
});

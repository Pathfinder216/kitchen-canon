import { renderHook, act } from '@testing-library/react';
import { useMediaVisibility } from './useMediaVisibility';

const STORAGE_KEY = 'ltc:showMedia';

describe('useMediaVisibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to visible when nothing is stored', () => {
    const { result } = renderHook(() => useMediaVisibility());
    expect(result.current.showMedia).toBe(true);
  });

  it('reads an existing stored preference', () => {
    localStorage.setItem(STORAGE_KEY, 'false');
    const { result } = renderHook(() => useMediaVisibility());
    expect(result.current.showMedia).toBe(false);
  });

  it('toggle flips the value and writes it to localStorage', () => {
    const { result } = renderHook(() => useMediaVisibility());

    act(() => result.current.toggle());
    expect(result.current.showMedia).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');

    act(() => result.current.toggle());
    expect(result.current.showMedia).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('persists across unmount and re-mount', () => {
    const first = renderHook(() => useMediaVisibility());
    act(() => first.result.current.toggle());
    expect(first.result.current.showMedia).toBe(false);
    first.unmount();

    const second = renderHook(() => useMediaVisibility());
    expect(second.result.current.showMedia).toBe(false);
  });

  it('keeps all mounted consumers in sync', () => {
    const a = renderHook(() => useMediaVisibility());
    const b = renderHook(() => useMediaVisibility());

    act(() => a.result.current.toggle());

    expect(a.result.current.showMedia).toBe(false);
    expect(b.result.current.showMedia).toBe(false);
  });
});

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatTime, getRemaining, useStepTimers } from './useStepTimers';
import type { Step } from '../types/recipe';

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    id: 's1',
    recipeId: 'r1',
    orderIndex: 0,
    instruction: 'Let it rest',
    timeMinutes: 1,
    isActiveTime: false,
    ...overrides,
  };
}

describe('formatTime', () => {
  it('formats sub-minute durations in seconds', () => {
    expect(formatTime(0)).toBe('0s');
    expect(formatTime(45)).toBe('45s');
  });

  it('formats whole minutes', () => {
    expect(formatTime(120)).toBe('2m');
  });

  it('formats minutes and seconds', () => {
    expect(formatTime(90)).toBe('1m 30s');
  });
});

describe('useStepTimers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks down remaining seconds while running', () => {
    const { result } = renderHook(() => useStepTimers());

    act(() => {
      result.current.startTimer(0, makeStep({ timeMinutes: 1 })); // 60s
    });

    expect(getRemaining(result.current.timers[0])).toBe(60);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(getRemaining(result.current.timers[0])).toBe(50);
  });

  it('fires the onComplete callback when a timer reaches zero', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useStepTimers({ onComplete }));

    act(() => {
      result.current.startTimer(0, makeStep({ timeMinutes: 1 / 60 })); // 1s
    });

    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it('maintains independent timers on two steps', () => {
    const { result } = renderHook(() => useStepTimers());

    act(() => {
      result.current.startTimer(0, makeStep({ timeMinutes: 1 })); // 60s
    });
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    act(() => {
      result.current.startTimer(1, makeStep({ timeMinutes: 2 })); // 120s
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    const t0 = result.current.timers.find((t) => t.stepIndex === 0)!;
    const t1 = result.current.timers.find((t) => t.stepIndex === 1)!;

    // t0 has run 30s of 60s, t1 has run 10s of 120s
    expect(getRemaining(t0)).toBe(30);
    expect(getRemaining(t1)).toBe(110);
  });

  it('pause stops the countdown and resume continues it', () => {
    const { result } = renderHook(() => useStepTimers());

    act(() => {
      result.current.startTimer(0, makeStep({ timeMinutes: 1 })); // 60s
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    act(() => {
      result.current.pauseTimer(0);
    });

    const pausedRemaining = getRemaining(result.current.timers[0]);
    expect(pausedRemaining).toBe(50);

    // Time passes while paused — remaining must not change
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(getRemaining(result.current.timers[0])).toBe(50);

    act(() => {
      result.current.resumeTimer(0);
    });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(getRemaining(result.current.timers[0])).toBe(45);
  });

  it('reset removes the timer', () => {
    const { result } = renderHook(() => useStepTimers());

    act(() => {
      result.current.startTimer(0, makeStep({ timeMinutes: 1 }));
    });
    expect(result.current.timers).toHaveLength(1);

    act(() => {
      result.current.resetTimer(0);
    });
    expect(result.current.timers).toHaveLength(0);
  });
});

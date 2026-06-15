import { useCallback, useEffect, useRef, useState } from 'react';
import type { Ingredient, Step } from '../types/recipe';
import { resolveIngredientRefsText } from '../utils/resolveIngredientRefs';

// ---------------------------------------------------------------------------
// Timer state
// ---------------------------------------------------------------------------
export interface TimerState {
  stepIndex: number;
  stepLabel: string;
  totalSeconds: number;
  /** Seconds elapsed before the most recent "start" */
  accumulatedSeconds: number;
  /** Date.now() when the timer is running; null when paused */
  startedAt: number | null;
}

export function getRemaining(t: TimerState): number {
  const elapsed =
    t.accumulatedSeconds +
    (t.startedAt !== null ? (Date.now() - t.startedAt) / 1000 : 0);
  return Math.max(0, t.totalSeconds - Math.floor(elapsed));
}

export function isRunning(t: TimerState): boolean {
  return t.startedAt !== null;
}

export function isDone(t: TimerState): boolean {
  return getRemaining(t) === 0;
}

function stepLabel(stepIndex: number, instruction: string): string {
  const truncated =
    instruction.length > 45 ? instruction.slice(0, 45) + '…' : instruction;
  return `Step ${stepIndex + 1}: ${truncated}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

// ---------------------------------------------------------------------------
// Timer sound (Web Audio API — three short beeps)
// ---------------------------------------------------------------------------
export function playTimerSound() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    [0, 0.28, 0.56].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.4, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.22);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.22);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    // Audio not available (e.g. in tests)
  }
}

// ---------------------------------------------------------------------------
// useStepTimers — timer state machine keyed by step index
// ---------------------------------------------------------------------------
export interface UseStepTimersOptions {
  /** Ingredients for resolving the step label text. */
  ingredients?: Ingredient[];
  /** Called when a running timer completes (fires repeatedly until reset). */
  onComplete?: () => void;
}

export interface UseStepTimers {
  timers: TimerState[];
  startTimer: (stepIndex: number, step: Step) => void;
  pauseTimer: (stepIndex: number) => void;
  resumeTimer: (stepIndex: number) => void;
  resetTimer: (stepIndex: number) => void;
  dismissTimer: (stepIndex: number) => void;
}

export function useStepTimers({ ingredients = [], onComplete }: UseStepTimersOptions = {}): UseStepTimers {
  const [timers, setTimers] = useState<TimerState[]>([]);
  // Tick state: forces re-render every second so countdowns update
  const [, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a ref to timers so the interval callback can read current state
  const timersRef = useRef<TimerState[]>(timers);
  timersRef.current = timers;
  // Track when each timer last fired its completion callback (stepIndex → timestamp)
  const lastPlayedRef = useRef<Map<number, number>>(new Map());
  // Keep a stable ref to the completion callback
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Run a shared interval only when at least one timer is actively running
  const hasRunning = timers.some(isRunning);

  useEffect(() => {
    if (hasRunning) {
      intervalRef.current = setInterval(() => {
        setTick((n) => n + 1);
        // Fire completion callback when a timer completes; repeat every 5 s until reset
        const now = Date.now();
        timersRef.current.forEach((t) => {
          if (isRunning(t) && getRemaining(t) === 0) {
            const lastPlayed = lastPlayedRef.current.get(t.stepIndex) ?? 0;
            if (now - lastPlayed >= 5000) {
              lastPlayedRef.current.set(t.stepIndex, now);
              onCompleteRef.current?.();
            }
          }
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasRunning]);

  // ── Timer actions ──────────────────────────────────────────────────────────
  const startTimer = useCallback((stepIndex: number, step: Step) => {
    const totalSeconds = (step.timeMinutes ?? 0) * 60;
    setTimers((prev) => {
      const existing = prev.find((t) => t.stepIndex === stepIndex);
      if (existing) {
        // Resume
        return prev.map((t) =>
          t.stepIndex === stepIndex ? { ...t, startedAt: Date.now() } : t,
        );
      }
      // New timer
      return [
        ...prev,
        {
          stepIndex,
          stepLabel: stepLabel(stepIndex, resolveIngredientRefsText(step.instruction, ingredients)),
          totalSeconds,
          accumulatedSeconds: 0,
          startedAt: Date.now(),
        },
      ];
    });
  }, [ingredients]);

  const pauseTimer = useCallback((stepIndex: number) => {
    setTimers((prev) =>
      prev.map((t) => {
        if (t.stepIndex !== stepIndex || t.startedAt === null) return t;
        const elapsed = (Date.now() - t.startedAt) / 1000;
        return {
          ...t,
          accumulatedSeconds: t.accumulatedSeconds + elapsed,
          startedAt: null,
        };
      }),
    );
  }, []);

  const resetTimer = useCallback((stepIndex: number) => {
    setTimers((prev) => prev.filter((t) => t.stepIndex !== stepIndex));
    lastPlayedRef.current.delete(stepIndex);
  }, []);

  const resumeTimer = useCallback((stepIndex: number) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.stepIndex === stepIndex ? { ...t, startedAt: Date.now() } : t,
      ),
    );
  }, []);

  return {
    timers,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    dismissTimer: resetTimer,
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRecipe } from '../hooks/useRecipes';
import type { Step } from '../types/recipe';

// ---------------------------------------------------------------------------
// Timer state
// ---------------------------------------------------------------------------
interface TimerState {
  stepIndex: number;
  stepLabel: string;
  totalSeconds: number;
  /** Seconds elapsed before the most recent "start" */
  accumulatedSeconds: number;
  /** Date.now() when the timer is running; null when paused */
  startedAt: number | null;
}

function getRemaining(t: TimerState): number {
  const elapsed =
    t.accumulatedSeconds +
    (t.startedAt !== null ? (Date.now() - t.startedAt) / 1000 : 0);
  return Math.max(0, t.totalSeconds - Math.floor(elapsed));
}

function isRunning(t: TimerState): boolean {
  return t.startedAt !== null;
}

function isDone(t: TimerState): boolean {
  return getRemaining(t) === 0;
}

function stepLabel(stepIndex: number, instruction: string): string {
  const truncated =
    instruction.length > 45 ? instruction.slice(0, 45) + '…' : instruction;
  return `Step ${stepIndex + 1}: ${truncated}`;
}

// ---------------------------------------------------------------------------
// Timer sound (Web Audio API — three short beeps)
// ---------------------------------------------------------------------------
function playTimerSound() {
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
// Helpers
// ---------------------------------------------------------------------------
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

// ---------------------------------------------------------------------------
// Step timer card (for current step — inline in the step card)
// ---------------------------------------------------------------------------
interface StepTimerCardProps {
  step: Step;
  stepIndex: number;
  timer: TimerState | undefined;
  onStart: (stepIndex: number, step: Step) => void;
  onPause: (stepIndex: number) => void;
  onReset: (stepIndex: number) => void;
}

function StepTimerCard({ step, stepIndex, timer, onStart, onPause, onReset }: StepTimerCardProps) {
  if (!step.timeMinutes) return null;

  const totalSeconds = (step.timeMinutes ?? 0) * 60;
  const remaining = timer ? getRemaining(timer) : totalSeconds;
  const running = timer ? isRunning(timer) : false;
  const done = timer ? isDone(timer) : false;
  const pct = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 0;

  return (
    <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-orange-700">Passive time</span>
        <span
          className={`text-2xl font-mono font-bold tabular-nums ${done ? 'text-green-600' : 'text-orange-700'}`}
        >
          {done ? '✓ Done' : formatTime(remaining)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-orange-100 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full transition-all ${done ? 'bg-green-500' : 'bg-orange-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex gap-2">
        {!running && !done && (
          <button
            onClick={() => onStart(stepIndex, step)}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-1.5 rounded-lg transition-colors"
          >
            {!timer || remaining === totalSeconds ? 'Start timer' : 'Resume'}
          </button>
        )}
        {running && !done && (
          <button
            onClick={() => onPause(stepIndex)}
            className="flex-1 border border-orange-400 text-orange-700 hover:bg-orange-100 text-sm font-medium py-1.5 rounded-lg transition-colors"
          >
            Pause
          </button>
        )}
        {timer && (running || remaining < totalSeconds) && (
          <button
            onClick={() => onReset(stepIndex)}
            className="border border-gray-300 text-gray-600 hover:bg-gray-100 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Running timers panel (other steps)
// ---------------------------------------------------------------------------
interface RunningTimersPanelProps {
  timers: TimerState[];
  currentStepIndex: number;
  onPause: (stepIndex: number) => void;
  onResume: (stepIndex: number) => void;
  onDismiss: (stepIndex: number) => void;
}

function RunningTimersPanel({
  timers,
  currentStepIndex,
  onPause,
  onResume,
  onDismiss,
}: RunningTimersPanelProps) {
  const others = timers.filter((t) => t.stepIndex !== currentStepIndex);
  if (others.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {others.map((t) => {
        const remaining = getRemaining(t);
        const running = isRunning(t);
        const done = isDone(t);

        return (
          <div
            key={t.stepIndex}
            className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm border ${
              done
                ? 'bg-green-50 border-green-200'
                : 'bg-orange-50 border-orange-200'
            }`}
          >
            <span className={`flex-1 font-medium truncate ${done ? 'text-green-700' : 'text-orange-800'}`}>
              {t.stepLabel}
            </span>
            <span
              className={`font-mono font-bold tabular-nums shrink-0 ${
                done ? 'text-green-600' : 'text-orange-700'
              }`}
            >
              {done ? '✓ Done' : formatTime(remaining)}
            </span>
            {!done && (
              running ? (
                <button
                  onClick={() => onPause(t.stepIndex)}
                  aria-label="Pause timer"
                  className="shrink-0 border border-orange-300 text-orange-700 hover:bg-orange-100 text-xs px-2 py-1 rounded-lg transition-colors"
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={() => onResume(t.stepIndex)}
                  aria-label="Resume timer"
                  className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-xs px-2 py-1 rounded-lg transition-colors"
                >
                  Resume
                </button>
              )
            )}
            <button
              onClick={() => onDismiss(t.stepIndex)}
              aria-label="Dismiss timer"
              className="shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cook mode page
// ---------------------------------------------------------------------------
export function CookModePage() {
  const { id } = useParams<{ id: string }>();
  const { data: recipe, isLoading, error } = useRecipe(id!);
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [timers, setTimers] = useState<TimerState[]>([]);
  // Tick state: forces re-render every second so countdowns update
  const [, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a ref to timers so the interval callback can read current state
  const timersRef = useRef<TimerState[]>(timers);
  timersRef.current = timers;
  // Track when each timer last played its completion sound (stepIndex → timestamp)
  const lastPlayedRef = useRef<Map<number, number>>(new Map());

  // Run a shared interval only when at least one timer is actively running
  const hasRunning = timers.some(isRunning);

  useEffect(() => {
    if (hasRunning) {
      intervalRef.current = setInterval(() => {
        setTick((n) => n + 1);
        // Play sound when a timer completes; repeat every 5 s until reset
        const now = Date.now();
        timersRef.current.forEach((t) => {
          if (isRunning(t) && getRemaining(t) === 0) {
            const lastPlayed = lastPlayedRef.current.get(t.stepIndex) ?? 0;
            if (now - lastPlayed >= 5000) {
              lastPlayedRef.current.set(t.stepIndex, now);
              playTimerSound();
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
          stepLabel: stepLabel(stepIndex, step.instruction),
          totalSeconds,
          accumulatedSeconds: 0,
          startedAt: Date.now(),
        },
      ];
    });
  }, []);

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

  const resumeTimerAction = useCallback((stepIndex: number) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.stepIndex === stepIndex ? { ...t, startedAt: Date.now() } : t,
      ),
    );
  }, []);

  const dismissTimer = resetTimer;

  function toggleIngredient(ingId: string) {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(ingId)) next.delete(ingId);
      else next.add(ingId);
      return next;
    });
  }

  if (isLoading) return <p className="text-gray-500">Loading recipe...</p>;
  if (error || !recipe) return <p className="text-red-600">Recipe not found.</p>;

  const steps = recipe.steps;
  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const currentTimer = timers.find((t) => t.stepIndex === currentStep);

  return (
    <>
      {/* Scrollable content — padded at bottom so fixed nav doesn't cover it */}
      <div className="max-w-2xl mx-auto pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to={`/recipes/${id}`} className="text-gray-500 hover:text-gray-800 text-sm">
            ← Back
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1 truncate">{recipe.title}</h1>
          <span className="text-sm text-gray-400 shrink-0">
            {steps.length > 0 ? `Step ${currentStep + 1} of ${steps.length}` : ''}
          </span>
        </div>

        {steps.length === 0 && (
          <p className="text-gray-500">This recipe has no steps.</p>
        )}

        {steps.length > 0 && (
          <div className="space-y-6">
            {/* Running timers from other steps */}
            <RunningTimersPanel
              timers={timers}
              currentStepIndex={currentStep}
              onPause={pauseTimer}
              onResume={resumeTimerAction}
              onDismiss={dismissTimer}
            />

            {/* Step card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-orange-500 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                  {currentStep + 1}
                </span>
                {step.timeMinutes && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {step.timeMinutes} min {step.isActiveTime ? '(active)' : '(passive)'}
                  </span>
                )}
              </div>
              <p className="text-gray-800 text-lg leading-relaxed">{step.instruction}</p>
              {!step.isActiveTime && (
                <StepTimerCard
                  step={step}
                  stepIndex={currentStep}
                  timer={currentTimer}
                  onStart={startTimer}
                  onPause={pauseTimer}
                  onReset={resetTimer}
                />
              )}
            </div>
          </div>
        )}

        {/* Ingredients checklist (collapsible) */}
        <details className="mt-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <summary className="px-5 py-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 select-none">
            Ingredients ({recipe.ingredients.length})
          </summary>
          <ul className="divide-y divide-gray-100 px-4 pb-2">
            {recipe.ingredients.map((ing) => (
              <li key={ing.id} className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id={`cook-ing-${ing.id}`}
                  checked={checkedIngredients.has(ing.id)}
                  onChange={() => toggleIngredient(ing.id)}
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                />
                <label
                  htmlFor={`cook-ing-${ing.id}`}
                  className={`text-sm cursor-pointer select-none ${checkedIngredients.has(ing.id) ? 'line-through text-gray-400' : 'text-gray-700'}`}
                >
                  {ing.amount !== null && (
                    <span className="font-medium">
                      {Number.isInteger(ing.amount) ? ing.amount : ing.amount?.toFixed(2).replace(/\.?0+$/, '')}{' '}
                      {ing.unit}{' '}
                    </span>
                  )}
                  {ing.name}
                  {ing.isOptional && <span className="text-gray-400 ml-1">(optional)</span>}
                </label>
              </li>
            ))}
          </ul>
        </details>
      </div>

      {/* Fixed navigation bar — always at the same spot regardless of scroll */}
      {steps.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 flex-wrap">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  aria-label={`Go to step ${i + 1}`}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i === currentStep
                      ? 'bg-orange-500'
                      : i < currentStep
                      ? 'bg-orange-200'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>

            {/* Previous / Next buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setCurrentStep((s) => s - 1)}
                disabled={isFirst}
                className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-30 font-medium py-2.5 rounded-xl transition-colors"
              >
                ← Previous
              </button>
              {isLast ? (
                <Link
                  to={`/recipes/${id}`}
                  className="flex-1 text-center bg-green-500 hover:bg-green-600 text-white font-medium py-2.5 rounded-xl transition-colors"
                >
                  Finish ✓
                </Link>
              ) : (
                <button
                  onClick={() => setCurrentStep((s) => s + 1)}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-xl transition-colors"
                >
                  Next →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

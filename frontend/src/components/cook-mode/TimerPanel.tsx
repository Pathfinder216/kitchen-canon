import { formatTime, getRemaining, isDone, isRunning, type TimerState } from '../../hooks/useStepTimers';

interface TimerPanelProps {
  timers: TimerState[];
  currentStepIndex: number;
  onPause: (stepIndex: number) => void;
  onResume: (stepIndex: number) => void;
  onDismiss: (stepIndex: number) => void;
}

export function TimerPanel({
  timers,
  currentStepIndex,
  onPause,
  onResume,
  onDismiss,
}: TimerPanelProps) {
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

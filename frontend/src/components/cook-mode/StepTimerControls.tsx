import type { Step } from '../../types/recipe';
import { formatTime, getRemaining, isDone, isRunning, type TimerState } from '../../hooks/useStepTimers';

export interface CustomTime {
  mins: string;
  secs: string;
}

interface StepTimerControlsProps {
  step: Step;
  stepIndex: number;
  timer: TimerState | undefined;
  customTime: CustomTime;
  onCustomTimeChange: (stepIndex: number, time: CustomTime) => void;
  onStart: (stepIndex: number, step: Step) => void;
  onPause: (stepIndex: number) => void;
  onReset: (stepIndex: number) => void;
}

export function StepTimerControls({ step, stepIndex, timer, customTime, onCustomTimeChange, onStart, onPause, onReset }: StepTimerControlsProps) {
  const customMins = customTime.mins;
  const customSecs = customTime.secs;
  const setCustomMins = (v: string) => onCustomTimeChange(stepIndex, { mins: v, secs: customSecs });
  const setCustomSecs = (v: string) => onCustomTimeChange(stepIndex, { mins: customMins, secs: v });

  if (!step.timeMinutes) return null;

  const parsedMins = Math.max(0, Math.floor(parseInt(customMins) || 0));
  const parsedSecs = Math.min(59, Math.max(0, Math.floor(parseInt(customSecs) || 0)));
  const totalSeconds = parsedMins * 60 + parsedSecs;
  const remaining = timer ? getRemaining(timer) : totalSeconds;
  const running = timer ? isRunning(timer) : false;
  const done = timer ? isDone(timer) : false;
  const pct = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 0;
  const canEdit = !timer && !running;

  const numInput = 'w-12 text-right text-lg font-mono font-bold text-orange-700 bg-transparent border-b border-orange-300 focus:outline-none focus:border-orange-500';
  const blockNonDigits = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!/^\d$/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-orange-700">Passive time</span>
        {canEdit ? (
          <div className="flex items-center gap-1 text-sm text-orange-700">
            <input
              type="number"
              min={0}
              step={1}
              value={customMins}
              onChange={(e) => setCustomMins(e.target.value)}
              onKeyDown={blockNonDigits}
              className={numInput}
            />
            <span>m</span>
            <input
              type="number"
              min={0}
              max={59}
              step={1}
              value={customSecs}
              onChange={(e) => setCustomSecs(e.target.value)}
              onKeyDown={blockNonDigits}
              className={numInput}
            />
            <span>s</span>
          </div>
        ) : (
          <span
            className={`text-2xl font-mono font-bold tabular-nums ${done ? 'text-green-600' : 'text-orange-700'}`}
          >
            {done ? '✓ Done' : formatTime(remaining)}
          </span>
        )}
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
            onClick={() => onStart(stepIndex, { ...step, timeMinutes: (parsedMins * 60 + parsedSecs) / 60 })}
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

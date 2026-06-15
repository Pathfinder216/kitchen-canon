import type { ReactNode } from 'react';
import type { Ingredient, Step } from '../../types/recipe';
import { StepMedia } from '../StepMedia';
import { resolveIngredientRefs } from '../../utils/resolveIngredientRefs';
import { StepTimerControls, type CustomTime } from './StepTimerControls';
import type { TimerState } from '../../hooks/useStepTimers';

interface StepCardProps {
  step: Step;
  stepIndex: number;
  scaledIngredients: Ingredient[];
  swapDisplayNames: Map<string, string>;
  timer: TimerState | undefined;
  customTime: CustomTime;
  onCustomTimeChange: (stepIndex: number, time: CustomTime) => void;
  onStart: (stepIndex: number, step: Step) => void;
  onPause: (stepIndex: number) => void;
  onReset: (stepIndex: number) => void;
}

export function StepCard({
  step,
  stepIndex,
  scaledIngredients,
  swapDisplayNames,
  timer,
  customTime,
  onCustomTimeChange,
  onStart,
  onPause,
  onReset,
}: StepCardProps): ReactNode {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-orange-500 text-white text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0">
          {stepIndex + 1}
        </span>
        {!!step.timeMinutes && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {step.timeMinutes} min {step.isActiveTime ? '(active)' : '(passive)'}
          </span>
        )}
      </div>
      <p className="text-gray-800 text-lg leading-relaxed">
        {resolveIngredientRefs(step.instruction, scaledIngredients, 1, swapDisplayNames)}
      </p>
      <StepMedia stepId={step.id} readOnly />
      {!step.isActiveTime && (
        <StepTimerControls
          step={step}
          stepIndex={stepIndex}
          timer={timer}
          customTime={customTime}
          onCustomTimeChange={onCustomTimeChange}
          onStart={onStart}
          onPause={onPause}
          onReset={onReset}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useRecipe } from '../hooks/useRecipes';
import { resolveIngredientRefsText } from '../utils/resolveIngredientRefs';
import { formatDuration } from '../utils/formatDuration';
import { playTimerSound, useStepTimers } from '../hooks/useStepTimers';
import { TimerPanel } from '../components/cook-mode/TimerPanel';
import { StepCard } from '../components/cook-mode/StepCard';
import { IngredientChecklist } from '../components/cook-mode/IngredientChecklist';
import type { CustomTime } from '../components/cook-mode/StepTimerControls';

export function CookModePage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const locationState = location.state as { from?: { label: string; href: string }; targetServings?: number; activeSwaps?: Record<string, { toIngredient: string; ratio: number }> } | null;
  const backLink = locationState?.from ?? { label: 'Back', href: `/recipes/${id}` };
  const { data: recipe, isLoading, error } = useRecipe(id!);
  const initialServings = locationState?.targetServings;
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [customTimes, setCustomTimes] = useState<Record<number, CustomTime>>({});

  const { timers, startTimer, pauseTimer, resumeTimer, resetTimer, dismissTimer } = useStepTimers({
    ingredients: recipe?.ingredients ?? [],
    onComplete: playTimerSound,
  });

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

  const targetServings = initialServings ?? recipe.servings;
  const multiplier = recipe.servings > 0 ? targetServings / recipe.servings : 1;
  const activeSwaps = locationState?.activeSwaps ?? {};
  const scaledIngredients = recipe.ingredients.map((ing) => {
    const scaled = ing.amount === null ? ing : { ...ing, amount: ing.amount * multiplier };
    const swap = activeSwaps[ing.id];
    if (!swap) return scaled;
    return { ...scaled, amount: scaled.amount !== null ? scaled.amount * swap.ratio : null };
  });

  const swapDisplayNames = new Map<string, string>();
  for (const [ingId, swap] of Object.entries(activeSwaps)) {
    swapDisplayNames.set(ingId, swap.toIngredient);
  }

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
          <Link to={backLink.href} state={{ targetServings }} className="text-gray-500 hover:text-gray-800 text-sm">
            ← {backLink.label}
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
            <TimerPanel
              timers={timers}
              currentStepIndex={currentStep}
              onPause={pauseTimer}
              onResume={resumeTimer}
              onDismiss={dismissTimer}
            />

            {/* Step card */}
            <StepCard
              step={step}
              stepIndex={currentStep}
              scaledIngredients={scaledIngredients}
              swapDisplayNames={swapDisplayNames}
              timer={currentTimer}
              customTime={customTimes[currentStep] ?? {
                mins: String(Math.floor(step.timeMinutes ?? 0)),
                secs: String(Math.round(((step.timeMinutes ?? 0) % 1) * 60)),
              }}
              onCustomTimeChange={(idx, time) => setCustomTimes((prev) => ({ ...prev, [idx]: time }))}
              onStart={startTimer}
              onPause={pauseTimer}
              onReset={resetTimer}
            />
          </div>
        )}

        {/* Ingredients checklist (collapsible) */}
        <IngredientChecklist
          ingredients={scaledIngredients}
          totalCount={recipe.ingredients.length}
          targetServings={targetServings}
          recipeServings={recipe.servings}
          checkedIngredients={checkedIngredients}
          swapDisplayNames={swapDisplayNames}
          onToggle={toggleIngredient}
        />

        {/* Next step preview */}
        {steps.length > 0 && !isLast && (
          <div className="mt-4 border border-gray-200 rounded-xl px-4 py-3 bg-gray-50">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Next step</p>
            <p className="text-sm text-gray-500 line-clamp-2 leading-snug">
              {resolveIngredientRefsText(steps[currentStep + 1].instruction, scaledIngredients, 1, swapDisplayNames)}
            </p>
            {!!steps[currentStep + 1].timeMinutes && (
              <p className="text-xs text-gray-400 mt-1">{formatDuration(steps[currentStep + 1].timeMinutes)}</p>
            )}
          </div>
        )}
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
                  to={backLink.href}
                  state={{ targetServings }}
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

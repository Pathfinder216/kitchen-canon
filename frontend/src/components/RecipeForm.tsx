import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import type { CreateRecipeInput, IngredientInput, StepInput, Recipe } from '../types/recipe';
import type { ParsedRecipe } from '../api/import';
import { StepMedia } from './StepMedia';

interface RecipeFormProps {
  initialData?: Recipe;
  importData?: ParsedRecipe;
  onSubmit: (data: CreateRecipeInput) => void;
  isSubmitting: boolean;
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <circle cx="7" cy="5" r="1.5" />
      <circle cx="13" cy="5" r="1.5" />
      <circle cx="7" cy="10" r="1.5" />
      <circle cx="13" cy="10" r="1.5" />
      <circle cx="7" cy="15" r="1.5" />
      <circle cx="13" cy="15" r="1.5" />
    </svg>
  );
}

/** Prevent mouse scroll from changing number input values */
function noScroll(e: React.WheelEvent<HTMLInputElement>) {
  (e.currentTarget as HTMLInputElement).blur();
}

const FLIP_TRANSITION = 'transform 320ms cubic-bezier(0.33, 1, 0.68, 1)';

export function RecipeForm({ initialData, importData, onSubmit, isSubmitting }: RecipeFormProps) {
  const seed = initialData ?? importData;

  const [title, setTitle] = useState(seed?.title ?? '');
  const [servings, setServings] = useState(seed?.servings ?? 1);
  const [totalTime, setTotalTime] = useState<string>(seed?.totalTime?.toString() ?? '');
  const [activeTime, setActiveTime] = useState<string>(seed?.activeTime?.toString() ?? '');
  const [source, setSource] = useState(seed?.source ?? '');
  const [authorNotes, setAuthorNotes] = useState(seed?.authorNotes ?? '');
  const [personalNotes, setPersonalNotes] = useState(initialData?.personalNotes ?? '');

  const [ingredients, setIngredients] = useState<IngredientInput[]>(
    seed?.ingredients.map((ing) => ({
      name: ing.name,
      originalName: ing.originalName ?? undefined,
      amount: ing.amount ?? undefined,
      unit: ing.unit ?? undefined,
      isOptional: ing.isOptional,
      orderIndex: ing.orderIndex,
      internalId: ing.internalId,
    })) ?? [],
  );

  type StepFormItem = StepInput & { internalId: string };

  const [steps, setSteps] = useState<StepFormItem[]>(
    seed?.steps.map((step, i) => ({
      internalId: `step_${i}_${Date.now()}`,
      // Preserve DB id only when coming from initialData (not importData)
      existingId: initialData ? (step as { id?: string }).id : undefined,
      orderIndex: step.orderIndex,
      instruction: step.instruction,
      timeMinutes: step.timeMinutes ?? undefined,
      isActiveTime: step.isActiveTime,
    })) ?? [],
  );

  // ── Ingredient drag state ────────────────────────────────────────────────────
  // ingDragId: ref for sync access in document listeners; ingDraggingId: state for rendering
  const ingDragId = useRef<string | null>(null);
  const [ingDraggingId, setIngDraggingId] = useState<string | null>(null);
  // ingEls: outer wrapper divs — hit-testing only, never transformed (layout position is always accurate)
  // ingContentEls: inner row divs — FLIP animation only
  const ingEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const ingContentEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const ingBeforePositions = useRef<Map<string, number>>(new Map());
  const ingPendingFlip = useRef(false);

  // ── Step drag state ──────────────────────────────────────────────────────────
  // stepDragId: ref for sync access; draggingStepId: state for rendering
  const stepDragId = useRef<string | null>(null);
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  // stepEls: outer row divs (hit-testing only, never transformed)
  // stepContentEls: inner content divs (FLIP animation only, step numbers excluded)
  const stepEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const stepContentEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const stepBeforePositions = useRef<Map<string, number>>(new Map());
  const stepPendingFlip = useRef(false);

  // ── Ingredient helpers ───────────────────────────────────────────────────────
  function addIngredient() {
    setIngredients((prev) => [
      ...prev,
      { name: '', orderIndex: prev.length, internalId: `ing_${Date.now()}`, isOptional: false },
    ]);
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index).map((ing, i) => ({ ...ing, orderIndex: i })));
  }

  function updateIngredient(index: number, field: keyof IngredientInput, value: unknown) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)));
  }

  // ── Step helpers ─────────────────────────────────────────────────────────────
  function addStep() {
    setSteps((prev) => [
      ...prev,
      { internalId: `step_${Date.now()}`, orderIndex: prev.length, instruction: '', isActiveTime: true },
    ]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index).map((step, i) => ({ ...step, orderIndex: i })));
  }

  function updateStep(index: number, field: keyof StepInput, value: unknown) {
    setSteps((prev) => prev.map((step, i) => (i === index ? { ...step, [field]: value } : step)));
  }

  // ── Ingredient drag: document-level pointer listeners ────────────────────────
  // Using document listeners (not setPointerCapture) because pointer capture is lost
  // when React moves the captured DOM node during a live reorder.
  useEffect(() => {
    if (!ingDraggingId) return;

    function handleMove(e: PointerEvent) {
      const draggedId = ingDragId.current;
      if (!draggedId) return;
      for (const [id, el] of ingEls.current) {
        if (id === draggedId) continue;
        const rect = el.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          if (e.clientY < rect.top + rect.height / 2) {
            const bef = new Map<string, number>();
            ingContentEls.current.forEach((ingEl, ingId) => { bef.set(ingId, ingEl.getBoundingClientRect().top); });
            ingBeforePositions.current = bef;
            ingPendingFlip.current = true;
            setIngredients(prev => {
              const fromIdx = prev.findIndex(s => s.internalId === draggedId);
              const toIdx = prev.findIndex(s => s.internalId === id);
              if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
              const arr = [...prev];
              const [item] = arr.splice(fromIdx, 1);
              arr.splice(toIdx, 0, item);
              return arr.map((ing, i) => ({ ...ing, orderIndex: i }));
            });
          }
          break;
        }
      }
    }

    function handleUp() {
      ingDragId.current = null;
      setIngDraggingId(null);
      document.documentElement.classList.remove('dragging-step');
      ingContentEls.current.forEach(el => { el.style.transition = ''; el.style.transform = ''; });
    }

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    document.addEventListener('pointercancel', handleUp);
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      document.removeEventListener('pointercancel', handleUp);
    };
  }, [ingDraggingId]);

  // FLIP animation for ingredients — only inner content divs, outer wrappers are never transformed
  useLayoutEffect(() => {
    if (!ingPendingFlip.current) return;
    ingPendingFlip.current = false;
    const dragging = ingDragId.current;
    ingContentEls.current.forEach((el, id) => {
      if (id === dragging) return;
      const prev = ingBeforePositions.current.get(id);
      if (prev === undefined) return;
      const after = el.getBoundingClientRect().top;
      const delta = prev - after;
      if (Math.abs(delta) < 1) return;
      el.style.transition = 'none';
      el.style.transform = `translateY(${delta}px)`;
      el.getBoundingClientRect(); // force reflow
      el.style.transition = FLIP_TRANSITION;
      el.style.transform = '';
    });
  }, [ingredients]);

  // ── Step drag: document-level pointer listeners ──────────────────────────────
  useEffect(() => {
    if (!draggingStepId) return;

    function handleMove(e: PointerEvent) {
      const draggedId = stepDragId.current;
      if (!draggedId) return;
      for (const [id, el] of stepEls.current) {
        if (id === draggedId) continue;
        const rect = el.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          if (e.clientY < rect.top + rect.height / 2) {
            const bef = new Map<string, number>();
            stepContentEls.current.forEach((stepEl, stepId) => { bef.set(stepId, stepEl.getBoundingClientRect().top); });
            stepBeforePositions.current = bef;
            stepPendingFlip.current = true;
            setSteps(prev => {
              const fromIdx = prev.findIndex(s => s.internalId === draggedId);
              const toIdx = prev.findIndex(s => s.internalId === id);
              if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
              const arr = [...prev];
              const [item] = arr.splice(fromIdx, 1);
              arr.splice(toIdx, 0, item);
              return arr.map((s, i) => ({ ...s, orderIndex: i }));
            });
          }
          break;
        }
      }
    }

    function handleUp() {
      stepDragId.current = null;
      setDraggingStepId(null);
      document.documentElement.classList.remove('dragging-step');
      stepContentEls.current.forEach(el => { el.style.transition = ''; el.style.transform = ''; });
    }

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    document.addEventListener('pointercancel', handleUp);
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      document.removeEventListener('pointercancel', handleUp);
    };
  }, [draggingStepId]);

  // FLIP animation for steps — only inner content divs; step numbers are excluded intentionally
  useLayoutEffect(() => {
    if (!stepPendingFlip.current) return;
    stepPendingFlip.current = false;
    const dragging = stepDragId.current;
    stepContentEls.current.forEach((el, id) => {
      if (id === dragging) return;
      const prev = stepBeforePositions.current.get(id);
      if (prev === undefined) return;
      const after = el.getBoundingClientRect().top;
      const delta = prev - after;
      if (Math.abs(delta) < 1) return;
      el.style.transition = 'none';
      el.style.transform = `translateY(${delta}px)`;
      el.getBoundingClientRect(); // force reflow
      el.style.transition = FLIP_TRANSITION;
      el.style.transform = '';
    });
  }, [steps]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      title,
      servings,
      totalTime: totalTime ? parseInt(totalTime) : undefined,
      activeTime: activeTime ? parseInt(activeTime) : undefined,
      source: source || undefined,
      authorNotes: authorNotes || undefined,
      personalNotes: personalNotes || undefined,
      ingredients,
      steps: steps.map(({ existingId: _id, internalId: _iid, ...rest }) => rest),
    });
  }

  // base: no width, so narrow inputs can specify their own
  const base = 'rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500';
  const inputClass = `${base} w-full`;
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';
  const gripClass = 'cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 touch-none select-none px-0.5';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div>
        <label htmlFor="recipe-title" className={labelClass}>Title *</label>
        <input id="recipe-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="recipe-servings" className={labelClass}>Servings</label>
          <input id="recipe-servings" type="number" value={servings} onChange={(e) => setServings(parseInt(e.target.value) || 1)} min={1} className={inputClass} onWheel={noScroll} />
        </div>
        <div>
          <label htmlFor="recipe-total-time" className={labelClass}>Total Time (min)</label>
          <input id="recipe-total-time" type="number" value={totalTime} onChange={(e) => setTotalTime(e.target.value)} min={1} className={inputClass} onWheel={noScroll} />
        </div>
        <div>
          <label htmlFor="recipe-active-time" className={labelClass}>Active Time (min)</label>
          <input id="recipe-active-time" type="number" value={activeTime} onChange={(e) => setActiveTime(e.target.value)} min={1} className={inputClass} onWheel={noScroll} />
        </div>
      </div>

      <div>
        <label htmlFor="recipe-source" className={labelClass}>Source</label>
        <input id="recipe-source" type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="URL or description" className={inputClass} />
      </div>

      {/* Ingredients */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Ingredients</h3>
        <div className="space-y-0.5">
          {ingredients.map((ing, index) => (
            // Outer div: hit-testing only, never transformed — ensures layout position is always accurate
            <div
              key={ing.internalId}
              ref={(el) => { if (el) ingEls.current.set(ing.internalId, el); else ingEls.current.delete(ing.internalId); }}
            >
              {/* Inner div: FLIP-animated + highlight */}
              <div
                ref={(el) => { if (el) ingContentEls.current.set(ing.internalId, el); else ingContentEls.current.delete(ing.internalId); }}
                className={`flex gap-1.5 items-center py-1 rounded-lg ${ingDraggingId === ing.internalId ? 'ring-2 ring-orange-400 bg-orange-50 shadow-md px-1' : ''}`}
              >
              <div
                className={gripClass}
                aria-label="Drag to reorder"
                onPointerDown={(e) => {
                  e.preventDefault();
                  ingDragId.current = ing.internalId;
                  setIngDraggingId(ing.internalId);
                  document.documentElement.classList.add('dragging-step');
                }}
              >
                <GripIcon />
              </div>

              <input
                type="number"
                value={ing.amount ?? ''}
                onChange={(e) => updateIngredient(index, 'amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="Amt"
                className={`${base} w-14 shrink-0`}
                step="any"
                onWheel={noScroll}
              />
              <input
                type="text"
                value={ing.unit ?? ''}
                onChange={(e) => updateIngredient(index, 'unit', e.target.value || undefined)}
                placeholder="Unit"
                className={`${base} w-20 shrink-0`}
              />
              <input
                type="text"
                value={ing.name}
                onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                placeholder="Ingredient name"
                className={`${base} flex-1 min-w-0`}
                required
              />
              <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap shrink-0">
                <input type="checkbox" checked={ing.isOptional} onChange={(e) => updateIngredient(index, 'isOptional', e.target.checked)} />
                Opt.
              </label>
              <button type="button" onClick={() => removeIngredient(index)} className="text-red-400 hover:text-red-600 shrink-0" aria-label="Remove ingredient">
                <TrashIcon />
              </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addIngredient} className="mt-2 text-sm text-orange-600 hover:text-orange-700 font-medium">
          + Add Ingredient
        </button>
      </div>

      {/* Steps */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Steps</h3>
        <div className="space-y-1">
          {steps.map((step, index) => (
            <div
              key={step.internalId}
              ref={(el) => { if (el) stepEls.current.set(step.internalId, el); else stepEls.current.delete(step.internalId); }}
              className="flex gap-3 items-start py-1"
            >
              {/* Step number — static, outside the draggable area */}
              <span className="flex-shrink-0 w-7 h-7 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-sm font-semibold mt-2 select-none">
                {index + 1}
              </span>

              {/* Draggable content — grip + fields + delete (only this div is FLIP-animated) */}
              <div
                ref={(el) => { if (el) stepContentEls.current.set(step.internalId, el); else stepContentEls.current.delete(step.internalId); }}
                className={`flex-1 flex gap-2 items-start min-w-0 rounded-lg ${draggingStepId === step.internalId ? 'ring-2 ring-orange-400 bg-orange-50 shadow-md px-1' : ''}`}
              >
                <div
                  className={`${gripClass} mt-2`}
                  aria-label="Drag to reorder"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    stepDragId.current = step.internalId;
                    setDraggingStepId(step.internalId);
                    document.documentElement.classList.add('dragging-step');
                  }}
                >
                  <GripIcon />
                </div>

                <div className="flex-1 space-y-1 min-w-0">
                  <textarea
                    value={step.instruction}
                    onChange={(e) => updateStep(index, 'instruction', e.target.value)}
                    placeholder="Step instruction"
                    className={`${inputClass} min-h-[60px]`}
                    required
                  />
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={step.timeMinutes ?? ''}
                      onChange={(e) => updateStep(index, 'timeMinutes', e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="Minutes"
                      className={`${base} w-24`}
                      min={1}
                      onWheel={noScroll}
                    />
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      <input type="checkbox" checked={step.isActiveTime} onChange={(e) => updateStep(index, 'isActiveTime', e.target.checked)} />
                      Active time
                    </label>
                  </div>
                  {step.existingId && <StepMedia stepId={step.existingId} />}
                </div>
                <button type="button" onClick={() => removeStep(index)} className="text-red-400 hover:text-red-600 shrink-0 mt-2" aria-label="Remove step">
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addStep} className="mt-3 text-sm text-orange-600 hover:text-orange-700 font-medium">
          + Add Step
        </button>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="recipe-author-notes" className={labelClass}>Author Notes</label>
        <textarea id="recipe-author-notes" value={authorNotes} onChange={(e) => setAuthorNotes(e.target.value)} className={`${inputClass} min-h-[60px]`} placeholder="Notes about the recipe (e.g., pan size when doubling)" />
      </div>

      <div>
        <label htmlFor="recipe-personal-notes" className={labelClass}>Personal Notes</label>
        <textarea id="recipe-personal-notes" value={personalNotes} onChange={(e) => setPersonalNotes(e.target.value)} className={`${inputClass} min-h-[60px]`} placeholder="Your personal notes and variations to try" />
      </div>

      {/* Submit */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 -mx-4 px-4 pt-3 pb-4 flex items-center gap-4">
        <button type="submit" disabled={isSubmitting || !title.trim()} className="bg-orange-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Create Recipe'}
        </button>
        {!initialData && (
          <Link to="/import" className="text-sm text-gray-500 hover:text-gray-700">
            or import from URL / file
          </Link>
        )}
      </div>
    </form>
  );
}

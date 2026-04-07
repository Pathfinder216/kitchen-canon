import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRecipeInput, IngredientInput, StepInput, Recipe } from '../types/recipe';
import type { ParsedRecipe } from '../api/import';
import { fetchCourses } from '../api/courses';
import { fetchLabels, createLabel } from '../api/labels';
import { StepMedia } from './StepMedia';
import { RecipeMedia } from './RecipeMedia';
import { ComboInput } from './ComboInput';
import { INGREDIENT_SUGGESTIONS, UNIT_SUGGESTIONS } from '../constants/suggestions';

export interface PendingMedia {
  coverPhoto?: File;
  stepMedia: Array<{ orderIndex: number; file: File }>;
}

interface RecipeFormProps {
  initialData?: Recipe;
  importData?: ParsedRecipe;
  onSubmit: (data: CreateRecipeInput, media: PendingMedia, courseTypes: string[], labelIds: string[]) => void;
  isSubmitting: boolean;
  /** Set when editing an existing recipe — enables live media upload UI */
  recipeId?: string;
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

/** Parse a fraction string like "1/2", "1 1/2", or "1.5" into a number */
function parseFraction(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const mixed = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
  const fraction = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) return parseInt(fraction[1]) / parseInt(fraction[2]);
  const num = parseFloat(t);
  return isNaN(num) ? undefined : num;
}

const FLIP_TRANSITION = 'transform 320ms cubic-bezier(0.33, 1, 0.68, 1)';


export function RecipeForm({ initialData, importData, onSubmit, isSubmitting, recipeId }: RecipeFormProps) {
  const seed = initialData ?? importData;
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(seed?.title ?? '');
  const [servings, setServings] = useState<string>(seed?.servings?.toString() ?? '1');
  const [source, setSource] = useState(seed?.source ?? '');
  const [authorNotes, setAuthorNotes] = useState(seed?.authorNotes ?? '');
  const [personalNotes, setPersonalNotes] = useState(initialData?.personalNotes ?? '');

  const [selectedCourseTypes, setSelectedCourseTypes] = useState<string[]>(
    initialData?.courses?.map((rc) => rc.courseType) ?? [],
  );
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(
    initialData?.labels?.map((rl) => rl.label.id) ?? [],
  );
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelType, setNewLabelType] = useState<'dietary' | 'allergen' | 'equipment' | 'makeAhead'>('dietary');
  const [isAddingLabel, setIsAddingLabel] = useState(false);

  const { data: allCourses = [] } = useQuery({ queryKey: ['courses'], queryFn: fetchCourses });
  const { data: allLabels = [] } = useQuery({ queryKey: ['labels'], queryFn: () => fetchLabels() });

  async function handleCreateLabel() {
    const name = newLabelName.trim();
    if (!name) return;
    try {
      const created = await createLabel({ type: newLabelType, name });
      queryClient.invalidateQueries({ queryKey: ['labels'] });
      setSelectedLabelIds((prev) => [...prev, created.id]);
      setNewLabelName('');
      setIsAddingLabel(false);
    } catch {
      // duplicate or error — keep input open
    }
  }

  type IngredientFormItem = IngredientInput & { amountText: string };

  const [ingredients, setIngredients] = useState<IngredientFormItem[]>(
    seed?.ingredients.map((ing, i) => ({
      name: ing.name,
      originalName: ing.originalName ?? undefined,
      amount: ing.amount ?? undefined,
      amountText: ing.amount != null ? String(ing.amount) : '',
      unit: ing.unit ?? undefined,
      isOptional: ing.isOptional,
      orderIndex: ing.orderIndex,
      internalId: ing.name || `ing_${i}`,
    })) ?? [],
  );

  type StepFormItem = StepInput & { internalId: string; timeMinutesText: string };

  const [steps, setSteps] = useState<StepFormItem[]>(
    seed?.steps.map((step, i) => ({
      internalId: `step_${i}_${Date.now()}`,
      // Preserve DB id only when coming from initialData (not importData)
      existingId: initialData ? (step as { id?: string }).id : undefined,
      orderIndex: step.orderIndex,
      instruction: step.instruction,
      timeMinutes: step.timeMinutes ?? 0,
      timeMinutesText: (step.timeMinutes ?? 0).toString(),
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
  const stepTextareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  // ── Ingredient helpers ───────────────────────────────────────────────────────
  function addIngredient() {
    setIngredients((prev) => [
      ...prev,
      { name: '', amountText: '', orderIndex: prev.length, internalId: `ing_${Date.now()}`, isOptional: false },
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
      { internalId: `step_${Date.now()}`, orderIndex: prev.length, instruction: '', isActiveTime: true, timeMinutes: 0, timeMinutesText: '0' },
    ]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index).map((step, i) => ({ ...step, orderIndex: i })));
  }

  function updateStep(index: number, field: keyof StepFormItem, value: unknown) {
    setSteps((prev) => prev.map((step, i) => (i === index ? { ...step, [field]: value } : step)));
  }

  function refKeyForIngredient(ingIndex: number): string {
    const name = ingredients[ingIndex].name;
    const total = ingredients.filter((i) => i.name === name).length;
    if (total === 1) return name;
    let rank = 1;
    for (let i = 0; i < ingIndex; i++) {
      if (ingredients[i].name === name) rank++;
    }
    return `${name} ${rank}`;
  }

  function insertIngredientRef(stepIndex: number, ingIndex: number) {
    const textarea = stepTextareaRefs.current.get(steps[stepIndex].internalId);
    const token = `{${refKeyForIngredient(ingIndex)}:100%}`;
    setSteps((prev) => prev.map((step, i) => {
      if (i !== stepIndex) return step;
      if (textarea) {
        const start = textarea.selectionStart ?? step.instruction.length;
        const end = textarea.selectionEnd ?? start;
        const instruction = step.instruction.slice(0, start) + token + step.instruction.slice(end);
        return { ...step, instruction };
      }
      const sep = step.instruction && !step.instruction.endsWith(' ') ? ' ' : '';
      return { ...step, instruction: step.instruction + sep + token };
    }));
    // Restore focus after state update
    setTimeout(() => textarea?.focus(), 0);
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

  // ── Pending media (create mode) ─────────────────────────────────────────────
  const [coverPhotoFile, setCoverPhotoFile] = useState<File | null>(null);
  const [coverPhotoPreview, setCoverPhotoPreview] = useState<string | null>(null);
  const [stepMediaFiles, setStepMediaFiles] = useState<Map<string, { file: File; preview: string }>>(new Map());

  function handleCoverPhotoChange(file: File) {
    if (coverPhotoPreview) URL.revokeObjectURL(coverPhotoPreview);
    setCoverPhotoFile(file);
    setCoverPhotoPreview(URL.createObjectURL(file));
  }
  function handleCoverPhotoRemove() {
    if (coverPhotoPreview) URL.revokeObjectURL(coverPhotoPreview);
    setCoverPhotoFile(null);
    setCoverPhotoPreview(null);
  }
  function handleStepMediaChange(internalId: string, file: File) {
    setStepMediaFiles(prev => {
      const next = new Map(prev);
      const existing = next.get(internalId);
      if (existing) URL.revokeObjectURL(existing.preview);
      next.set(internalId, { file, preview: URL.createObjectURL(file) });
      return next;
    });
  }
  function handleStepMediaRemove(internalId: string) {
    setStepMediaFiles(prev => {
      const next = new Map(prev);
      const existing = next.get(internalId);
      if (existing) URL.revokeObjectURL(existing.preview);
      next.delete(internalId);
      return next;
    });
  }

  function getFormData(): CreateRecipeInput {
    return {
      title,
      servings: parseInt(servings) || 1,
      source: source || undefined,
      authorNotes: authorNotes || undefined,
      personalNotes: personalNotes || undefined,
      ingredients: ingredients.map(({ amountText, internalId: _iid, ...ing }) => ({
        ...ing,
        amount: parseFraction(amountText),
      })),
      steps: steps.map(({ existingId: _id, internalId: _iid, timeMinutesText, timeMinutes: _tm, ...rest }) => ({
        ...rest,
        timeMinutes: parseFloat(timeMinutesText) || 0,
      })),
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pendingStepMedia = Array.from(stepMediaFiles.entries()).flatMap(([internalId, { file }]) => {
      const step = steps.find(s => s.internalId === internalId);
      return step ? [{ orderIndex: step.orderIndex, file }] : [];
    });
    onSubmit(getFormData(), { coverPhoto: coverPhotoFile ?? undefined, stepMedia: pendingStepMedia }, selectedCourseTypes, selectedLabelIds);
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

      <div className="flex items-end gap-6 flex-wrap">
        <div className="w-32">
          <label htmlFor="recipe-servings" className={labelClass}>Servings</label>
          <input id="recipe-servings" type="number" value={servings} onChange={(e) => setServings(e.target.value)} min={1} className={inputClass} onWheel={noScroll} />
        </div>
        {steps.length > 0 && (() => {
          const total = Math.ceil(steps.reduce((sum, s) => sum + (parseFloat(s.timeMinutesText) || 0), 0));
          const active = Math.ceil(steps.filter(s => s.isActiveTime).reduce((sum, s) => sum + (parseFloat(s.timeMinutesText) || 0), 0));
          return (
            <div className="pb-2 text-sm text-gray-500 space-y-0.5">
              <p>Total time: <span className="font-medium text-gray-700">{total} min</span></p>
              <p>Active time: <span className="font-medium text-gray-700">{active} min</span></p>
            </div>
          );
        })()}
      </div>

      <div>
        <label htmlFor="recipe-source" className={labelClass}>Source</label>
        <input id="recipe-source" type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="URL or description" className={inputClass} />
      </div>

      {/* Cover photo */}
      <div>
        <h3 className={labelClass}>Cover Photo</h3>
        {recipeId ? (
          <RecipeMedia recipeId={recipeId} />
        ) : coverPhotoPreview ? (
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-gray-200">
              <img src={coverPhotoPreview} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-2">
              <label className="cursor-pointer text-xs text-gray-600 hover:text-gray-900 border border-gray-300 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors">
                Change
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverPhotoChange(f); e.target.value = ''; }} />
              </label>
              <button type="button" onClick={handleCoverPhotoRemove} className="text-xs text-red-500 hover:text-red-700 border border-gray-300 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors">
                Remove
              </button>
            </div>
          </div>
        ) : (
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 hover:border-gray-300 rounded-lg px-3 py-2 transition-colors">
            <span className="text-lg leading-none">🖼</span>
            <span>+ Add cover photo</span>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverPhotoChange(f); e.target.value = ''; }} />
          </label>
        )}
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
                  type="text"
                  inputMode="decimal"
                  value={ing.amountText}
                  onChange={(e) => updateIngredient(index, 'amountText', e.target.value)}
                  placeholder="Amt"
                  className={`${base} w-18 shrink-0`}
                />
                <ComboInput
                  value={ing.unit ?? ''}
                  onChange={(v) => updateIngredient(index, 'unit', v || undefined)}
                  suggestions={UNIT_SUGGESTIONS}
                  placeholder="Unit"
                  wrapperClassName="w-20 shrink-0"
                  className={base}
                />
                <ComboInput
                  value={ing.name}
                  onChange={(v) => updateIngredient(index, 'name', v)}
                  suggestions={INGREDIENT_SUGGESTIONS}
                  placeholder="Ingredient name"
                  wrapperClassName="flex-1 min-w-0"
                  className={base}
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
                    ref={(el) => { if (el) stepTextareaRefs.current.set(step.internalId, el); else stepTextareaRefs.current.delete(step.internalId); }}
                    value={step.instruction}
                    onChange={(e) => updateStep(index, 'instruction', e.target.value)}
                    placeholder="Step instruction"
                    className={`${inputClass} min-h-[60px]`}
                    required
                  />
                  {ingredients.some((ing) => ing.name) && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-xs text-gray-400 shrink-0">Insert ingredient reference:</span>
                      <div className="relative shrink-0 group">
                        <button
                          type="button"
                          className="w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 text-[10px] font-bold flex items-center justify-center leading-none transition-colors"
                          tabIndex={-1}
                          aria-label="About ingredient references"
                        >
                          ?
                        </button>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg px-3 py-2.5 shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <p className="font-semibold mb-1">Ingredient references</p>
                          <p className="text-gray-300 leading-snug">Click an ingredient button to insert a scaling ingredient reference into the step. The reference will be replaced with the ingredient amount scaled to the right serving size.</p>
                          <p className="text-gray-400 mt-1.5 font-mono text-[10px]">2 Tbsp butter referenced as &#123;butter:50%&#125; → 1 Tbsp butter</p>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                        </div>
                      </div>
                      {ingredients.map((ing, ingIndex) => ing.name ? (
                        <button
                          key={ing.internalId}
                          type="button"
                          onClick={() => insertIngredientRef(index, ingIndex)}
                          className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded transition-colors"
                        >
                          {refKeyForIngredient(ingIndex)}
                        </button>
                      ) : null)}
                    </div>
                  )}
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={step.timeMinutesText}
                      onChange={(e) => updateStep(index, 'timeMinutesText', e.target.value)}
                      className={`${base} w-24`}
                      min={0}
                      step="any"
                      required
                      onWheel={noScroll}
                    />
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      <input type="checkbox" checked={step.isActiveTime} onChange={(e) => updateStep(index, 'isActiveTime', e.target.checked)} />
                      Active time
                    </label>
                  </div>
                  {step.existingId ? (
                    <StepMedia stepId={step.existingId} />
                  ) : (() => {
                    const pending = stepMediaFiles.get(step.internalId);
                    if (pending) return (
                      <div className="mt-2 relative group inline-block">
                        {pending.file.type.startsWith('video/')
                          ? <video src={pending.preview} className="h-24 w-40 object-cover rounded-lg border border-gray-200" />
                          : <img src={pending.preview} alt="" className="h-24 w-40 object-cover rounded-lg border border-gray-200" />
                        }
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                          <label className="cursor-pointer bg-white text-gray-800 text-xs font-medium px-2 py-1 rounded shadow">
                            Change
                            <input type="file" accept="image/*,video/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleStepMediaChange(step.internalId, f); e.target.value = ''; }} />
                          </label>
                          <button type="button" onClick={() => handleStepMediaRemove(step.internalId)} className="bg-white text-red-600 text-xs font-medium px-2 py-1 rounded shadow">Remove</button>
                        </div>
                      </div>
                    );
                    return (
                      <div className="mt-2">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1.5 transition-colors">
                          <input type="file" accept="image/*,video/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleStepMediaChange(step.internalId, f); e.target.value = ''; }} />
                          + Add photo / video
                        </label>
                      </div>
                    );
                  })()}
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

      {/* Course */}
      <div>
        <h3 className={labelClass}>Course</h3>
        <div className="flex flex-wrap gap-1.5">
          {allCourses.map((course) => (
            <button
              key={course.type}
              type="button"
              onClick={() =>
                setSelectedCourseTypes((prev) =>
                  prev.includes(course.type) ? prev.filter((t) => t !== course.type) : [...prev, course.type],
                )
              }
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${selectedCourseTypes.includes(course.type)
                ? 'bg-orange-100 border-orange-300 text-orange-700'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
            >
              {course.name}
            </button>
          ))}
        </div>
      </div>

      {/* Labels */}
      <div>
        <h3 className={labelClass}>Labels</h3>
        <div className="flex flex-wrap gap-1.5">
          {allLabels.map((label) => (
            <button
              key={label.id}
              type="button"
              title={label.type}
              onClick={() =>
                setSelectedLabelIds((prev) =>
                  prev.includes(label.id) ? prev.filter((id) => id !== label.id) : [...prev, label.id],
                )
              }
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${selectedLabelIds.includes(label.id)
                ? 'bg-orange-100 border-orange-300 text-orange-700'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
            >
              {label.name}
            </button>
          ))}
          {isAddingLabel ? (
            <div className="flex gap-1 items-center flex-wrap">
              <select
                value={newLabelType}
                onChange={(e) => setNewLabelType(e.target.value as typeof newLabelType)}
                className="rounded border border-gray-300 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="dietary">dietary</option>
                <option value="allergen">allergen</option>
                <option value="equipment">equipment</option>
                <option value="makeAhead">make-ahead</option>
              </select>
              <input
                autoFocus
                type="text"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleCreateLabel(); }
                  if (e.key === 'Escape') { setIsAddingLabel(false); setNewLabelName(''); }
                }}
                placeholder="Label name"
                className="rounded border border-gray-300 px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <button type="button" onClick={handleCreateLabel} className="text-xs text-orange-600 hover:text-orange-800 font-medium">Add</button>
              <button type="button" onClick={() => { setIsAddingLabel(false); setNewLabelName(''); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingLabel(true)}
              className="px-2.5 py-1 text-xs rounded-full border border-dashed border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
            >
              + New
            </button>
          )}
        </div>
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

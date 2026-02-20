import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CreateRecipeInput, IngredientInput, StepInput, Recipe } from '../types/recipe';
import type { ParsedRecipe } from '../api/import';

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

  const [steps, setSteps] = useState<StepInput[]>(
    seed?.steps.map((step) => ({
      orderIndex: step.orderIndex,
      instruction: step.instruction,
      timeMinutes: step.timeMinutes ?? undefined,
      isActiveTime: step.isActiveTime,
    })) ?? [],
  );

  // Drag-and-drop state
  const ingDragIdx = useRef<number | null>(null);
  const stepDragIdx = useRef<number | null>(null);
  const [ingDropTarget, setIngDropTarget] = useState<number | null>(null);
  const [stepDropTarget, setStepDropTarget] = useState<number | null>(null);

  // ── Ingredient helpers ──────────────────────────────────────────────────────
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

  function reorderIngredients(from: number, to: number) {
    setIngredients((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr.map((ing, i) => ({ ...ing, orderIndex: i }));
    });
  }

  // ── Step helpers ────────────────────────────────────────────────────────────
  function addStep() {
    setSteps((prev) => [
      ...prev,
      { orderIndex: prev.length, instruction: '', isActiveTime: true },
    ]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index).map((step, i) => ({ ...step, orderIndex: i })));
  }

  function updateStep(index: number, field: keyof StepInput, value: unknown) {
    setSteps((prev) => prev.map((step, i) => (i === index ? { ...step, [field]: value } : step)));
  }

  function reorderSteps(from: number, to: number) {
    setSteps((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr.map((step, i) => ({ ...step, orderIndex: i }));
    });
  }

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
      steps,
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
        <div className="space-y-2">
          {ingredients.map((ing, index) => (
            <div
              key={ing.internalId}
              className={`flex gap-1.5 items-center rounded transition-colors ${ingDropTarget === index && ingDragIdx.current !== index ? 'bg-orange-50 ring-1 ring-orange-200' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIngDropTarget(index); }}
              onDragLeave={() => setIngDropTarget(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (ingDragIdx.current !== null && ingDragIdx.current !== index) {
                  reorderIngredients(ingDragIdx.current, index);
                }
                ingDragIdx.current = null;
                setIngDropTarget(null);
              }}
            >
              {/* Drag handle */}
              <div
                draggable
                className={gripClass}
                aria-label="Drag to reorder"
                onDragStart={(e) => {
                  ingDragIdx.current = index;
                  e.dataTransfer.effectAllowed = 'move';
                  // Use whole row as drag image
                  const row = e.currentTarget.parentElement;
                  if (row) e.dataTransfer.setDragImage(row, 20, 20);
                }}
                onDragEnd={() => { ingDragIdx.current = null; setIngDropTarget(null); }}
              >
                <GripIcon />
              </div>

              {/* Amount — narrow, no w-full */}
              <input
                type="number"
                value={ing.amount ?? ''}
                onChange={(e) => updateIngredient(index, 'amount', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="Amt"
                className={`${base} w-14 shrink-0`}
                step="any"
                onWheel={noScroll}
              />
              {/* Unit — narrow */}
              <input
                type="text"
                value={ing.unit ?? ''}
                onChange={(e) => updateIngredient(index, 'unit', e.target.value || undefined)}
                placeholder="Unit"
                className={`${base} w-20 shrink-0`}
              />
              {/* Name — fills remaining space */}
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
          ))}
        </div>
        <button type="button" onClick={addIngredient} className="mt-2 text-sm text-orange-600 hover:text-orange-700 font-medium">
          + Add Ingredient
        </button>
      </div>

      {/* Steps */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Steps</h3>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`flex gap-2 items-start rounded transition-colors ${stepDropTarget === index && stepDragIdx.current !== index ? 'bg-orange-50 ring-1 ring-orange-200' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setStepDropTarget(index); }}
              onDragLeave={() => setStepDropTarget(null)}
              onDrop={(e) => {
                e.preventDefault();
                if (stepDragIdx.current !== null && stepDragIdx.current !== index) {
                  reorderSteps(stepDragIdx.current, index);
                }
                stepDragIdx.current = null;
                setStepDropTarget(null);
              }}
            >
              {/* Drag handle */}
              <div
                draggable
                className={`${gripClass} mt-2`}
                aria-label="Drag to reorder"
                onDragStart={(e) => {
                  stepDragIdx.current = index;
                  e.dataTransfer.effectAllowed = 'move';
                  const row = e.currentTarget.parentElement;
                  if (row) e.dataTransfer.setDragImage(row, 20, 20);
                }}
                onDragEnd={() => { stepDragIdx.current = null; setStepDropTarget(null); }}
              >
                <GripIcon />
              </div>

              <span className="flex-shrink-0 w-7 h-7 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-sm font-semibold mt-1">
                {index + 1}
              </span>
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
              </div>
              <button type="button" onClick={() => removeStep(index)} className="text-red-400 hover:text-red-600 shrink-0 mt-2" aria-label="Remove step">
                <TrashIcon />
              </button>
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
      <div className="flex items-center gap-4">
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

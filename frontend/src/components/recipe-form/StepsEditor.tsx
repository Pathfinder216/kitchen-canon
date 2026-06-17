import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { StepMedia } from '../StepMedia';
import { GripIcon, TrashIcon } from './icons';
import { base, inputClass, gripClass, FLIP_TRANSITION } from './styles';
import { NumberField } from '../ui/NumberField';
import { refKeyForIngredient, getRefUsage } from './refs';
import type { IngredientFormItem, StepFormItem } from './useRecipeFormState';

interface StepsEditorProps {
  steps: StepFormItem[];
  setSteps: React.Dispatch<React.SetStateAction<StepFormItem[]>>;
  ingredients: IngredientFormItem[];
  addStep: () => void;
  removeStep: (index: number) => void;
  updateStep: (index: number, field: keyof StepFormItem, value: unknown) => void;
  stepMediaFiles: Map<string, { file: File; preview: string }>;
  onStepMediaChange: (internalId: string, file: File) => void;
  onStepMediaRemove: (internalId: string) => void;
}

/**
 * Two-field hours/minutes entry for a step time. The canonical form-state value
 * stays `timeMinutesText` (total minutes); this widget keeps its own empty-able
 * `hours`/`mins` strings (seeded once from the incoming minutes) and emits the
 * combined `h * 60 + m` total on every change.
 */
function StepTimeInput({ valueMinutes, onChange }: { valueMinutes: string; onChange: (minutes: string) => void }) {
  const seedTotal = Math.round(parseFloat(valueMinutes) || 0);
  const [hours, setHours] = useState(seedTotal >= 60 ? String(Math.floor(seedTotal / 60)) : '');
  const [mins, setMins] = useState(seedTotal % 60 > 0 ? String(seedTotal % 60) : '');

  function emit(h: string, m: string) {
    const hv = parseInt(h, 10) || 0;
    const mv = parseFloat(m) || 0;
    onChange(String(hv * 60 + mv));
  }

  return (
    <div className="flex items-center gap-1">
      <NumberField
        value={hours}
        onChange={(v) => { setHours(v); emit(v, mins); }}
        className={`${base} w-14`}
        min={0}
        placeholder="0"
        aria-label="Hours"
      />
      <span className="text-xs text-gray-500 mr-1">h</span>
      <NumberField
        value={mins}
        onChange={(v) => { setMins(v); emit(hours, v); }}
        className={`${base} w-14`}
        min={0}
        placeholder="0"
        aria-label="Minutes"
      />
      <span className="text-xs text-gray-500">min</span>
    </div>
  );
}

export function StepsEditor({
  steps,
  setSteps,
  ingredients,
  addStep,
  removeStep,
  updateStep,
  stepMediaFiles,
  onStepMediaChange,
  onStepMediaRemove,
}: StepsEditorProps) {
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

  function insertIngredientRef(stepIndex: number, ingIndex: number) {
    const textarea = stepTextareaRefs.current.get(steps[stepIndex].internalId);
    const key = refKeyForIngredient(ingredients, ingIndex);
    const hasAmount = ingredients[ingIndex].amountText.trim() !== '';
    const token = hasAmount ? `{${key}:100%}` : `{${key}}`;
    let cursorPos: number | null = null;
    setSteps((prev) => prev.map((step, i) => {
      if (i !== stepIndex) return step;
      if (textarea) {
        const start = textarea.selectionStart ?? step.instruction.length;
        const end = textarea.selectionEnd ?? start;
        cursorPos = start + token.length;
        const instruction = step.instruction.slice(0, start) + token + step.instruction.slice(end);
        return { ...step, instruction };
      }
      const sep = step.instruction && !step.instruction.endsWith(' ') ? ' ' : '';
      cursorPos = step.instruction.length + sep.length + token.length;
      return { ...step, instruction: step.instruction + sep + token };
    }));
    setTimeout(() => {
      textarea?.focus();
      if (textarea && cursorPos !== null) {
        textarea.selectionStart = cursorPos;
        textarea.selectionEnd = cursorPos;
      }
    }, 0);
  }

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
  }, [draggingStepId, setSteps]);

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

  return (
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
                {ingredients.some((ing) => ing.name) && (() => {
                  const refUsage = getRefUsage(steps);
                  return (
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
                      {ingredients.map((ing, ingIndex) => {
                        if (!ing.name) return null;
                        const key = refKeyForIngredient(ingredients, ingIndex);
                        const used = refUsage[key] ?? 0;
                        const fullyUsed = used >= 100;
                        const overUsed = used > 100;
                        return (
                          <button
                            key={ing.internalId}
                            type="button"
                            onClick={() => insertIngredientRef(index, ingIndex)}
                            title={used > 0 ? `${used}% referenced across steps` : undefined}
                            className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${overUsed
                              ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-300'
                              : fullyUsed
                                ? 'bg-green-50 hover:bg-green-100 text-green-700 border-green-300'
                                : 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200'
                              }`}
                          >
                            {key}{overUsed ? ' !' : fullyUsed ? ' ✓' : ''}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
                <div className="flex gap-3 items-center flex-wrap">
                  <StepTimeInput
                    valueMinutes={step.timeMinutesText}
                    onChange={(v) => updateStep(index, 'timeMinutesText', v)}
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
                          <input type="file" accept="image/*,video/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onStepMediaChange(step.internalId, f); e.target.value = ''; }} />
                        </label>
                        <button type="button" onClick={() => onStepMediaRemove(step.internalId)} className="bg-white text-red-600 text-xs font-medium px-2 py-1 rounded shadow">Remove</button>
                      </div>
                    </div>
                  );
                  return (
                    <div className="mt-2">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1.5 transition-colors">
                        <input type="file" accept="image/*,video/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onStepMediaChange(step.internalId, f); e.target.value = ''; }} />
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
  );
}

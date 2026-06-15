import { useState } from 'react';
import type { CreateRecipeInput, IngredientInput, StepInput, Recipe } from '../../types/recipe';
import type { ParsedRecipe } from '../../api/import';

export type IngredientFormItem = IngredientInput & { amountText: string; internalId: string };
export type StepFormItem = StepInput & { internalId: string; timeMinutesText: string };

/** Parse a fraction string like "1/2", "1 1/2", or "1.5" into a number */
export function parseFraction(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const mixed = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
  const fraction = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) return parseInt(fraction[1]) / parseInt(fraction[2]);
  const num = parseFloat(t);
  return isNaN(num) ? undefined : num;
}

interface UseRecipeFormStateArgs {
  initialData?: Recipe;
  importData?: ParsedRecipe;
}

/**
 * Centralises all RecipeForm field state, the ingredient/step row helpers, and
 * the submit payload assembly. Seeding precedence is `initialData ?? importData`
 * for shared fields; `personalNotes`, step DB ids, and the course/label
 * selections only come from `initialData` (an imported recipe has none).
 */
export function useRecipeFormState({ initialData, importData }: UseRecipeFormStateArgs) {
  const seed = initialData ?? importData;

  const [title, setTitle] = useState(seed?.title ?? '');
  const [servings, setServings] = useState<string>(seed?.servings?.toString() ?? '1');
  const [source, setSource] = useState(seed?.source ?? '');
  const [authorNotes, setAuthorNotes] = useState(seed?.authorNotes ?? '');
  const [personalNotes, setPersonalNotes] = useState(initialData?.personalNotes ?? '');

  const [selectedCourseTypes, setSelectedCourseTypes] = useState<string[]>(
    initialData?.courses?.map((rc) => rc.courseType) ?? [],
  );
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(
    initialData?.labels
      ?.filter((rl) => rl.label.type !== 'dietary' && rl.label.type !== 'allergen')
      .map((rl) => rl.label.id) ?? [],
  );

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

  function updateIngredient(index: number, field: keyof IngredientFormItem, value: unknown) {
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

  return {
    // primitive fields
    title, setTitle,
    servings, setServings,
    source, setSource,
    authorNotes, setAuthorNotes,
    personalNotes, setPersonalNotes,
    selectedCourseTypes, setSelectedCourseTypes,
    selectedLabelIds, setSelectedLabelIds,
    // collections
    ingredients, setIngredients,
    steps, setSteps,
    // helpers
    addIngredient, removeIngredient, updateIngredient,
    addStep, removeStep, updateStep,
    getFormData,
  };
}

export type RecipeFormState = ReturnType<typeof useRecipeFormState>;

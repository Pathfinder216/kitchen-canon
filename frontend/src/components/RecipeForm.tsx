import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { CreateRecipeInput, Recipe } from '../types/recipe';
import type { ParsedRecipe } from '../api/import';
import { useIngredientNames } from '../hooks/useIngredients';
import { useRecipeFormState } from './recipe-form/useRecipeFormState';
import { IngredientsEditor } from './recipe-form/IngredientsEditor';
import { StepsEditor } from './recipe-form/StepsEditor';
import { BasicInfoFields, NotesAndTaxonomyFields } from './recipe-form/RecipeMetaFields';
import { CoverPhotoField } from './recipe-form/CoverPhotoField';
import { OverRefWarningDialog, UnderRefInfoDialog } from './recipe-form/RefWarningDialogs';
import { UnclassifiedWarningDialog } from './recipe-form/UnclassifiedWarningDialog';
import {
  getRefUsage,
  getOverReferencedIngredients,
  getUnderReferencedIngredients,
  getUnclassifiedIngredients,
} from './recipe-form/refs';

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

export function RecipeForm({ initialData, importData, onSubmit, isSubmitting, recipeId }: RecipeFormProps) {
  const ingredientNames = useIngredientNames();
  const catalogNameSet = useMemo(() => new Set(ingredientNames), [ingredientNames]);

  const form = useRecipeFormState({ initialData, importData });
  const {
    title, setTitle,
    servings, setServings,
    source, setSource,
    authorNotes, setAuthorNotes,
    personalNotes, setPersonalNotes,
    selectedCourseTypes, setSelectedCourseTypes,
    selectedLabelIds, setSelectedLabelIds,
    ingredients, setIngredients,
    steps, setSteps,
    addIngredient, removeIngredient, updateIngredient,
    addStep, removeStep, updateStep,
    getFormData,
  } = form;

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

  // ── Submit orchestration + warning gates ────────────────────────────────────
  const [showOverRefWarning, setShowOverRefWarning] = useState(false);
  const [showUnderRefInfo, setShowUnderRefInfo] = useState(false);
  const [showUnclassifiedWarning, setShowUnclassifiedWarning] = useState(false);
  const [unclassifiedForWarning, setUnclassifiedForWarning] = useState<string[]>([]);

  function finalSubmit() {
    const pendingStepMedia = Array.from(stepMediaFiles.entries()).flatMap(([internalId, { file }]) => {
      const step = steps.find(s => s.internalId === internalId);
      return step ? [{ orderIndex: step.orderIndex, file }] : [];
    });
    onSubmit(getFormData(), { coverPhoto: coverPhotoFile ?? undefined, stepMedia: pendingStepMedia }, selectedCourseTypes, selectedLabelIds);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (getOverReferencedIngredients(steps).length > 0) {
      setShowOverRefWarning(true);
      return;
    }
    if (!initialData && getUnderReferencedIngredients(ingredients, steps).length > 0) {
      setShowUnderRefInfo(true);
      return;
    }
    const unclassified = getUnclassifiedIngredients(ingredients, catalogNameSet);
    if (unclassified.length > 0) {
      setUnclassifiedForWarning(unclassified);
      setShowUnclassifiedWarning(true);
      return;
    }
    finalSubmit();
  }

  const overRefWarningIngredients = showOverRefWarning ? getOverReferencedIngredients(steps) : [];
  const underRefInfoIngredients = showUnderRefInfo ? getUnderReferencedIngredients(ingredients, steps) : [];
  const noRefsUsedAtAll = showUnderRefInfo && Object.keys(getRefUsage(steps)).length === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <OverRefWarningDialog
        open={showOverRefWarning}
        ingredients={overRefWarningIngredients}
        onClose={() => setShowOverRefWarning(false)}
        onSaveAnyway={() => { setShowOverRefWarning(false); finalSubmit(); }}
      />
      <UnderRefInfoDialog
        open={showUnderRefInfo}
        ingredients={underRefInfoIngredients}
        noRefsUsedAtAll={noRefsUsedAtAll}
        onClose={() => setShowUnderRefInfo(false)}
        onSaveAnyway={() => { setShowUnderRefInfo(false); finalSubmit(); }}
      />
      <UnclassifiedWarningDialog
        open={showUnclassifiedWarning}
        ingredients={unclassifiedForWarning}
        onClose={() => setShowUnclassifiedWarning(false)}
        onSaveAnyway={() => { setShowUnclassifiedWarning(false); finalSubmit(); }}
      />

      <BasicInfoFields
        title={title}
        setTitle={setTitle}
        servings={servings}
        setServings={setServings}
        source={source}
        setSource={setSource}
        steps={steps}
      />

      <CoverPhotoField
        recipeId={recipeId}
        coverPhotoPreview={coverPhotoPreview}
        onChange={handleCoverPhotoChange}
        onRemove={handleCoverPhotoRemove}
      />

      <IngredientsEditor
        ingredients={ingredients}
        setIngredients={setIngredients}
        addIngredient={addIngredient}
        removeIngredient={removeIngredient}
        updateIngredient={updateIngredient}
        ingredientNames={ingredientNames}
        catalogNameSet={catalogNameSet}
        recipeId={recipeId}
      />

      <StepsEditor
        steps={steps}
        setSteps={setSteps}
        ingredients={ingredients}
        addStep={addStep}
        removeStep={removeStep}
        updateStep={updateStep}
        stepMediaFiles={stepMediaFiles}
        onStepMediaChange={handleStepMediaChange}
        onStepMediaRemove={handleStepMediaRemove}
      />

      <NotesAndTaxonomyFields
        authorNotes={authorNotes}
        setAuthorNotes={setAuthorNotes}
        personalNotes={personalNotes}
        setPersonalNotes={setPersonalNotes}
        selectedCourseTypes={selectedCourseTypes}
        setSelectedCourseTypes={setSelectedCourseTypes}
        selectedLabelIds={selectedLabelIds}
        setSelectedLabelIds={setSelectedLabelIds}
      />

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

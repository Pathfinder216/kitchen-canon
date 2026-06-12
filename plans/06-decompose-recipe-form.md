# 06 — Decompose RecipeForm.tsx

**Size:** M-L | **Depends on:** 01, 05 (and do 04 first to avoid double-touching the dietary-tag imports)

## Goal
`frontend/src/components/RecipeForm.tsx` is 1046 lines holding form state, ingredient editing
with drag-reorder, step editing with media slots, inline classification, label/course pickers,
and a warning dialog. Split it into focused modules with **zero behavior change**. The existing
11 RecipeForm tests (green after plan 01) are the safety net — they must pass unchanged.

## Target structure

```
components/recipe-form/
  RecipeForm.tsx          (~250 lines: composition + submit orchestration)
  useRecipeFormState.ts   (state: seeding from initialData ?? importData, field updates, payload assembly)
  IngredientsEditor.tsx   (rows, add/remove, drag handles + FLIP animation, ComboInput typeahead,
                           unclassified icon + InlineClassifyPanel)
  StepsEditor.tsx         (rows, add/remove/reorder, time + active/passive, StepMedia slots)
  RecipeMetaFields.tsx    (title/servings/source/notes, course + label pickers)
  UnclassifiedWarningDialog.tsx (uses ui/Modal from plan 05)
```
Keep `components/RecipeForm.tsx` as a re-export (`export { RecipeForm } from './recipe-form/RecipeForm'`)
so `RecipeFormPage` and the tests don't move; or update the imports — either is fine, but the
test file keeps testing through the public `RecipeForm` interface.

## Approach

1. Extract `useRecipeFormState` first: all `useState` clusters currently at
   `RecipeForm.tsx:166-180+` (title, servings-as-string, source, notes, courses, labels,
   ingredients, steps) plus `getUnclassifiedIngredients()` (`:557`) and the submit payload
   assembly. Pin with a few direct hook tests (`renderHook`): seeding precedence
   (`initialData` wins over `importData`), servings string→number parsing via the existing
   `parseFraction` behavior, payload shape including `orderIndex` renumbering.
2. Extract the three editor components, passing state slices + updaters from the hook. The
   drag-reorder logic and `FLIP_TRANSITION` (`:158`) move with `IngredientsEditor`.
3. Replace the inline warning overlay (`:680-710`) with `UnclassifiedWarningDialog` on
   `ui/Modal`.
4. `InlineClassifyPanel` (`:59-139`) moves into `recipe-form/` as its own file; it must keep
   invalidating `['ingredients']` AND gain `['recipe-dietary', recipeId]` invalidation **only
   if plan 10 hasn't landed yet** (check first — don't duplicate).
5. One PR-sized commit per extraction step; run the full frontend suite after each.

## Acceptance
- All existing tests pass without modification (except import paths if you chose to move them).
- New hook tests for seeding/payload.
- `RecipeForm.tsx` (composition file) under ~300 lines; no file in `recipe-form/` over ~350.
- Manual smoke: create recipe with ingredients/steps/labels/photo; edit it; import-prefill flow
  (`navigate('/recipes/new', { state: { importData } })`) still seeds the form.

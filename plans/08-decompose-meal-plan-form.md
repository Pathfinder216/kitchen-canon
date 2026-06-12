# 08 — Decompose MealPlanFormPage.tsx

**Size:** M | **Depends on:** 01, 05

## Goal
`frontend/src/pages/MealPlanFormPage.tsx` (712 lines) mixes plan metadata fields, dietary
filtering of candidate recipes (:450-466), recipe multi-select, per-recipe servings +
substitution pickers. Extract sections; zero behavior change.

## Target structure

```
pages/MealPlanFormPage.tsx        (~200 lines: composition, load/create/update mutations)
components/meal-plan-form/
  PlanDetailsFields.tsx           (name/date/time/notes)
  DietaryFilterBar.tsx            (the diet/allergen restriction filters — after plan 04, tags
                                   come from useDietaryTags())
  SelectedRecipesList.tsx         (chosen recipes with servings inputs + substitution selectors)
  useMealPlanForm.ts              (only if state threading is still messy after extraction —
                                   judge at the end, don't force it)
```
`components/RecipeSelector.tsx` already exists for picking recipes — fold any inlined selection
UI in the page into it rather than creating a parallel component.

## Approach

1. Read the whole page first and map its state. There are no tests for this page today, so
   write a small characterization suite BEFORE refactoring (render with `renderWithProviders`
   + fetch stubs): loads an existing plan into the form, dietary filter hides a
   non-matching recipe, selecting a recipe adds a servings input, submit posts the expected
   payload shape. ~4-6 tests.
2. Then extract components one at a time, keeping the characterization tests green.
3. While in the file, do NOT also fix the servings-input annoyance — that's plan 14 (it will be
   trivial after this restructure; sequence 08 → 14).

## Acceptance
- Characterization tests written first and green before+after.
- Page composition file ≤ ~250 lines.
- Manual smoke: create plan with 2 recipes + a substitution; edit it; grocery list regenerates.

# 14 — Empty-able servings input on the meal plan form

**Size:** S | **Depends on:** sequence after 08 if both are queued (08 moves the code)

## Goal
The per-recipe servings input on the meal plan form can't be cleared while typing (number-bound
state snaps back, typically to 0 or the old value). Make it an empty-able text input like the
recipe form's servings field.

## Implementation

1. Locate the servings input in `frontend/src/pages/MealPlanFormPage.tsx` (or
   `components/meal-plan-form/SelectedRecipesList.tsx` after plan 08) — search for
   `servings` in the selected-recipes section.
2. Apply the established pattern (`RecipeForm.tsx:169`): keep the value in **string state**,
   allow `''` during editing, parse on blur/submit. On submit: empty/invalid → fall back to the
   recipe's default servings (and reflect that in the field). Use
   `inputMode="numeric"` + the existing `noScroll` wheel-blur helper if it's a number input
   being converted.
3. Guard the payload: `MealRecipe.servings` is a required Int ≥ 1 — clamp/parse before the
   mutation, never send NaN.
4. Test (in the plan-08 characterization suite or standalone): clear the field entirely (no
   snap-back), type `6`, submit → payload has 6; clear and submit → payload has the recipe
   default.

## Acceptance
Selecting/typing in the servings field never fights the user; submitted plans always carry a
valid integer.

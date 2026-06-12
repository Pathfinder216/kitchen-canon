# 11 — Remove alias names from the recipe ingredient list

**Size:** S | **Depends on:** nothing (coordinates with 22)

## Goal
The recipe ingredient list currently appends the US/UK alternative name in gray parentheses —
e.g. `cilantro (coriander)` — which clutters the UI. Remove it from the list display.

## Current state
`frontend/src/components/IngredientList.tsx:27-30` renders
`getIngredientAlias(ingredient.name)` from `frontend/src/utils/ingredientAliases.ts` as a
parenthetical. `IngredientList` is used by RecipeDetailPage and (indirectly) anywhere
ingredients are listed read-only.

## Implementation

1. Delete the alias parenthetical block from `IngredientList.tsx` (lines 27-30) and the now
   possibly-unused import.
2. Scope check — the user note targets the *recipe ingredient list* only. `getIngredientAlias`
   is also used in `GroceryList.tsx`, `CookModePage.tsx`, and `RecipeDetailPage.tsx`. Leave
   those call sites as they are (the grocery list arguably benefits from the alias when
   shopping). Do not delete `utils/ingredientAliases.ts`.
3. If plan 22 (localization mappings API) has landed, instead surface the alias as a `title`
   tooltip on the ingredient name rather than visible text — discoverability without clutter.
   If 22 hasn't landed, plain removal is correct.
4. Update any RTL snapshot/text assertions that expected the parenthetical (check
   `GroceryList.test.tsx` is unaffected — it tests a different component).

## Acceptance
Recipe detail ingredient list shows `1 cup cilantro` with no parenthetical; optional/amount
formatting unchanged; frontend tests green.

# 35 — Nutrition aggregation & display (recipes + meal plans)

**Size:** M | **Depends on:** 34 (data), 18 (canonical units)

## Goal
Automatic per-serving nutrition on recipe detail and per-meal-plan totals, computed from
catalog nutrition data — with **honest incompleteness**: when amounts can't be converted to
grams, say so rather than printing a wrong number.

## Conversion model

For each recipe ingredient: resolve to catalog entry (existing dietary resolution path) →
determine grams:
1. Weight units (`g`, `kg`, `oz`, `lb`): direct via plan 18's conversion table.
2. Volume/count units (`cup`, `tbsp`, `piece`…): via the entry's `gramsPerUnit` map (plan 34
   captures it from FDC portions; users can edit it).
3. No path to grams, or no catalog entry, or entry lacks nutrition → ingredient is
   **uncounted**; track it.

Recipe nutrition = Σ counted ingredients' grams × per100g/100, ÷ servings. Optional
ingredients: **include** them but list them in a footnote ("includes optional mushrooms") —
excluding silently would understate most real cooking. Coverage =
`countedCount / totalCount`, surfaced in the UI.

## Implementation

1. `backend/src/services/nutrition.service.ts` (extend from 34):
   `computeRecipeNutrition(userId, recipeId)` returning
   `{ perServing: {...}, coverage: { counted, total, uncounted: [{ name, reason }] } }` with
   `reason ∈ 'no-catalog-entry' | 'no-nutrition-data' | 'no-gram-conversion'`.
2. Routes: `GET /api/recipes/:id/nutrition`; meal plans: extend the meal-plan detail payload
   (or a sibling endpoint `GET /api/meal-plans/:id/nutrition`) summing component recipes with
   their servings multipliers and applied substitutions (substituted ingredient's catalog entry
   is the one counted — reuse how dietary info resolves effective ingredients in
   `meal-plan.service.ts`).
3. Frontend:
   - RecipeDetailPage: "Nutrition (per serving)" card — calories prominent, macro rows; a
     coverage line when incomplete: "Based on 9 of 12 ingredients — 3 unclassified" linking to
     classify (the uncounted list, with per-reason hints: classify / add nutrition / set grams
     per cup).
   - MealPlanDetailPage: total + per-person (using plan servings) summary with the same
     coverage treatment.
   - `gramsPerUnit` editing: in the IngredientsPage nutrition editor (34), allow adding
     "grams per <unit>" rows — this is where the user fixes `no-gram-conversion` gaps.
4. Caching: compute on request (catalog is small, recipes are small — no precompute/storage;
   mirrors the live `dietary-info` endpoint's approach). React Query staleness handles the UI;
   invalidate on classify (`['recipe-nutrition', id]` — wire into the plan-10 invalidation
   sites).
5. Tests: conversion ladder (weight unit; cup via gramsPerUnit; uncounted fallback with each
   reason); per-serving division; substitution swaps the counted entry; meal-plan multiplier
   math; RTL: coverage line renders and links.

## Acceptance
A fully classified recipe shows believable per-serving macros; a partly classified one shows
numbers + an accurate coverage caveat with a path to fix; meal plan totals respect servings and
substitutions; spec §8 updated.

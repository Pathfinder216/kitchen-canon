# 27 — Unit conversion (imperial ↔ metric) incl. temperatures in steps

**Size:** M-L | **Depends on:** 18 (canonical units with `system`/`kind` metadata)

## Goal
Display-time conversion between unit systems: a user preferring metric sees `120 ml` where the
recipe stores `1/2 cup`, and a step saying "heat oven to 400°F" reads "heat oven to 200°C".
Storage never changes — recipes keep their authored units; conversion is a per-user display
preference.

## Part A — preferences endpoint (prerequisite, reusable)

`UserPreferences` exists in the schema (userId-unique, locale, theme) but has **no route**.
1. Add `unitSystem String @default("original")` to `UserPreferences`
   (`'original' | 'imperial' | 'metric'`; `original` = no conversion).
2. `backend/src/routes/preferences.ts`: `GET /api/preferences` (get-or-create the row for
   `req.userId`), `PATCH /api/preferences` (Zod-validated partial). Mount authed. Supertest
   suite incl. isolation.
3. Frontend `hooks/usePreferences.ts` (query + mutation) and a small settings UI — simplest
   placement: a "Settings" section with the unit-system radio on the IngredientsPage header or
   a tiny new `/settings` page (judge by effort; a new page route is cleaner and gives plan 22
   a home for locale later).

## Part B — quantity conversion

4. Extend `backend/src/constants/units.ts` (plan 18) with conversion data per canonical unit:
   `{ toBase: number, base: 'ml' | 'g' }` for volume/weight units (`cup`=236.6 ml, `tbsp`=14.8,
   `tsp`=4.9, `fl oz`=29.6, `pt`/`qt`/`gal`; `oz`=28.35 g, `lb`=453.6; metric identity). Count
   units (`clove`, `can`…) have no conversion — always display as stored.
5. Conversion is **frontend display logic** (keeps API responses canonical):
   `frontend/src/utils/convertUnit.ts` with a mirror of the conversion table (add it to the
   plan-04 mirror-check script) — `convertForDisplay(amount, unit, targetSystem)` returning
   sensible target units and rounding: choose the largest target unit ≥ 1
   (`830 ml` not `0.83 l`; `1.5 lb` not `24 oz`), round to kitchen-sane precision (ml/g to
   whole numbers; cups/tbsp to common fractions via the existing `formatScaledAmount`
   fraction logic in `useScaling.ts`).
6. Apply in display surfaces: `IngredientList` (which already takes a `formatAmount` prop —
   thread a `formatQuantity(amount, unit)` variant or wrap at call sites), CookMode checklist +
   step refs (`resolveIngredientRefs` gains the conversion at label-build time), GroceryList
   (convert at render; consolidation already happened in canonical units).

## Part C — temperatures in step text

7. Render-time detection in step instructions (display only, both RecipeDetail + CookMode):
   regex `/(\d{2,3})\s*(?:°|degrees?\s*)([FC])\b/gi`. When the user's target system differs,
   append the conversion in parentheses: "heat oven to 400°F **(200°C)**" (oven temps round to
   nearest 5°C / 25°F). Appending (rather than replacing) avoids destroying meaning when
   detection misfires. Implement as a step in the same render pipeline as
   `resolveIngredientRefs` (compose the two transforms; refs first, then temperature spans on
   the plain-text segments only).
8. Tests: conversion table round-trips; display picks sane units (830 ml case, 1.5 lb case);
   fraction rendering for cups; temperature regex against: `400°F`, `400 °F`, `400 degrees
   Fahrenheit` (extend regex), `200C`, false-positive guard (`step 3 of 4` must not match);
   `original` preference = zero transformation.

## Acceptance
Metric preference shows converted quantities + oven temps everywhere ingredients/steps render;
`original` shows exactly what was authored; stored data unchanged (verify via API responses).

# 04 — Serve dietary tags from the API (kill the constants mirror)

**Size:** S-M | **Depends on:** 01

## Goal
`frontend/src/constants/dietaryTags.ts` hand-mirrors `backend/src/constants/dietaryTags.ts`.
If the backend adds an allergen, the frontend silently won't show it. Make the backend the
single source of truth, with the static file as a documented loading fallback, plus a CI guard
that the fallback hasn't drifted.

## Implementation

1. **Backend**: new route file `backend/src/routes/meta.ts` exposing
   `GET /api/meta` → `{ allergens, diets, allergenLabels, dietLabels }` straight from
   `backend/src/constants/dietaryTags.ts`. No service needed. Mount in `app.ts` with the other
   authed routers (`app.use('/api/meta', metaRouter)`). Add a small supertest suite
   (authed via `createAuthedApi`; assert shape and that `allergens` contains `'dairy'`).
2. **Frontend**: new hook `frontend/src/hooks/useDietaryTags.ts`:
   ```ts
   export function useDietaryTags() {
     const { data } = useQuery({ queryKey: ['meta'], queryFn: () => apiGet<Meta>('/meta'), staleTime: Infinity });
     return data ?? STATIC_FALLBACK; // the existing constants module
   }
   ```
   Returns `{ allergens, diets, allergenLabels, dietLabels }` with identical shapes to the
   constants so call sites are mechanical swaps.
3. Migrate the 5 consumers of the constants module (verified list):
   `components/ClassifyIngredientsPanel.tsx`, `components/FilterPanel.tsx`,
   `components/RecipeForm.tsx` (both the form and its `InlineClassifyPanel` at line ~59),
   `pages/IngredientsPage.tsx`, `pages/MealPlanDetailPage.tsx`. Keep
   `constants/dietaryTags.ts` exporting the same names — it becomes the fallback only; add a
   header comment saying so.
4. **Service worker**: add `/api/meta` to the NetworkFirst runtime-caching group in
   `frontend/vite.config.ts` (the `/^\/api\/(courses|labels|meal-plans)/` pattern) so the
   vocabulary is available offline.
5. **CI mirror guard**: `scripts/check-constant-mirrors.mjs` — run with
   `npx tsx scripts/check-constant-mirrors.mjs`; imports both dietaryTags modules and
   deep-compares `ALLERGENS`, `DIETS`, and both label maps; exits 1 with a diff on mismatch.
   Wire it as a step in the frontend CI job (plan 02).

## Acceptance
- Filters/classify UIs render identically (tags now come from the API after first load).
- Mirror-check script fails CI when either file is changed alone.

# 34 — Nutrition data on the ingredient catalog (USDA live lookup + easier classification)

**Size:** L | **Depends on:** 20 (suggest endpoint / fuzzy) | **Blocks:** 35

## Goal
Per-ingredient nutrition data on the catalog, populated via live USDA FoodData Central lookups
that the user confirms, plus the "copy from a similar ingredient" flow that makes
classification (tags AND nutrition) fast. Decision (user-confirmed): **live external API**, not
a bundled dataset.

## Design

- API: USDA FoodData Central (`https://api.nal.usda.gov/fdc/v1/foods/search`), free key via
  env var `FDC_API_KEY` (optional in config Zod — when absent, the lookup UI shows "nutrition
  lookup not configured" and manual entry still works). Add to `.env.example` +
  `docker-compose.yml` passthrough + architecture.md config table.
- The **backend proxies** FDC (`/api/nutrition/search`) so the key never reaches the client and
  responses can be normalized. Results are stored on the catalog row once confirmed — FDC is
  hit at classification time only, never at recipe render time (works offline afterward).
- Storage: `IngredientCatalog.nutrition Json?`:
  ```ts
  { per100g: { calories, protein, fat, saturatedFat, carbs, fiber, sugar, sodium },
    gramsPerUnit?: Record<string, number>,   // e.g. { cup: 240, tbsp: 15, piece: 118 } — from FDC portions
    source: 'fdc' | 'manual' | 'copied', fdcId?: number }
  ```
  `gramsPerUnit` (from FDC's `foodPortions`) is what makes volume→mass conversion possible in
  plan 35 — capture it whenever FDC provides portions.

## Implementation

1. Schema: add `nutrition Json?` to `IngredientCatalog`; `db:push`. Include in API responses.
2. `backend/src/services/nutrition.service.ts` + `routes/nutrition.ts`:
   - `GET /api/nutrition/search?q=` → proxy FDC search (dataType `Foundation,SR Legacy`, top 5),
     normalized to the storage shape (map FDC nutrient ids: 1008 kcal, 1003 protein, 1004 fat,
     1258 sat fat, 1005 carbs, 1079 fiber, 2000 sugar, 1093 sodium; values per 100 g). 10s
     timeout; FDC failure → 502 AppError with readable message.
   - Rate-limit guard: in-memory throttle (e.g. ≥ 500 ms between upstream calls) — FDC default
     keys allow 1000 req/hr; classification is low-volume so this suffices.
3. Catalog write paths: `PATCH /api/ingredients/:id` and `POST /api/ingredients` accept an
   optional `nutrition` field (Zod: numbers ≥ 0, all fields optional within `per100g`).
   Globals stay read-only — nutrition on a global is set via the private-shadow Customize flow
   (plan 15).
4. **Classification UX** (the "make classification easier" note) — in the classify panels
   (`InlineClassifyPanel`, `ClassifyIngredientsPanel`, IngredientsPage editor):
   - **Copy from similar**: ComboInput over the catalog (reuse plan 20's
     `GET /api/ingredients/suggest?name=` top matches as preselected suggestions); picking one
     prefills allergens + diets + nutrition (`source: 'copied'`), all fields remain editable
     before save.
   - **Nutrition lookup**: button → calls `/api/nutrition/search` with the ingredient name →
     list of top FDC matches (name + kcal/100g) → pick one → prefills nutrition
     (`source: 'fdc'`, stores `fdcId`, captures `gramsPerUnit`).
   - Both are additive to the existing tag toggles; saving without nutrition stays valid.
5. Tests: FDC normalization against a **recorded fixture response** (save a real search JSON
   under `__tests__/fixtures/fdc-search.json`; never hit the network in tests — mock fetch);
   missing-key behavior (route returns 503-style "not configured", UI hides the button);
   copy-from-similar prefill (RTL); catalog PATCH round-trips nutrition.

## Acceptance
With a key configured: classify "greek yogurt" → lookup → pick FDC match → catalog entry holds
per-100g data + portions. Without a key: everything else still works. Copy-from-similar fills
a new ingredient from an existing one in two taps.

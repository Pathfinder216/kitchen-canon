# 20 — Better fuzzy matching for recipe/ingredient filtering

**Size:** M | **Depends on:** nothing (synergizes with 33's copy-from-similar)

## Goal
Matching today is exact-substring (`contains`) plus stem variants. "tomatos" finds nothing;
"chiken breast" doesn't match "chicken breast"; ingredient filtering on the recipe list misses
near-spellings. Add fuzzy matching where it helps, WITHOUT letting fuzzy guesses silently feed
allergen detection.

## Design decisions (made)
- Algorithm: character-bigram Dice coefficient (simple, fast, good for short food names), plus
  token-set overlap for multi-word names. Pure TypeScript, no dependency. Data sizes (≈258
  catalog entries + ~1-2k aliases) make in-memory scoring trivial.
- **Safety rule**: dietary/allergen auto-resolution (`dietary.service.ts`) keeps its exact →
  alias → stem pipeline. Fuzzy results are only ever *suggestions* a user confirms, or
  *search/filter* results where a false positive is harmless.

## Implementation

1. `backend/src/utils/fuzzy.ts`:
   - `normalize(s)`: lowercase, strip punctuation, collapse whitespace.
   - `diceSimilarity(a, b): number` over character bigrams.
   - `fuzzyScore(query, candidate)`: max of dice over the whole strings and best per-token
     dice (so `chiken` ≈ `chicken breast` scores high).
   - Unit tests with food-typo cases: `tomatos/tomatoes`, `chiken/chicken`, `brocolli/broccoli`,
     plus negative cases (`salt` vs `basalt` should stay below threshold — tune ≥ 0.75).
2. **Ingredient typeahead** (`GET /api/ingredients?q=`, `routes/ingredients.ts:29-49`): keep
   the SQL `contains` prefilter, but when it returns < 5 results, fetch the user's visible
   catalog (global + own) and append fuzzy matches with `fuzzyScore ≥ 0.75`, ranked by score.
   Return shape unchanged.
3. **Recipe list ingredient filters**: read `recipe.service.ts`'s include/exclude-ingredient
   filtering implementation first. Apply fuzzy at the *filter-term → catalog/alias resolution*
   level: resolve each filter term to catalog entries (exact → alias → fuzzy ≥ 0.8), then
   filter recipes whose ingredients resolve to those entries (or whose raw names match). For
   **exclude** filters, keep raw substring matching as an OR-branch — excluding "nuts" should
   stay aggressive (excluding too much is safer than too little).
4. **Title search**: extend the existing search to also fuzzy-match when exact `contains`
   yields nothing — fetch the user's recipe titles (cheap) and return fuzzy hits ≥ 0.7.
5. **Classify suggestion**: in the classify endpoints/UI flow, when an ingredient is unknown,
   surface the top-3 fuzzy catalog matches as "Did you mean …?" one-tap options
   (tap = link `Ingredient.catalogId` / prefill the classify panel from that entry). This is
   the seed of plan 33's copy-from-similar; build the API part here:
   `GET /api/ingredients/suggest?name=` → top-3 `{ id, displayAlias, allergens, diets, score }`.
6. Tests: supertest for typeahead-with-typo, recipe filter with `tomatos`, suggest endpoint
   ranking; service-level tests for the resolution pipeline confirming dietary auto-labels
   do NOT change from fuzzy (a recipe with `chiken` stays unclassified until confirmed).

## Acceptance
Typos find the obvious ingredient in typeahead/filters/search; allergen auto-detection behavior
is provably unchanged; suggest endpoint returns sensible top-3 for misspellings.

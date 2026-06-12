# 19 — Import hardening ("make sure importing works fully")

**Size:** M | **Depends on:** 18 (unit normalization feeds the parser)

## Goal
Make URL/file import robust against the real-world variety of recipe formats, with a fixture
corpus that pins behavior. Current implementation: `backend/src/services/import.service.ts`
(JSON-LD extraction by regex → HTML-strip → heuristic text parser; mammoth for .docx,
pdf-parse for .pdf).

## Implementation

1. **Fixture corpus**: create `backend/src/__tests__/fixtures/import/` with sanitized,
   truncated real-world samples (strip scripts/styles/tracking; keep structure):
   - JSON-LD variants: plain `Recipe` object; `@graph` array containing the Recipe; array-of-
     objects script tag; Recipe with `HowToSection`-grouped instructions; `HowToStep` objects
     vs plain strings; `recipeYield` as `"4"`, `4`, `"4 servings"`, `["4", "4 servings"]`;
     ISO-8601 durations (`PT1H30M`); ingredient strings with unicode fractions.
   - A no-JSON-LD blog-style HTML page (headers "Ingredients"/"Instructions").
   - A .txt export, and keep/extend the existing .docx/.pdf coverage in `import.test.ts`.
2. **Gap fixes** — write the fixture test first, then fix until green. Known/likely gaps to
   verify against the current `extractJsonLd()` and `parseTextRecipe()`:
   - `@graph` and array forms of JSON-LD (most WordPress recipe plugins emit `@graph`).
   - `HowToSection` flattening (sections → ordered steps; optionally prefix the section name).
   - `recipeYield` array/string-with-text parsing → integer servings.
   - HTML entities in extracted strings (`&amp;`, `&frac12;`) — decode before parsing.
   - Multi-script-tag pages (take the first valid Recipe, not the first script).
   - Errors: unreachable URL, non-HTML content type, >10s timeout → clean 4xx AppError with a
     user-readable message (check existing behavior, pin with tests).
3. **Unit + fraction consistency**: parser output runs through `normalizeUnit` (plan 18) and
   the existing fraction handling. Regression-pin the two known regex gotchas (bullet-strip
   must not eat standalone digits; slash fractions before integers) if not already covered in
   `import.test.ts`.
4. **Frontend**: `pages/ImportPage.tsx` — surface the backend's error message on failure
   (verify it doesn't swallow into a generic "failed"); show which fields were NOT found
   (e.g. "no servings detected — defaulting to 1") so the user reviews before saving. The
   import → RecipeForm prefill flow (`navigate('/recipes/new', { state: { importData } })`)
   stays unchanged.
5. Keep scope: no new format families (OCR is plan 31; email forwarding is out of scope).

## Acceptance
- Fixture suite: every fixture imports with correct title/servings/times/ingredient
  count/step count (assert exact values per fixture).
- All previously passing import tests still green.
- Manual: import 2–3 live recipe URLs of your choice end-to-end through the UI.

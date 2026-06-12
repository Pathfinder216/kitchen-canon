# 24 — Ingredient references default to *remaining* percent

**Size:** M | **Depends on:** nothing

## Goal
Step instructions reference ingredients as `{butter:50%}`; a bare `{butter}` currently means
100% (`resolveIngredientRefs.tsx:53`). Change the default: a bare reference means **whatever
percent remains** after earlier steps' explicit references. `{butter:50%}` in step 2, `{butter}`
in step 5 → step 5 shows 50%.

## Design decisions (made)
- Explicit percents are always honored as written (no capping); only the **bare** form changes
  meaning.
- Remaining = `max(0, 100 − Σ explicit percents in EARLIER steps)`. Bare refs themselves
  consume their computed remainder (two bare refs in different steps: the first takes all
  remaining, the second shows 0% — render `0`-amount refs with a warning style/title so
  authoring mistakes are visible, not hidden).
- Multiple refs in the *same* step consume in instruction order (steps are ordered by
  `orderIndex`; within a step, token order).

## Implementation

1. Rework `frontend/src/utils/resolveIngredientRefs.tsx`. Today it's per-instruction; the
   remaining computation needs all steps:
   - New: `computeRemainingPercents(steps: Step[], ingredients: Ingredient[]): Map<stepId|index, Map<refKey, number>>`
     — walk steps in `orderIndex` order, tokenize with the existing `REF_PATTERN`, track
     consumed percent per ingredient key (keys from `buildIngredientMap`, which handles
     duplicate names as `"butter 1"`/`"butter 2"` — consumption tracks per *key*).
   - `resolveIngredientRefs` / `resolveIngredientRefsText` gain a parameter carrying the
     precomputed per-step remaining map (or, simpler API: accept `(instruction, ingredients,
     multiplier, nameOverrides, priorInstructions: string[])` and compute internally — choose
     the simpler call-site shape after looking at callers).
   - Bare token: `pct = remaining`; tooltip becomes `"remaining 50% of butter"`.
2. Update all callers to pass prior-step context: `CookModePage` (step cards), `RecipeDetailPage`
   (steps list), and any other `resolveIngredientRefs*` call sites (grep).
3. Authoring affordance: in the step editor help text (RecipeForm), document the new semantics:
   `{name:NN%}` = explicit, `{name}` = remaining.
4. Tests (`resolveIngredientRefs` has none today — add a suite):
   - bare-only ref → 100%.
   - 50% in step 1, bare in step 3 → 50%.
   - 30% + 30% in step 1, bare in step 2 → 40%.
   - over-consumption (explicit 80% + 40%) → bare shows 0 with warning styling.
   - duplicate ingredient names consume independently per key.
   - multiplier × remaining interaction (scaled amounts).
5. Check existing recipes: previous bare refs meant 100%; under the new rule they only change
   meaning when explicit refs precede them — which is exactly the case the user considers wrong
   today. No data migration needed; note this in the PR.

## Acceptance
The motivating case works: split an ingredient across steps without writing the final
percentage by hand; CookMode and Detail render identical numbers; new test suite green.

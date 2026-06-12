# 23 — Per-ingredient notes in recipes

**Size:** M | **Depends on:** nothing

## Goal
Allow a note on each recipe ingredient — "use Cooper brand", "chopped into 1-inch cubes" —
displayed wherever the ingredient is shown, excluded from matching/consolidation logic.

## Implementation

1. **Schema**: `Ingredient.note String?` in `schema.prisma` → `prisma generate` + `db:push`.
2. **⚠️ Versioning copy-path (conventions file)**: `recipe.service.ts` copies ingredients on
   create/update/restore — add `note` to every copy site or it vanishes on the next edit.
   Write the regression test FIRST: create recipe with a noted ingredient → update the recipe
   title → fetch → note still present; restore an old version → note present.
3. **Validation**: ingredient object in `schemas/recipe.schema.ts` gets
   `note: z.string().max(200).optional()`.
4. **Import**: do NOT try to parse notes out of ingredient lines — the existing parser already
   keeps unparsed trailing text in the name/originalName; leave as-is.
5. **Grocery**: consolidation (`grocery.service.ts`) keys on name+unit — notes must not affect
   keys (they don't, but don't surface notes on grocery items either; a brand note is shopping-
   relevant but per-recipe notes colliding across recipes is unsolvable — keep grocery clean).
6. **Frontend**:
   - Types: add `note?` to `Ingredient` in `frontend/src/types/recipe.ts`.
   - Form: a small secondary input (placeholder "note — brand, prep, etc.") under/next to each
     ingredient row in the ingredients editor (`RecipeForm.tsx` or `IngredientsEditor` if plan
     06 landed); include in payload.
   - Display: `IngredientList.tsx` renders the note as muted text after the name
     (`— use Cooper brand`); cook mode's `IngredientChecklist` likewise.
   - Substitution swap UI and `resolveIngredientRefs` ignore notes (no change).
7. Tests: backend version-survival test (step 2) + schema accepts/rejects (>200 chars);
   frontend: form round-trips a note; IngredientList renders it.

## Acceptance
Notes survive recipe edits and version restores; show in detail + cook mode; absent from
grocery list; import unaffected.

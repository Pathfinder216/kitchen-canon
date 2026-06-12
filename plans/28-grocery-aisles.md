# 28 — Grocery aisle grouping (zero-effort default, opt-in customization)

**Size:** M | **Depends on:** nothing (15 helpful first — same override mechanism)

## Goal
Group the grocery list by store aisle automatically with no user effort; users who care (e.g.
"my store's cheese is in the deli") can reassign an ingredient's aisle, privately.

## Design decisions (made)
- Fixed aisle vocabulary (enum-like string constant, not a table): `produce`, `meat-seafood`,
  `dairy-eggs`, `deli`, `bakery`, `frozen`, `canned-jarred`, `dry-pasta-grains`,
  `baking-spices`, `condiments-oils`, `snacks`, `beverages`, `household-other`.
- Default aisle lives on the catalog (`IngredientCatalog.aisle String?`), seeded globally.
  User reassignment uses the **existing private-shadow mechanism** (a user catalog entry
  overrides the global — same flow as plan 15's Customize), so no new override table.
- Grocery items resolve: item name → catalog entry (user's shadow first) → `aisle`; unresolved
  → `household-other`, displayed last as "Other".

## Implementation

1. Schema: add `aisle String?` to `IngredientCatalog`; `prisma generate` + `db:push`.
2. Constants: `backend/src/constants/aisles.ts` with the vocabulary + display names + sort
   order. Seed default aisles: extend `backend/src/constants/ingredientCatalog.ts` entries with
   an aisle column (258 entries — bulk-assign by obvious category: produce items → `produce`,
   flours/sugars → `baking-spices`, etc.; this is tedious but mechanical; default anything
   genuinely ambiguous to `household-other`). Update `seed.ts` to write it.
3. API: include `aisle` in `GET /api/ingredients` responses (automatic via Prisma select) and
   accept it in POST/PATCH (Zod: enum of vocabulary, optional) so the IngredientsPage/Customize
   flow (plan 15) can set it.
4. Grocery list shape: `GET /api/meal-plans/:id` builds the grocery list — read
   `meal-plan.service.ts` and attach a resolved `aisle` to each grocery item at read time
   (resolve via the dietary service's existing name→catalog resolution; do NOT store aisle on
   `GroceryItem` — resolution should always reflect current catalog/overrides).
5. Frontend `components/GroceryList.tsx`: group items under aisle headers (vocabulary sort
   order), "Other" last; purchased-toggle and clipboard-copy keep working — copied text gets
   aisle section headers too. Long-press/kebab on an item → "Change aisle" → small dialog
   (plan 05 Modal) listing aisles → calls the customize flow (POST /api/ingredients with the
   item's name + chosen aisle, preserving existing tags if the entry exists — fetch entry
   first).
6. Tests: backend — grocery response carries aisles, user shadow with different aisle wins;
   frontend — grouping renders headers in order, unresolved items land in Other, copy output
   includes headers.

## Acceptance
Default behavior: grouped list with zero setup. Reassigning cheese to deli persists for that
user only and survives regeneration; copy/paste output stays sensible.

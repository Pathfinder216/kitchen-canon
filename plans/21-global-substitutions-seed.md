# 21 — Seed a curated set of global substitutions

**Size:** S-M | **Depends on:** nothing

## Goal
The substitution system exists (model, routes, per-user + official split) but ships empty —
`prisma/seed.ts` seeds only the ingredient catalog and labels. Provide an app-chosen global
set; users already can add their own (kept).

## Implementation

1. Create `backend/src/constants/substitutionSeed.ts`: ~40 well-established substitutions as
   `{ from, to, ratio, notes }` (names lowercase, matching catalog `displayAlias` where
   possible). Content to include (use authoritative ratios):
   - Baking: buttermilk → milk + lemon juice (1:1, "add 1 tbsp acid per cup, rest 5 min");
     cake flour → all-purpose flour (1:1 minus 2 tbsp per cup); baking powder → baking soda +
     cream of tartar (1 tsp → 1/4 tsp + 1/2 tsp); butter → coconut oil (1:1); egg → ground
     flaxseed + water (1 egg → 1 tbsp + 3 tbsp, "vegan; best in baking"); egg → applesauce
     (1 egg → 1/4 cup, "adds sweetness").
   - Herbs: fresh herbs → dried herbs (3:1) for basil, oregano, thyme, rosemary, parsley
     (individual rows, ratio 0.333).
   - Dairy: heavy cream → evaporated milk (1:1, "won't whip"); sour cream → greek yogurt (1:1);
     milk → oat milk (1:1, "vegan").
   - Pantry: cornstarch → all-purpose flour (1:2); fresh garlic → garlic powder (1 clove →
     1/8 tsp); fresh ginger → ground ginger (1 tbsp → 1/4 tsp); lemon juice → vinegar (1:1);
     tomato sauce → tomato paste + water (1 cup → 3/4 cup paste + 1/4 cup); wine → broth (1:1,
     "non-alcoholic"); honey → maple syrup (1:1).
   - Fill the remainder with similarly uncontroversial pairs.
2. Seed block in `prisma/seed.ts`: for each row, `findFirst({ where: { fromIngredient,
   toIngredient, isOfficial: true } })` → create if absent with
   `{ isOfficial: true, createdBy: null }` (findFirst+create, NOT upsert — conventions file,
   SQLite NULL-unique rule). Must be idempotent and must NOT touch user rows
   (`isOfficial: false`). ⚠️ The catalog seed section wipes and re-seeds catalog/alias tables —
   do not follow that pattern here; user substitutions must survive reseeds.
3. Verify direction semantics by reading `substitutions.service.ts` (`from`→`to` with `ratio`
   meaning multiply amount by ratio when swapping to `to`) and make the seed data consistent
   with how the recipe-detail swap UI applies ratios — write one integration test: recipe with
   `1 cup fresh basil`, apply official basil→dried sub, amount becomes `1/3 cup`.
4. Frontend: no changes — SubstitutionsPage and the detail-page swap menu already list
   official + own.

## Acceptance
Fresh DB seed produces the official set; reseeding is idempotent; user-created substitutions
survive reseed; swap UI applies a seeded ratio correctly end-to-end.

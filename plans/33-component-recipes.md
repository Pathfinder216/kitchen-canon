# 33 — Component recipes (sub-recipes used by other recipes)

**Size:** L | **Depends on:** nothing hard; 06 makes the form work easier

## Goal
Spec §8 "Component Recipes": a recipe (pie crust, stock) can be flagged as a component;
other recipes' ingredients can reference it ("1 batch [Pie Crust]"); scaling propagates;
detail page shows "Used in"; recipe list separates components.

## Schema

```prisma
// Recipe
isComponent Boolean @default(false)

// Ingredient
componentRecipeId String?
componentRecipe   Recipe? @relation("ComponentUsage", fields: [componentRecipeId], references: [id], onDelete: SetNull)
```
(`Recipe` gains the back-relation `usedAsComponentIn Ingredient[] @relation("ComponentUsage")`.)

⚠️ **The versioning trap** (conventions file): every recipe edit creates a NEW Recipe row, so a
stored `componentRecipeId` pins one version. Decide deliberately: references resolve to the
**latest version of the component's chain** at read time. Implement a helper
`resolveLatestInChain(recipeId)` in `recipe.service.ts` — study how `getRecipeVersions` walks
`parentId`/`versions` and reuse. Used-in queries must also match any version in the chain.
Also: `isComponent` and ingredient `componentRecipeId`s must survive the version-copy paths
(create/update/restore) — add to copy logic + regression test, same pattern as plan 23.

## Backend

1. Schema change + `db:push`; add `isComponent` to recipe Zod schemas; ingredient schema gains
   optional `componentRecipeId` (validate: must reference a recipe owned by the same user and
   flagged `isComponent`; reject self/derived-chain references to prevent cycles — walk the
   chain, max depth guard).
2. `GET /api/recipes` gains `isComponent` filter param (default: exclude components from the
   main list; `?components=true` lists only components; `?components=all` everything) — keep
   backward compatible: existing callers see non-components.
3. `GET /api/recipes/:id` response: ingredients referencing components include a summary
   (`componentRecipe: { id, title, servings }` resolved to latest); add `usedIn:
   [{ id, title }]` (latest-version recipes whose latest version references this chain).
4. Scaling semantics: `Ingredient.amount` for a component ref = number of **batches**. No
   server change needed beyond storing it — display math is client-side like other scaling.
5. Grocery/dietary expansion: when a meal-plan recipe contains component refs, expand the
   component's ingredients (scaled by batches × servings multiplier) into grocery consolidation
   and dietary computation (`grocery.service.ts` / `meal-plan.service.ts` / `dietary.service.ts`).
   Depth-limit expansion (components of components: support 1 level now; deeper → flatten
   recursively with the cycle guard from step 1).

## Frontend

6. RecipeForm: "This is a component recipe" checkbox; in the ingredients editor, allow linking
   a row to a component (ComboInput source gains a "Recipes" group listing the user's
   components; selecting stores `componentRecipeId`, name displays as `[Pie Crust]`).
7. RecipeDetailPage: component refs render as links; "Used in" section; component recipes show
   a `Component` badge.
8. RecipeListPage: components under a separate collapsed section (and excluded from the main
   grid per the API default).
9. Cook mode: a step referencing the component's ingredient shows the batch amount; full
   inline expansion of component steps is OUT of scope (note as future).

## Tests
Backend: cycle rejection; latest-chain resolution after editing the component; used-in across
versions; grocery expansion math (2 batches × 1.5 servings multiplier); isolation (can't
reference another user's component). Frontend: form link flow; detail render of refs + used-in.

## Acceptance
Pie-crust scenario end-to-end: create component, reference it from a pie with `1.5` batches,
scale the pie ×2 → grocery list contains crust ingredients ×3; editing the crust updates what
the pie shows; spec §8 updated.

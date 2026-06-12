# 10 — Bug: unclassified-ingredients banner doesn't update after classifying

**Size:** S | **Depends on:** nothing

## Bug (root cause verified)
On the edit-recipe page, classifying an ingredient via the inline panel doesn't update the
amber "N ingredients not in catalog" banner at the top of the page.

- The banner lives in `frontend/src/pages/RecipeFormPage.tsx:98-115`, driven by the query
  `['recipe-dietary', id]` (`:37-42`, `staleTime: 5 * 60 * 1000`) whose data comes from
  `GET /api/recipes/:id/dietary-info` (computed live from the catalog).
- The inline classify panel's save handler (`frontend/src/components/RecipeForm.tsx:78-90`,
  `InlineClassifyPanel.handleSave`) invalidates only `['ingredients']` (line 83).
- Nothing invalidates `['recipe-dietary', id]`, so the banner stays stale until reload.

## Fix

1. In `InlineClassifyPanel.handleSave`, additionally invalidate the dietary query. The panel
   doesn't currently receive the recipe id — `RecipeForm` gets `recipeId` as a prop
   (`RecipeForm.tsx:161`), so pass it down (it may be undefined on the create page; guard).
   ```ts
   await queryClient.invalidateQueries({ queryKey: ['ingredients'] });
   if (recipeId) await queryClient.invalidateQueries({ queryKey: ['recipe-dietary', recipeId] });
   ```
2. Check the other classify path: `components/ClassifyIngredientsPanel.tsx` (used on the meal
   plan detail page) — verify its save path invalidates whatever query feeds that page's
   dietary display (`['meal-plan', id]` or similar in `useMealPlans.ts` / a recalculate call).
   Fix the same way if stale.
3. Note: classifying changes catalog data but the recipe's **auto labels** are recomputed on
   recipe save, and the meal plan's stored `dietaryInfo` only via `POST /meal-plans/:id/recalculate`.
   Don't add recalculation here — only fix the query invalidation so displayed data refetches.

## Tests
RTL test: render `RecipeFormPage` (via `renderWithProviders`, route with an id) with fetch
stubs where dietary-info first returns one unknown ingredient, then (after classify save)
returns none; classify via the inline panel; assert the banner disappears. If wiring the full
page is too fiddly, a narrower test on `InlineClassifyPanel` asserting both invalidations fire
(spy on `queryClient.invalidateQueries`) is acceptable.

## Acceptance
Manual: edit a recipe with an uncataloged ingredient → banner lists it → classify inline →
banner updates without reload (count drops / disappears).

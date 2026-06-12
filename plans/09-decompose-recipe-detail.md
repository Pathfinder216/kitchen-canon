# 09 — Decompose RecipeDetailPage.tsx

**Size:** M | **Depends on:** 01, 05

## Goal
`frontend/src/pages/RecipeDetailPage.tsx` (503 lines) holds the detail view plus a confirm
dialog (:203-228), substitutions dropdown (:390-439), scaling controls (:294-326), dietary
badges, notes (:479-486), and print/export actions (:517). Extract sections; zero behavior
change.

## Target structure

```
pages/RecipeDetailPage.tsx          (outer loading + inner composition — KEEP the existing
                                     outer/inner split; it prevents hooks-after-early-return)
components/recipe-detail/
  RecipeActionsBar.tsx              (edit/archive/delete/print/export buttons + confirm flow
                                     using ui/Modal)
  SubstitutionsMenu.tsx             (the :390-439 dropdown using ui/Menu, with ratio swap logic)
  ServingScaler.tsx                 (the :294-326 scaling input; useScaling stays where it is)
  DietaryBadges.tsx                 (allergen/diet chips + unknown-ingredients note)
  RecipeNotes.tsx                   (author + personal notes sections)
```

## Approach

1. Write a small characterization suite first (none exists for this page): renders title,
   ingredients, steps from a stubbed recipe; scaling input doubles displayed amounts (the
   `formatAmount` path through `IngredientList`); archive button calls the mutation; export
   menu triggers `exportRecipe`. ~5 tests with `renderWithProviders` + fetch stubs.
2. Extract one component per commit; suite stays green throughout.
3. The substitution-swap state (`nameOverrides` map fed into `resolveIngredientRefs`) moves
   into `SubstitutionsMenu`'s parent state — keep the swap data flow identical.

## Acceptance
- Characterization tests green before and after.
- Inner composition component ≤ ~200 lines.
- Manual smoke: scale servings, apply a substitution (step refs update), archive/unarchive,
  print preview still styled.

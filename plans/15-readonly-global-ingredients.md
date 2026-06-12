# 15 — Make global ingredients read-only in the UI (with explicit "customize")

**Size:** S-M | **Depends on:** nothing

## Goal
Users must not appear to edit app-global data. The backend already enforces this — `PATCH/DELETE
/api/ingredients/:id` 404 unless `userId` matches (`backend/src/routes/ingredients.ts:101-104,
118-121`), and `POST /api/ingredients` creates a user-private shadow entry that wins resolution
over the global (`:74-77`). The frontend (`frontend/src/pages/IngredientsPage.tsx`) doesn't
distinguish, so editing a global either errors or confusingly creates a shadow.

## Implementation

1. In `IngredientsPage.tsx`: entries from `GET /api/ingredients` carry `userId`
   (null = global) and `isUserAdded`. Render global entries read-only: no edit/delete
   affordances; show a subtle `built-in` badge. User entries keep edit/delete.
2. Add an explicit **Customize** action on global entries: opens the same tag editor
   pre-filled with the global's `allergens`/`diets`; saving calls the existing
   `POST /api/ingredients` with the same name, creating the private shadow (this is exactly
   the backend's intended semantics — `ingredients.ts:74-77`). The list should then show the
   user's entry as overriding: dedupe display so a shadowed global shows once, as the user's
   version, with a `customized` badge and a "reset to default" (= DELETE the private entry).
   Dedupe key: lowercase `displayAlias` matching between a user entry and a global entry.
3. The inline classify panels (RecipeForm, ClassifyIngredientsPanel) already only create
   user entries via POST — no change needed there; verify by reading.
4. Audit the same principle elsewhere: `SubstitutionsPage.tsx` — official substitutions must
   not show a delete button (backend 404s already; check the UI hides it; fix if not).
5. Tests: RTL on IngredientsPage with stubbed fetch — global rows show no edit/delete but show
   Customize; customizing posts and re-renders as user-owned; reset deletes.

## Acceptance
No UI path appears to mutate global data; customize→override→reset round-trip works; the
override visibly wins in the list.

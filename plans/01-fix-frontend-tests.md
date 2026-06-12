# 01 — Fix the 12 failing frontend tests

**Size:** S | **Depends on:** nothing | **Blocks:** 02 (CI), all decomposition plans

## Goal
`npm test --prefix frontend` passes 54/54. Currently 42 pass, 12 fail. Both failures are
test-side staleness, not product bugs — do NOT change product behavior.

## Root causes (verified)

1. **RecipeForm.test.tsx — all 11 tests** fail with `No QueryClient set` thrown from
   `RecipeForm.tsx:163` (`useQueryClient()`, added with catalog typeahead). The test's
   `renderForm()` helper (`RecipeForm.test.tsx:7-13`) wraps in `MemoryRouter` only.
2. **CookModePage.test.tsx — "shows timer for passive time steps"** asserts `getByText(/10m/)`
   but the UI now renders the duration as `10 min (passive)` (`CookModePage.tsx:458`) and the
   countdown via `formatTime()` as `10:00` (`CookModePage.tsx:72,152`).

## Implementation

1. Create `frontend/src/test/utils.tsx`:
   ```tsx
   import { render } from '@testing-library/react';
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
   import { MemoryRouter } from 'react-router-dom';
   import type { ReactElement } from 'react';

   export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
     const queryClient = new QueryClient({
       defaultOptions: { queries: { retry: false, gcTime: Infinity } },
     });
     return render(
       <QueryClientProvider client={queryClient}>
         <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
       </QueryClientProvider>,
     );
   }
   ```
2. Switch `renderForm()` in `RecipeForm.test.tsx` to `renderWithProviders`. The form's
   `useIngredientNames()` falls back to a static list while its query is loading, so no fetch
   mock is required; if jsdom logs unhandled fetch rejections, stub `global.fetch` in
   `src/test/setup.ts` to resolve `[]` for `/api/ingredients`.
3. Fix the CookModePage assertion: the test should verify a passive step offers a startable
   timer. Assert the `Start timer` button (rendered at `CookModePage.tsx:171`) and the
   `10 min (passive)` caption; drop `/10m/`. Confirm the sibling test ("does not show timer for
   active time steps") still encodes the intended rule.
4. Opportunistically migrate the other test files (`CookModePage`, `MealHistoryPage`, `App`,
   `GroceryList`, `RecipeCard`) to `renderWithProviders` where they hand-build providers —
   pure consolidation, no assertion changes.

## Acceptance
- `npm test --prefix frontend` → 54/54 pass (run count may grow if you add none — do not delete tests).
- `npm test --prefix backend` still green.

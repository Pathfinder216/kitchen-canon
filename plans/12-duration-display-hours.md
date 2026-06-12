# 12 — Show hours + minutes for long durations

**Size:** S | **Depends on:** nothing

## Goal
Durations render as raw minutes everywhere (`135 min`). When 60+ minutes, show `2 h 15 min`
(and `2 h` when minutes are 0). The user specifically called out the recipe overview.

## Implementation

1. Create `frontend/src/utils/formatDuration.ts`:
   ```ts
   /** 135 → "2 h 15 min"; 90 → "1 h 30 min"; 45 → "45 min"; 60 → "1 h"; null/0 → '' */
   export function formatDuration(minutes: number | null | undefined): string
   ```
   Handle fractional minutes (step times are floats) by rounding to the nearest minute for
   display. Unit-test the boundaries: 0, 45, 59.6, 60, 61, 90, 120, null.
2. Apply at every duration display site. Find them with `grep -rn "min" frontend/src --include="*.tsx"`
   and judge each; known sites:
   - `components/RecipeCard.tsx:47` — `{recipe.totalTime} min` (the "recipe overview" the note
     means).
   - `pages/RecipeDetailPage.tsx` — total/active time display.
   - `pages/MealPlanDetailPage.tsx` / `MealHistoryPage.tsx` if they show times.
   - `pages/CookModePage.tsx:458,531` — per-step times. Step times are typically short; still
     use `formatDuration` for consistency (a 90-minute braise step reads `1 h 30 min`).
     ⚠️ The CookModePage test from plan 01 asserts `10 min (passive)` — `formatDuration(10)`
     returns `10 min` so it should hold; verify.
3. Do NOT change the timer countdown format (`formatTime`, mm:ss) — different concern.

## Acceptance
A recipe with totalTime 135 shows `2 h 15 min` on its card and detail page; sub-hour values
unchanged; new util tests + existing suites green.

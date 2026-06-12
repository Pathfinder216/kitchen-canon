# 13 — Input hours and/or minutes for step times

**Size:** S | **Depends on:** none (pairs naturally with 12; if 06 is done, edit StepsEditor)

## Goal
Step time entry is a single minutes field, so a 2-hour braise must be typed as `120`. Allow
hours + minutes entry. Storage stays `Step.timeMinutes` (Float, minutes) — display/input only.

## Implementation

1. In the step editor (inside `frontend/src/components/RecipeForm.tsx`, or
   `components/recipe-form/StepsEditor.tsx` if plan 06 landed): replace the single minutes
   input with two small inputs, `h` and `min`, side by side with their unit suffixes.
   - String state for both (empty-able; conventions file pattern), parsed on change to
     `timeMinutes = h * 60 + m`.
   - Seeding from an existing step: `h = Math.floor(timeMinutes / 60)`,
     `m = round(timeMinutes % 60)`; render empty `h` when 0.
   - Keep the active/passive toggle untouched.
2. Cook mode's editable timer inputs (`CookModePage.tsx:168-172`, mins/secs) are a different
   widget for a different purpose (seconds-level timer adjustment) — leave them alone.
3. Backend: no change. `timeMinutes` already accepts floats; verify the Zod recipe schema has
   no max that a 12 h value (720) would hit (check `backend/src/schemas/recipe.schema.ts`).
4. Tests: extend the RecipeForm suite — entering `1 h 30 min` submits `timeMinutes: 90`;
   editing a step with `timeMinutes: 90` shows `1`/`30`; minutes-only entry still works.

## Acceptance
Creating/editing steps with hour-scale times is natural; stored values unchanged in meaning;
recipe total/active time computation (server-side, from steps) unaffected.

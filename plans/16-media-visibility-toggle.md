# 16 — Media visibility toggle

**Size:** S | **Depends on:** nothing

## Goal
Spec §2: "Toggle media on/off to avoid screen clutter when not needed." Today recipe and step
media always render. Add a user-controlled toggle, persisted locally per device.

## Design decisions (made)
- Persistence: `localStorage` key `ltc:showMedia` (`'true'`/`'false'`, default true). This is a
  device-level display preference; do NOT add it to UserPreferences/server — cook mode on a
  phone and editing on a desktop legitimately differ.
- Scope: one global toggle affecting media display surfaces (not the upload UIs).

## Implementation

1. `frontend/src/hooks/useMediaVisibility.ts`: returns `{ showMedia, toggle }` backed by
   localStorage + a module-level subscriber (or `useSyncExternalStore`) so all mounted
   consumers update together.
2. Apply in display surfaces:
   - `pages/RecipeDetailPage.tsx` — cover photo block.
   - `pages/CookModePage.tsx` — step media inside the step card.
   - `components/StepMedia.tsx` has upload + display duty — gate only its read-only display
     mode (cook mode path), never the edit mode in RecipeForm.
   - `components/RecipeCard.tsx` thumbnails: leave visible (list thumbnails are wayfinding,
     not clutter) — note this choice in the PR description.
3. Toggle placement: an icon button (image-slash) in RecipeDetailPage's action bar and in cook
   mode's header. Both call the same hook.
4. Tests: hook unit test (persists across re-mount via localStorage stub); RTL: cook mode with
   `showMedia=false` renders no `<img>`/`<video>` in the step card.

## Acceptance
Toggling in cook mode hides step images immediately and persists across reloads; uploads in the
edit form are unaffected; spec §8 status updated.

# 26 — Image cropping on upload + natural aspect-ratio display

**Size:** M | **Depends on:** 05 (Modal)

## Goal
Uploaded images get forced into unexpected aspect ratios at display time. Two-part fix:
(a) let the user crop at upload time, (b) stop forcing display containers to fixed ratios where
it doesn't serve the layout.

## Design decisions (made)
- Crop library: `react-easy-crop` (small, touch-friendly, canvas-output).
- Crop is optional: the upload flow shows the crop dialog with a free-form crop defaulting to
  the full image; "Use full image" skips cropping. No server-side image processing — the
  cropped canvas is uploaded as the file (JPEG, quality ~0.9).
- Display rules: list **thumbnails** (RecipeCard, 64px square) stay `object-cover` on a fixed
  square — wayfinding consistency. **Hero/cover and step images** render at natural aspect
  ratio constrained by `max-height` (e.g. `max-h-80 w-auto mx-auto`), no forced ratio.

## Implementation

1. `npm install react-easy-crop --prefix frontend`.
2. `frontend/src/components/ui/ImageCropDialog.tsx` (on plan 05's Modal): props
   `{ file, onConfirm(blob), onSkip, onCancel }`; free aspect by default with quick-ratio
   buttons (1:1, 4:3, 16:9, free). Canvas-export helper produces a `File` with the original
   name.
3. Wire into both upload paths — `components/RecipeMedia.tsx` (cover) and
   `components/StepMedia.tsx` (step images; **video files bypass the dialog**). The upload
   fetch itself is unchanged (multipart to `/api/recipes/:id/media` / `/api/steps/:stepId/media`).
   Note RecipeForm defers uploads until save (`PendingMedia`) — crop must happen at file-pick
   time, storing the cropped File in the pending state.
4. Display changes: audit `<img>` styling in `RecipeMedia`, `StepMedia` display mode,
   `RecipeDetailPage`, `CookModePage` — apply the display rules above. Leave `RecipeCard.tsx:37`
   (thumbnail) as-is.
5. Tests: crop-helper unit test (given a crop rect, output canvas dimensions match); RTL: pick
   file → dialog appears → skip → original file lands in pending state; video pick → no dialog.
   (jsdom canvas is limited — `vi.mock` the canvas export in RTL tests; the geometry math gets
   its own pure-function test.)

## Acceptance
Picking an image offers crop-or-skip; cropped image is what's stored/served; cover and step
images no longer letterbox/stretch; thumbnails unchanged; frontend tests green.

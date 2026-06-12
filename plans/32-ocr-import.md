# 32 — Photo/OCR recipe import

**Size:** M | **Depends on:** 19 (hardened text parser is the consumer)

## Goal
Spec §1: import from photos of recipe cards. Decision (recorded in architecture.md): OCR runs
**client-side** with tesseract.js — the Pi is too weak for server OCR, and the browser doing it
keeps the image off the wire until the user confirms.

## Implementation

1. `npm install tesseract.js --prefix frontend`. Lazy-load it (dynamic `import()`) only when
   the user picks a photo — it pulls a multi-MB WASM + language data; never put it in the main
   bundle. Verify with `npm run build` that it lands in a separate chunk.
   - Language data: default CDN fetch is fine online, but for offline/PWA friendliness pin
     `langPath` to a local copy of `eng.traineddata.gz` under `frontend/public/ocr/` (add to
     the repo; ~2 MB) and set `workerPath`/`corePath` to the bundled assets.
2. `pages/ImportPage.tsx`: add a third source — "Photo". Flow:
   - File input (`accept="image/*" capture="environment"` so phones offer the camera).
   - Run tesseract with a progress bar (`logger` callback → percentage).
   - Show the raw extracted text in an **editable textarea** (OCR will be imperfect; the user
     fixes obvious garbage before parsing).
   - "Parse" sends the text to the existing text-import path. Check `routes/import.ts`:
     `POST /api/import/file` accepts `.txt` — either post the text as a `.txt` blob through the
     existing multipart endpoint, or (cleaner) add `POST /api/import/text { text }` routed to
     `parseTextRecipe` directly; prefer the new endpoint, it's ~15 lines.
   - Parsed result flows into the existing review/prefill → RecipeForm path.
3. Image preprocessing (cheap wins, do them): downscale to max 1600px on a canvas before OCR
   (speed) — skip binarization/rotation; tesseract handles moderate cases and the editable
   textarea is the safety net.
4. Tests: backend — `POST /api/import/text` parses a fixture card text (supertest). Frontend —
   mock `tesseract.js` module (resolve canned text), assert flow: pick photo → textarea
   populated → parse → form prefill navigation. Don't run real OCR in CI.
5. Note in the PR: OCR quality on handwriting will be poor; that's acceptable — printed cards
   and cookbook photos are the target.

## Acceptance
Phone flow: snap a photo of a printed recipe card → editable text → parsed recipe → save.
Main bundle size unchanged (chunk-split verified); spec §8 updated.

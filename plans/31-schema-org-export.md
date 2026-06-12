# 31 — Bulk export (schema.org + proprietary)

**Size:** M | **Depends on:** nothing

## Goal
Spec §6: export all recipes in a standardized format (schema.org Recipe), plus a proprietary
format that preserves everything schema.org can't (versions, notes, percent refs, labels,
substitution selections). Today only per-recipe client-side `.txt`/`.json` exists.

## Implementation

1. **Backend** `backend/src/services/export.service.ts` + route `GET /api/export?format=`:
   - `format=schema-org`: JSON array of schema.org `Recipe` objects (latest versions only,
     unarchived + archived flagged via `creativeWorkStatus`): `name`, `recipeYield`,
     `totalTime`/`prepTime` as ISO-8601 durations, `recipeIngredient` (formatted strings:
     amount unit name — reuse/port the text formatter), `recipeInstructions` as `HowToStep`
     array (resolve `{ref}` tokens to plain text server-side — port
     `resolveIngredientRefsText`'s logic or duplicate minimally with a shared test vector),
     `recipeCategory` from courses, `keywords` from labels, `author`/`url` from source.
   - `format=full` (proprietary): complete dump — recipes with ALL versions, ingredients
     (incl. notes, catalogId), steps (raw instructions with tokens), courses, labels, meal
     plans, user's private catalog entries/substitutions/localizations. Versioned envelope:
     `{ formatVersion: 1, exportedAt, data: {…} }`.
   - Media: include a `media` manifest (paths + which recipe/step) but not file bytes;
     document that media files live in the data volume. (A zip with media is out of scope —
     note as future.)
   - Set `Content-Disposition: attachment; filename=let-them-cook-export-<date>.json`.
2. **JSON-LD round-trip**: the import service already parses schema.org JSON-LD — add a test
   that exports schema-org format and re-imports one recipe through
   `import.service`'s JSON-LD path, asserting title/servings/ingredients/steps survive. This
   keeps the two implementations honest.
3. **Frontend**: export buttons (both formats) — natural home: the settings page if plan 27
   landed, else the recipe list header menu. Plain `<a href="/api/export?format=…" download>`
   won't carry cookies through service-worker edge cases — use the fetch-blob-download pattern
   from `exportRecipe.ts`.
4. Tests: supertest both formats (shape, latest-version selection, personal data present in
   `full`, ISO durations valid); round-trip test from step 2; isolation (only the user's own
   data).

## Acceptance
Both export downloads work from the UI; schema-org output re-imports cleanly; `full` export
contains versions/notes/private supplements; spec §8 updated.

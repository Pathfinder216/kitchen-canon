# 22 — Implement LocalizationMapping (US/UK ingredient names)

**Size:** M | **Depends on:** nothing | **Coordinates with:** 11 (alias display)

## Goal
The Prisma model `LocalizationMapping` (schema.prisma:164-174, per-user nullable owner,
`User.localizations` relation) has zero code references. The real localization is a static
~50-pair map in `frontend/src/utils/ingredientAliases.ts`. Decision (user-confirmed):
**implement the model** — seed globals from the static pairs, serve via API, allow per-user
private additions.

## Implementation

1. **Seed**: add a block to `backend/prisma/seed.ts` converting the pairs into global rows.
   Model each direction explicitly as `{ locale, originalName, localizedName }` rows with
   `userId: null`:
   - `{ locale: 'en-US', originalName: 'coriander', localizedName: 'cilantro' }`
   - `{ locale: 'en-GB', originalName: 'cilantro', localizedName: 'coriander' }`
   Source data: the `ALIAS_PAIRS` in `frontend/src/utils/ingredientAliases.ts` (note seed.ts's
   `ALIAS_GROUPS` at :14-35 overlaps but serves catalog resolution — leave it alone; these are
   display mappings). Use findFirst+create (idempotent; SQLite NULL-unique rule — conventions).
2. **API**: `backend/src/routes/localizations.ts`, mirroring `routes/substitutions.ts`
   (identical ownership semantics):
   - `GET /api/localizations?locale=` → global + user's own rows (locale filter optional).
   - `POST /api/localizations` `{ locale, originalName, localizedName }` → private row
     (lowercase originalName; Zod schema in `schemas/`).
   - `DELETE /api/localizations/:id` → own rows only; 404 for global (matches substitutions).
   Mount in `app.ts` under the authed gates. Supertest suite incl. an isolation test (user B
   cannot see/delete user A's mapping) — copy the shape from the substitutions tests.
3. **Frontend**:
   - `frontend/src/api/localizations.ts` + `hooks/useIngredientAliases.ts`: fetch once
     (`staleTime: Infinity`), build a `Map<string, string>` (originalName → localizedName,
     user rows overriding global on key collisions).
   - Refactor `utils/ingredientAliases.ts`: keep `containsPhrase` and the matching logic but
     change the signature to `getIngredientAlias(name: string, aliasMap: Map<string, string>)`.
     Keep `ALIAS_PAIRS`-derived map exported as `STATIC_FALLBACK_MAP` (used while the query
     loads). Update the call sites: `GroceryList.tsx`, `CookModePage.tsx`,
     `RecipeDetailPage.tsx` (and `IngredientList.tsx` unless plan 11 already removed it).
   - Locale selection: defer — serve all locales' rows for now and keep the bidirectional map
     exactly like today's behavior (this preserves current UX; a locale preference comes with
     plan 27's preferences endpoint).
4. **Docs**: architecture.md model table row for LocalizationMapping changes from
   "(planned)"-adjacent wording to implemented; spec §2 already lists localization — mark
   status in §8.

## Acceptance
- Seeded mappings appear via GET; a user-created mapping shows only for its owner and overrides
  the global for them.
- Frontend alias display (grocery list etc.) behaves exactly as before on first paint
  (fallback) and after load (API data).
- Existing frontend tests green; new backend suite green.

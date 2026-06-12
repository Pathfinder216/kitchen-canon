# 30 — Shareable recipe links (token-gated public view)

**Size:** M | **Depends on:** nothing (29 adds the share menu this slots into)

## Goal
A user can create a link to one of their recipes that anyone can open without an account.
Today every route including `/media` is login-gated, so this requires deliberate public
routes — unguessable token, revocable, read-only, latest version.

## Design

New model (no fields on Recipe — versioning makes per-row fields wrong):
```prisma
model RecipeShare {
  id        String   @id @default(uuid())   // doubles as the URL token (uuid = unguessable)
  recipeId  String                          // any version row; resolved to latest at read
  userId    String                          // owner; cascade delete with user
  createdAt DateTime @default(now())
  revokedAt DateTime?
  @@index([recipeId])
  @@index([userId])
}
```
Resolution: from `recipeId`, walk to the version chain's latest (`isLatest`) — study how
`GET /api/recipes/:id` and `getRecipeVersions` resolve chains in `recipe.service.ts` and reuse
that logic so a share keeps tracking the recipe across edits.

## Implementation

1. Schema + `db:push`.
2. **Owner endpoints** (authed, in `routes/recipes.ts` or a new `routes/shares.ts`):
   - `POST /api/recipes/:id/share` → create (or return existing unrevoked) share; response
     includes the token.
   - `DELETE /api/recipes/:id/share` → revoke (set `revokedAt`).
   - `GET /api/recipes/:id/share` → current share state.
3. **Public endpoints** — mounted in `app.ts` BEFORE the CSRF/requireAuth gates (like
   `/api/auth`; see conventions):
   - `GET /api/shared/:token` → 404 if unknown/revoked; else the latest-version recipe
     (title, servings, times, ingredients incl. notes, steps, courses, labels, author notes —
     EXCLUDE `personalNotes` and any user identifiers).
   - `GET /api/shared/:token/media/:mediaId` → streams the file ONLY if that media row belongs
     to the shared recipe's version chain (ownership via the share, not the session). Reuse
     `MEDIA_STORAGE_PATH` + `res.sendFile`; do not widen the authed `/media` static mount.
4. **Frontend**:
   - Public page `/shared/:token` (outside `ProtectedRoute`): read-only recipe view — reuse
     display components (IngredientList, step list with `resolveIngredientRefs`, scaled
     serving display optional). Media `src` uses the token media endpoint. No app chrome
     requiring auth.
   - Share menu (plan 29) gains **Copy link** (creates share on demand, copies
     `${location.origin}/shared/${token}`) and **Revoke link**.
   - SPA fallback: confirm the production regex in `app.ts:73` serves index.html for
     `/shared/...` (it does — non-`/api`, non-`/media`), and the service worker doesn't cache
     the public API path in a way that leaks across users (it's fine — caches are per-browser).
5. **Tests** (supertest): share create/fetch round-trip without auth; revoked → 404;
   personalNotes absent from payload; media token-scoping (foreign mediaId → 404); isolation
   (user B cannot create/revoke shares on user A's recipe → 404).

## Acceptance
Copy link → open in an incognito window → full read-only recipe with images; revoke → link
dead; owner's personal notes never exposed; spec §8 updated.

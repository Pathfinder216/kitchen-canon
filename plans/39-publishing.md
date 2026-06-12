# 39 — Publishing: share recipes with other users (discover & save)

**Size:** L | **Depends on:** 30 (public-route patterns); 26/05 useful for UI polish

## Goal
Spec §6 stretch goal: publish recipes for other users to view, discover, and save into their
own collections. Copyright/moderation: deferred per spec — publishing is self-service,
unpublish always available, plus a minimal report mechanism (below).

## Design (decided)

**Immutable snapshots, not live rows.** Publishing creates a frozen copy; later edits to the
source don't change the published version until the author re-publishes. This sidesteps
version-chain leakage, keeps the public surface read-only, and makes "save to my collection"
a simple copy.

```prisma
model PublishedRecipe {
  id          String   @id @default(uuid())
  slug        String   @unique            // url-safe title + short suffix
  authorId    String                      // user; display name derived (see step 4)
  author      User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  sourceRecipeId String                   // version-row id it was snapped from (chain member)
  snapshot    Json                        // full recipe content (no personalNotes, no userId)
  publishedAt DateTime @default(now())
  updatedAt   DateTime @updatedAt         // bumped on re-publish
  saveCount   Int      @default(0)
  reported    Boolean  @default(false)
}
```
Media: published images are copied to `MEDIA_STORAGE_PATH/public/<publishedId>/…` at publish
time and served WITHOUT auth (`app.use('/public-media', express.static(...))` mounted before
the gates); unpublish deletes the directory. Never expose authed `/media` paths publicly.

## Implementation

1. **Author endpoints** (authed): `POST /api/recipes/:id/publish` (build snapshot from the
   latest version: title/servings/times/ingredients incl. notes/steps/courses/labels/author
   notes; copy media; slugify title + 6-char suffix; re-publish updates the existing row's
   snapshot + media), `DELETE /api/recipes/:id/publish` (unpublish + delete public media),
   `GET /api/recipes/:id/publish` (status). Map source across versions: a recipe is
   "published" if any chain member matches `sourceRecipeId` — reuse plan 30/33's chain helper.
2. **Public endpoints** (mounted before auth gates):
   - `GET /api/public/recipes?q=&course=&page=` — list/search published recipes (title
     contains + course filter; newest first; page size 20).
   - `GET /api/public/recipes/:slug` — full snapshot.
   - `POST /api/public/recipes/:slug/report` — sets `reported: true` (rate-limit naive: one
     per session is fine; it's a flag for the operator, surfaced nowhere else for now).
3. **Save to collection** (authed): `POST /api/public/recipes/:slug/save` → creates a new
   Recipe (v1) for `req.userId` from the snapshot, `source` set to "Shared by <author> on Let
   Them Cook"; media files copied into the user's media space and rows created; increments
   `saveCount`. The saved copy is fully independent (edits don't relate back).
4. **Author display name**: `User.displayName String?` (new field, settable via the
   preferences endpoint from plan 27); published pages show displayName or "anonymous" — never
   the email.
5. **Frontend**:
   - `pages/DiscoverPage.tsx` (`/discover`, behind login like the rest of the app — the
     *content* is public-API-served, but the v1 UI lives inside the app; truly logged-out
     browsing can ride on plan 30's public page shell later): search box, course filter chips,
     card grid (saveCount badge), detail view reusing read-only recipe components, Save button,
     small Report link.
   - RecipeDetailPage action bar: Publish/Unpublish with state + "view public page".
6. **Tests** (supertest): publish→public-fetch round-trip excludes personalNotes/userId/email;
   re-publish updates snapshot; unpublish 404s the slug and clears media; save creates an owned
   independent copy + increments count; isolation (B can't unpublish A's); public list
   pagination/search. RTL: discover flow renders and saves.

## Acceptance
User A publishes; user B discovers it by search, views images, saves it, edits their copy —
A's original untouched; A unpublishes — slug gone, B's copy remains; A's email appears nowhere.
Spec §8 stretch goal updated.

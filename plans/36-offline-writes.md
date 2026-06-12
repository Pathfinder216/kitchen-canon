# 36 — Offline writes (persisted cache + queued mutations)

**Size:** L | **Depends on:** 01; do 04 first (offline forms need the vocabulary cached) | **Blocks:** 37

## Goal
Spec §7 promises full offline functionality; today only service-worker read caching exists.
Deliver: app opens offline with previously loaded data, and creates/edits made offline queue
and replay when connectivity returns. Scope: **recipes and meal plans** mutations (media upload
stays online-only — show a clear "media uploads need a connection" notice).

## Architecture (decided)

Stay on React Query — no parallel Dexie data layer (that comes with plan 37 if ever):
- **Persisted query cache**: `@tanstack/react-query-persist-client` +
  `@tanstack/query-async-storage-persister` over IndexedDB via `idb-keyval`. The whole query
  cache (recipes, meal plans, meta, ingredients) survives restarts → offline reads of anything
  previously seen.
- **Paused mutations**: React Query's built-in offline mutation support —
  `networkMode: 'offlineFirst'` is wrong for this; use the pause/resume flow:
  mutations configured with default `networkMode: 'online'` pause while offline;
  `resumePausedMutations()` on reconnect + app start (after cache restore). For replays to
  survive a page reload, every mutation used offline needs a **default mutation function**
  registered via `queryClient.setMutationDefaults(key, { mutationFn })` — persisted mutations
  rehydrate by key, not closure.
- **CSRF on replay**: replayed requests can carry a stale token. In `api/client.ts`, on a CSRF
  rejection (read the error the backend returns for bad CSRF — verify its status/shape in
  `middleware/csrf.ts`), re-fetch `GET /api/auth/csrf` once and retry the request once.
- **Conflicts**: last-write-wins (the PATCH that replays later wins). Versioned recipes soften
  this — a replayed recipe edit creates a new version rather than destroying the other edit.
  Accept LWW for meal plans. Document in the PR.

## Implementation

1. Deps: `npm install @tanstack/react-query-persist-client @tanstack/query-async-storage-persister idb-keyval --prefix frontend`.
2. `frontend/src/queryClient.ts`: create the IDB persister; wrap the app in
   `PersistQueryClientProvider` (replaces `QueryClientProvider` in `main.tsx`/`App.tsx`);
   `maxAge` ~7 days; `buster` string bumped on breaking shape changes. ⚠️ Persisted cache is
   per-browser-profile and the app is multi-user: key the persister cache (`buster` or IDB key)
   by the logged-in user id, and **clear it on logout** (`AuthContext` logout path) so user A's
   data never renders for user B on a shared device.
3. Mutation defaults: register `setMutationDefaults` for `['create-recipe']`,
   `['update-recipe']`, `['archive-recipe']`, `['create-meal-plan']`, `['update-meal-plan']`,
   `['toggle-grocery']` with their current mutationFns (refactor `useRecipes.ts`/`useMealPlans.ts`
   hooks to consume the defaults: `useMutation({ mutationKey: [...] })`).
4. Optimistic updates for the offline UX: on mutate, write the expected result into the query
   cache (recipes list + detail) so the user sees their edit immediately; on replay
   success/error, invalidate. Use React Query's `onMutate`/rollback pattern; for offline
   creates, generate a temp id and reconcile on success (map temp → server id in the cache; the
   recipe form navigates by returned id — when offline, navigate to the list instead with a
   "queued" toast, avoiding temp-id routes).
5. Connectivity UX: a small offline banner (listen to `onlineManager`), per-item "pending sync"
   badge on optimistically-written rows (mark them in cache with a `_pending` flag the
   components render subtly), and `resumePausedMutations` + invalidate-all on reconnect.
6. Service worker: existing runtime caching stays (it serves the shell + first-paint data);
   bump the recipes cache pattern if needed so detail pages visited offline come from the
   persisted query cache anyway.
7. **Tests**: this is logic-heavy — cover with vitest:
   - persister round-trip (jsdom + fake-indexeddb or an in-memory storage stub).
   - mutation pauses offline (`onlineManager.setOnline(false)`), resumes and fires on
     reconnect, cache reconciles.
   - CSRF retry-once path in `client.ts` (mock fetch: first 403-CSRF, then ok).
   - logout clears the persisted store.
   Plus a manual checklist in the PR (Chrome DevTools offline: browse → edit → kill tab →
   reopen offline → edit visible + pending → go online → server has it).

## Acceptance
DevTools-offline: app loads, previously seen recipes browsable, recipe edit + meal plan
grocery toggles queue with visible pending state, reconnect syncs them, reload mid-queue
doesn't lose mutations, logout wipes local data. Spec §8's biggest gap closed.

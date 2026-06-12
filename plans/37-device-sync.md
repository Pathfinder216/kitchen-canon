# 37 — Multi-device sync (changelog-based, server as relay)

**Size:** XL — implement in the staged milestones below | **Depends on:** 36 (hard prerequisite)

## Goal (user's framing)
"Instead of a single beefy central server holding all data, a cloud-sync feature where people
store data on their own devices and share it amongst their devices." Implemented as: devices
become first-class replicas with full local data; the existing server remains, demoted to a
**sync relay + one replica** (this preserves login, sharing/publishing, and the Pi deployment
while delivering the device-ownership property; a serverless P2P design would orphan auth,
share links, and import — explicitly rejected).

## Architecture

- **Change log**: every mutation appends a change row; devices pull changes since their last
  cursor and push their local queue. Server stores the log per user and applies changes to its
  own DB (so the server replica stays the source for share links/exports).
  ```prisma
  model Change {
    id        String   @id @default(uuid())
    userId    String
    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    seq       Int      // per-user monotonic sequence, assigned by the server on accept
    deviceId  String
    entity    String   // 'recipe' | 'mealPlan' | 'ingredientCatalog' | 'substitution' | 'localization'
    entityId  String
    op        String   // 'upsert' | 'delete'
    payload   Json     // full entity snapshot (document-level, not field diffs)
    clientTs  DateTime
    createdAt DateTime @default(now())
    @@unique([userId, seq])
    @@index([userId, createdAt])
  }
  ```
- **Granularity & conflicts**: document-level snapshots with last-write-wins by `clientTs`
  (+ deviceId tiebreak). Recipes are naturally conflict-soft: an offline edit creates a new
  *version*, so concurrent edits on two devices yield two versions in one chain (merge =
  parent chain reconciliation: second writer's version is appended after the first; implement
  chain-append rather than reject). Meal plans/catalog entries: plain LWW.
- **Client store**: this milestone graduates the frontend from "React Query cache as truth" to
  a real local store — Dexie (IndexedDB) tables mirroring the entities, with React Query
  reading from Dexie and Dexie syncing with the server. (This is the step where Dexie finally
  earns its place; plan 36's queue keeps working as the push side.)
- `deviceId`: uuid in localStorage, registered implicitly on first sync.

## Milestones (each shippable)

**M1 — server changelog (backend only).** Schema + `POST /api/sync/push`
(`{ deviceId, changes: [...] }` → server validates ownership per entity, assigns `seq`,
applies to DB idempotently — replaying the same change id is a no-op) and `GET
/api/sync/pull?since=<seq>` (returns changes + new cursor, excluding the requesting device's
own changes by default). Server-side appliers per entity reuse existing service create/update
paths where possible. Backfill: a `seq 0` bootstrap = full snapshot endpoint
(`GET /api/sync/bootstrap`). Supertest: push/pull round-trip, idempotent replay, ownership
isolation, LWW application, version-chain append on concurrent recipe edits.

**M2 — write-through.** Existing REST mutations also append Change rows server-side (one
code path: services emit changes; sync push reuses the same appliers). After M2, a device
that only pulls still sees edits made through the normal API.

**M3 — client replica.** Dexie schema + sync engine (`frontend/src/sync/`): pull on
app start/reconnect/interval (60s while active), push = drain plan-36 queue through
`/api/sync/push`. React Query query functions read Dexie first, fall back to REST when the
table is cold. Cursor + deviceId persistence; logout wipes Dexie (extends 36's wipe).

**M4 — UX + hardening.** Sync status indicator (last synced, pending count); conflict
surfacing for recipes ("2 versions were created from concurrent edits" — link to version
history); a settings action "Re-download everything" (reset cursor + bootstrap).

## Acceptance (final)
Two browsers (devices) on one account: edit a recipe offline on A, edit the same recipe on B,
bring both online → both devices converge, version history contains both edits, meal-plan LWW
converges, server export still reflects everything. Each milestone lands green CI.

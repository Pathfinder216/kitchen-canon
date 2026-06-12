# Implementation Plan — Code Review Follow-ups (June 2026)

Plan for the recommendations from the 2026-06-11 codebase/docs review, ordered so each phase
unblocks the next. Each phase is independently shippable; none changes user-facing behavior
except Phase 4 (which makes localization user-extensible).

Already done: docs reconciled with the code, `backend/ecosystem.config.cjs` deleted.

---

## Phase 1 — Fix the 12 failing frontend tests

**Why first:** CI (Phase 2) is pointless while the suite is red. Current state: 42 pass,
12 fail across 2 files. Both failures are test-side staleness, not product bugs.

### 1a. RecipeForm.test.tsx — 11 failures, one root cause

All 11 fail with `Error: No QueryClient set, use QueryClientProvider to set one` thrown from
`RecipeForm.tsx:163` (`useQueryClient()`, added when the form gained catalog-backed ingredient
typeahead via `useIngredientNames()`). The tests render with only `MemoryRouter`
(`RecipeForm.test.tsx:7-13`).

Steps:
1. Create a shared render helper `frontend/src/test/utils.tsx`:
   ```tsx
   export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
     const queryClient = new QueryClient({
       defaultOptions: { queries: { retry: false, gcTime: Infinity } },
     });
     return render(
       <QueryClientProvider client={queryClient}>
         <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
       </QueryClientProvider>,
     );
   }
   ```
   A fresh `QueryClient` per test prevents cross-test cache bleed.
2. Switch `renderForm()` in `RecipeForm.test.tsx` to use it. `useIngredientNames()` falls back
   to the static list while loading, so no fetch mocking is needed; if any test triggers a real
   fetch, stub `global.fetch` in `src/test/setup.ts` to return an empty-list response rather
   than mocking per-test.
3. Migrate the other test files (`CookModePage`, `MealHistoryPage`, `App`, `GroceryList`,
   `RecipeCard`) to the same helper where they currently build providers by hand — pure
   consolidation, do it opportunistically.

### 1b. CookModePage.test.tsx — "shows timer for passive time steps"

The test asserts `getByText(/10m/)` but the current UI renders the duration as
`10 min (passive)` (`CookModePage.tsx:458`) and the timer countdown via `formatTime()` as
`10:00` (`CookModePage.tsx:72,152`). The assertion predates the timer redesign.

Steps:
1. Confirm intent: the test should verify a passive step exposes a startable timer. Assert on
   the `Start timer` button (`CookModePage.tsx:171`) and/or `10:00`, plus `10 min (passive)`.
2. While in the file, check the sibling test "does not show timer for active time steps" still
   encodes the intended rule (timers only auto-offered for passive steps).

**Acceptance:** `npm test --prefix frontend` → 54/54 pass. Backend suite still green
(`npm test --prefix backend`, ~92 tests).

**Effort:** small — an hour or two.

---

## Phase 2 — CI with GitHub Actions

**Why:** 130+ tests exist but only run when someone remembers. The repo has no
`.github/workflows/`.

Steps:
1. Add `.github/workflows/ci.yml`, triggered on `push` to `master` and on `pull_request`:
   - **backend job** (ubuntu-latest, Node 20, `cache: npm` keyed on `backend/package-lock.json`):
     `npm ci` → `npx prisma generate` → `npm test`. The test setup creates its own temp SQLite
     DB via `prisma db push` (`src/__tests__/setup.ts`), so no DB service or env is needed —
     except `SESSION_SECRET`, which config.ts requires: set a dummy 32+ char value in the job's
     `env`. Check whether setup.ts already sets one; if it does, nothing to add.
   - **frontend job**: `npm ci` → `npm test` → `npm run build` (the build catches TS errors
     that vitest's transform tolerates).
   - **docker job** (optional, on master only): `docker build .` to catch Dockerfile drift —
     it's the production artifact and nothing else exercises it. Use
     `docker/build-push-action` with `push: false` and GHA layer cache.
2. Line endings: `.gitattributes` already pins LF, so Linux runners are fine.
3. Add a status badge to `README.md`.

**Acceptance:** a PR with a failing test or TS error shows a red check.

**Effort:** small. Do immediately after Phase 1.

---

## Phase 3 — Make the deploy script's data copy opt-in

**Why:** `scripts/deploy-to-pi.sh:33-43` unconditionally copies the dev machine's
`data/database.db` and media into the running container on *every* deploy. With multi-user
signup live on the Pi, the first redeploy after anyone registers there would silently destroy
their account and data.

Steps:
1. Move the two copy blocks behind a `--with-data` flag (parse before the positional
   `user@host` arg, or after — keep `$1` handling simple).
2. Under `--with-data`, require confirmation: print a warning that the Pi's database will be
   **overwritten**, and check whether a DB already exists in the container
   (`docker compose exec app test -f /app/data/database.db`); if it does, require an
   interactive `yes` (or a second flag `--force` for non-interactive use).
3. Default path (no flag) prints: "Skipping data copy — pass --with-data to seed the Pi from
   this machine's data/".
4. Optional but recommended while touching the script: add a `backup` companion that pulls a
   timestamped copy of the Pi's DB to the dev machine before any overwrite
   (`docker compose cp app:/app/data/database.db backups/pi-$(date +%F).db`). The backend
   already has `db:backup`/`db:restore` npm scripts for the local DB; this is the Pi-side
   equivalent.
5. Update the deploy section of `architecture.md` (it currently documents the unconditional
   copy and flags it as a risk — replace with the new flag semantics).

**Acceptance:** plain `./scripts/deploy-to-pi.sh user@host` redeploys without touching Pi data;
`--with-data` warns before overwriting an existing DB.

**Effort:** small. Independent of Phases 1–2.

---

## Phase 4 — Single source of truth for shared vocabulary

Two duplications exist between the halves of the app. Same theme, different fixes.

### 4a. Dietary tags (`ALLERGENS` / `DIETS` / label maps)

`frontend/src/constants/dietaryTags.ts` hand-mirrors `backend/src/constants/dietaryTags.ts`
(used by 5 frontend files). If the backend adds an allergen, the frontend silently won't show
it in filters or the classify panel.

Recommended approach — serve from the API with a static fallback (matches the existing
`useIngredientNames()` pattern):
1. Backend: add `GET /api/meta` returning
   `{ allergens, diets, allergenLabels, dietLabels }` straight from the backend constants.
   Trivial route, no service needed; mount with the other authed routes.
2. Frontend: add `useDietaryTags()` (React Query, `staleTime: Infinity`) that falls back to the
   current static constants while loading. Keep `constants/dietaryTags.ts` as the documented
   fallback mirror.
3. Add `/api/meta` to the service-worker runtime cache list in `vite.config.ts` (the
   NetworkFirst group) so the vocabulary is available offline.
4. Migrate the 5 consumers (`FilterPanel`, `ClassifyIngredientsPanel`, `RecipeForm`,
   `IngredientsPage`, `MealPlanDetailPage`) from constant imports to the hook. The two
   label-map consumers can take the maps as a hook return value with the same shape — small
   diffs.
5. CI guard for the remaining mirror: a 20-line node script at root
   (`scripts/check-constant-mirrors.mjs`) that imports both files (via `tsx`) and deep-compares;
   wire into the frontend CI job. This protects the fallback from drifting even though the
   live UI no longer depends on it.

Cheaper alternative if the API endpoint feels heavy: skip steps 1–4 and adopt only step 5
(CI mirror check). That eliminates the *risk* without eliminating the duplication. The npm
workspace / shared-package route is **not** recommended: backend `tsc` rootDir constraints and
the multi-stage Dockerfile (which `npm ci`s each package independently) make it the most
invasive option for the least gain.

### 4b. Ingredient localization — implement or delete `LocalizationMapping`

Current state: the Prisma model `LocalizationMapping` (schema.prisma:164, with per-user
nullable owner and `User.localizations` relation) has **zero** code references — no route, no
service, no seed. The real implementation is `frontend/src/utils/ingredientAliases.ts`: a
static ~50-pair US/UK map used by `GroceryList`, `IngredientList`, `CookModePage`, and
`RecipeDetailPage` via `getIngredientAlias(name)`.

Recommended: implement the model (it's designed, spec §2 calls for user localization, and the
global+private ownership pattern is already established by catalog/aliases/labels):
1. Seed: convert `ALIAS_PAIRS` from the frontend file into global `LocalizationMapping` rows in
   `backend/prisma/seed.ts` (locale pairs like `en-US`/`en-GB`; the current data is
   direction-agnostic display aliases, so either model both directions as rows or keep a single
   `originalName → localizedName` row per direction as the schema implies). Follow the seed's
   existing findFirst+create pattern — compound uniques with null `userId` can't be upserted
   under SQLite.
2. Backend: `GET /api/localizations` (all rows visible to the user: `userId IS NULL OR userId
   = me`), plus `POST` and `DELETE /:id` for private additions — mirror
   `routes/substitutions.ts`, which has identical ownership semantics, including its tests.
3. Frontend: `useIngredientAliases()` hook fetching once (`staleTime: Infinity`); refactor
   `getIngredientAlias(name)` to `getIngredientAlias(name, aliasMap)` keeping the existing
   whole-word `containsPhrase` matching, with the static `ALIAS_PAIRS` as the loading-state
   fallback. The four consumers all sit inside components that already use React Query, so
   threading the map in is mechanical.
4. UI for managing private mappings can wait; the API existing is enough for now. Add a note in
   `specification.md` §2 status when shipped.
5. Add `/api/localizations` to the service-worker cache list (same reason as 4a).

If you'd rather not invest here yet, the honest alternative is to **delete the model** (and the
`User.localizations` relation) so the schema stops advertising a feature that doesn't exist —
it can be re-added when wanted. Keeping unused schema is how the docs drifted last time.

**Effort:** 4a small-to-medium; 4b medium (~half a day with tests).

---

## Phase 5 — Decompose the oversized frontend components (+ a11y)

**Why:** Four files hold most of the UI complexity; they work, but every new feature lands in
them, and the hand-rolled overlays have no focus management. Current line counts:
`RecipeForm.tsx` 1046, `MealPlanFormPage.tsx` 712, `CookModePage.tsx` 546,
`RecipeDetailPage.tsx` 503.

Ground rules: behavior-preserving extractions only, one file per PR, existing tests must pass
unchanged (they will be green after Phase 1 and enforced by Phase 2 — do not start Phase 5
before both).

### 5a. Shared primitives first (enables everything else)

1. Extract a shared `components/ui/Modal.tsx` from the inline overlay divs (e.g.
   `RecipeDetailPage.tsx:203-228`) and a `components/ui/Menu.tsx` from the inline dropdown
   (`RecipeDetailPage.tsx:401-437`).
2. Decision point — two viable implementations:
   - **Headless UI** (`@headlessui/react`): focus trap, escape/outside-click, aria wiring for
     free; one small dependency; architecture.md originally planned it.  ← recommended
   - Hand-rolled with explicit a11y: `role="dialog"`, `aria-modal`, focus trap, Escape handling,
     focus restore. More code to own, zero deps.
3. Either way, every overlay in the app goes through these two components afterward — that is
   the actual a11y fix; the primitives are just the vehicle.

### 5b. `RecipeForm.tsx` (1046 → target ~300 + extracted modules)

- `useRecipeFormState.ts` — the form reducer/state: seed-from-`initialData ?? importData`,
  field updates, submit payload assembly.
- `IngredientsEditor.tsx` — ingredient rows, add/remove, drag-to-reorder handles, catalog
  typeahead (`ComboInput` usage).
- `StepsEditor.tsx` — step rows, add/remove/reorder, per-step time + active/passive toggle,
  `StepMedia` slots.
- `RecipeMetaFields.tsx` — title/servings/source/notes, courses + labels pickers (the
  dietary-tag UI migrates to the Phase 4a hook).
- The existing 11 RecipeForm tests are the safety net; they test through the public interface
  (labels, placeholders, buttons) so extractions shouldn't touch them. Add small focused tests
  for `useRecipeFormState` (seeding precedence, payload shape) — cheap and they pin the
  riskiest logic.

### 5c. `MealPlanFormPage.tsx` (712)

Extract: `PlanDetailsFields` (name/date/time/notes), `DietaryFilterBar` (the restriction
filters at :450-466), and reuse `RecipeSelector` more aggressively for the pick-list (some
selection UI is inlined in the page today). Add a `useMealPlanForm` hook if the state threading
is still messy after extraction.

### 5d. `CookModePage.tsx` (546)

The timer system (~lines 72-340: `formatTime`, timer cards, running-timers panel, Web Audio
beep) is self-contained — extract `useStepTimers.ts` + `TimerPanel.tsx`. Then `StepCard.tsx`
(instruction + `resolveIngredientRefs` rendering + media) and `IngredientChecklist.tsx`. The 11
CookModePage tests cover timers well; they're the regression net.

### 5e. `RecipeDetailPage.tsx` (503)

Extract `SubstitutionsMenu` (the :390-439 dropdown → Phase 5a `Menu`), `DietaryInfoBadges`,
and the archive/delete confirm flow (→ `Modal`). Keep the existing outer/inner page split
(it exists to avoid hooks-after-early-return).

**Sequencing within Phase 5:** 5a → 5b (worst offender) → 5d (clearest seams) → 5c → 5e.
Each is a separate PR reviewed against "no behavior change".

**Effort:** 5a small; 5b medium-large; 5c/5d/5e medium each. Spread over multiple sessions.

---

## Explicitly out of scope here

Feature gaps tracked in `specification.md` §8 Implementation Status (offline writes, wake lock,
share links, schema.org export, OCR, component recipes, cooking timeline) — those are product
work, not review follow-ups. The one interaction to note: if offline writes get scheduled,
do Phase 4 first (its API-served vocabulary needs to be in the service-worker cache for
offline forms to render correctly).

## Suggested order of execution

| # | Item | Size | Unblocks |
|---|------|------|----------|
| 1 | Phase 1 test fixes | S | CI |
| 2 | Phase 2 GitHub Actions | S | safe refactoring |
| 3 | Phase 3 deploy `--with-data` flag | S | safe redeploys (do before next Pi deploy) |
| 4 | Phase 4a dietary tags via API + mirror check | S–M | 5b |
| 5 | Phase 4b localization model decision | M | — |
| 6 | Phase 5 component decomposition + a11y | L | future feature velocity |

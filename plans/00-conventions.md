# 00 — Conventions (read this before implementing any plan)

Every plan in this directory assumes the implementer has read this file. It captures the
codebase's load-bearing patterns and the traps that have bitten before.

## Layout & commands

- `backend/` — Express + Prisma + SQLite. `frontend/` — React 19 + Vite + Tailwind 4 + TanStack Query 5.
- Dev: `npm run dev` at repo root (concurrently runs both; Vite :5173 proxies `/api` and `/media` to backend on :3000 — `backend/.env` must set `PORT=3000` and a 32+ char `SESSION_SECRET`).
- Backend tests: `npm test --prefix backend` (Vitest + Supertest; `src/__tests__/setup.ts` creates a temp SQLite DB via `prisma db push`).
- Frontend tests: `npm test --prefix frontend` (Vitest + RTL, jsdom).
- Schema change procedure: edit `backend/prisma/schema.prisma` → `npx prisma generate` → `npm run db:push --prefix backend`. There are **no migration files**; prod applies schema via `prisma db push` in `backend/docker-entrypoint.sh`. If the change involves seeded/global data, also update `backend/prisma/seed.ts` and run `npm run db:seed --prefix backend`.
- `prisma db push --force-reset` is interactive-blocked for agents (requires `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`). Don't design around needing it.

## Backend patterns

- Routes are thin: `asyncHandler` wrapper + `validate(zodSchema)` middleware + service call. See `backend/src/routes/ingredients.ts` for the canonical shape. Errors: `throw new AppError(status, message)`.
- Services take `userId` as the **first argument**. Ownership reads use `where: { id, userId }` and return 404 (never 403) on a miss. Global+private tables use `where: { OR: [{ userId: null }, { userId }] }` with the user's own row preferred on ties.
- Request schemas live in `backend/src/schemas/`; constants in `backend/src/constants/`.
- New routers are mounted in `backend/src/app.ts`. Everything mounted under `/api` after line ~50 is behind CSRF + `requireAuth`. **Public routes must be mounted before those gates** (like `/api/auth`).
- SQLite gotchas: no `mode: 'insensitive'` — normalize to lowercase instead. NULL is distinct in unique indexes, so compound uniques with nullable `userId` can't upsert/dedupe globals — use `findFirst` + `create` (see `seed.ts:137-141`).
- **Recipe versioning is row-copy**: `PATCH /api/recipes/:id` creates a brand-new `Recipe` row (new id) and copies ingredients/steps/labels/courses; restore does the same from an old version. ⚠️ When you add a field to `Recipe`, `Ingredient`, or `Step`, you MUST update the copy logic in `backend/src/services/recipe.service.ts` (create, update, and restore paths) or the field silently vanishes on the next edit. Also update: the Zod schemas, the import parser's output mapping (`import.service.ts`) if importable, frontend types in `frontend/src/types/`, and `RecipeForm`.
- Backend test helpers: `createAuthedApi(app)` from `src/__tests__/helpers/auth.ts` returns an authed supertest agent that auto-attaches the CSRF header; `cleanupUsers()` cascade-deletes users between tests. Clean tables in FK-safe order in `beforeEach`.

## Frontend patterns

- `src/api/client.ts` prepends `/api` — API module paths must NOT include `/api` (double-prefix = 404). Exception: raw `fetch()` for multipart uploads uses full `/api/...` paths and no JSON content-type.
- CSRF is handled inside `client.ts`; never hand-roll it.
- React Query keys in use: `['recipes']`, `['recipe', id]`, `['ingredients']`, `['recipe-dietary', id]`, `['meal-plans']`, `['cover-photo', id]`, etc. After a mutation, invalidate every key whose data the mutation affects — stale-banner bugs come from missing invalidations.
- Component tests render via the shared provider helper (`src/test/utils.tsx`, created by plan 01). Don't render query-using components with only `MemoryRouter`.
- Number inputs that users may want to clear use **string state** parsed on submit (see `RecipeForm.tsx:169` servings). Follow that pattern; never bind a number input directly to numeric state.
- `RecipeDetailPage` splits into an outer loading component + inner hooks component to avoid hooks-after-early-return. Preserve that shape when editing it.

## Definition of done (every plan)

1. All backend and frontend tests pass; both `npm run build`s succeed.
2. New behavior has tests (backend: supertest suite; frontend: RTL where there's logic worth pinning).
3. If the plan ships a user-facing feature: update the Implementation Status section in `specification.md`, and `architecture.md` if it adds models/routes/dependencies.
4. Check the plan off in `plans/README.md`.
5. Open a PR from a branch (`gh pr create`). Follow the PR template's title guidance and suffix the title with "(plan NN)", e.g. "Keep the screen awake in cook mode (plan 17)".

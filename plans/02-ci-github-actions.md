# 02 — GitHub Actions CI

**Size:** S | **Depends on:** 01 (suite must be green) | **Blocks:** safe refactoring everywhere

## Goal
Every push to `master` and every PR runs backend tests, frontend tests + build, and (on master)
a Docker image build. A red check means broken code.

## Implementation

1. Create `.github/workflows/ci.yml` with three jobs (all `ubuntu-latest`, Node 20 via
   `actions/setup-node` with `cache: npm` and the matching `cache-dependency-path`):
   - **backend**: working-directory `backend`; steps: `npm ci` → `npx prisma generate` →
     `npm test`. Check `backend/src/__tests__/setup.ts` first: it creates its own temp SQLite
     DB, but `config.ts` hard-requires `SESSION_SECRET` (≥32 chars) — if setup.ts doesn't set
     one, add `SESSION_SECRET: ci-only-dummy-secret-0123456789abcdef` to the job `env`.
   - **frontend**: working-directory `frontend`; `npm ci` → `npm test` → `npm run build`
     (build catches TS errors vitest tolerates).
   - **docker** (only `if: github.ref == 'refs/heads/master'`): `docker/build-push-action`
     with `push: false` and GHA cache (`cache-from/to: type=gha`) — the Dockerfile is the
     production artifact and nothing else exercises it.
2. `.gitattributes` already pins LF, so Linux runners are fine — no line-ending work needed.
3. Add a workflow status badge to the top of `README.md`.

## Acceptance
- Workflow passes on master.
- Verify failure detection: in a scratch branch, break one test, confirm the check goes red,
  then delete the branch.

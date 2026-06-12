# 03 — Make the deploy script's data copy opt-in

**Size:** S | **Depends on:** nothing | **Do before the next Pi deploy**

## Goal
`scripts/deploy-to-pi.sh` stops silently overwriting the Pi's database. Today lines 33-43
unconditionally `docker compose cp` the dev machine's `data/database.db` and `data/media/` into
the running container on **every** deploy — with signup live on the Pi, any redeploy would
destroy accounts created there.

## Implementation

1. Add flag parsing to `scripts/deploy-to-pi.sh`. Supported invocations:
   - `./scripts/deploy-to-pi.sh user@host` — deploy only; prints
     `Skipping data copy — pass --with-data to seed the Pi from this machine's data/`.
   - `./scripts/deploy-to-pi.sh --with-data user@host` — deploy + copy, with guard (below).
   - `--with-data --force` — skip the interactive guard (non-interactive use).
2. Guard for `--with-data`: before copying, check whether a DB already exists in the container:
   `ssh "$PI_HOST" "cd ~/let-them-cook && docker compose exec -T app test -f /app/data/database.db"`.
   If it exists and `--force` wasn't given: print a clear warning that the Pi DB (and any
   accounts on it) will be **overwritten**, take a timestamped backup to the dev machine first
   (`backups/pi-$(date +%Y%m%d-%H%M%S).db` via `docker compose cp app:/app/data/database.db`),
   then require typed `yes` on stdin to proceed. `backups/` should be added to `.gitignore`.
3. Keep the existing tar-sync, `.env` generation, and `docker compose up --build -d` steps
   untouched.
4. Update the "Deploying" subsection of `architecture.md` — it currently documents the
   unconditional copy and flags it as a risk; replace with the new flag semantics.

## Testing
No CI hook for this (it needs a Pi). Verify by review + `bash -n scripts/deploy-to-pi.sh`, and
dry-run the flag parsing locally by temporarily stubbing the ssh/scp commands with `echo`
(don't commit the stubs).

## Acceptance
- Plain invocation never touches Pi data.
- `--with-data` against a Pi with an existing DB backs up, warns, and requires confirmation.

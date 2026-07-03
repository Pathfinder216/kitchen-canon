#!/bin/bash
# Deploy Kitchen Canon to Raspberry Pi via Docker.
# Usage: ./scripts/deploy-to-pi.sh [--with-data [--force]] user@host [--invite-code CODE]
set -e

USAGE="Usage: ./scripts/deploy-to-pi.sh [--with-data [--force]] user@host [--invite-code CODE]"

# The SSH target is positional; --invite-code optionally sets/rotates the signup invite code.
# --with-data copies this machine's data/ into the Pi container (off by default so a redeploy
# never silently overwrites accounts created on the Pi); --force skips the interactive guard.
INVITE_CODE=""
PI_HOST=""
WITH_DATA=false
FORCE=false
while [ $# -gt 0 ]; do
  case "$1" in
    --invite-code)
      [ $# -ge 2 ] || { echo "Error: --invite-code requires a value" >&2; exit 1; }
      INVITE_CODE="$2"; shift 2 ;;
    --invite-code=*) INVITE_CODE="${1#*=}"; shift ;;
    --with-data) WITH_DATA=true; shift ;;
    --force) FORCE=true; shift ;;
    *) PI_HOST="$1"; shift ;;
  esac
done
: "${PI_HOST:?$USAGE}"
if [ "$FORCE" = true ] && [ "$WITH_DATA" != true ]; then
  echo "Error: --force only applies with --with-data" >&2; exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="$ROOT/data/database.db"
MEDIA_PATH="$ROOT/data/media"

echo "==> Checking for a pre-rename deploy to migrate..."
# One-time migration from the pre-rename layout (the app was called Let Them Cook). The compose
# project name — and therefore the data volume name — derives from the deploy directory, so the
# old stack must be stopped, the directory moved, and the volume contents copied to the new name.
# Both steps are guarded, so this is a no-op once migrated (or on a fresh Pi).
ssh "$PI_HOST" 'bash -s' <<'REMOTE'
set -e
if [ -d ~/let-them-cook ] && [ ! -d ~/kitchen-canon ]; then
  echo "   Migrating ~/let-them-cook -> ~/kitchen-canon"
  (cd ~/let-them-cook && docker compose down) || true
  mv ~/let-them-cook ~/kitchen-canon
fi
if docker volume inspect let-them-cook_data >/dev/null 2>&1 \
   && ! docker volume inspect kitchen-canon_data >/dev/null 2>&1; then
  echo "   Copying data volume let-them-cook_data -> kitchen-canon_data"
  docker volume create kitchen-canon_data >/dev/null
  docker run --rm -v let-them-cook_data:/from:ro -v kitchen-canon_data:/to alpine cp -a /from/. /to/
  echo "   Old volume kept as a backup; remove later with: docker volume rm let-them-cook_data"
fi
REMOTE

echo "==> Syncing project to Pi..."
# Exclude .env so we never clobber the Pi's secret (and never ship a local one).
tar -C "$ROOT" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='backend/dist' \
  --exclude='frontend/dist' \
  --exclude='data' \
  --exclude='.env' \
  -czf - . \
  | ssh "$PI_HOST" 'mkdir -p ~/kitchen-canon && tar -xzf - -C ~/kitchen-canon'

echo "==> Ensuring auth secret exists on the Pi..."
# docker compose reads ~/kitchen-canon/.env for SESSION_SECRET (generated on first deploy) and
# SIGNUP_INVITE_CODE, which gates registration (the app is internet-facing). Pass --invite-code to
# set/rotate it; otherwise a random one is generated on first deploy and any existing value is kept.
# COOKIE_SECURE=true because the app is fronted by the host's nginx HTTPS reverse proxy.
ssh "$PI_HOST" 'bash -s' "$INVITE_CODE" <<'REMOTE'
set -e
INVITE_CODE="$1"
cd ~/kitchen-canon
if [ ! -f .env ]; then
  CODE="${INVITE_CODE:-$(openssl rand -hex 8)}"
  printf "SESSION_SECRET=%s\nCOOKIE_SECURE=true\nSIGNUP_INVITE_CODE=%s\nAPP_DOMAIN=\n" "$(openssl rand -hex 32)" "$CODE" > .env
  echo "   Generated a new .env with a random SESSION_SECRET"
  echo "   >>> Signup invite code (share with intended users): $CODE"
  echo "   >>> Set APP_DOMAIN in ~/kitchen-canon/.env to the DuckDNS name and configure the nginx vhost + certbot for it."
else
  echo "   .env already present"
  if [ -n "$INVITE_CODE" ]; then
    # Replace the SIGNUP_INVITE_CODE line (or add it) without touching SESSION_SECRET or others.
    grep -v '^SIGNUP_INVITE_CODE=' .env > .env.tmp || true
    printf "SIGNUP_INVITE_CODE=%s\n" "$INVITE_CODE" >> .env.tmp
    mv .env.tmp .env
    echo "   >>> Updated signup invite code to: $INVITE_CODE"
  fi
fi
REMOTE

echo "==> Building and starting containers..."
ssh "$PI_HOST" "cd ~/kitchen-canon && docker compose up --build -d"

if [ "$WITH_DATA" != true ]; then
  echo "==> Skipping data copy — pass --with-data to seed the Pi from this machine's data/"
else
  # Guard: if the Pi already has a database, copying would overwrite it (and any accounts
  # created on the Pi). Back it up to this machine and require confirmation, unless --force.
  if [ "$FORCE" != true ] && \
     ssh "$PI_HOST" "cd ~/kitchen-canon && docker compose exec -T app test -f /app/data/database.db" 2>/dev/null; then
    echo ""
    echo "!! WARNING: the Pi already has a database at /app/data/database.db."
    echo "!! Copying --with-data will OVERWRITE it, destroying any accounts created on the Pi."
    mkdir -p "$ROOT/backups"
    BACKUP="$ROOT/backups/pi-$(date +%Y%m%d-%H%M%S).db"
    echo "==> Backing up the Pi database to $BACKUP first..."
    ssh "$PI_HOST" "cd ~/kitchen-canon && docker compose cp app:/app/data/database.db /tmp/kc-pi-backup.db"
    scp "$PI_HOST:/tmp/kc-pi-backup.db" "$BACKUP"
    ssh "$PI_HOST" "rm -f /tmp/kc-pi-backup.db"
    printf "Type 'yes' to overwrite the Pi database: "
    read -r CONFIRM
    [ "$CONFIRM" = "yes" ] || { echo "Aborted — Pi data left untouched."; exit 1; }
  fi

  if [ -f "$DB_PATH" ]; then
    echo "==> Copying database into container..."
    scp "$DB_PATH" "$PI_HOST:/tmp/kitchen-canon-db.db"
    ssh "$PI_HOST" "cd ~/kitchen-canon && docker compose cp /tmp/kitchen-canon-db.db app:/app/data/database.db && rm /tmp/kitchen-canon-db.db"
  fi

  if [ -d "$MEDIA_PATH" ]; then
    echo "==> Copying media into container..."
    scp -r "$MEDIA_PATH" "$PI_HOST:/tmp/kitchen-canon-media"
    ssh "$PI_HOST" "cd ~/kitchen-canon && docker compose cp /tmp/kitchen-canon-media/. app:/app/data/media && rm -rf /tmp/kitchen-canon-media"
  fi
fi

echo ""
APP_DOMAIN="$(ssh "$PI_HOST" 'cd ~/kitchen-canon && grep -E "^APP_DOMAIN=" .env 2>/dev/null | cut -d= -f2-')"
if [ -n "$APP_DOMAIN" ]; then
  echo "Deployed! App is live at https://$APP_DOMAIN (via the nginx reverse proxy)."
else
  echo "Deployed! Set APP_DOMAIN in the Pi's .env and configure the nginx vhost to serve it over HTTPS."
fi

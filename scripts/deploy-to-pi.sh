#!/bin/bash
# Deploy Let Them Cook to Raspberry Pi via Docker.
# Usage: ./scripts/deploy-to-pi.sh user@host
set -e

PI_HOST="${1:?Usage: ./scripts/deploy-to-pi.sh user@host}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="$ROOT/data/database.db"
MEDIA_PATH="$ROOT/data/media"

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
  | ssh "$PI_HOST" 'mkdir -p ~/let-them-cook && tar -xzf - -C ~/let-them-cook'

echo "==> Ensuring auth secret exists on the Pi..."
# docker compose reads ~/let-them-cook/.env for SESSION_SECRET. Generate one on first deploy.
# COOKIE_SECURE=true because the app is fronted by the host's nginx HTTPS reverse proxy.
ssh "$PI_HOST" 'cd ~/let-them-cook && if [ ! -f .env ]; then \
  printf "SESSION_SECRET=%s\nCOOKIE_SECURE=true\nAPP_DOMAIN=\n" "$(openssl rand -hex 32)" > .env; \
  echo "   Generated a new .env with a random SESSION_SECRET"; \
  echo "   >>> Set APP_DOMAIN in ~/let-them-cook/.env to the DuckDNS name and configure the nginx vhost + certbot for it."; \
else echo "   .env already present"; fi'

echo "==> Building and starting containers..."
ssh "$PI_HOST" "cd ~/let-them-cook && docker compose up --build -d"

if [ -f "$DB_PATH" ]; then
  echo "==> Copying database into container..."
  scp "$DB_PATH" "$PI_HOST:/tmp/let-them-cook-db.db"
  ssh "$PI_HOST" "cd ~/let-them-cook && docker compose cp /tmp/let-them-cook-db.db app:/app/data/database.db && rm /tmp/let-them-cook-db.db"
fi

if [ -d "$MEDIA_PATH" ]; then
  echo "==> Copying media into container..."
  scp -r "$MEDIA_PATH" "$PI_HOST:/tmp/let-them-cook-media"
  ssh "$PI_HOST" "cd ~/let-them-cook && docker compose cp /tmp/let-them-cook-media/. app:/app/data/media && rm -rf /tmp/let-them-cook-media"
fi

echo ""
APP_DOMAIN="$(ssh "$PI_HOST" 'cd ~/let-them-cook && grep -E "^APP_DOMAIN=" .env 2>/dev/null | cut -d= -f2-')"
if [ -n "$APP_DOMAIN" ]; then
  echo "Deployed! App is live at https://$APP_DOMAIN (via the nginx reverse proxy)."
else
  echo "Deployed! Set APP_DOMAIN in the Pi's .env and configure the nginx vhost to serve it over HTTPS."
fi

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
ssh "$PI_HOST" 'cd ~/let-them-cook && if [ ! -f .env ]; then \
  printf "SESSION_SECRET=%s\nCOOKIE_SECURE=false\n" "$(openssl rand -hex 32)" > .env; \
  echo "   Generated a new .env with a random SESSION_SECRET"; \
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
echo "Deployed! App is live at http://$(echo "$PI_HOST" | cut -d@ -f2):8080"

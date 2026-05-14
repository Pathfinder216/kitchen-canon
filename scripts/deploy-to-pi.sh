#!/bin/bash
# Deploy Let Them Cook to Raspberry Pi via Docker.
# Usage: ./scripts/deploy-to-pi.sh user@host
set -e

PI_HOST="${1:?Usage: ./scripts/deploy-to-pi.sh user@host}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Syncing project to Pi..."
tar -C "$ROOT" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='backend/dist' \
  --exclude='frontend/dist' \
  --exclude='data' \
  -czf - . \
  | ssh "$PI_HOST" 'mkdir -p ~/let-them-cook && tar -xzf - -C ~/let-them-cook'

echo "==> Building and starting containers..."
ssh "$PI_HOST" "cd ~/let-them-cook && docker compose up --build -d"

echo ""
echo "Deployed! App is live at http://$(echo "$PI_HOST" | cut -d@ -f2):8080"

#!/bin/sh
set -e
echo "==> Applying database schema..."
npx prisma db push
echo "==> Seeding ingredient catalog..."
node dist/prisma/seed.js
echo "==> Starting server..."
exec node dist/server.js

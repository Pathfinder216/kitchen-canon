# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:24-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build backend (compile TS + seed script) ────────────────────────
FROM node:24-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
# Generate the Prisma client before copying the rest of the source so this layer stays cached
# across pushes (it only busts when the schema/config or deps change, not on every code edit).
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./
RUN npx prisma generate
COPY backend/ ./
RUN npm run build

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:24-alpine
WORKDIR /app/backend

# Production deps only (prisma CLI included — it's in dependencies)
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Generate the Prisma client for this platform. Done before copying the compiled output so the
# generate layer only busts when the schema/config or deps change — not on every code push.
COPY --from=backend-build /app/backend/prisma ./prisma
COPY backend/prisma.config.ts ./
RUN npx prisma generate

# Compiled backend + built frontend (served as static files by Express in production). These
# change every push, so they come last to keep the cacheable layers above untouched.
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

COPY backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Run as the unprivileged `node` user (uid 1000, ships with the alpine base) instead of root.
# /app/data must exist and be node-owned BEFORE the named volume mounts over it — a fresh volume
# inherits ownership from the image path on first use, so this is what lets the app write the
# SQLite DB and uploaded media once the volume is attached.
RUN mkdir -p /app/data && chown -R node:node /app/data /app/backend /app/frontend
USER node

ENV NODE_ENV=production
EXPOSE 8080
ENTRYPOINT ["./docker-entrypoint.sh"]

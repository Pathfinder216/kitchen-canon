# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build backend (compile TS + seed script) ────────────────────────
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app/backend

# Production deps only (prisma CLI included — it's in dependencies)
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Compiled backend + seed
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/prisma ./prisma
COPY backend/prisma.config.ts ./

# Generate Prisma client for this platform
RUN npx prisma generate

# Built frontend — served as static files by Express in production
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

COPY backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 8080
ENTRYPOINT ["./docker-entrypoint.sh"]

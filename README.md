# Let Them Cook

[![CI](https://github.com/Pathfinder216/let-them-cook/actions/workflows/ci.yml/badge.svg)](https://github.com/Pathfinder216/let-them-cook/actions/workflows/ci.yml)

A personal recipe management app for collecting, organizing, and cooking from your recipe collection. Self-hosted, offline-capable, and designed for use on both mobile and desktop.

## Features

- **User accounts** — self-service signup and login; each user has their own private recipes, meal plans, and grocery lists, with a shared global ingredient catalog they can supplement privately
- **Recipe management** — add, edit, and organize recipes with ingredients, steps, timing, and notes
- **Import** — import recipes from food blog URLs or uploaded files (PDF, DOCX, images)
- **Cook mode** — distraction-free step-by-step interface with passive-time countdown timers that persist across steps
- **Serving scaling** — scale ingredient amounts to any number of servings
- **Meal planning** — select recipes for a meal and get a consolidated grocery list
- **Search & filter** — find recipes by title, ingredients, labels, or categories
- **Ingredient substitutions** — view substitution options for individual ingredients
- **Version history** — every edit creates a new version; restore any previous version
- **Export** — download recipes as plain text or JSON
- **Offline-capable** — works without internet after initial load

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v24 (matches CI and the Docker image; v20.19+ is the floor for the Vite 7 build)

### Setup

1. **Install dependencies**

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Configure the backend environment**

   Create `backend/.env` (used for local dev):

   ```env
   NODE_ENV=development
   PORT=3000
   DATABASE_URL="file:../data/database.db"
   MEDIA_STORAGE_PATH="../data/media"
   # Required: signs the session + CSRF cookies (min 32 chars). Generate with: openssl rand -hex 32
   SESSION_SECRET="change-me-to-a-long-random-string-at-least-32-chars"
   ```

3. **Initialize the database**

   ```bash
   cd backend
   npm run db:push
   npm run db:seed
   ```

4. **Start the app**

   ```bash
   npm run dev
   ```

   This runs the frontend and backend concurrently. Alternatively, you can use two terminals to run each one by itself:

   1. **Backend**

      ```bash
      cd backend
      npm run dev
      ```

   2. **Frontend**

      ```bash
      cd frontend
      npm run dev
      ```

   The API server starts on `http://localhost:3000`. The frontend server is probably accessible in your browser at `http://localhost:5173` (see terminal output to confirm address).

## Authentication

The app is private: every page requires an account. Open the app and use the **Sign up** link to create one (email + password, at least 10 characters with a letter and a number), then log in. Sessions are kept in a secure, httpOnly cookie; logging out clears it.

Each user's recipes, meal plans, grocery lists, and substitutions are private to them. The built-in ingredient catalog and dietary/allergen labels are shared globally, but each user can add their own private ingredients, aliases, and labels on top.

Configuration (see the env vars above and `.env.example`):

- `SESSION_SECRET` (**required**) — signs the session/CSRF cookies; the server refuses to start without it.
- `SESSION_TTL_HOURS` (optional, default `720`) — how long a session stays valid.
- `COOKIE_SECURE` (optional) — whether cookies require HTTPS; defaults to `true` in production. Set `false` for a LAN-only HTTP deploy (e.g. the Raspberry Pi over plain HTTP).
- `CORS_ORIGIN` (optional) — only needed if the frontend is served from a different origin than the API.

## Deploying to a Raspberry Pi

The app can be self-hosted on a Raspberry Pi 5 (or any arm64 Linux machine) using Docker.

### First-time Pi setup

SSH into the Pi and install Docker:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in for the Docker group to take effect.

### Deploying

From your development machine (requires Git Bash or any bash-compatible shell):

```bash
./scripts/deploy-to-pi.sh <user>@<ip-address>
```

This syncs the source code to the Pi and runs `docker compose up --build -d`. The app will be available at `http://<ip-address>:8080`.

On the first deploy the script generates `~/let-them-cook/.env` on the Pi with a random `SESSION_SECRET` and `COOKIE_SECURE=false` (the Pi is served over plain HTTP on the LAN). This `.env` is never overwritten by later deploys and is excluded from the sync — keep it safe; rotating `SESSION_SECRET` logs everyone out. If you put the app behind HTTPS, set `COOKIE_SECURE=true` in that file.

Subsequent deploys use the same command — Docker rebuilds the image and restarts the container with zero downtime for the database (persisted in a named Docker volume).

## Running tests

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

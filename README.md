# Let Them Cook

A personal recipe management app for collecting, organizing, and cooking from your recipe collection. Self-hosted, offline-capable, and designed for use on both mobile and desktop.

## Features

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

- [Node.js](https://nodejs.org/) v18 or later

### Setup

1. **Install dependencies**

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Initialize the database**

   ```bash
   cd backend
   npm run db:migrate
   ```

3. **Start the app**

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

This syncs the source code to the Pi and runs `docker compose up --build -d`. The app will be available at `http://<ip-address>:3000`.

Subsequent deploys use the same command — Docker rebuilds the image and restarts the container with zero downtime for the database (persisted in a named Docker volume).

## Running tests

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

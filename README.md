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

3. **Start the backend**

   ```bash
   cd backend
   npm run dev
   ```

   The API server starts on `http://localhost:3000`.

4. **Start the frontend** (in a separate terminal)

   ```bash
   cd frontend
   npm run dev
   ```

   Open `http://localhost:5173` in your browser.

## Running tests

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

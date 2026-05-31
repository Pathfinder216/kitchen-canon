import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/requireAuth.js';
import { doubleCsrfProtection } from './middleware/csrf.js';
import authRouter from './routes/auth.js';
import recipesRouter from './routes/recipes.js';
import coursesRouter from './routes/courses.js';
import labelsRouter from './routes/labels.js';
import mealPlansRouter from './routes/meal-plans.js';
import importRouter from './routes/import.js';
import substitutionsRouter from './routes/substitutions.js';
import mediaRouter from './routes/media.js';
import ingredientsRouter from './routes/ingredients.js';
import fs from 'fs';

export function createApp() {
  const app = express();

  // Middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  // credentials:true is required for the browser to send/receive auth cookies. In dev the Vite
  // proxy keeps requests same-origin; CORS_ORIGIN is only needed for split-origin hosting.
  app.use(cors({ origin: config.CORS_ORIGIN ?? true, credentials: true }));
  app.use(cookieParser(config.SESSION_SECRET));
  app.use(express.json({ limit: '10mb' }));

  if (config.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Health check (public)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  fs.mkdirSync(config.MEDIA_STORAGE_PATH, { recursive: true });

  // Auth routes are public (register/login) and handle their own CSRF issuance, so they are
  // mounted before the CSRF + requireAuth gates.
  app.use('/api/auth', authRouter);

  // All other /api routes require CSRF validation (state-changing methods) and a live session.
  // Scoped to /api so the public auth routes, media, and the production SPA shell are unaffected.
  app.use('/api', doubleCsrfProtection);
  app.use('/api', requireAuth);

  // Authenticated media — served only to logged-in users (true per-user isolation).
  app.use('/media', requireAuth, express.static(config.MEDIA_STORAGE_PATH));

  // Routes
  app.use('/api/recipes', recipesRouter);
  app.use('/api/courses', coursesRouter);
  app.use('/api/labels', labelsRouter);
  // Label/category assignment routes are mounted under /api to allow /api/recipes/:id/labels
  app.use('/api', labelsRouter);
  app.use('/api/meal-plans', mealPlansRouter);
  app.use('/api/import', importRouter);
  app.use('/api/substitutions', substitutionsRouter);
  app.use('/api/ingredients', ingredientsRouter);
  app.use('/api', mediaRouter);

  // Serve frontend in production
  if (config.NODE_ENV === 'production') {
    const frontendDist = path.resolve('../frontend/dist');
    app.use(express.static(frontendDist));
    // SPA fallback for client-side routes (not API/media)
    app.get(/^(?!\/api(\/|$)|\/media(\/|$))/, (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

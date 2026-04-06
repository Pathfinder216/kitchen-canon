import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import recipesRouter from './routes/recipes.js';
import coursesRouter from './routes/courses.js';
import labelsRouter from './routes/labels.js';
import mealPlansRouter from './routes/meal-plans.js';
import importRouter from './routes/import.js';
import substitutionsRouter from './routes/substitutions.js';
import mediaRouter from './routes/media.js';
import fs from 'fs';

export function createApp() {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  if (config.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Static media files
  fs.mkdirSync(config.MEDIA_STORAGE_PATH, { recursive: true });
  app.use('/media', express.static(config.MEDIA_STORAGE_PATH));

  // Routes
  app.use('/api/recipes', recipesRouter);
  app.use('/api/courses', coursesRouter);
  app.use('/api/labels', labelsRouter);
  // Label/category assignment routes are mounted under /api to allow /api/recipes/:id/labels
  app.use('/api', labelsRouter);
  app.use('/api/meal-plans', mealPlansRouter);
  app.use('/api/import', importRouter);
  app.use('/api/substitutions', substitutionsRouter);
  app.use('/api', mediaRouter);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

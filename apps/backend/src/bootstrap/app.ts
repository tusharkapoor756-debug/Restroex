import express, { Express } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';

// Middlewares
import { requestIdMiddleware } from '../middlewares/request-id/request-id.middleware';
import { requestLoggerMiddleware } from '../middlewares/logging/request-logger.middleware';
import { errorMiddleware } from '../middlewares/errors/error.middleware';
import { notFoundMiddleware } from '../middlewares/not-found/not-found.middleware';

// Routes
import routes from '../routes';

/**
 * Express Application Factory.
 * Initializes and configures the application foundation.
 */
export const createApp = (): Express => {
  const app = express();

  // 1. Security & Optimization Middlewares
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json());

  // 2. Lifecycle & Observability Middlewares
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // 3. API Routes
  app.use(routes);

  // 4. Legacy / Top-level Health check (Optional, redirecting to v1)
  app.get('/health', (req, res) => res.redirect('/api/v1/health'));

  // 5. Error & Fallback Middlewares
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};

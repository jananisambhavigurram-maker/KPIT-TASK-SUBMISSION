import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { errorHandler } from './errors.js';
import { api } from './routes.js';
import { swaggerSpec } from './swagger.js';

export function createApp() {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:5173' }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use('/api', api);
  app.use(errorHandler);
  return app;
}

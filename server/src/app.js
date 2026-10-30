import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { clientOrigins, env } from './config/env.js';
import routes from './routes/index.js';
import { originCheck } from './middleware/csrf.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();
  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: clientOrigins, credentials: true }));
  app.use(express.json({ limit: '6mb' }));
  app.use(cookieParser());
  app.use('/api', apiLimiter, originCheck, routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

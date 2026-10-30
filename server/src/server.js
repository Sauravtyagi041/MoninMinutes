import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/db.js';
import { logger } from './utils/logger.js';
import { recoverStale, startWorker, stopWorker } from './services/jobs/worker.js';
import { isAiConfigured } from './services/ai/providers.js';

const app = createApp();
const server = app.listen(env.PORT, async () => {
  logger.info('server listening', { port: env.PORT, env: env.NODE_ENV, aiConfigured: isAiConfigured() });
  try {
    // Anything left RUNNING by a previous process is picked up once its heartbeat goes stale.
    await recoverStale();
  } catch (e) {
    logger.error('startup recovery failed', { msg: e?.message });
  }
  startWorker();
});

const shutdown = (signal) => {
  logger.info('shutting down', { signal });
  stopWorker();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

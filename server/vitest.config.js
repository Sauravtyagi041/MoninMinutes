import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false, // tests share one Postgres database
    testTimeout: 20000,
    hookTimeout: 20000,
    include: ['tests/**/*.test.js'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ||
        'postgresql://minutemate:minutemate@localhost:5433/minutemate_test?schema=public',
      JWT_SECRET: 'test-secret-test-secret-test-secret-test-secret',
      CLIENT_ORIGINS: 'http://localhost:5173',
      AI_PROVIDER: 'openai-compatible',
      AI_BASE_URL: 'http://127.0.0.1:45871/v1',
      AI_MODEL: 'fake-model',
      AI_API_KEY: 'test-key',
      AI_MAX_RETRIES: '0',
      RATE_LIMIT_ENABLED: 'false',
      WORKER_ENABLED: 'false',
    },
  },
});

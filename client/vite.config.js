import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');
  return {
    envDir: '..',
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // Same-origin in development, so cookies "just work" without CORS.
      proxy: { '/api': `http://localhost:${env.PORT || 4000}` },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
      css: false,
    },
  };
});

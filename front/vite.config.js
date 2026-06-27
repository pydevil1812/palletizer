import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Load all vars (no prefix filter) from the project root, one level above front/
  const env = loadEnv(mode, resolve(__dirname, '..'), '');

  const apiHost = env.API_HOST || '127.0.0.1';
  const apiPort = env.API_PORT || '5000';
  const devPort = parseInt(env.DEV_PORT) || 5173;

  return {
    plugins: [react()],
    server: {
      host: true,
      port: devPort,
      proxy: {
        '/api': `http://${apiHost}:${apiPort}`,
      },
    },
  };
});

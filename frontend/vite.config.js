import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, process.cwd(), '');
  
  // If running inside docker container (IS_DOCKER or hostname check), target 'backend:8000'
  const isDocker = process.env.IS_DOCKER === 'true' || process.env.VITE_API_URL?.includes('backend');
  const target = isDocker ? 'http://backend:8000' : (env.VITE_API_URL || 'http://localhost:8000');

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: target,
          changeOrigin: true,
        },
        '/health': {
          target: target,
          changeOrigin: true,
        },
      },
    },
  };
});

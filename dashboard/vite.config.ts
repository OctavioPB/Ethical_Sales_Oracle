import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// API_TARGET lets docker-compose point the proxy at the api service name.
// Falls back to localhost for local dev without Docker.
const API_TARGET = process.env.API_TARGET ?? 'http://localhost:3001';
const USE_POLLING = process.env.CHOKIDAR_USEPOLLING === 'true';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' },
  },
  server: {
    port: 5173,
    host: true, // bind 0.0.0.0 so the container port is reachable from host
    watch: USE_POLLING ? { usePolling: true, interval: 1000 } : undefined,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
      '/socket.io': {
        target: API_TARGET,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});

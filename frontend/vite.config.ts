import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, forward API + websocket calls to the Spring Boot backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8081',
      '/ws': { target: 'http://localhost:8081', ws: true },
    },
  },
});

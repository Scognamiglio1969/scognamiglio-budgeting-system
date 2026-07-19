import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/scognamiglio-budgeting-system/',
  plugins: [react()],
  server: { port: 4173, host: '127.0.0.1' },
});

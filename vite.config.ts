import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/scognamiglio-budgeting-system/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  server: { port: 4173, host: '127.0.0.1' },
});

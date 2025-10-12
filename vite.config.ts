import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    fs: {
      allow: ['..'],
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/database', 'firebase/firestore', 'firebase/auth'],
          vendor: ['react', 'react-dom'],
          ui: ['uuid', 'dompurify']
        },
      },
      external: []
    },
  },
  optimizeDeps: {
    include: ['firebase/app', 'firebase/database', 'firebase/firestore', 'firebase/auth']
  },
  define: {
    __FIREBASE_MODE__: true,
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
  }
});


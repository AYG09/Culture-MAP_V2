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
          vendor: ['react', 'react-dom'],
          liveblocks: ['@liveblocks/client', '@liveblocks/yjs', 'yjs'],
          ui: ['uuid']
        },
      },
      external: []
    },
  },
  optimizeDeps: {
    include: ['@liveblocks/client', '@liveblocks/yjs', 'yjs', 'y-indexeddb']
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
  }
});

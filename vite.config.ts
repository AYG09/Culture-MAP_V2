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
          // React 코어
          vendor: ['react', 'react-dom'],
          // Liveblocks 협업
          liveblocks: ['@liveblocks/client', '@liveblocks/react', '@liveblocks/yjs', 'yjs', 'y-indexeddb'],
          // AI SDK (매우 큼)
          'ai-google': ['@google/genai'],
          'ai-anthropic': ['@anthropic-ai/sdk'],
          // PDF/문서 생성 (큼)
          'docs-pdf': ['jspdf', 'html2pdf.js', 'html2canvas', 'pdfjs-dist'],
          'docs-word': ['docx'],
          'docs-excel': ['exceljs'],
          'docs-utils': ['file-saver'],
          // UI 라이브러리
          'ui-flow': ['@xyflow/react', 'dagre'],
          'ui-editor': ['quill', 'react-quill-new'],
          'ui-motion': ['framer-motion'],
          'ui-icons': ['lucide-react'],
          // 유틸리티
          utils: ['uuid', 'qrcode', 'html-to-image']
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

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
        manualChunks(id) {
          // 앱 코드는 기본 청킹에 맡김
          if (!id.includes('node_modules')) return;

          // 기존 수동 매핑 유지 (청크명 일관성)
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor';
          if (id.includes('@liveblocks') || id.includes('/yjs') || id.includes('y-indexeddb')) return 'liveblocks';
          if (id.includes('@google/genai')) return 'ai-google';
          if (id.includes('jspdf') || id.includes('html2pdf') || id.includes('html2canvas') || id.includes('pdfjs-dist')) return 'docs-pdf';
          if (id.includes('/docx/')) return 'docs-word';
          if (id.includes('exceljs') || id.includes('/xlsx')) return 'docs-excel';
          if (id.includes('file-saver')) return 'docs-utils';
          if (id.includes('@xyflow') || id.includes('/dagre') || id.includes('elkjs')) return 'ui-flow';
          if (id.includes('quill') || id.includes('react-quill')) return 'ui-editor';
          if (id.includes('framer-motion')) return 'ui-motion';
          if (id.includes('lucide-react')) return 'ui-icons';
          if (id.includes('/uuid') || id.includes('/qrcode') || id.includes('html-to-image')) return 'utils';
          // Markdown 렌더링 (react-markdown, remark, rehype, unified 등)
          if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype') || id.includes('unified') || id.includes('mdast') || id.includes('hast') || id.includes('micromark')) return 'ui-markdown';
          // React Router
          if (id.includes('react-router')) return 'vendor';

          // 나머지 node_modules는 공통 vendor 청크로 통합
          return 'vendor-common';
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

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

          // Windows/Unix 경로 모두 처리를 위해 정규화
          const normalizedId = id.replace(/\\/g, '/');

          // React 코어 + React Router (함께 번들링 필수 - 순환 의존성 방지)
          // React 19의 Activity API를 위해 react, react-dom, scheduler, react-router를 같은 청크로
          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/react-router/') ||
            normalizedId.includes('/node_modules/react-router-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) return 'vendor';
          
          if (normalizedId.includes('@liveblocks') || normalizedId.includes('/yjs/') || normalizedId.includes('y-indexeddb')) return 'liveblocks';
          if (normalizedId.includes('@google/genai')) return 'ai-google';
          if (normalizedId.includes('jspdf') || normalizedId.includes('html2pdf') || normalizedId.includes('html2canvas') || normalizedId.includes('pdfjs-dist')) return 'docs-pdf';
          if (normalizedId.includes('/docx/')) return 'docs-word';
          if (normalizedId.includes('exceljs') || normalizedId.includes('/xlsx/')) return 'docs-excel';
          if (normalizedId.includes('file-saver')) return 'docs-utils';
          if (normalizedId.includes('@xyflow') || normalizedId.includes('/dagre/') || normalizedId.includes('elkjs')) return 'ui-flow';
          if (normalizedId.includes('quill') || normalizedId.includes('react-quill')) return 'ui-editor';
          if (normalizedId.includes('framer-motion')) return 'ui-motion';
          if (normalizedId.includes('lucide-react')) return 'ui-icons';
          if (normalizedId.includes('/uuid/') || normalizedId.includes('/qrcode/') || normalizedId.includes('html-to-image')) return 'utils';
          // Markdown 렌더링 (react-markdown, remark, rehype, unified 등)
          if (normalizedId.includes('react-markdown') || normalizedId.includes('remark') || normalizedId.includes('rehype') || normalizedId.includes('unified') || normalizedId.includes('mdast') || normalizedId.includes('hast') || normalizedId.includes('micromark')) return 'ui-markdown';

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

import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { normalizeSearchInput, performWebSearch } from './api/web-search-shared';

function webSearchDevPlugin(env: Record<string, string>) {
  return {
    name: 'web-search-dev-api',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/web-search', async (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        const headerValue = req.headers['x-tavily-api-key'];
        const userApiKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;
        const apiKey = (typeof userApiKey === 'string' && userApiKey.trim()) || env.TAVILY_API_KEY || env.VITE_TAVILY_API_KEY;
        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'TAVILY_API_KEY not configured' }));
          return;
        }

        try {
          const bodyText = await readRequestBody(req);
          const body = bodyText ? JSON.parse(bodyText) as { query?: string; maxResults?: number } : {};
          const { query, maxResults } = normalizeSearchInput(body.query, body.maxResults);

          if (!query) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'query is required' }));
            return;
          }

          const result = await performWebSearch(query, maxResults, apiKey);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Web search server error';
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: message }));
        }
      });
    }
  };
}

async function readRequestBody(req: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), webSearchDevPlugin(env)],
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
            if (normalizedId.includes('exceljs')) return 'docs-exceljs';
            if (normalizedId.includes('/xlsx/')) return 'docs-xlsx';
            if (normalizedId.includes('file-saver')) return 'docs-utils';
            if (normalizedId.includes('@xyflow')) return 'ui-xyflow';
            if (normalizedId.includes('/dagre/')) return 'ui-dagre';
            if (normalizedId.includes('elkjs')) return 'ui-elk';
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
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
      css: true,
      clearMocks: true,
      restoreMocks: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
    }
  };
});

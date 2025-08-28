import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'firebase' ? '/' : './', // Firebase 모드에서는 절대 경로 사용
  server: {
    host: '0.0.0.0', // 모든 네트워크 인터페이스에서 접근 허용
    port: mode === 'firebase' ? 5173 : 5178, // Firebase 모드는 표준 포트 사용
    fs: {
      allow: ['..'], // 상위 디렉토리 접근 허용
    },
    // Firebase 모드에서는 proxy 불필요
    ...(mode !== 'firebase' && {
      proxy: {
        '/api': {
          target: 'http://localhost:54321',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api/, '/api'),
        },
      },
    }),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000, // 경고 임계값을 1MB로 상향 조정
    rollupOptions: {
      output: {
        manualChunks: {
          // 큰 라이브러리들을 별도 청크로 분리하여 로딩 최적화
          firebase: ['firebase/app', 'firebase/database', 'firebase/firestore', 'firebase/auth'],
          vendor: ['react', 'react-dom'],
          ui: ['uuid', 'dompurify']
        },
      },
      external: [] // Firebase 모듈을 external로 처리하지 않도록 설정
    },
  },
  // Firebase ESM 모듈 최적화
  optimizeDeps: {
    include: ['firebase/app', 'firebase/database', 'firebase/firestore', 'firebase/auth']
  },
  // Firebase 모드에서 환경변수 정의
  define: mode === 'firebase' ? {
    __FIREBASE_MODE__: true,
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
  } : {
    __FIREBASE_MODE__: false,
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
  }
}));

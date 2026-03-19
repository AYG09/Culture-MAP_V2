import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './playwright',
  /* 테스트 실행 시간 제한 - AI 응답 시간을 고려하여 상향 */
  timeout: 120 * 1000,
  expect: {
    /**
     * expect()의 최대 대기 시간.
     */
    timeout: 5000,
  },
  /* 실패 시 재시도 안 함 */
  retries: 0,
  /* CI에서는 옵트인, 로컬에서는 옵트아웃 */
  workers: process.env.CI ? 1 : undefined,
  /* 리포터 설정 */
  reporter: 'html',
  webServer: {
    command: 'npm run dev > server-log.txt 2>&1',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  use: {
    /* 기본 브라우저: Chromium */
    browserName: 'chromium',
    /* 헤드리스 모드: true (백그라운드 실행) */
    headless: true,
    /* 개발 서버 시작 */
    baseURL: 'http://localhost:5173',
    /* 스크린샷, 비디오 녹화 설정 */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
});

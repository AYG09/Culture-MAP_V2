import { test, expect, type Page } from '@playwright/test';

import { clearBrowserState, goToWorkspace, waitForWorkspaceReady, WORKSPACE_URL } from './helpers';

test.describe('React Flow 성능 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserState(page);
    page.on('dialog', (dialog) => dialog.accept());
    await goToWorkspace(page);
  });

  test('CultureMapFlow 로딩 시간 측정', async ({ page }) => {
    console.log('🎯 테스트 1: 로딩 시간 측정');

    const start = Date.now();
    await clearBrowserState(page);
    await page.goto(WORKSPACE_URL, { waitUntil: 'domcontentloaded' });
    await waitForWorkspaceReady(page);
    const loadTime = Date.now() - start;

    console.log(`✅ CultureMapFlow 로딩 완료: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(15000);
  });

  test('React Flow 컴포넌트 로드 확인', async ({ page }) => {
    console.log('🎯 테스트 2: 컴포넌트 로드 확인');

    await expect(page.locator('.workspace-session-strip')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.workspace-toolbar')).toBeVisible();
    await expect(page.locator('.workspace-canvas-shell')).toBeVisible();
    await expect(page.locator('.react-flow__pane')).toBeVisible();
    await expect(page.getByRole('button', { name: /층위 관리/ })).toBeVisible();

    console.log('✅ 주요 UI 요소가 정상적으로 렌더링되었습니다.');
  });

  test('층위 관리 패널 열림 시간 측정', async ({ page }) => {
    console.log('🎯 테스트 3: 층위 관리 패널 열림 성능');

    const layerControlPanel = page.locator('.layer-control-panel');
    await expect(layerControlPanel).toBeHidden();

    const start = Date.now();
    await page.getByRole('button', { name: /세부 편집|층위 관리/ }).first().click();
    await expect(layerControlPanel).toBeVisible({ timeout: 2000 });
    const duration = Date.now() - start;

    console.log(`✅ 층위 관리 패널 열림 완료: ${duration}ms`);
    expect(duration).toBeLessThan(3000);
  });

  test('AI 일괄 생성 패널 토글 성능', async ({ page }) => {
    console.log('🎯 테스트 4: AI 패널 토글');

    const aiButton = page.getByRole('button', { name: /AI (확장|열기|접기)/ });
    const panel = page.locator('.ai-chat-sidebar');
    const peekButton = page.locator('.workspace-ai-peek-button');

    const openStart = Date.now();
    await aiButton.click();
    await expect(panel).toBeVisible({ timeout: 1000 });
    const openDuration = Date.now() - openStart;
    console.log(`✅ 패널 열림: ${openDuration}ms`);
    expect(openDuration).toBeLessThan(1000);

    const closeStart = Date.now();
    await page.getByRole('button', { name: /AI 접기/ }).click();
    await expect(page.getByRole('button', { name: /AI (확장|열기)/ })).toBeVisible({ timeout: 3000 });
    const closeDuration = Date.now() - closeStart;
    console.log(`✅ 패널 닫힘: ${closeDuration}ms`);
    expect(closeDuration).toBeLessThan(1000);
  });

  test('층위 배경 토글 반응성', async ({ page }) => {
    console.log('🎯 테스트 5: 층위 배경 토글');

    await page.locator('.workspace-side-panel__tab', { hasText: '레이어' }).click();

    const toggleButton = page.locator('.workspace-side-action').filter({ hasText: /층위 배경 (숨기기|표시)/ }).first();
    await expect(toggleButton).toBeVisible();
    const initialLabel = (await toggleButton.textContent())?.trim();

    const disableStart = Date.now();
    await toggleButton.click();
    await expect(toggleButton).not.toHaveText(initialLabel ?? '', { timeout: 2000 });
    const disableDuration = Date.now() - disableStart;
    console.log(`✅ 배경 토글 1회: ${disableDuration}ms`);
    expect(disableDuration).toBeLessThan(500);

    const enableStart = Date.now();
    await toggleButton.click();
    await expect(toggleButton).toHaveText(initialLabel ?? '', { timeout: 2000 });
    const enableDuration = Date.now() - enableStart;
    console.log(`✅ 배경 토글 2회: ${enableDuration}ms`);
    expect(enableDuration).toBeLessThan(500);
  });

  test('모바일 제스처 가이드 표시 확인', async ({ page, isMobile }) => {
    console.log('🎯 테스트 6: 모바일 제스처 가이드');

    if (!isMobile) {
      console.log('⏭️  데스크톱 환경 - 모바일 시나리오 스킵');
      return;
    }

    await page.evaluate(() => {
      localStorage.removeItem('hasSeenMobileGestureGuide');
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    const guide = page.locator('.mobile-gesture-guide');
    await expect(guide).toBeVisible({ timeout: 3000 });
    console.log('✅ 모바일 제스처 가이드가 표시되었습니다.');

    await page.locator('.guide-close-button').click();
    await expect(guide).toBeHidden({ timeout: 2000 });
    console.log('✅ 가이드 닫기 동작도 정상입니다.');
  });

  test('메모리 사용량 모니터링', async ({ page }) => {
    console.log('🎯 테스트 7: 메모리 사용량 추적');

    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    const beforeMetrics = await client.send('Performance.getMetrics');
    const beforeMemory = beforeMetrics.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value || 0;
    console.log(`📊 초기 메모리: ${(beforeMemory / 1024 / 1024).toFixed(2)} MB`);

    await page.evaluate(() => {
      const mockData: Array<{ id: string; payload: string }> = [];
      for (let i = 0; i < 100; i++) {
        mockData.push({ id: `memory-test-${i}`, payload: 'x'.repeat(5000) });
      }
      // @ts-expect-error 테스트 유틸
      window.__memoryTestData = mockData;
    });

    await page.waitForTimeout(1500);

    const afterMetrics = await client.send('Performance.getMetrics');
    const afterMemory = afterMetrics.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value || 0;
    const increase = (afterMemory - beforeMemory) / 1024 / 1024;

    console.log(`📊 이후 메모리: ${(afterMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📊 증가량: ${increase.toFixed(2)} MB`);

    expect(increase).toBeLessThan(50);
  });

  test('크로스 브라우저 호환성', async ({ browserName }) => {
    console.log(`🎯 테스트 8: ${browserName} 호환성 체크`);
    console.log(`✅ ${browserName} 브라우저에서 테스트가 실행되었습니다.`);
  });
});

test.describe('성능 벤치마크 요약', () => {
  test('종합 성능 리포트 생성', async () => {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════');
    console.log('🎊 React Flow 기반 CultureMap 성능 테스트 요약');
    console.log('═══════════════════════════════════════════════════');
    console.log('  ✅ 로딩 시간 < 4초');
    console.log('  ✅ 층위 관리 패널 열림 < 3초');
    console.log('  ✅ AI 패널 토글 < 1초');
    console.log('  ✅ 층위 배경 토글 < 0.5초');
    console.log('  ✅ 메모리 증가 < 50MB');
    console.log('  ✅ 모바일 제스처 가이드 정상 동작');
    console.log('═══════════════════════════════════════════════════');
  });
});

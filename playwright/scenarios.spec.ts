import { test, expect } from '@playwright/test';

import { clearBrowserState, ensureAiPanelAccessible, goToWorkspace } from './helpers';

test.describe('Culture-MAP V2 Full Scenarios', () => {
    test.beforeEach(async ({ page }) => {
        await clearBrowserState(page);
        await goToWorkspace(page);
    });

    test('워크스페이스 핵심 흐름이 끝까지 동작한다', async ({ page }) => {
        await expect(page.locator('.workspace-shell')).toBeVisible();
        await expect(page.locator('.workspace-toolbar')).toBeVisible();

        await page.locator('.workspace-side-card__list button').filter({ hasText: /^결과/ }).first().click();
        await expect(page.locator('.layer-control-panel')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.workspace-side-panel')).toContainText('층위 구조');

        await page.locator('.tab-button', { hasText: '📄 보고서' }).click();
        await expect(page.locator('.report-editor')).toBeVisible({ timeout: 10000 });

        await page.locator('.tab-button', { hasText: '🗺️ 컬쳐맵' }).click();
        await expect(page.locator('.workspace-side-panel__tab', { hasText: '세션' })).toBeVisible();
        await page.locator('.workspace-side-panel__tab', { hasText: '세션' }).click();
        await expect(page.locator('.workspace-side-panel')).toContainText('세션 상태');
    });

    test('AI 제안 적용까지 포함한 종합 흐름이 동작한다', async ({ page }) => {
        const nodes = page.locator('.react-flow__node');
        const initialCount = await nodes.count();
        const resultLayerSummary = page.locator('.workspace-side-card__list button').filter({ hasText: /^결과/ }).first();

        await ensureAiPanelAccessible(page);

        const aiInput = page.locator('.chat-input-field');
        await aiInput.fill('결과 레이어에 "시나리오 AI 노드"라는 결과 노드 하나를 추가해줘. 실행 가능한 제안으로 만들어줘.');
        await aiInput.press('Enter');

        const applyButton = page.locator('.action-apply-btn').last();
        await expect(applyButton).toBeVisible({ timeout: 120000 });
        await applyButton.click();

        await expect(nodes).toHaveCount(initialCount + 1, { timeout: 15000 });
        await expect(applyButton).toHaveText(/적용됨|전체 적용/, { timeout: 5000 });
        await expect(resultLayerSummary).toContainText('1개', { timeout: 15000 });
    });
});

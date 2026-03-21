import { test, expect } from '@playwright/test';

import { attachBrowserDebugLogging, clearBrowserState, ensureAiPanelAccessible, goToWorkspace } from './helpers';

test('Robust Debug AI Streaming', async ({ page }) => {
    attachBrowserDebugLogging(page, 'BROWSER');

    await clearBrowserState(page);
    await goToWorkspace(page);
    await ensureAiPanelAccessible(page);

    const aiInput = page.locator('.chat-input-field');
    await aiInput.waitFor({ state: 'visible', timeout: 30000 });

    await aiInput.fill('결과 레이어에 "디버그 스트리밍 노드"라는 결과 노드 하나를 추가해줘. 도구 제안이 보이면 적용 가능한 형태로 보여줘.');
    await aiInput.press('Enter');

    const aiMessage = page.locator('.message-wrapper.ai').last();
    await expect(aiMessage).toBeVisible({ timeout: 90000 });
    await expect(aiMessage.locator('.message-content')).not.toHaveText('', { timeout: 30000 });

    const applyButton = page.locator('.action-apply-btn').last();
    await expect(applyButton).toBeVisible({ timeout: 120000 });
});

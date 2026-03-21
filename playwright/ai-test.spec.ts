import { test, expect } from '@playwright/test';

import { clearBrowserState, ensureAiPanelAccessible, goToWorkspace } from './helpers';

test('AI가 기본 질문에 응답한다', async ({ page }) => {
    await clearBrowserState(page);
    await goToWorkspace(page);
    await ensureAiPanelAccessible(page);

    const aiMessages = page.locator('.message-wrapper.ai');
    const initialAiCount = await aiMessages.count();
    const aiInput = page.locator('.chat-input-field');

    await aiInput.fill('안녕, 1+1은 뭐니? 한 줄로 답해줘.');
    await aiInput.press('Enter');

    await expect(aiMessages).toHaveCount(initialAiCount + 1, { timeout: 90000 });
    await expect(aiMessages.last().locator('.message-content')).not.toHaveText('', { timeout: 30000 });
});

test('AI 도구 호출로 노드 생성 제안을 적용할 수 있다', async ({ page }) => {
    await clearBrowserState(page);
    await goToWorkspace(page);
    await ensureAiPanelAccessible(page);

    const nodeLocator = page.locator('.react-flow__node');
    const initialNodeCount = await nodeLocator.count();
    const aiInput = page.locator('.chat-input-field');

    await aiInput.fill('결과 레이어에 "AI 테스트 노드"라는 결과 노드 하나를 추가해줘. 반드시 도구를 사용해서 실행 가능한 제안으로 만들어줘.');
    await aiInput.press('Enter');

    const applyBtn = page.locator('.action-apply-btn').last();
    await expect(applyBtn).toBeVisible({ timeout: 120000 });
    await applyBtn.click();

    await expect(nodeLocator).toHaveCount(initialNodeCount + 1, { timeout: 15000 });
    await expect(page.locator('.react-flow__node').filter({ hasText: 'AI 테스트 노드' })).toBeVisible({ timeout: 15000 });
});

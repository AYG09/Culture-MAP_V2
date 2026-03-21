import { test, expect } from '@playwright/test';

import { attachBrowserDebugLogging, clearBrowserState, ensureAiPanelAccessible, goToWorkspace } from './helpers';

test('Debug AI Response', async ({ page }) => {
    attachBrowserDebugLogging(page, 'BROWSER');

    await clearBrowserState(page);
    await goToWorkspace(page);
    await ensureAiPanelAccessible(page);

    const aiInput = page.locator('.chat-input-field');
    await expect(aiInput).toBeVisible({ timeout: 15000 });

    await aiInput.fill('안녕');
    await aiInput.press('Enter');

    const aiMessage = page.locator('.message-wrapper.ai').last();
    await expect(aiMessage).toBeVisible({ timeout: 60000 });
    await expect(aiMessage.locator('.message-content')).not.toHaveText('', { timeout: 30000 });
});

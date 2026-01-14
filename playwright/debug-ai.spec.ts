
import { test, expect } from '@playwright/test';

test('Debug AI Response', async ({ page }) => {
    // Enable console logging from browser
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    await page.goto('http://localhost:5173');
    
    // Check if we are logged in (Skip Gate should work)
    console.log('Page title:', await page.title());
    
    // Wait for the UI to settle
    await page.waitForTimeout(5000);

    // Try to find the AI input
    const aiInput = page.getByPlaceholder('AI에게 지시하기...');
    if (await aiInput.count() === 0) {
        console.log('AI Input not found! Current URL:', page.url());
        // Try to click Admin button if we are at Gateway
        const adminBtn = page.getByRole('button', { name: '관리자' });
        if (await adminBtn.isVisible()) {
            await adminBtn.click();
            await page.fill('input[type="password"]', 'MASTER2025');
            await page.click('button:has-text("입장")');
        }
    }

    await expect(aiInput).toBeVisible({ timeout: 15000 });
    console.log('AI Input is visible');

    await aiInput.fill('안녕');
    await aiInput.press('Enter');
    console.log('Message "안녕" sent');

    // Wait and check for list of messages
    await page.waitForTimeout(10000);
    const messageCount = await page.locator('.message-wrapper').count();
    console.log('Message count:', messageCount);

    const messageTexts = await page.locator('.message-content').allTextContents();
    console.log('Message texts:', messageTexts);

    await expect(page.locator('.message-wrapper.ai')).toBeVisible({ timeout: 30000 });
});

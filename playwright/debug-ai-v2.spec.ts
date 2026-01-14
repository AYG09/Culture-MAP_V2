import { test, expect } from '@playwright/test';

test('Robust Debug AI Streaming', async ({ page }) => {
    // Inject auth token to skip Gateway
    await page.addInitScript(() => {
        const authData = {
          token: `gw_test`,
          isAdmin: false,
          passwordType: 'workshop' as const,
          timestamp: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        };
        localStorage.setItem('gateway-auth-token', JSON.stringify(authData));
    });

    page.on('console', msg => {
        console.log(`BROWSER [${msg.type()}]: ${msg.text()}`);
    });

    page.on('pageerror', err => {
        console.log(`BROWSER ERROR: ${err.message}`);
    });

    await page.goto('http://localhost:5173/');

    // Skip Splash
    console.log('--- Checking Splash Screen ---');
    const skipBtn = page.locator('.skip-button');
    try {
        await skipBtn.waitFor({ state: 'visible', timeout: 15000 });
        await skipBtn.click();
        console.log('--- Splash Skipped ---');
    } catch (e) {
        console.log('--- Splash skip button not found, moving on ---');
    }

    // Handle session modal if visible (Workshop token requires session join)
    console.log('--- Checking Session Modal ---');
    const joinInput = page.locator('.join-session input');
    const joinBtn = page.locator('.join-btn');

    try {
        // 모달이 나타날 때까지 짧게 대기 (이미 로그인되어 있을 수도 있음)
        if (await joinInput.isVisible({ timeout: 10000 }).catch(() => false)) {
            console.log('--- Filling Session Code ---');
            await joinInput.fill('E2E-DEBUG');
            
            console.log('--- Clicking Join Button ---');
            await joinBtn.click({ force: true });
            
            console.log('--- Waiting for Modal to Close ---');
            await page.waitForSelector('.session-modal-overlay', { state: 'hidden', timeout: 30000 });
            console.log('--- Session Joined Successfully ---');
        } else {
            console.log('--- Session input not visible, assuming joined ---');
        }
    } catch (e) {
        console.log('--- Session modal handling failed or timed out:', e.message);
    }

    // AI Chat - Desktop에서는 이미 좌측에 표시됨
    console.log('--- Checking AI Chat Presence ---');
    const aiInput = page.locator('.chat-input-field');
    
    // AI 사이드바가 보이지 않는다면 렌더링을 기다림
    await aiInput.waitFor({ state: 'visible', timeout: 30000 });

    console.log('--- Sending message "안녕" ---');
    await aiInput.fill('안녕');
    await aiInput.press('Enter');

    // Wait for AI message wrapper
    console.log('--- Waiting for AI response wrapper ---');
    const aiMessage = page.locator('.message-wrapper.ai').first();
    await expect(aiMessage).toBeVisible({ timeout: 60000 });
    
    console.log('--- AI response appeared, waiting for content ---');
    await page.waitForTimeout(5000);
    const content = await aiMessage.innerText();
    console.log('--- AI Content at 5s:', content);
});

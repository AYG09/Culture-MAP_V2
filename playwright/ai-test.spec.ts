
import { test, expect } from '@playwright/test';

test('AI Basic Response Test', async ({ page }) => {
    // 1. Setup - Skip Gate and Use Env Vars
    // (Vite will pick up VITE_SKIP_GATE=true if we set it, or we just bypass the gateway manually)
    await page.goto('http://localhost:5173');
    
    // Bypass Gateway if needed
    if (await page.locator('input[type="password"]').isVisible()) {
        await page.locator('input[type="password"]').fill('MASTER2025'); // Assuming this is one of the passwords
        await page.click('button:has-text("입장")');
    }

    // 2. Wait for AI Sidebar
    const aiInput = page.getByPlaceholder('AI에게 지시하기...');
    await expect(aiInput).toBeVisible({ timeout: 15000 });

    // 3. Simple Message
    await aiInput.fill('안녕, 1+1은 뭐니?');
    await aiInput.press('Enter');

    // 4. Expect AI Response
    const aiMessage = page.locator('.message-wrapper.ai').first();
    await expect(aiMessage).toBeVisible({ timeout: 30000 });
    
    const content = await aiMessage.locator('.message-content').textContent();
    console.log('AI Response:', content);
    expect(content?.length).toBeGreaterThan(0);
});

test('AI Tool Calling Test', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    if (await page.locator('input[type="password"]').isVisible()) {
        await page.locator('input[type="password"]').fill('MASTER2025');
        await page.click('button:has-text("입장")');
    }

    const aiInput = page.getByPlaceholder('AI에게 지시하기...');
    await expect(aiInput).toBeVisible({ timeout: 15000 });

    // Force add_node
    await aiInput.fill('결과 레이어에 "테스트 노드" 하나 추가해줘. 반드시 add_node 도구를 사용해.');
    await aiInput.press('Enter');

    // Expect Apply Button
    const applyBtn = page.locator('.action-apply-btn');
    await expect(applyBtn).toBeVisible({ timeout: 60000 });
    
    await applyBtn.click();
    console.log('Apply button clicked');

    // Check if node is created
    await expect(page.locator('.react-flow__node')).toBeVisible({ timeout: 10000 });
});

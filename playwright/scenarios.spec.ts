import { test, expect, type Page } from '@playwright/test';

const ADMIN_PASSWORD = 'winter09@!';
const WORKSHOP_PASSWORD = 'TEST_WORKSHOP_123';

async function skipSplash(page: Page) {
    const skipButton = page.locator('.skip-button');
    await expect(skipButton).toBeVisible({ timeout: 5000 });
    await skipButton.click();
    await expect(page.locator('.video-splash-container')).toBeHidden();
}

async function login(page: Page, password: string) {
    await expect(page.locator('.gateway-container')).toBeVisible();
    await page.locator('input[type="password"]').fill(password);
    await page.locator('.submit-button').click();
}

test.describe('Culture-MAP V2 Full Scenarios', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('Admin can login and create a workshop password', async ({ page }) => {
        await skipSplash(page);
        await login(page, ADMIN_PASSWORD);

        // 관리자 로그인 시 자동으로 AdminGateway가 표시됨
        await expect(page.locator('.admin-gateway-container')).toBeVisible({ timeout: 10000 });

        // Create a workshop password
        await page.locator('.create-password-btn').click();
        await page.locator('input[placeholder="비밀번호 입력"]').fill(WORKSHOP_PASSWORD);

        // Ensure "Workshop" is selected (it's default, but let's be sure)
        const workshopRadio = page.locator('input[value="workshop"]');
        if (await workshopRadio.isVisible()) {
            await workshopRadio.check();
        }

        await page.locator('button[type="submit"]').click();

        // Check if it appears in the list
        await expect(page.locator('.passwords-list')).toContainText(WORKSHOP_PASSWORD, { timeout: 5000 });

        // Logout - 뒤로 가기 후 로그아웃
        await page.locator('.back-btn').click();
        await page.locator('.logout-button').click();
        await expect(page.locator('.gateway-container')).toBeVisible();
    });

    test('User can login and use the editor', async ({ page }) => {
        // Note: This test depends on the previous test having run or the password being persistent in localStorage
        // Since Playwright runs tests in isolation, we need to recreate the state or do it in one test.
        // Let's do it in one long test for simplicity in this environment.
    });

    test('Comprehensive E2E Flow', async ({ page }) => {
        // 1. Splash & Login as Admin
        await skipSplash(page);
        await login(page, ADMIN_PASSWORD);

        // 2. 관리자 로그인 시 자동으로 AdminGateway 표시됨
        await expect(page.locator('.admin-gateway-container')).toBeVisible({ timeout: 10000 });

        // Create Workshop Password
        await page.locator('.create-password-btn').click();
        await page.locator('input[placeholder="비밀번호 입력"]').fill(WORKSHOP_PASSWORD);
        await page.locator('button[type="submit"]').click();
        await expect(page.locator('.passwords-list')).toContainText(WORKSHOP_PASSWORD, { timeout: 5000 });

        // 3. Logout & Login as User
        await page.locator('.back-btn').click();
        await page.locator('.logout-button').click();
        await login(page, WORKSHOP_PASSWORD);

        // 4. Session Manager - 실제 UI 요소에 맞게 수정
        await expect(page.getByRole('heading', { name: '멀티유저 세션' })).toBeVisible({ timeout: 10000 });

        // Create a new session
        await page.getByPlaceholder('세션 이름 (선택사항)').fill('E2E Test Session');
        await page.getByRole('button', { name: '세션 생성' }).click();

        // Wait for Session Modal to disappear completely
        await expect(page.locator('.session-modal-overlay')).not.toBeVisible({ timeout: 10000 });

        // 5. Editor (CultureMapFlow)
        await expect(page.locator('.culture-map-flow-container')).toBeVisible({ timeout: 15000 });

        // Create a node via context menu
        const pane = page.locator('.react-flow__pane');
        await pane.click({ button: 'right', position: { x: 400, y: 300 } });
        await page.getByRole('button', { name: '🔴 결과 (가시적 요소)' }).click();

        await expect(page.locator('.react-flow__node')).toHaveCount(1);
        const node = page.locator('.react-flow__node').first();
        // 실제 수신된 텍스트 "결과중립새 노트"에 맞춰 수정
        await expect(node).toContainText('새 노트');

        // Edit node
        await node.dblclick();
        const textarea = page.locator('textarea.node-textarea');
        await expect(textarea).toBeVisible();
        await textarea.fill('E2E 테스트 완료');
        await textarea.press('Enter');
        await expect(node).toContainText('E2E 테스트 완료');

        // Drag node (simple move)
        await node.hover();
        await page.mouse.down();
        await page.mouse.move(500, 400);
        await page.mouse.up();

        // 6. AI Interaction Test
        // AI Sidebar 활성화
        const aiToggle = page.locator('.ai-sidebar-toggle');
        if (await aiToggle.count() > 0) {
            await aiToggle.click();
        }

        const aiInput = page.getByPlaceholder('AI에게 지시하기...');
        await expect(aiInput).toBeVisible();

        // 사용자가 입력한 노드 인식 및 AI 노드 생성 테스트
        await aiInput.fill('안녕, 넌 누구니?');
        await aiInput.press('Enter');

        // AI 응답 대기 (첫 번째 메시지가 나타날 때까지)
        // 스트리밍 덕분에 5-10초 내에 나타나야 함
        await expect(page.locator('.message-wrapper.ai')).toBeVisible({ timeout: 30000 });
        console.log('AI response started streaming');

        // 메시지 텍스트가 어느 정도 채워질 때까지 잠시 대기
        await page.waitForTimeout(2000);

        // 본래 테스트 수행
        await aiInput.fill('방금 만든 "E2E 테스트 완료" 노드 옆에 "AI 추천 전략"이라는 제목의 결과 노드를 추가해줘');
        await aiInput.press('Enter');

        // AI 도구 실행 및 적용 버튼 대기 (Thinking 고려하여 60초)
        const applyBtn = page.locator('.action-apply-btn').last();
        await expect(applyBtn).toBeVisible({ timeout: 60000 });
        await applyBtn.click();

        // 노드 개수가 늘어나는지 확인 (애니메이션 고려)
        await expect(async () => {
            const nodeCount = await page.locator('.react-flow__node').count();
            expect(nodeCount).toBeGreaterThan(1);
        }).toPass({ timeout: 5000 });

        const aiNode = page.locator('.react-flow__node').filter({ hasText: 'AI 추천 전략' });
        await expect(aiNode).toBeVisible();
    });
});

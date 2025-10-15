import { test, expect, type Page } from '@playwright/test';

const APP_URL = 'http://localhost:5173';

const closeWelcomeModal = async (page: Page) => {
  const closeButton = page.locator('.welcome-modal-close');
  try {
    if (await closeButton.isVisible({ timeout: 2000 })) {
      await closeButton.click();
      await expect(page.locator('.welcome-modal-overlay')).toBeHidden({ timeout: 2000 });
    }
  } catch {
    // Modal이 표시되지 않은 경우 무시합니다.
  }
};

const createNodeViaContextMenu = async (page: Page) => {
  const nodeLocator = page.locator('.react-flow__node');
  const initialCount = await nodeLocator.count();

  const pane = page.locator('.react-flow__pane');
  await expect(pane).toBeVisible();
  await pane.click({ button: 'right', position: { x: 400, y: 300 } });

  const menu = page.locator('.react-flow-context-menu');
  await expect(menu).toBeVisible();
  await page.getByRole('button', { name: /결과/ }).click();
  await expect(menu).toBeHidden();

  await expect(nodeLocator).toHaveCount(initialCount + 1);
  return nodeLocator.last();
};

test.describe('CultureMapFlow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForSelector('.culture-map-flow-container', { timeout: 10000 });
    await closeWelcomeModal(page);
  });

  test('CultureMapFlow UI가 정상적으로 렌더링된다', async ({ page }) => {
    await expect(page.locator('.culture-map-flow-wrapper')).toBeVisible();
    await expect(page.locator('.top-bar')).toBeVisible();
    await expect(page.locator('.left-panel')).toBeVisible();
    await expect(page.locator('.react-flow__pane')).toBeVisible();
    await expect(page.locator('.layer-legend')).toBeVisible();
  });

  test('컨텍스트 메뉴를 통해 새 노드를 추가할 수 있다', async ({ page }) => {
    const newNode = await createNodeViaContextMenu(page);
    await expect(newNode.locator('.node-content')).toContainText('새 노트');
  });

  test('노드 내용을 편집하고 저장할 수 있다', async ({ page }) => {
    const node = await createNodeViaContextMenu(page);
    await node.dblclick();

    const textarea = page.locator('textarea.node-textarea');
    await expect(textarea).toBeVisible();

    const updatedText = 'Playwright에서 수정한 노트';
    await textarea.fill(updatedText);
    await textarea.press('Enter');

    await expect(node.locator('.node-content')).toHaveText(updatedText);
  });

  test('노드를 드래그하여 위치를 이동할 수 있다', async ({ page }) => {
    const node = await createNodeViaContextMenu(page);
    await page.waitForTimeout(200); // 렌더링 안정화

    const initialBox = await node.boundingBox();
    expect(initialBox).not.toBeNull();

    await node.hover();
    await page.mouse.down();
    await page.mouse.move(initialBox!.x + 120, initialBox!.y + 80);
    await page.mouse.up();

    const movedBox = await node.boundingBox();
    expect(movedBox).not.toBeNull();
    expect(Math.abs(movedBox!.x - initialBox!.x)).toBeGreaterThan(5);
    expect(Math.abs(movedBox!.y - initialBox!.y)).toBeGreaterThan(5);
  });
});

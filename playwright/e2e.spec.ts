import { test, expect, type Locator, type Page } from '@playwright/test';

import { clearBrowserState, ensureAiPanelAccessible, goToWorkspace } from './helpers';

const openCreateNodeMenu = async (page: Page) => {
  const pane = page.locator('.react-flow__pane');
  await pane.click({ button: 'right', position: { x: 400, y: 280 } });

  const menu = page.locator('.react-flow-context-menu');
  await expect(menu).toBeVisible();

  return menu;
};

const createNodeViaContextMenu = async (page: Page, type: '결과' | '행동' | '유형' | '무형' = '결과') => {
  const nodeLocator = page.locator('.react-flow__node');
  const initialCount = await nodeLocator.count();
  let clicked = false;

  for (let attempt = 0; attempt < 3 && !clicked; attempt += 1) {
    await openCreateNodeMenu(page);

    clicked = await page.evaluate(async (label) => {
      const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

      for (let index = 0; index < 4; index += 1) {
        const toggle = document.querySelector('.react-flow-context-menu .context-menu-section-toggle');
        if (!(toggle instanceof HTMLButtonElement)) {
          return false;
        }

        toggle.click();
        await wait(120);

        const buttons = Array.from(
          document.querySelectorAll('.react-flow-context-menu .context-menu-section-body button')
        );
        const target = buttons.find((button) => (button.textContent || '').trim() === label);

        if (target instanceof HTMLButtonElement) {
          target.click();
          return true;
        }
      }

      return false;
    }, type);

    if (!clicked) {
      await page.mouse.click(40, 40);
      await page.waitForTimeout(200);
    }
  }

  expect(clicked).toBeTruthy();

  await expect(nodeLocator).toHaveCount(initialCount + 1);
  return nodeLocator.last();
};

const openNodeEditor = async (node: Locator) => {
  await node.locator('.node-content').dblclick();
  const textarea = node.locator('textarea.node-textarea');
  await expect(textarea).toBeVisible();
  return textarea;
};

test.describe('CultureMapFlow Workspace Shell', () => {
  test.beforeEach(async ({ page }) => {
    await clearBrowserState(page);
    await goToWorkspace(page);
  });

  test('개편된 워크스페이스 UI가 정상적으로 렌더링된다', async ({ page }) => {
    await expect(page.locator('.workspace-session-strip')).toBeVisible();
    await expect(page.locator('.workspace-toolbar')).toBeVisible();
    await expect(page.locator('.workspace-side-panel')).toBeVisible();
    await expect(page.locator('.workspace-ai-peek-button')).toBeVisible();
    await ensureAiPanelAccessible(page);
    await expect(page.locator('.tab-button', { hasText: '🗺️ 컬쳐맵' })).toHaveClass(/tab-button--active/);
  });

  test('컨텍스트 메뉴를 통해 새 결과 노드를 추가할 수 있다', async ({ page }) => {
    const newNode = await createNodeViaContextMenu(page, '결과');
    await expect(newNode.locator('.node-content')).toContainText('새 노트');
    await expect(page.locator('.workspace-side-panel')).toContainText('1개');
  });

  test('노드 내용을 편집하고 인스펙터에 반영할 수 있다', async ({ page }) => {
    const node = await createNodeViaContextMenu(page, '결과');
    const textarea = await openNodeEditor(node);

    const updatedText = 'Playwright에서 수정한 노트';
    await textarea.fill(updatedText);
    await textarea.press('Enter');

    await expect(node.locator('.node-content')).toHaveText(updatedText);
    await node.click();
    await expect(page.locator('.workspace-side-panel')).toContainText('인스펙터');
    await expect(page.locator('.workspace-side-panel')).toContainText('노드 상세');
  });

  test('노드를 드래그하여 위치를 이동할 수 있다', async ({ page }) => {
    const node = await createNodeViaContextMenu(page, '결과');
    await page.waitForTimeout(300);

    const initialBox = await node.boundingBox();
    expect(initialBox).not.toBeNull();

    await node.hover();
    await page.mouse.down();
    await page.mouse.move(initialBox!.x + 140, initialBox!.y + 90, { steps: 12 });
    await page.mouse.up();

    const movedBox = await node.boundingBox();
    expect(movedBox).not.toBeNull();
    expect(Math.abs(movedBox!.x - initialBox!.x)).toBeGreaterThan(5);
    expect(Math.abs(movedBox!.y - initialBox!.y)).toBeGreaterThan(5);
  });

  test('보고서 탭과 우측 패널 탭이 정상 전환된다', async ({ page }) => {
    await page.locator('.tab-button', { hasText: '📄 보고서' }).click();
    await expect(page.locator('.report-editor')).toBeVisible();
    await expect(page.locator('.report-editor')).toContainText('AI 보고서 생성');

    await page.locator('.tab-button', { hasText: '🗺️ 컬쳐맵' }).click();
    await expect(page.locator('.workspace-side-panel__tab', { hasText: '세션' })).toBeVisible();
    await page.locator('.workspace-side-panel__tab', { hasText: '세션' }).click();
    await expect(page.locator('.workspace-side-panel')).toContainText('세션 상태');

    const node = await createNodeViaContextMenu(page, '결과');
    await node.click();
    await expect(page.locator('.workspace-side-panel__tab', { hasText: '인스펙터' })).toHaveClass(/workspace-side-panel__tab--active/);
    await expect(page.locator('.workspace-side-panel')).toContainText('노드 상세');
  });
});

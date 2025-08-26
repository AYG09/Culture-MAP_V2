import { test, expect } from '@playwright/test';

test.describe('EnhancedCultureMapApp', () => {
  test.beforeEach(async ({ page }) => {
    // Vite 개발 서버의 기본 URL로 이동합니다.
    await page.goto('http://localhost:5173');
    // 페이지가 완전히 로드될 때까지 기다립니다.
    await page.waitForSelector('.enhanced-culture-map-app');
  });

  test('애플리케이션이 성공적으로 로드되고 기본 UI 요소들이 표시되어야 합니다.', async ({
    page,
  }) => {
    // 메인 앱 컨테이너가 보이는지 확인
    await expect(page.locator('.enhanced-culture-map-app')).toBeVisible();

    // 상단 바가 보이는지 확인
    await expect(page.locator('.top-bar')).toBeVisible();
    await expect(page.getByText('🗺️ 진화적 컬쳐맵')).toBeVisible();

    // 왼쪽 패널 (프롬프트 생성기)이 보이는지 확인
    await expect(page.locator('.left-panel')).toBeVisible();

    // 메인 콘텐츠 영역이 보이는지 확인
    await expect(page.locator('.main-content')).toBeVisible();

    // 맵 뷰 탭이 활성화되어 있는지 확인
    await expect(page.locator('.tab-button.active')).toHaveText('🗺️ 진화적 컬쳐맵');

    // 맵 보드가 존재하는지 확인
    await expect(page.locator('#enhanced-notes-board')).toBeVisible();
  });

  test('컨텍스트 메뉴를 통해 새 노트를 추가할 수 있어야 합니다.', async ({ page }) => {
    const board = page.locator('#enhanced-notes-board');

    // 보드의 특정 위치를 우클릭하여 컨텍스트 메뉴를 엽니다.
    await board.click({ button: 'right', position: { x: 300, y: 200 } });

    // 컨텍스트 메뉴가 나타나는지 확인
    await expect(page.locator('.context-menu')).toBeVisible();

    // '결과 포스트잇 추가' 메뉴를 클릭
    await page.getByText('결과 포스트잇 추가').click();

    // 새 포스트잇이 보드에 추가되었는지 확인
    await expect(page.locator('.enhanced-sticky-note')).toBeVisible();
    await expect(page.locator('.enhanced-sticky-note textarea')).toHaveValue('새 포스트잇');

    // 편집 모드가 활성화되었는지 확인
    await expect(page.locator('.enhanced-sticky-note textarea')).toBeFocused();
  });

  test('추가된 노트를 드래그하여 위치를 변경할 수 있어야 합니다.', async ({ page }) => {
    // 먼저 노트를 추가합니다.
    const board = page.locator('#enhanced-notes-board');
    await board.click({ button: 'right', position: { x: 300, y: 200 } });
    await page.getByText('결과 포스트잇 추가').click();
    const note = page.locator('.enhanced-sticky-note');
    await expect(note).toBeVisible();

    const initialPosition = await note.boundingBox();
    expect(initialPosition).not.toBeNull();

    // 노트를 드래그 앤 드롭합니다.
    await note.hover();
    await page.mouse.down();
    await page.mouse.move(initialPosition!.x + 100, initialPosition!.y + 50);
    await page.mouse.up();

    const newPosition = await note.boundingBox();
    expect(newPosition).not.toBeNull();

    // 위치가 변경되었는지 확인 (GRID_SIZE에 맞춰 스냅되므로 정확한 값 대신 변경 여부 확인)
    expect(newPosition!.x).not.toEqual(initialPosition!.x);
    expect(newPosition!.y).not.toEqual(initialPosition!.y);
  });

  test('노트 편집 및 내용 저장이 가능해야 합니다.', async ({ page }) => {
    // 노트를 추가합니다.
    const board = page.locator('#enhanced-notes-board');
    await board.click({ button: 'right', position: { x: 300, y: 200 } });
    await page.getByText('결과 포스트잇 추가').click();
    const noteTextarea = page.locator('.enhanced-sticky-note textarea');

    // 텍스트를 입력합니다.
    const testText = 'Playwright 테스트 중';
    await noteTextarea.fill(testText);

    // 포커스를 잃게 하여 저장 로직을 트리거합니다. (예: 보드 클릭)
    await board.click({ position: { x: 10, y: 10 } });

    // 편집 모드가 종료되었는지 확인
    await expect(noteTextarea).not.toBeFocused();

    // 내용이 저장되었는지 확인
    await expect(noteTextarea).toHaveValue(testText);
  });
});

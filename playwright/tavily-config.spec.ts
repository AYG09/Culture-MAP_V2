import { test, expect, type Page } from '@playwright/test';

const APP_URL = 'http://localhost:5173';
const SKIP_GATE_URL = `${APP_URL}?skipGate=true`;
const TEST_GEMINI_KEY = 'test-gemini-key';
const TEST_TAVILY_KEY = 'REDACTED';

const clearBrowserState = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
};

const seedAiConfig = async (page: Page, tavilyApiKey?: string) => {
  await page.addInitScript(([geminiKey, tavilyKey]) => {
    localStorage.setItem('culture-map-ai-config', JSON.stringify({
      provider: 'gemini',
      apiKey: geminiKey,
      tavilyApiKey: tavilyKey,
      modelName: 'gemini-3.1-flash-lite-preview',
      autoExecuteFunctionCalls: false,
      sharedApiKeyMode: false,
    }));
  }, [TEST_GEMINI_KEY, tavilyApiKey]);
};

test.describe('Tavily config', () => {
  test('스플래시를 건너뛴 뒤 게이트웨이 진입 화면이 표시된다', async ({ page }) => {
    await clearBrowserState(page);

    await page.goto(APP_URL);

    await expect(page.getByRole('button', { name: /건너뛰기/ })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /건너뛰기/ }).click();

    await expect(page.getByRole('heading', { name: /조직문화 분석기/ })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /새 세션 만들기/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /세션 코드로 입장/ })).toBeVisible();
  });

  test('저장된 Tavily 키가 웹 검색 요청 헤더에 포함된다', async ({ page }) => {
    await clearBrowserState(page);
    await seedAiConfig(page, TEST_TAVILY_KEY);

    let capturedHeader = '';
    await page.route('**/api/web-search', async (route) => {
      capturedHeader = route.request().headers()['x-tavily-api-key'] ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: '2025 조직문화 트렌드',
          provider: 'tavily',
          results: [
            {
              title: 'Mock result',
              url: 'https://example.com/article',
              content: 'Mock content',
              source: 'example.com',
            }
          ]
        })
      });
    });

    await page.goto(SKIP_GATE_URL);

    const result = await page.evaluate(async () => {
      const module = await import('/src/services/AIService.ts');
      module.aiService.initializeFromStorage();
      return await (module.aiService as Record<string, unknown>)['searchWeb']('2025 조직문화 트렌드', 2);
    });

    expect(capturedHeader).toBe(TEST_TAVILY_KEY);
    expect(result).toMatchObject({
      status: 'ok',
      sources: [
        expect.objectContaining({
          kind: 'web',
          title: 'Mock result',
          url: 'https://example.com/article',
        })
      ]
    });
  });
});
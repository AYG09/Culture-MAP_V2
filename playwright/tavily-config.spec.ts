import { test, expect, type Page } from '@playwright/test';

const APP_URL = 'http://localhost:5173';
const TEST_GEMINI_KEY = 'test-gemini-key';
const TEST_TAVILY_KEY = 'REDACTED';

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
  test('저장된 Tavily 키가 웹 검색 요청 헤더에 포함된다', async ({ page }) => {
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

    await page.goto(APP_URL);

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
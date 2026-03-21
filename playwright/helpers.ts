import { expect, type Page } from '@playwright/test';

export const APP_URL = 'http://localhost:5173';
export const ROOT_URL = `${APP_URL}/`;
export const WORKSPACE_URL = `${APP_URL}/?skipGate=true`;

type AppBootState = 'workspace' | 'loading' | 'gateway' | 'splash' | 'unknown';

const detectAppBootState = async (page: Page): Promise<AppBootState> => {
  const workspaceShell = page.locator('.workspace-shell');
  const workspaceCanvas = page.locator('.culture-map-flow-container');
  const reactFlowPane = page.locator('.react-flow__pane');
  const loadingFallback = page.locator('.app-loading-fallback');
  const gateway = page.locator('.gateway-container');
  const splash = page.locator('.video-splash-container');

  if (
    await workspaceShell.isVisible().catch(() => false) &&
    await workspaceCanvas.isVisible().catch(() => false) &&
    await reactFlowPane.isVisible().catch(() => false)
  ) {
    return 'workspace';
  }

  if (await splash.isVisible().catch(() => false)) {
    return 'splash';
  }

  if (await gateway.isVisible().catch(() => false)) {
    return 'gateway';
  }

  if (await loadingFallback.isVisible().catch(() => false)) {
    return 'loading';
  }

  return 'unknown';
};

export const clearBrowserState = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
};

export const attachBrowserDebugLogging = (page: Page, prefix = 'BROWSER') => {
  page.on('console', (msg) => {
    console.log(`${prefix} [${msg.type()}]: ${msg.text()}`);
  });

  page.on('pageerror', (err) => {
    console.log(`${prefix} ERROR: ${err.message}`);
  });
};

export const seedAiConfig = async (
  page: Page,
  config: {
    apiKey: string;
    tavilyApiKey?: string;
    provider?: 'gemini' | 'claude';
    modelName?: string;
    autoExecuteFunctionCalls?: boolean;
    sharedApiKeyMode?: boolean;
  }
) => {
  await page.addInitScript((seed) => {
    localStorage.setItem(
      'culture-map-ai-config',
      JSON.stringify({
        provider: seed.provider ?? 'gemini',
        apiKey: seed.apiKey,
        tavilyApiKey: seed.tavilyApiKey,
        modelName: seed.modelName ?? 'gemini-3.1-flash-lite-preview',
        autoExecuteFunctionCalls: seed.autoExecuteFunctionCalls ?? false,
        sharedApiKeyMode: seed.sharedApiKeyMode ?? false,
      })
    );
  }, config);
};

export const waitForWorkspaceReady = async (page: Page, timeout = 45000) => {
  const deadline = Date.now() + timeout;
  let lastState: AppBootState = 'unknown';

  while (Date.now() < deadline) {
    lastState = await detectAppBootState(page);

    if (lastState === 'workspace') {
      await expect(page.locator('.app-loading-fallback')).toBeHidden({ timeout: 5000 });
      await expect(page.locator('.workspace-toolbar')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.workspace-canvas-shell')).toBeVisible({ timeout: 5000 });
      return;
    }

    if (page.url().includes('skipGate=true') && (lastState === 'splash' || lastState === 'gateway')) {
      throw new Error(`skipGate workspace 진입이 ${lastState} 화면에서 막혔습니다.`);
    }

    await page.waitForTimeout(500);
  }

  const loadingText = (await page.locator('.app-loading-fallback').textContent().catch(() => null))?.trim();
  throw new Error(
    `워크스페이스 준비가 ${timeout}ms 내에 완료되지 않았습니다. 마지막 상태: ${lastState}${loadingText ? ` (${loadingText})` : ''}`
  );
};

export const goToWorkspace = async (page: Page) => {
  await page.goto(WORKSPACE_URL, { waitUntil: 'domcontentloaded' });
  await waitForWorkspaceReady(page);
};

export const ensureAiPanelAccessible = async (page: Page) => {
  const aiSidebar = page.locator('.ai-chat-sidebar');
  if (await aiSidebar.count()) {
    await expect(aiSidebar).toBeVisible({ timeout: 10000 });
    return aiSidebar;
  }

  const peekButton = page.locator('.workspace-ai-peek-button');
  if (await peekButton.count()) {
    await peekButton.click();
  } else {
    await page.getByRole('button', { name: /AI (열기|확장|접기)/ }).click();
  }

  await expect(aiSidebar).toBeVisible({ timeout: 10000 });
  return aiSidebar;
};

export const goToRootAndSkipSplash = async (page: Page) => {
  await page.goto(ROOT_URL, { waitUntil: 'domcontentloaded' });
  const splash = page.locator('.video-splash-container');
  const gateway = page.locator('.gateway-container');

  if (await gateway.isVisible().catch(() => false)) {
    return;
  }

  await expect(splash).toBeVisible({ timeout: 15000 });
  const skipButton = page.getByRole('button', { name: /건너뛰기/ });
  await expect(skipButton).toBeVisible({ timeout: 10000 });
  await skipButton.click();
  await expect(splash).toBeHidden({ timeout: 10000 });
  await expect(gateway).toBeVisible({ timeout: 15000 });
};

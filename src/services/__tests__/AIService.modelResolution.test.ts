import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../RagService', () => ({
  default: { hasIndex: vi.fn(), retrieveContext: vi.fn(), getLastRetrievalError: vi.fn(), setClient: vi.fn() },
}));
vi.mock('../LiveblocksService', () => ({
  default: {
    getSharedRagChunks: vi.fn(() => []),
    hasSharedRagDoc: vi.fn(() => false),
    addSharedRagChunks: vi.fn(),
    removeSharedRagDoc: vi.fn(),
    getCurrentUserId: vi.fn(() => 'user-1'),
    getCurrentUserDisplayName: vi.fn(() => 'User 1'),
    getCurrentSession: vi.fn(() => null),
    updateSessionType: vi.fn(),
  },
}));

import aiService from '../AIService';

const svc = aiService as any;

describe('filterOfficialGeminiModels', () => {
  it('generateContent를 지원하지 않는 모델은 제외된다', () => {
    const result = svc.filterOfficialGeminiModels([
      { id: 'gemini-3.1-flash-lite', supportedGenerationMethods: ['generateContent'] },
      { id: 'text-embedding-004', supportedGenerationMethods: ['embedContent'] },
    ]);
    expect(result).toContain('gemini-3.1-flash-lite');
    expect(result).not.toContain('text-embedding-004');
  });

  it('supportedGenerationMethods가 빈 배열이면 지원 메서드 없음으로 간주해 제외된다', () => {
    const result = svc.filterOfficialGeminiModels([
      { id: 'gemini-3.1-flash-lite', supportedGenerationMethods: [] },
    ]);
    expect(result).not.toContain('gemini-3.1-flash-lite');
  });

  it('supportedGenerationMethods 필드 자체가 없으면 이름 기반 fallback으로 포함된다', () => {
    const result = svc.filterOfficialGeminiModels([
      { id: 'gemini-3.1-flash-lite' },
    ]);
    expect(result).toContain('gemini-3.1-flash-lite');
  });

  it('embedding 모델은 이름에 generateContent가 있어도 이름 패턴으로 제외된다', () => {
    const result = svc.filterOfficialGeminiModels([
      { id: 'gemini-embedding-exp', supportedGenerationMethods: ['generateContent'] },
    ]);
    expect(result).not.toContain('gemini-embedding-exp');
  });

  it('문자열 배열 오버로드도 동작한다 (이름 기반 fallback)', () => {
    const result = svc.filterOfficialGeminiModels(['models/gemini-3.1-flash-lite', 'gemini-2.5-pro']);
    expect(result).toContain('gemini-3.1-flash-lite');
    expect(result).toContain('gemini-2.5-pro');
  });
});

describe('resolveModelAlias — gemini-3.5-flash', () => {
  it('gemini-flash-latest는 available에 gemini-3.5-flash가 있으면 그쪽으로 마이그레이션된다', () => {
    const result = svc.resolveModelAlias('gemini-flash-latest', ['gemini-3.5-flash', 'gemini-3-flash-preview']);
    expect(result).toBe('gemini-3.5-flash');
  });

  it('gemini-3-flash-preview 저장값이 있고 available에 gemini-3.5-flash가 있으면 마이그레이션된다', () => {
    const result = svc.resolveModelAlias('gemini-3-flash-preview', ['gemini-3.5-flash', 'gemini-3-flash-preview']);
    expect(result).toBe('gemini-3.5-flash');
  });

  it('gemini-2.5-flash 저장값이 있고 available에 gemini-3.5-flash가 있으면 마이그레이션된다', () => {
    const result = svc.resolveModelAlias('gemini-2.5-flash', ['gemini-3.5-flash']);
    expect(result).toBe('gemini-3.5-flash');
  });

  it('gemini-3.5-flash는 alias 변환 없이 그대로 반환된다 (null = 변환 없음)', () => {
    const result = svc.resolveModelAlias('gemini-3.5-flash', ['gemini-3.5-flash']);
    expect(result).toBeNull();
  });
});

describe('resolveModelAlias', () => {
  it('gemini-3.1-flash-lite-preview는 Stable gemini-3.1-flash-lite로 마이그레이션된다', () => {
    const result = svc.resolveModelAlias('gemini-3.1-flash-lite-preview', ['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite-preview']);
    expect(result).toBe('gemini-3.1-flash-lite');
  });

  it('gemini-2.5-flash-lite가 available에 없을 때만 gemini-3.1-flash-lite로 마이그레이션된다', () => {
    const result = svc.resolveModelAlias('gemini-2.5-flash-lite', ['gemini-3.1-flash-lite']);
    expect(result).toBe('gemini-3.1-flash-lite');
  });

  it('gemini-3-pro-preview는 gemini-3.1-pro-preview로 대체된다', () => {
    const result = svc.resolveModelAlias('gemini-3-pro-preview', ['gemini-3.1-pro-preview']);
    expect(result).toBe('gemini-3.1-pro-preview');
  });

  it('alias 대상이 available 목록에 없으면 null 반환', () => {
    const result = svc.resolveModelAlias('gemini-2.5-flash-lite', ['gemini-3-flash-preview']);
    expect(result).toBeNull();
  });
});

describe('getAvailableGeminiModels fallback', () => {
  beforeEach(() => {
    svc.availableModelsCache = null;
    svc.availableModelsCacheTime = 0;
  });

  it('캐시가 없으면 gemini-3.5-flash를 첫 번째로 반환한다', () => {
    const models = svc.getAvailableGeminiModels();
    expect(models[0]).toBe('gemini-3.5-flash');
  });
});

describe('normalizeModelConfig', () => {
  beforeEach(() => {
    svc.availableModelsCache = null;
    svc.availableModelsCacheTime = 0;
  });

  it('available 목록에 없는 gemini-2.5-flash-lite는 gemini-3.1-flash-lite로 마이그레이션된다', () => {
    // fallback 목록(캐시 없음)에는 gemini-2.5-flash-lite가 있으므로 캐시를 빈 목록으로 대체해 테스트
    svc.availableModelsCache = ['gemini-3.1-flash-lite', 'gemini-3-flash-preview'];
    const config = svc.normalizeModelConfig({
      provider: 'gemini',
      apiKey: 'test',
      modelName: 'gemini-2.5-flash-lite',
    });
    expect(config.modelName).toBe('gemini-3.1-flash-lite');
    svc.availableModelsCache = null;
  });

  it('available 목록에 있는 gemini-2.5-flash-lite는 그대로 유지된다', () => {
    svc.availableModelsCache = ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite'];
    const config = svc.normalizeModelConfig({
      provider: 'gemini',
      apiKey: 'test',
      modelName: 'gemini-2.5-flash-lite',
    });
    expect(config.modelName).toBe('gemini-2.5-flash-lite');
    svc.availableModelsCache = null;
  });

  it('available 목록에 있는 gemini-2.5-pro는 3.x로 강제 변환되지 않는다', () => {
    svc.availableModelsCache = ['gemini-2.5-pro', 'gemini-3.1-flash-lite'];
    const config = svc.normalizeModelConfig({
      provider: 'gemini',
      apiKey: 'test',
      modelName: 'gemini-2.5-pro',
    });
    expect(config.modelName).toBe('gemini-2.5-pro');
    svc.availableModelsCache = null;
  });

  it('gemini-3.1-flash-lite-preview 저장값이 있으면 Stable로 마이그레이션된다', () => {
    svc.availableModelsCache = ['gemini-3.1-flash-lite'];
    const config = svc.normalizeModelConfig({
      provider: 'gemini',
      apiKey: 'test',
      modelName: 'gemini-3.1-flash-lite-preview',
    });
    expect(config.modelName).toBe('gemini-3.1-flash-lite');
    svc.availableModelsCache = null;
  });

  it('모델명이 없으면 DEFAULT_GEMINI_MODEL(gemini-3.5-flash)을 사용한다', () => {
    const config = svc.normalizeModelConfig({
      provider: 'gemini',
      apiKey: 'test',
    });
    expect(config.modelName).toBe('gemini-3.5-flash');
  });
});

describe('normalizeModelConfig — gemini-3.5-flash 검증', () => {
  beforeEach(() => {
    svc.availableModelsCache = null;
    svc.availableModelsCacheTime = 0;
  });

  it('저장값 gemini-3-flash-preview가 available에서 제거되면 gemini-3.5-flash로 마이그레이션된다', () => {
    // gemini-3-flash-preview가 deprecated되어 available에 없는 상황
    svc.availableModelsCache = ['gemini-3.5-flash'];
    const config = svc.normalizeModelConfig({ provider: 'gemini', apiKey: 'test', modelName: 'gemini-3-flash-preview' });
    expect(config.modelName).toBe('gemini-3.5-flash');
    svc.availableModelsCache = null;
  });

  it('저장값 gemini-3-flash-preview가 available에 아직 있으면 그대로 유지된다', () => {
    svc.availableModelsCache = ['gemini-3.5-flash', 'gemini-3-flash-preview'];
    const config = svc.normalizeModelConfig({ provider: 'gemini', apiKey: 'test', modelName: 'gemini-3-flash-preview' });
    expect(config.modelName).toBe('gemini-3-flash-preview');
    svc.availableModelsCache = null;
  });

  it('저장값 gemini-3.5-flash가 available에 있으면 그대로 유지된다', () => {
    svc.availableModelsCache = ['gemini-3.5-flash'];
    const config = svc.normalizeModelConfig({ provider: 'gemini', apiKey: 'test', modelName: 'gemini-3.5-flash' });
    expect(config.modelName).toBe('gemini-3.5-flash');
    svc.availableModelsCache = null;
  });
});

describe('getGeminiModelFamily', () => {
  it('gemini-3.1-flash-lite는 gemini-3 계열로 판별된다', () => {
    expect(svc.getGeminiModelFamily('gemini-3.1-flash-lite')).toBe('gemini-3');
  });

  it('gemini-3-flash-preview는 gemini-3 계열로 판별된다', () => {
    expect(svc.getGeminiModelFamily('gemini-3-flash-preview')).toBe('gemini-3');
  });

  it('gemini-3.1-pro-preview는 gemini-3 계열로 판별된다', () => {
    expect(svc.getGeminiModelFamily('gemini-3.1-pro-preview')).toBe('gemini-3');
  });

  it('gemini-2.5-flash는 gemini-2.5 계열로 판별된다', () => {
    expect(svc.getGeminiModelFamily('gemini-2.5-flash')).toBe('gemini-2.5');
  });

  it('gemini-2.5-pro는 gemini-2.5 계열로 판별된다', () => {
    expect(svc.getGeminiModelFamily('gemini-2.5-pro')).toBe('gemini-2.5');
  });

  it('gemini-2.5-flash-lite는 gemini-2.5 계열로 판별된다', () => {
    expect(svc.getGeminiModelFamily('gemini-2.5-flash-lite')).toBe('gemini-2.5');
  });

  it('gemini-3.5-flash는 gemini-3 계열로 판별된다', () => {
    expect(svc.getGeminiModelFamily('gemini-3.5-flash')).toBe('gemini-3');
  });

  it('알 수 없는 모델은 other로 판별된다', () => {
    expect(svc.getGeminiModelFamily('gpt-4o')).toBe('other');
  });
});

describe('getThinkingConfig', () => {
  // --- default preset ---
  it('Gemini 3 + default: includeThoughts만 있고 thinkingLevel/thinkingBudget 없음', () => {
    const cfg = svc.getThinkingConfig('gemini-3.1-flash-lite', 'default');
    expect(cfg).not.toBeNull();
    expect(cfg).toHaveProperty('includeThoughts', true);
    expect(cfg).not.toHaveProperty('thinkingLevel');
    expect(cfg).not.toHaveProperty('thinkingBudget');
  });

  it('Gemini 2.5 + default: null (모델 기본값 사용)', () => {
    expect(svc.getThinkingConfig('gemini-2.5-flash', 'default')).toBeNull();
  });

  it('Gemini 2.5 Flash-Lite + default: null (기본값 유지, dynamic thinking 강제 없음)', () => {
    expect(svc.getThinkingConfig('gemini-2.5-flash-lite', 'default')).toBeNull();
  });

  it('알 수 없는 모델 + 어떤 preset이든: null', () => {
    expect(svc.getThinkingConfig('gpt-4o', 'deep')).toBeNull();
  });

  // --- fast preset ---
  it('Gemini 3 + fast: thinkingLevel=low, thinkingBudget 없음', () => {
    const cfg = svc.getThinkingConfig('gemini-3.1-flash-lite', 'fast');
    expect(cfg).toHaveProperty('thinkingLevel', 'low');
    expect(cfg).not.toHaveProperty('thinkingBudget');
  });

  it('Gemini 2.5 + fast: thinkingBudget=1024, thinkingLevel 없음', () => {
    const cfg = svc.getThinkingConfig('gemini-2.5-flash', 'fast');
    expect(cfg).toHaveProperty('thinkingBudget', 1024);
    expect(cfg).not.toHaveProperty('thinkingLevel');
  });

  // --- balanced preset ---
  it('Gemini 3 Flash + balanced: thinkingLevel=medium', () => {
    const cfg = svc.getThinkingConfig('gemini-3.1-flash-lite', 'balanced');
    expect(cfg).toHaveProperty('thinkingLevel', 'medium');
    expect(cfg).not.toHaveProperty('thinkingBudget');
  });

  it('Gemini 3 Pro + balanced: thinkingLevel=high (medium 미지원 fallback)', () => {
    const cfg = svc.getThinkingConfig('gemini-3.1-pro-preview', 'balanced');
    expect(cfg).toHaveProperty('thinkingLevel', 'high');
    expect(cfg).not.toHaveProperty('thinkingBudget');
  });

  it('Gemini 2.5 + balanced: thinkingBudget=8192, thinkingLevel 없음', () => {
    const cfg = svc.getThinkingConfig('gemini-2.5-flash', 'balanced');
    expect(cfg).toHaveProperty('thinkingBudget', 8192);
    expect(cfg).not.toHaveProperty('thinkingLevel');
  });

  // --- deep preset ---
  it('Gemini 3 + deep: thinkingLevel=high, thinkingBudget 없음', () => {
    const cfg = svc.getThinkingConfig('gemini-3.1-flash-lite', 'deep');
    expect(cfg).toHaveProperty('thinkingLevel', 'high');
    expect(cfg).not.toHaveProperty('thinkingBudget');
  });

  it('Gemini 3 deep의 thinkingLevel은 소문자 high이다', () => {
    const cfg = svc.getThinkingConfig('gemini-3.1-flash-lite', 'deep');
    expect(cfg?.thinkingLevel).toBe('high');
  });

  it('Gemini 2.5 + deep: thinkingBudget=24576, thinkingLevel 없음', () => {
    const cfg = svc.getThinkingConfig('gemini-2.5-pro', 'deep');
    expect(cfg).toHaveProperty('thinkingBudget', 24576);
    expect(cfg).not.toHaveProperty('thinkingLevel');
  });

  // --- invariant ---
  it('gemini-3.5-flash는 thinkingBudget 없이 thinkingLevel만 사용한다', () => {
    const cfg = svc.getThinkingConfig('gemini-3.5-flash', 'deep');
    expect(cfg).toHaveProperty('thinkingLevel', 'high');
    expect(cfg).not.toHaveProperty('thinkingBudget');
  });

  it('gemini-3.5-flash + default: includeThoughts만 있고 thinkingBudget 없음', () => {
    const cfg = svc.getThinkingConfig('gemini-3.5-flash', 'default');
    expect(cfg).not.toBeNull();
    expect(cfg).toHaveProperty('includeThoughts', true);
    expect(cfg).not.toHaveProperty('thinkingBudget');
  });

  it('어떤 모델/preset 조합에서도 thinkingLevel과 thinkingBudget이 동시에 포함되지 않는다', () => {
    const models = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview',
                    'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gpt-4o'];
    const presets: Array<'default' | 'fast' | 'balanced' | 'deep'> = ['default', 'fast', 'balanced', 'deep'];
    for (const model of models) {
      for (const preset of presets) {
        const cfg = svc.getThinkingConfig(model, preset);
        if (cfg) {
          expect('thinkingLevel' in cfg && 'thinkingBudget' in cfg).toBe(false);
        }
      }
    }
  });
});

describe('normalizeModelConfig — reasoningPreset', () => {
  beforeEach(() => { svc.availableModelsCache = null; svc.availableModelsCacheTime = 0; });

  it('reasoningPreset이 없으면 default로 보정된다', () => {
    const config = svc.normalizeModelConfig({ provider: 'gemini', apiKey: 'test' });
    expect(config.reasoningPreset).toBe('default');
  });

  it('reasoningPreset이 있으면 그대로 유지된다', () => {
    const config = svc.normalizeModelConfig({ provider: 'gemini', apiKey: 'test', reasoningPreset: 'deep' });
    expect(config.reasoningPreset).toBe('deep');
  });
});

describe('collectRawModelsFromListResult', () => {
  const FLASH_MODEL = { name: 'models/gemini-3.5-flash', supportedActions: ['generateContent'] };
  const LITE_MODEL  = { name: 'models/gemini-3.1-flash-lite', supportedGenerationMethods: ['generateContent'] };

  it('{ models: [...] } 형태 — models-array shape', async () => {
    const { rawModels, shape } = await svc.collectRawModelsFromListResult({ models: [FLASH_MODEL] });
    expect(shape).toBe('models-array');
    expect(rawModels).toHaveLength(1);
    expect(rawModels[0]).toMatchObject({ name: 'models/gemini-3.5-flash' });
  });

  it('{ page: [...] } 형태 — pager-page shape', async () => {
    const { rawModels, shape } = await svc.collectRawModelsFromListResult({ page: [FLASH_MODEL, LITE_MODEL] });
    expect(shape).toBe('pager-page');
    expect(rawModels).toHaveLength(2);
    expect(rawModels[0]).toMatchObject({ name: 'models/gemini-3.5-flash' });
  });

  it('{ page: [] } 형태 — pager-page shape이지만 rawModels 비어있음', async () => {
    const { rawModels, shape } = await svc.collectRawModelsFromListResult({ page: [] });
    expect(shape).toBe('pager-page');
    expect(rawModels).toHaveLength(0);
  });

  it('iterateAll() 형태 — iterate-all shape', async () => {
    async function* gen() { yield FLASH_MODEL; yield LITE_MODEL; }
    const { rawModels, shape } = await svc.collectRawModelsFromListResult({ iterateAll: gen });
    expect(shape).toBe('iterate-all');
    expect(rawModels).toHaveLength(2);
  });

  it('async iterator(모델 직접 yield) — async-iterator shape', async () => {
    async function* gen() { yield FLASH_MODEL; }
    const iterable = { [Symbol.asyncIterator]: gen };
    const { rawModels, shape } = await svc.collectRawModelsFromListResult(iterable);
    expect(shape).toBe('async-iterator');
    expect(rawModels).toHaveLength(1);
    expect(rawModels[0]).toMatchObject({ name: 'models/gemini-3.5-flash' });
  });

  it('알 수 없는 형태 — unknown shape, rawModels 비어있음', async () => {
    const { rawModels, shape } = await svc.collectRawModelsFromListResult({ foo: 'bar' });
    expect(shape).toBe('unknown');
    expect(rawModels).toHaveLength(0);
  });
});

describe('fetchModelsFromApi — 응답 형태별 통합', () => {
  const FLASH_OBJ = { name: 'models/gemini-3.5-flash', supportedActions: ['generateContent'] };
  const EMBED_OBJ = { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] };

  beforeEach(() => {
    svc.availableModelsCache = null;
    svc.availableModelsCacheTime = 0;
  });

  it('{ page: [gemini-3.5-flash] } Pager 응답 → status: ok, shape: pager-page', async () => {
    svc.geminiClient = { models: { list: vi.fn().mockResolvedValue({ page: [FLASH_OBJ] }) } };
    const outcome = await svc.fetchModelsFromApi();
    expect(outcome.status).toBe('ok');
    expect(outcome.shape).toBe('pager-page');
    expect(outcome.models).toContain('gemini-3.5-flash');
    svc.geminiClient = null;
  });

  it('async iterator가 모델 직접 yield → status: ok, shape: async-iterator', async () => {
    async function* gen() { yield FLASH_OBJ; }
    const iterable = { [Symbol.asyncIterator]: gen };
    svc.geminiClient = { models: { list: vi.fn().mockResolvedValue(iterable) } };
    const outcome = await svc.fetchModelsFromApi();
    expect(outcome.status).toBe('ok');
    expect(outcome.shape).toBe('async-iterator');
    expect(outcome.models).toContain('gemini-3.5-flash');
    svc.geminiClient = null;
  });

  it('{ models: [...] } 레거시 형태 → status: ok, shape: models-array', async () => {
    svc.geminiClient = { models: { list: vi.fn().mockResolvedValue({ models: [FLASH_OBJ] }) } };
    const outcome = await svc.fetchModelsFromApi();
    expect(outcome.status).toBe('ok');
    expect(outcome.shape).toBe('models-array');
    expect(outcome.models).toContain('gemini-3.5-flash');
    svc.geminiClient = null;
  });

  it('{ page: [] } → status: empty-raw, shape: pager-page', async () => {
    svc.geminiClient = { models: { list: vi.fn().mockResolvedValue({ page: [] }) } };
    const outcome = await svc.fetchModelsFromApi();
    expect(outcome.status).toBe('empty-raw');
    expect(outcome.shape).toBe('pager-page');
    svc.geminiClient = null;
  });

  it('모델은 있지만 supportedActions가 generateContent 미포함 → status: filter-empty', async () => {
    svc.geminiClient = { models: { list: vi.fn().mockResolvedValue({ page: [EMBED_OBJ] }) } };
    const outcome = await svc.fetchModelsFromApi();
    expect(outcome.status).toBe('filter-empty');
    expect(outcome.rawCount).toBe(1);
    svc.geminiClient = null;
  });

  it('models.list() throw → status: api-error', async () => {
    svc.geminiClient = { models: { list: vi.fn().mockRejectedValue(new Error('network fail')) } };
    const outcome = await svc.fetchModelsFromApi();
    expect(outcome.status).toBe('api-error');
    svc.geminiClient = null;
  });
});

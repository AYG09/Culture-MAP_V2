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

import aiService, { normalizeReasoningPreset } from '../AIService';

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
    const result = svc.filterOfficialGeminiModels(['models/gemini-3.1-flash-lite', 'gemini-3.5-flash']);
    expect(result).toContain('gemini-3.1-flash-lite');
    expect(result).toContain('gemini-3.5-flash');
  });

  it('3세대 미만 구형 모델은 제외된다', () => {
    const result = svc.filterOfficialGeminiModels([
      { id: 'gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
      { id: 'gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
      { id: 'gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
      { id: 'gemini-3.5-flash', supportedGenerationMethods: ['generateContent'] },
    ]);
    expect(result).toEqual(['gemini-3.5-flash']);
  });

  it('이미지 전용 모델은 제외된다', () => {
    const result = svc.filterOfficialGeminiModels([
      { id: 'gemini-3.1-flash-lite-image', supportedGenerationMethods: ['generateContent'] },
    ]);
    expect(result).not.toContain('gemini-3.1-flash-lite-image');
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

  it('gemini-2.5-flash는 alias 표에 없으므로 null (기본 모델로 떨어진다)', () => {
    const result = svc.resolveModelAlias('gemini-2.5-flash', ['gemini-3.5-flash']);
    expect(result).toBeNull();
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

  it('gemini-2.5-flash-lite는 alias 표에 없으므로 null', () => {
    const result = svc.resolveModelAlias('gemini-2.5-flash-lite', ['gemini-3.1-flash-lite']);
    expect(result).toBeNull();
  });

  it('gemini-3-pro-preview는 gemini-3.1-pro-preview로 대체된다', () => {
    const result = svc.resolveModelAlias('gemini-3-pro-preview', ['gemini-3.1-pro-preview']);
    expect(result).toBe('gemini-3.1-pro-preview');
  });

  it('alias 대상이 available 목록에 없으면 null 반환', () => {
    const result = svc.resolveModelAlias('gemini-3.1-flash-lite-preview', ['gemini-3-flash-preview']);
    expect(result).toBeNull();
  });
});

describe('getAvailableGeminiModels fallback', () => {
  beforeEach(() => {
    svc.availableModelsCache = null;
    svc.availableModelsCacheTime = 0;
  });

  it('캐시가 없으면 gemini-3.6-flash를 첫 번째로 반환한다', () => {
    const models = svc.getAvailableGeminiModels();
    expect(models[0]).toBe('gemini-3.6-flash');
  });

  it('fallback 목록에는 3세대 미만 모델이 없다', () => {
    const models: string[] = svc.getAvailableGeminiModels();
    expect(models.every((m) => /^gemini-3/.test(m))).toBe(true);
  });
});

describe('normalizeModelConfig', () => {
  beforeEach(() => {
    svc.availableModelsCache = null;
    svc.availableModelsCacheTime = 0;
  });

  it('구형 저장값 gemini-2.5-flash-lite는 기본 모델로 대체된다', () => {
    svc.availableModelsCache = ['gemini-3.1-flash-lite', 'gemini-3-flash-preview'];
    const config = svc.normalizeModelConfig({
      provider: 'gemini',
      apiKey: 'test',
      modelName: 'gemini-2.5-flash-lite',
    });
    expect(config.modelName).toBe('gemini-3.1-flash-lite');
    svc.availableModelsCache = null;
  });

  it('구형 모델은 available 목록에 들어 있어도 선택되지 않는다', () => {
    svc.availableModelsCache = ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite'];
    const config = svc.normalizeModelConfig({
      provider: 'gemini',
      apiKey: 'test',
      modelName: 'gemini-2.5-flash-lite',
    });
    expect(config.modelName).toBe('gemini-3.1-flash-lite');
    svc.availableModelsCache = null;
  });

  it('구형 저장값 gemini-2.5-pro도 3.x 기본 모델로 대체된다', () => {
    svc.availableModelsCache = ['gemini-2.5-pro', 'gemini-3.1-flash-lite'];
    const config = svc.normalizeModelConfig({
      provider: 'gemini',
      apiKey: 'test',
      modelName: 'gemini-2.5-pro',
    });
    expect(config.modelName).toBe('gemini-3.1-flash-lite');
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

  it('모델명이 없으면 DEFAULT_GEMINI_MODEL(gemini-3.6-flash)을 사용한다', () => {
    const config = svc.normalizeModelConfig({
      provider: 'gemini',
      apiKey: 'test',
    });
    expect(config.modelName).toBe('gemini-3.6-flash');
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

  it('gemini-3.5-flash는 gemini-3 계열로 판별된다', () => {
    expect(svc.getGeminiModelFamily('gemini-3.5-flash')).toBe('gemini-3');
  });

  it('gemini-3.6-flash 등 상위 세대도 gemini-3 계열로 판별된다', () => {
    expect(svc.getGeminiModelFamily('gemini-3.6-flash')).toBe('gemini-3');
  });

  it('구형 gemini-2.5 계열은 other로 판별된다', () => {
    expect(svc.getGeminiModelFamily('gemini-2.5-flash')).toBe('other');
    expect(svc.getGeminiModelFamily('gemini-2.5-pro')).toBe('other');
    expect(svc.getGeminiModelFamily('gemini-2.5-flash-lite')).toBe('other');
  });

  it('알 수 없는 모델은 other로 판별된다', () => {
    expect(svc.getGeminiModelFamily('gpt-4o')).toBe('other');
  });
});

describe('normalizeReasoningPreset', () => {
  it('구버전 프리셋명은 현행 thinking level로 옮겨진다', () => {
    expect(normalizeReasoningPreset('fast')).toBe('low');
    expect(normalizeReasoningPreset('balanced')).toBe('medium');
    expect(normalizeReasoningPreset('deep')).toBe('high');
  });

  it('현행 값은 그대로 유지된다', () => {
    for (const level of ['default', 'minimal', 'low', 'medium', 'high']) {
      expect(normalizeReasoningPreset(level)).toBe(level);
    }
  });

  it('알 수 없는 값이나 비문자열은 default로 보정된다', () => {
    expect(normalizeReasoningPreset('bogus')).toBe('default');
    expect(normalizeReasoningPreset(undefined)).toBe('default');
    expect(normalizeReasoningPreset(42)).toBe('default');
  });
});

describe('getThinkingConfig', () => {
  it('default: includeThoughts만 있고 thinkingLevel 없음 (모델 기본 추론 사용)', () => {
    const cfg = svc.getThinkingConfig('gemini-3.1-flash-lite', 'default');
    expect(cfg).not.toBeNull();
    expect(cfg).toHaveProperty('includeThoughts', true);
    expect(cfg).not.toHaveProperty('thinkingLevel');
  });

  it('minimal/low/medium/high는 그대로 thinkingLevel로 전달된다', () => {
    for (const level of ['minimal', 'low', 'medium', 'high'] as const) {
      const cfg = svc.getThinkingConfig('gemini-3.5-flash', level);
      expect(cfg).toHaveProperty('thinkingLevel', level);
      expect(cfg).toHaveProperty('includeThoughts', true);
    }
  });

  it('Pro 모델도 medium을 그대로 쓴다 (구버전 high fallback 제거됨)', () => {
    const cfg = svc.getThinkingConfig('gemini-3.1-pro-preview', 'medium');
    expect(cfg).toHaveProperty('thinkingLevel', 'medium');
  });

  it('구형 2.5 모델은 null (thinkingBudget 경로 제거됨)', () => {
    expect(svc.getThinkingConfig('gemini-2.5-flash', 'high')).toBeNull();
    expect(svc.getThinkingConfig('gemini-2.5-pro', 'default')).toBeNull();
  });

  it('알 수 없는 모델은 어떤 preset이든 null', () => {
    expect(svc.getThinkingConfig('gpt-4o', 'high')).toBeNull();
  });

  it('어떤 조합에서도 thinkingBudget은 포함되지 않는다', () => {
    const models = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3-flash-preview',
                    'gemini-3.1-pro-preview', 'gemini-2.5-flash', 'gpt-4o'];
    const presets: Array<'default' | 'minimal' | 'low' | 'medium' | 'high'> =
      ['default', 'minimal', 'low', 'medium', 'high'];
    for (const model of models) {
      for (const preset of presets) {
        const cfg = svc.getThinkingConfig(model, preset);
        if (cfg) expect(cfg).not.toHaveProperty('thinkingBudget');
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

  it('현행 값은 그대로 유지된다', () => {
    const config = svc.normalizeModelConfig({ provider: 'gemini', apiKey: 'test', reasoningPreset: 'high' });
    expect(config.reasoningPreset).toBe('high');
  });

  it('구버전 저장값 deep은 high로 마이그레이션된다', () => {
    const config = svc.normalizeModelConfig({ provider: 'gemini', apiKey: 'test', reasoningPreset: 'deep' });
    expect(config.reasoningPreset).toBe('high');
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

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHasIndex, mockRetrieveContext, mockGetLastRetrievalError } = vi.hoisted(() => ({
  mockHasIndex: vi.fn(),
  mockRetrieveContext: vi.fn(),
  mockGetLastRetrievalError: vi.fn(),
}));

vi.mock('../RagService', () => ({
  default: {
    hasIndex: mockHasIndex,
    retrieveContext: mockRetrieveContext,
    getLastRetrievalError: mockGetLastRetrievalError,
    setClient: vi.fn(),
  },
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

describe('AIService academic grounding fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockHasIndex.mockResolvedValue(true);
    mockRetrieveContext.mockResolvedValue(null);
    mockGetLastRetrievalError.mockReturnValue('현재 Gemini 임베딩 모델을 사용할 수 없어 업로드된 문헌 검색을 건너뛰었습니다.');
    vi.spyOn(aiService as any, 'searchWeb').mockResolvedValue({
      status: 'unavailable',
      contextText: '',
      sources: [],
    });
  });

  it('학술 검색 장애를 맵 데이터 부재로 오인하지 않도록 폴백 프롬프트를 고정한다', async () => {
    const result = await (aiService as any).prepareAcademicGrounding('샤인 이론으로 현재 조직문화를 설명해줘');

    expect(result.status).toBe('fallback');
    expect(result.prompt).toContain('임베딩 검색을 사용할 수 없어');
    expect(result.prompt).toContain('현재 Culture Map 데이터 유무와 문헌 검색 가능 여부는 별개');
    expect(result.evidence.note).toContain('문헌 검색 시스템 문제');
  });

  it('현재 설정된 RAG 검색 범위를 학술 검색 호출에 전달한다', async () => {
    (aiService as any).currentConfig = {
      provider: 'gemini',
      apiKey: 'test-key',
      modelName: 'gemini-3.1-flash-lite',
      ragSearchScope: 'shared',
    };

    await (aiService as any).prepareAcademicGrounding('샤인 이론으로 현재 조직문화를 설명해줘');

    expect(mockRetrieveContext).toHaveBeenCalledWith(
      '샤인 이론으로 현재 조직문화를 설명해줘',
      expect.objectContaining({ scope: 'shared' })
    );
  });
});

describe('AIService sendChatMessageStream — groundingMode', () => {
  const svc = aiService as any;
  let prepareGroundingSpy: ReturnType<typeof vi.spyOn>;
  let sendMessageStream: ReturnType<typeof vi.fn>;
  let createChat: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    sendMessageStream = vi.fn().mockResolvedValue((async function* () {})());
    createChat = vi.fn().mockReturnValue({ sendMessageStream });
    // stub chat session so the generator doesn't need a real client
    svc.chatSession = {
      sendMessageStream,
    };
    svc.geminiClient = {
      chats: {
        create: createChat,
      },
    };
    svc.currentConfig = { provider: 'gemini', apiKey: 'test-key', modelName: 'gemini-3.1-flash-lite' };
    prepareGroundingSpy = vi.spyOn(svc, 'prepareAcademicGrounding').mockResolvedValue({
      status: 'not-needed',
      prompt: 'test',
      evidence: { level: 'general', summary: '일반 지식 기반 답변' },
    });
  });

  async function drain(gen: AsyncGenerator<unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of gen) { /* drain */ }
  }

  it('groundingMode: auto는 prepareAcademicGrounding()을 호출한다', async () => {
    const gen = svc.sendChatMessageStream('test prompt', undefined, undefined, { groundingMode: 'auto' });
    await drain(gen);
    expect(prepareGroundingSpy).toHaveBeenCalled();
  });

  it('groundingMode: none은 prepareAcademicGrounding()을 호출하지 않는다', async () => {
    const gen = svc.sendChatMessageStream('test prompt', undefined, undefined, { groundingMode: 'none' });
    await drain(gen);
    expect(prepareGroundingSpy).not.toHaveBeenCalled();
    expect(createChat).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.not.objectContaining({
        tools: expect.anything(),
      }),
    }));
  });

  it('groundingMode: attached-files-only는 prepareAcademicGrounding()을 호출하지 않는다', async () => {
    const gen = svc.sendChatMessageStream('test prompt', undefined, undefined, { groundingMode: 'attached-files-only' });
    await drain(gen);
    expect(prepareGroundingSpy).not.toHaveBeenCalled();
    expect(createChat).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.not.objectContaining({
        tools: expect.anything(),
      }),
    }));
  });

  it('groundingMode 없음(기본값)은 auto처럼 prepareAcademicGrounding()을 호출한다', async () => {
    const gen = svc.sendChatMessageStream('test prompt');
    await drain(gen);
    expect(prepareGroundingSpy).toHaveBeenCalled();
  });
});

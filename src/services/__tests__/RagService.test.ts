import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSharedRagChunks } = vi.hoisted(() => ({
  mockGetSharedRagChunks: vi.fn(() => []),
}));

vi.mock('../DocumentService', () => ({
  default: {
    iteratePdfPages: vi.fn(),
  },
}));

vi.mock('../LiveblocksService', () => ({
  default: {
    getSharedRagChunks: mockGetSharedRagChunks,
    hasSharedRagDoc: vi.fn(() => false),
    addSharedRagChunks: vi.fn(),
    removeSharedRagDoc: vi.fn(),
    getCurrentUserId: vi.fn(() => 'user-1'),
    getCurrentUserDisplayName: vi.fn(() => 'User 1'),
  },
}));

import ragService from '../RagService';

describe('RagService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSharedRagChunks.mockReturnValue([]);
    ragService.setClient(null);
    (ragService as any).cachedChunks = [
      {
        id: 'chunk-1',
        docId: 'doc-1',
        docName: 'Schein.pdf',
        content: '조직문화는 공유된 기본 가정의 패턴이다.',
        embedding: [1, 0],
        pageNumber: 12,
      },
    ];
    (ragService as any).loadingPromise = null;
    (ragService as any).resolvedEmbeddingModel = null;
    (ragService as any).lastRetrievalError = null;
  });

  it('text-embedding-004가 실패하면 대체 임베딩 모델로 재시도한다', async () => {
    const embedContent = vi
      .fn()
      .mockRejectedValueOnce(new Error('models/text-embedding-004 is not found for API version v1beta'))
      .mockResolvedValueOnce({
        embeddings: [{ values: [1, 0] }],
      });

    ragService.setClient({
      models: {
        embedContent,
      },
    } as any);

    const result = await ragService.retrieveContext('샤인의 조직문화 이론', {
      topK: 1,
      minScore: 0,
      maxContextChars: 500,
      scope: 'local',
    });

    expect(result?.contextText).toContain('Schein.pdf');
    expect(embedContent).toHaveBeenCalledTimes(2);
    expect(embedContent.mock.calls[0][0].model).toBe('text-embedding-004');
    expect(embedContent.mock.calls[1][0].model).toBe('embedding-001');
    expect(ragService.getLastRetrievalError()).toBeNull();
  });

  it('모든 임베딩 모델이 실패하면 예외를 삼키고 조회를 null로 돌려준다', async () => {
    const embedContent = vi
      .fn()
      .mockRejectedValue(new Error('models/text-embedding-004 is not found for API version v1beta'));

    ragService.setClient({
      models: {
        embedContent,
      },
    } as any);

    const result = await ragService.retrieveContext('샤인의 조직문화 이론', { scope: 'local' });

    expect(result).toBeNull();
    expect(embedContent).toHaveBeenCalledTimes(3);
    expect(ragService.getLastRetrievalError()).toContain('Gemini 임베딩 모델을 사용할 수 없어');
  });

  it('검색 범위가 local이면 로컬 청크만 검색한다', async () => {
    const embedContent = vi.fn().mockResolvedValue({
      embeddings: [{ values: [1, 0] }],
    });

    mockGetSharedRagChunks.mockReturnValue([
      {
        id: 'shared-1',
        docId: 'shared-doc-1',
        docName: 'Shared.pdf',
        content: '공유 문헌 내용',
        embedding: [0, 1],
      },
    ]);

    ragService.setClient({ models: { embedContent } } as any);

    const result = await ragService.retrieveContext('샤인의 조직문화 이론', {
      topK: 1,
      minScore: 0,
      scope: 'local',
    });

    expect(result?.contextText).toContain('Schein.pdf');
    expect(result?.contextText).not.toContain('Shared.pdf');
  });

  it('검색 범위가 shared면 공유 청크만 검색한다', async () => {
    const embedContent = vi.fn().mockResolvedValue({
      embeddings: [{ values: [0, 1] }],
    });

    mockGetSharedRagChunks.mockReturnValue([
      {
        id: 'shared-1',
        docId: 'shared-doc-1',
        docName: 'Shared.pdf',
        content: '공유 문헌 내용',
        embedding: [0, 1],
      },
    ]);

    ragService.setClient({ models: { embedContent } } as any);

    const result = await ragService.retrieveContext('공유 문헌 내용', {
      topK: 1,
      minScore: 0,
      scope: 'shared',
    });

    expect(result?.contextText).toContain('Shared.pdf');
    expect(result?.contextText).not.toContain('Schein.pdf');
  });
});
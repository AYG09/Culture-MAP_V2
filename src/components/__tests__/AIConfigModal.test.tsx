import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AIConfigModal from '../AIConfigModal';
import type { AIConfig, GeminiModelListResult } from '../../services/AIService';

const TEST_GEMINI_KEY = 'test-gemini-key';
const TEST_TAVILY_KEY = 'REDACTED';

const {
  mockGetConfig,
  mockSetConfig,
  mockGetAvailableGeminiModels,
  mockGetAvailableGeminiModelsAsync,
  mockGetAvailableGeminiModelsResult,
  mockGetAcademicFiles,
  mockAddAcademicFile,
  mockRemoveAcademicFile,
  mockGetSharedRagDocList,
  mockRemoveSharedRagDocument,
} = vi.hoisted(() => ({
  mockGetConfig: vi.fn<() => AIConfig | null>(),
  mockSetConfig: vi.fn<(config: AIConfig) => void>(),
  mockGetAvailableGeminiModels: vi.fn<() => string[]>(),
  mockGetAvailableGeminiModelsAsync: vi.fn<() => Promise<string[]>>(),
  mockGetAvailableGeminiModelsResult: vi.fn<() => Promise<GeminiModelListResult>>(),
  mockGetAcademicFiles: vi.fn<() => Array<{ name: string; displayName: string; mimeType: string }>>(),
  mockAddAcademicFile: vi.fn<(file: File) => Promise<unknown>>(),
  mockRemoveAcademicFile: vi.fn<(fileName: string) => void>(),
  mockGetSharedRagDocList: vi.fn<() => Array<{ docId: string; docName: string; uploaderId: string; uploaderName: string; chunkCount: number; uploadedAt: number }>>(),
  mockRemoveSharedRagDocument: vi.fn<(docId: string) => void>(),
}));

vi.mock('../../services/AIService', () => ({
  aiService: {
    getConfig: mockGetConfig,
    setConfig: mockSetConfig,
    getAvailableGeminiModels: mockGetAvailableGeminiModels,
    getAvailableGeminiModelsAsync: mockGetAvailableGeminiModelsAsync,
    getAvailableGeminiModelsResult: mockGetAvailableGeminiModelsResult,
    ensureClientInitialized: vi.fn(() => true),
    getAcademicFiles: mockGetAcademicFiles,
    addAcademicFile: mockAddAcademicFile,
    removeAcademicFile: mockRemoveAcademicFile,
    uploadAcademicFileWithOptions: vi.fn(),
    indexAcademicPdfToShared: vi.fn(),
    removeSharedRagDocument: mockRemoveSharedRagDocument,
  },
}));

vi.mock('../../services/LiveblocksService', () => ({
  default: {
    getCurrentUserId: vi.fn(() => 'user-1'),
    getSharedRagDocList: mockGetSharedRagDocList,
    onSharedRagChunks: vi.fn(() => () => {}),
    getCurrentSession: vi.fn(() => null),
    updateSessionType: vi.fn(),
  },
}));

describe('AIConfigModal', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetConfig.mockReturnValue({
      provider: 'gemini',
      apiKey: TEST_GEMINI_KEY,
      tavilyApiKey: undefined,
      modelName: 'gemini-3.1-flash-lite',
      ragSearchScope: 'shared',
      autoExecuteFunctionCalls: false,
      sharedApiKeyMode: false,
    });
    mockGetAvailableGeminiModels.mockReturnValue(['gemini-3.1-flash-lite']);
    mockGetAvailableGeminiModelsAsync.mockResolvedValue(['gemini-3.1-flash-lite']);
    mockGetAvailableGeminiModelsResult.mockResolvedValue({ models: ['gemini-3.1-flash-lite'], source: 'api' });
    mockGetAcademicFiles.mockReturnValue([]);
    mockGetSharedRagDocList.mockReturnValue([]);
    mockAddAcademicFile.mockResolvedValue(undefined);
    mockRemoveAcademicFile.mockImplementation(() => undefined);
    mockSetConfig.mockImplementation((config) => {
      localStorage.setItem('culture-map-ai-config', JSON.stringify(config));
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Tavily 키를 입력하고 저장하면 설정에 반영된다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<AIConfigModal isOpen={true} onClose={onClose} />);

    const tavilyInput = screen.getByPlaceholderText('선택 사항: Tavily API 키를 입력하세요');
    expect(tavilyInput).toBeVisible();

    await user.clear(tavilyInput);
    await user.type(tavilyInput, TEST_TAVILY_KEY);
    await user.click(screen.getByRole('button', { name: /설정 저장/ }));

    await waitFor(() => {
      expect(mockSetConfig).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'gemini',
        apiKey: TEST_GEMINI_KEY,
        tavilyApiKey: TEST_TAVILY_KEY,
        ragSearchScope: 'shared',
      }));
    });

    const storedConfig = JSON.parse(localStorage.getItem('culture-map-ai-config') || '{}');
    expect(storedConfig.tavilyApiKey).toBe(TEST_TAVILY_KEY);
  });

  it('닫았다가 다시 열면 저장된 설정값으로 다시 초기화된다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { rerender } = render(<AIConfigModal isOpen={true} onClose={onClose} />);

    const tavilyInput = screen.getByPlaceholderText('선택 사항: Tavily API 키를 입력하세요');
    await user.clear(tavilyInput);
    await user.type(tavilyInput, 'draft-unsaved-key');
    expect(tavilyInput).toHaveValue('draft-unsaved-key');

    rerender(<AIConfigModal isOpen={false} onClose={onClose} />);
    rerender(<AIConfigModal isOpen={true} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('선택 사항: Tavily API 키를 입력하세요')).toHaveValue('');
    });
  });

  it('학술자료 검색 범위는 세션 RAG로 고정 저장된다', async () => {
    const user = userEvent.setup();

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('세션 RAG만 사용')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /설정 저장/ }));

    await waitFor(() => {
      expect(mockSetConfig).toHaveBeenCalledWith(expect.objectContaining({
        ragSearchScope: 'shared',
      }));
    });
  });

  it('세션 RAG 문서 삭제 버튼이 removeSharedRagDocument를 호출한다', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockGetSharedRagDocList.mockReturnValue([
      { docId: 'shared-doc-1', docName: '공유 문헌.pdf', uploaderId: 'user-1', uploaderName: 'User 1', chunkCount: 3, uploadedAt: Date.now() },
    ]);

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await user.click(screen.getByTitle('삭제'));

    expect(mockRemoveSharedRagDocument).toHaveBeenCalledWith('shared-doc-1');
    confirmSpy.mockRestore();
  });

  it('models.list() mock이 gemini-3.1-flash-lite를 반환하면 선택 목록에 Stable 모델이 표시된다', async () => {
    mockGetAvailableGeminiModelsResult.mockResolvedValue({ models: ['gemini-3.1-flash-lite', 'gemini-3-flash-preview'], source: 'api' });

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      const modelSelect = selects[0];
      const options = Array.from(modelSelect.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value);
      expect(options).toContain('gemini-3.1-flash-lite');
    });
  });

  it('API 결과가 정상이면 fallback 경고가 표시되지 않는다', async () => {
    mockGetAvailableGeminiModelsResult.mockResolvedValue({ models: ['gemini-3.5-flash'], source: 'api' });

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText(/모델 목록 조회 실패/)).not.toBeInTheDocument();
    });
  });

  it('캐시 결과(source: cache)에서는 fallback 경고가 표시되지 않는다', async () => {
    mockGetAvailableGeminiModelsResult.mockResolvedValue({ models: ['gemini-3.5-flash'], source: 'cache' });

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText(/모델 목록 조회 실패/)).not.toBeInTheDocument();
    });
  });

  it('reason: api-error이면 API 키 관련 정확한 경고 문구가 표시된다', async () => {
    mockGetAvailableGeminiModelsResult.mockResolvedValue({
      models: ['gemini-3.5-flash'],
      source: 'fallback',
      reason: 'api-error',
      hasConfiguredApiKey: true,
      clientReady: true,
    });

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/저장된 API 키로 Google 모델 목록 조회에 실패했습니다/)).toBeInTheDocument();
    });
  });

  it('reason: stale-cache-after-refresh-error이면 stale cache 경고 문구가 표시된다', async () => {
    mockGetAvailableGeminiModelsResult.mockResolvedValue({
      models: ['gemini-3.5-flash'],
      source: 'cache',
      stale: true,
      reason: 'stale-cache-after-refresh-error',
    });

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/최신 목록 조회에 실패해 이전에 조회한 모델 목록을 표시합니다/)).toBeInTheDocument();
    });
  });

  it('reason: filter-empty이면 필터 관련 경고 문구가 표시된다', async () => {
    mockGetAvailableGeminiModelsResult.mockResolvedValue({
      models: ['gemini-3.5-flash'],
      source: 'fallback',
      reason: 'filter-empty',
      rawCount: 5,
      filteredCount: 0,
    });

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Google 응답은 있었지만 생성 가능한 Gemini 모델을 찾지 못했습니다/)).toBeInTheDocument();
    });
  });

  it('reason: client-not-initialized이면 클라이언트 미초기화 경고 문구가 표시된다', async () => {
    mockGetAvailableGeminiModelsResult.mockResolvedValue({
      models: ['gemini-3.5-flash'],
      source: 'fallback',
      reason: 'client-not-initialized',
      hasConfiguredApiKey: true,
      clientReady: false,
    });

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/AI 클라이언트가 초기화되지 않았습니다/)).toBeInTheDocument();
    });
  });

  it('API 키 있음 + 기존 캐시 있음 + 강제 새로고침 실패 → stale cache 사용, fallback 아님', async () => {
    mockGetAvailableGeminiModelsResult.mockResolvedValue({
      models: ['gemini-3.5-flash', 'gemini-3.1-flash-lite'],
      source: 'cache',
      stale: true,
      reason: 'stale-cache-after-refresh-error',
    });

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      // stale cache이므로 모델은 표시되고, 경고는 stale 문구
      const selects = screen.getAllByRole('combobox');
      const options = Array.from(selects[0].querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value);
      expect(options).toContain('gemini-3.5-flash');
      expect(screen.getByText(/최신 목록 조회에 실패해 이전에 조회한 모델 목록을 표시합니다/)).toBeInTheDocument();
    });
  });

  it('API 키 있음 + models.list() throw → reason: api-error', async () => {
    mockGetAvailableGeminiModelsResult.mockResolvedValue({
      models: ['gemini-3.5-flash'],
      source: 'fallback',
      reason: 'api-error',
      errorMessage: 'network error',
      hasConfiguredApiKey: true,
      clientReady: true,
    });

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/저장된 API 키로 Google 모델 목록 조회에 실패했습니다/)).toBeInTheDocument();
    });
  });

  it('source: api이면 어떤 경고도 표시되지 않는다', async () => {
    mockGetAvailableGeminiModelsResult.mockResolvedValue({
      models: ['gemini-3.5-flash'],
      source: 'api',
      rawCount: 10,
      filteredCount: 1,
      hasConfiguredApiKey: true,
      clientReady: true,
    });

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument();
      expect(screen.queryByText(/조회에 실패/)).not.toBeInTheDocument();
      expect(screen.queryByText(/목록을 표시합니다/)).not.toBeInTheDocument();
    });
  });

  it('모델 목록 조회 예외 발생 시 catch 경고 문구가 표시된다', async () => {
    mockGetAvailableGeminiModelsResult.mockRejectedValue(new Error('network error'));

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/저장된 API 키로 Google 모델 목록 조회에 실패했습니다/)).toBeInTheDocument();
    });
  });

  it('설정창 open 시 getAvailableGeminiModelsResult가 forceRefresh=true로 호출된다', async () => {
    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(mockGetAvailableGeminiModelsResult).toHaveBeenCalledWith(true);
    });
  });

  it('generateContent를 지원하지 않는 모델은 선택 목록에 없다', async () => {
    mockGetAvailableGeminiModelsResult.mockResolvedValue({ models: ['gemini-3.1-flash-lite'], source: 'api' });

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      // 첫 번째 combobox가 모델 선택
      const selects = screen.getAllByRole('combobox');
      const modelSelect = selects[0];
      const options = Array.from(modelSelect.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value);
      expect(options).not.toContain('text-embedding-004');
      expect(options).not.toContain('imagen-3');
    });
  });

  it('설정 모달에 추론 깊이 select가 표시된다', async () => {
    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      // 두 번째 combobox가 추론 깊이 select
      expect(selects.length).toBeGreaterThanOrEqual(2);
      const presetSelect = selects[1];
      const options = Array.from(presetSelect.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value);
      expect(options).toContain('default');
      expect(options).toContain('fast');
      expect(options).toContain('balanced');
      expect(options).toContain('deep');
    });
  });

  it('preset 선택 후 저장하면 setConfig에 reasoningPreset이 포함된다', async () => {
    const user = userEvent.setup();
    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[1], 'deep');
    await user.click(screen.getByRole('button', { name: /설정 저장/ }));

    await waitFor(() => {
      expect(mockSetConfig).toHaveBeenCalledWith(expect.objectContaining({
        reasoningPreset: 'deep',
      }));
    });
  });

  it('기존 config에 preset이 있으면 모달 재오픈 시 값이 유지된다', async () => {
    mockGetConfig.mockReturnValue({
      provider: 'gemini',
      apiKey: TEST_GEMINI_KEY,
      modelName: 'gemini-3.1-flash-lite',
      reasoningPreset: 'balanced',
      ragSearchScope: 'shared',
      autoExecuteFunctionCalls: false,
      sharedApiKeyMode: false,
    });

    const { rerender } = render(<AIConfigModal isOpen={false} onClose={vi.fn()} />);
    rerender(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      expect((selects[1] as HTMLSelectElement).value).toBe('balanced');
    });
  });

  it('모델이 3.x일 때와 2.5일 때 추론 설명 문구가 다르다', async () => {
    const user = userEvent.setup();
    mockGetAvailableGeminiModelsResult.mockResolvedValue({ models: ['gemini-3.1-flash-lite', 'gemini-2.5-flash'], source: 'api' });
    mockGetConfig.mockReturnValue({
      provider: 'gemini',
      apiKey: TEST_GEMINI_KEY,
      modelName: 'gemini-3.1-flash-lite',
      reasoningPreset: 'deep',
      ragSearchScope: 'shared',
      autoExecuteFunctionCalls: false,
      sharedApiKeyMode: false,
    });

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Gemini 3\.x.*높은 추론/)).toBeInTheDocument();
    });

    // 2.5 모델로 전환
    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'gemini-2.5-flash');

    await waitFor(() => {
      expect(screen.getByText(/Gemini 2\.5.*높은 토큰 예산/)).toBeInTheDocument();
    });
  });
});
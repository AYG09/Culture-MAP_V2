import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AIConfigModal from '../AIConfigModal';
import type { AIConfig } from '../../services/AIService';

const TEST_GEMINI_KEY = 'test-gemini-key';
const TEST_TAVILY_KEY = 'REDACTED';

const {
  mockGetConfig,
  mockSetConfig,
  mockGetAvailableGeminiModels,
  mockGetAvailableGeminiModelsAsync,
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
      modelName: 'gemini-2.5-flash-lite',
      ragSearchScope: 'shared',
      autoExecuteFunctionCalls: false,
      sharedApiKeyMode: false,
    });
    mockGetAvailableGeminiModels.mockReturnValue(['gemini-2.5-flash-lite']);
    mockGetAvailableGeminiModelsAsync.mockResolvedValue(['gemini-2.5-flash-lite']);
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
});
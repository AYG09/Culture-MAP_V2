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
  mockRemoveSharedRagDocument,
} = vi.hoisted(() => ({
  mockGetConfig: vi.fn<() => AIConfig | null>(),
  mockSetConfig: vi.fn<(config: AIConfig) => void>(),
  mockGetAvailableGeminiModels: vi.fn<() => string[]>(),
  mockGetAvailableGeminiModelsAsync: vi.fn<() => Promise<string[]>>(),
  mockGetAcademicFiles: vi.fn<() => Array<{ name: string; displayName: string; mimeType: string }>>(),
  mockAddAcademicFile: vi.fn<(file: File) => Promise<unknown>>(),
  mockRemoveAcademicFile: vi.fn<(fileName: string) => void>(),
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
    getSharedRagDocList: vi.fn(() => []),
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
      ragSearchScope: 'both',
      autoExecuteFunctionCalls: false,
      sharedApiKeyMode: false,
    });
    mockGetAvailableGeminiModels.mockReturnValue(['gemini-2.5-flash-lite']);
    mockGetAvailableGeminiModelsAsync.mockResolvedValue(['gemini-2.5-flash-lite']);
    mockGetAcademicFiles.mockReturnValue([]);
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
        ragSearchScope: 'both',
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

  it('RAG 검색 범위를 변경하고 저장하면 설정에 반영된다', async () => {
    const user = userEvent.setup();

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '공유만' }));
    await user.click(screen.getByRole('button', { name: /설정 저장/ }));

    await waitFor(() => {
      expect(mockSetConfig).toHaveBeenCalledWith(expect.objectContaining({
        ragSearchScope: 'shared',
      }));
    });
  });

  it('로컬 RAG 문서 삭제 버튼이 removeAcademicFile을 호출한다', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockGetAcademicFiles.mockReturnValue([
      { name: 'local-doc-1', displayName: '로컬 문헌.pdf', mimeType: 'application/pdf' },
    ]);

    render(<AIConfigModal isOpen={true} onClose={vi.fn()} />);

    await user.click(screen.getByTitle('삭제'));

    expect(mockRemoveAcademicFile).toHaveBeenCalledWith('local-doc-1');
    confirmSpy.mockRestore();
  });
});
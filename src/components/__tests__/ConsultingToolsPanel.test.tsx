import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConsultingToolsPanel from '../ConsultingToolsPanel';

const { mockExtractTextFromPDF } = vi.hoisted(() => ({
  mockExtractTextFromPDF: vi.fn(),
}));

vi.mock('../../services/DocumentService', () => ({
  default: {
    extractTextFromPDF: mockExtractTextFromPDF,
  },
}));

// fetch 모킹
const mockFetch = vi.fn();
global.fetch = mockFetch;

// clipboard 모킹 — JSDOM clipboard API polyfill
const mockClipboardWrite = vi.fn().mockResolvedValue(undefined);
if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: mockClipboardWrite },
    configurable: true,
  });
} else {
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(mockClipboardWrite);
}

const SAMPLE_PROMPT = '# 1차 분석\n\n제공된 자료만 근거로 분석합니다.';

describe('ConsultingToolsPanel', () => {
  const onFillInput = vi.fn();
  const onRunAnalysis = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_PROMPT,
    });
    mockClipboardWrite.mockResolvedValue(undefined);
    mockExtractTextFromPDF.mockResolvedValue('PDF에서 추출한 인터뷰 내용');
  });

  it('카드 클릭 시 즉시 onFillInput/onRunAnalysis가 호출되지 않는다', async () => {
    render(<ConsultingToolsPanel onFillInput={onFillInput} onRunAnalysis={onRunAnalysis} />);

    await user.click(screen.getByRole('button', { name: /Step 1 1차 분석 선택/ }));

    // 프롬프트 로드 완료를 기다림
    await waitFor(() => {
      expect(screen.getByText('프롬프트만 복사')).toBeInTheDocument();
    });

    // 즉시 전송 없음
    expect(onFillInput).not.toHaveBeenCalled();
    expect(onRunAnalysis).not.toHaveBeenCalled();
  });

  it('카드 클릭 후 준비 패널(prep-panel)이 열린다', async () => {
    render(<ConsultingToolsPanel onFillInput={onFillInput} onRunAnalysis={onRunAnalysis} />);

    await user.click(screen.getByRole('button', { name: /Step 1 1차 분석 선택/ }));

    await waitFor(() => {
      expect(screen.getByText('프롬프트만 복사')).toBeInTheDocument();
      expect(screen.getByText('채팅 입력창에 넣기')).toBeInTheDocument();
      expect(screen.getByText('선택한 자료로 분석 실행')).toBeInTheDocument();
    });
  });

  it('프롬프트만 복사 버튼 클릭 후 "복사됨!" 피드백이 표시된다', async () => {
    render(<ConsultingToolsPanel onFillInput={onFillInput} onRunAnalysis={onRunAnalysis} />);

    await user.click(screen.getByRole('button', { name: /Step 1 1차 분석 선택/ }));
    await waitFor(() => screen.getByText('프롬프트만 복사'));

    await user.click(screen.getByText('프롬프트만 복사'));

    // UI 피드백 확인 (클립보드 API 없어도 fallback 복사 후 상태 전환)
    await waitFor(() => expect(screen.getByText('복사됨!')).toBeInTheDocument());
    // 성공 메시지도 표시
    await waitFor(() => expect(screen.getByText(/프롬프트가 복사되었습니다/)).toBeInTheDocument());
  });

  it('채팅 입력창에 넣기는 onFillInput을 호출하고 전송하지 않는다', async () => {
    render(<ConsultingToolsPanel onFillInput={onFillInput} onRunAnalysis={onRunAnalysis} />);

    await user.click(screen.getByRole('button', { name: /Step 1 1차 분석 선택/ }));
    await waitFor(() => screen.getByText('채팅 입력창에 넣기'));

    await user.click(screen.getByText('채팅 입력창에 넣기'));

    expect(onFillInput).toHaveBeenCalledWith(SAMPLE_PROMPT, 'Step 1: 1차 분석');
    expect(onRunAnalysis).not.toHaveBeenCalled();
  });

  it('선택 자료가 없으면 선택한 자료로 분석 실행이 실행되지 않고 안내 문구를 표시한다', async () => {
    render(<ConsultingToolsPanel onFillInput={onFillInput} onRunAnalysis={onRunAnalysis} />);

    await user.click(screen.getByRole('button', { name: /Step 1 1차 분석 선택/ }));
    await waitFor(() => screen.getByText('선택한 자료로 분석 실행'));

    await user.click(screen.getByText('선택한 자료로 분석 실행'));

    expect(onRunAnalysis).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText(/분석에 사용할 자료를 먼저 선택해주세요/)).toBeInTheDocument();
    });
  });

  it('PDF 자료는 일반 file.text()가 아니라 PDF 텍스트 추출기를 사용한다', async () => {
    render(<ConsultingToolsPanel onFillInput={onFillInput} onRunAnalysis={onRunAnalysis} />);

    await user.click(screen.getByRole('button', { name: /Step 1 1차 분석 선택/ }));
    await waitFor(() => screen.getByText('자료 추가'));

    const pdfFile = new File(['%PDF-binary-content'], 'interview.pdf', { type: 'application/pdf' });
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, pdfFile);

    await waitFor(() => expect(screen.getByText('interview.pdf')).toBeInTheDocument());
    expect(mockExtractTextFromPDF).toHaveBeenCalledWith(pdfFile);

    await user.click(screen.getByText('선택한 자료로 분석 실행'));
    expect(onRunAnalysis).toHaveBeenCalledWith(
      SAMPLE_PROMPT,
      'Step 1: 1차 분석',
      expect.arrayContaining([
        expect.objectContaining({
          name: 'interview.pdf',
          content: 'PDF에서 추출한 인터뷰 내용',
        }),
      ])
    );
  });

  it('분석 자료함 힌트 문구가 표시된다', () => {
    render(<ConsultingToolsPanel onFillInput={onFillInput} onRunAnalysis={onRunAnalysis} />);
    expect(screen.getByText(/카드를 선택한 뒤 자료를 확인하고 실행하거나/)).toBeInTheDocument();
  });
});

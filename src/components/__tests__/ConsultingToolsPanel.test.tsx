import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      expect(screen.getByText(/분석에 사용할 원천자료를 먼저 선택해주세요/)).toBeInTheDocument();
    });
  });

  it('Step 2는 Step 1 결과를 소스로 받아 컬쳐맵 생성 분석을 실행한다', async () => {
    render(<ConsultingToolsPanel onFillInput={onFillInput} onRunAnalysis={onRunAnalysis} />);

    await user.click(screen.getByRole('button', { name: /Step 2 컬쳐맵 생성 선택/ }));
    await waitFor(() => screen.getByLabelText('Step 1 1차 분석 결과'));

    await user.type(screen.getByLabelText('Step 1 1차 분석 결과'), '1차 분석 결과 본문');
    await user.click(screen.getByText('선택한 자료로 분석 실행'));

    expect(onRunAnalysis).toHaveBeenCalledWith(
      SAMPLE_PROMPT,
      'Step 2: 컬쳐맵 생성',
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Step 1 1차 분석 결과',
          content: '1차 분석 결과 본문',
        }),
      ])
    );
  });

  it('Step 2는 최근 AI 답변을 Step 1 결과 입력값으로 가져올 수 있다', async () => {
    render(
      <ConsultingToolsPanel
        onFillInput={onFillInput}
        onRunAnalysis={onRunAnalysis}
        recentOutputs={[{
          id: 'ai-1',
          label: '최신 AI 답변 12:00',
          content: '최근 1차 분석 결과',
          timestamp: Date.now(),
        }]}
      />
    );

    await user.click(screen.getByRole('button', { name: /Step 2 컬쳐맵 생성 선택/ }));
    await waitFor(() => screen.getByLabelText('Step 1 1차 분석 결과 최근 AI 답변 선택'));

    await user.selectOptions(screen.getByLabelText('Step 1 1차 분석 결과 최근 AI 답변 선택'), 'ai-1');

    expect(screen.getByLabelText('Step 1 1차 분석 결과')).toHaveValue('최근 1차 분석 결과');
  });

  it('Step 3는 Step 1 결과와 Step 2 컬쳐맵 결과를 모두 소스로 사용한다', async () => {
    render(<ConsultingToolsPanel onFillInput={onFillInput} onRunAnalysis={onRunAnalysis} />);

    await user.click(screen.getByRole('button', { name: /Step 3 진단·전략 선택/ }));
    await user.click(await screen.findByText('문화 상태 정의'));

    await waitFor(() => screen.getByLabelText('Step 1 1차 분석 결과'));
    await user.type(screen.getByLabelText('Step 1 1차 분석 결과'), '1차 분석 결과');
    fireEvent.change(screen.getByLabelText('Step 2 컬쳐맵 생성 결과'), {
      target: { value: '[결과_빈도多] (부정) 혁신 저하' },
    });
    const sourceFile = new File(['원천 인터뷰 기록'], 'interview.txt', { type: 'text/plain' });
    Object.defineProperty(sourceFile, 'text', {
      value: vi.fn().mockResolvedValue('원천 인터뷰 기록'),
    });
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, sourceFile);
    await waitFor(() => expect(screen.getByText(/원천자료 1개 보기/)).toBeInTheDocument());

    await user.click(screen.getByText('선택한 자료로 분석 실행'));

    expect(onRunAnalysis).toHaveBeenCalledWith(
      SAMPLE_PROMPT,
      '3a-1: 문화 상태 정의',
      expect.arrayContaining([
        expect.objectContaining({ name: 'Step 1 1차 분석 결과', content: '1차 분석 결과' }),
        expect.objectContaining({ name: 'Step 2 컬쳐맵 생성 결과', content: '[결과_빈도多] (부정) 혁신 저하' }),
        expect.objectContaining({ name: '원천자료 참고: interview.txt', content: '원천 인터뷰 기록' }),
      ])
    );
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

  it('준비 패널이 열리면 prep-scroll-body와 prep-actions가 모두 렌더링된다', async () => {
    render(<ConsultingToolsPanel onFillInput={onFillInput} onRunAnalysis={onRunAnalysis} />);

    await user.click(screen.getByRole('button', { name: /Step 1 1차 분석 선택/ }));
    await waitFor(() => screen.getByText('프롬프트만 복사'));

    // DOM 구조 확인
    const prepPanel = document.querySelector('.prep-panel');
    expect(prepPanel).toBeInTheDocument();
    expect(prepPanel?.querySelector('.prep-scroll-body')).toBeInTheDocument();
    expect(prepPanel?.querySelector('.prep-actions')).toBeInTheDocument();
  });

  it('Step 2 준비 화면에서 textarea와 액션 버튼이 동시에 렌더링된다', async () => {
    render(<ConsultingToolsPanel onFillInput={onFillInput} onRunAnalysis={onRunAnalysis} />);

    await user.click(screen.getByRole('button', { name: /Step 2 컬쳐맵 생성 선택/ }));
    await waitFor(() => screen.getByLabelText('Step 1 1차 분석 결과'));

    // textarea와 버튼이 동시에 보임
    expect(screen.getByLabelText('Step 1 1차 분석 결과')).toBeInTheDocument();
    expect(screen.getByText('선택한 자료로 분석 실행')).toBeInTheDocument();
    expect(screen.getByText('채팅 입력창에 넣기')).toBeInTheDocument();
  });

  it('Step 3 준비 화면에서 Step 1/Step 2 입력 영역과 액션 버튼이 모두 렌더링된다', async () => {
    render(<ConsultingToolsPanel onFillInput={onFillInput} onRunAnalysis={onRunAnalysis} />);

    await user.click(screen.getByRole('button', { name: /Step 3 진단·전략 선택/ }));
    await user.click(await screen.findByText('문화 상태 정의'));

    await waitFor(() => screen.getByLabelText('Step 1 1차 분석 결과'));

    expect(screen.getByLabelText('Step 1 1차 분석 결과')).toBeInTheDocument();
    expect(screen.getByLabelText('Step 2 컬쳐맵 생성 결과')).toBeInTheDocument();
    expect(screen.getByText('선택한 자료로 분석 실행')).toBeInTheDocument();
    expect(screen.getByText('소스 포함 복사')).toBeInTheDocument();
  });
});

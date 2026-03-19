type PdfJsModule = typeof import('pdfjs-dist');

export interface DocumentContext {
  id: string;
  name: string;
  type: 'reference' | 'birkman';
  content: string;
}

/**
 * PDF 텍스트 추출 및 문서 컨텍스트 관리 서비스
 */
class DocumentService {
  private documentContexts: DocumentContext[] = [];
  private pdfjsPromise: Promise<PdfJsModule> | null = null;

  private async getPdfJs(): Promise<PdfJsModule> {
    if (!this.pdfjsPromise) {
      this.pdfjsPromise = import('pdfjs-dist').then((pdfjsLib) => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        return pdfjsLib;
      });
    }

    return this.pdfjsPromise;
  }

  /**
   * PDF 파일에서 텍스트 추출
   */
  public async extractTextFromPDF(file: File): Promise<string> {
    const pdfjsLib = await this.getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'str' in item) {
            return String((item as { str?: unknown }).str ?? '');
          }
          return '';
        })
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  }

  /**
   * PDF 페이지 단위 텍스트 추출 (스트리밍용)
   */
  public async *iteratePdfPages(file: File): AsyncGenerator<{ pageNumber: number; text: string }> {
    const pdfjsLib = await this.getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const items = textContent.items as Array<unknown>;
      const pageText = items
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'str' in item) {
            return String((item as { str?: unknown }).str ?? '');
          }
          return '';
        })
        .join(' ');

      yield { pageNumber: i, text: pageText };
    }
  }

  /**
   * 문서 컨텍스트 추가 (RAG 지원용)
   */
  public addContext(doc: DocumentContext) {
    this.documentContexts.push(doc);
  }

  public getContextsByType(type: 'reference' | 'birkman') {
    return this.documentContexts.filter(d => d.type === type);
  }

  public getAllContextForPrompt(): string {
    return this.documentContexts
      .map(d => `[문서: ${d.name} (${d.type})]\n${d.content}`)
      .join('\n\n---\n\n');
  }

  /**
   * 버크만 리포트 기반 맞춤형 솔루션 프롬프트 생성
   */
  public generateBirkmanSolutionPrompt(cultureAnalysis: string, birkmanReport: string): string {
    return `
# 버크만 진단 기반 조직 변화 솔루션 제안

## 1. 현재 조직문화 분석 결과 (건너뜀 가능)
${cultureAnalysis}

## 2. 대상자의 버크만 리포트 요약
${birkmanReport}

## 3. 요청 사항
위의 조직문화 분석 결과에서 도출된 '핵심 레버리지(변화 요인)'를 확인하고, 
버크만 리포트 대상자의 [흥미, 평소행동, 욕구, 스트레스 행동]을 고려하여 다음을 제안해주세요:

1. **대상자가 가장 성공적으로 기여할 수 있는 요인**: 
   - 유형(Tangible) 또는 무형(Intangible) 요인 중 선택하고 이유를 설명하세요.
2. **대상자 맞춤형 변화 액션 플랜**: 
   - 대상자의 강점을 활용하여 조직 변화를 이끌 수 있는 구체적인 행동을 제안하세요.
3. **효과적인 커뮤니케이션 전략**: 
   - 이 대상자가 변화 과정에서 스트레스를 받지 않고 성과를 내기 위해 주변(리더/동료)에서 지원해야 할 사항을 기술하세요.
`;
  }
}

export const documentService = new DocumentService();
export default documentService;

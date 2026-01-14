/**
 * AI 서비스 - Gemini API 및 Claude API 통합
 * 
 * 중요: @google/genai SDK 사용 (2025.05~ GA)
 * - @google/generative-ai는 deprecated됨
 * - File API 지원 (PDF 업로드)
 * - Gemini 2.5, 3.0 모델 완벽 지원
 */

import { GoogleGenAI, createPartFromUri } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';

export type AIProvider = 'gemini' | 'claude';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  modelName?: string;
}

export interface FileMetadata {
  name: string;
  uri: string;
  mimeType: string;
  state: string;
}

/**
 * 외부 AI API 직접 호출 서비스
 * BYOK(Bring Your Own Key) 방식 - API 키는 localStorage에 저장
 */
class AIService {
  private geminiClient: GoogleGenAI | null = null;
  private claudeClient: Anthropic | null = null;
  private currentConfig: AIConfig | null = null;

  /**
   * AI 서비스 설정
   * @param config - API 키 및 제공자 정보
   */
  public setConfig(config: AIConfig) {
    this.currentConfig = config;
    if (config.provider === 'gemini') {
      this.geminiClient = new GoogleGenAI({ apiKey: config.apiKey });
    } else if (config.provider === 'claude') {
      this.claudeClient = new Anthropic({
        apiKey: config.apiKey,
        dangerouslyAllowBrowser: true
      });
    }
  }

  /**
   * 현재 설정 반환
   */
  public getConfig(): AIConfig | null {
    return this.currentConfig;
  }

  /**
   * 문화 분석 수행
   */
  public async analyzeCulture(prompt: string, schema?: object): Promise<string> {
    if (!this.currentConfig) {
      throw new Error('AI API 설정을 먼저 완료해주세요.');
    }

    if (this.currentConfig.provider === 'gemini') {
      return this.callGemini(prompt, schema);
    } else {
      return this.callClaude(prompt);
    }
  }

  /**
   * PDF 파일 업로드 (Gemini File API)
   * @param file - 업로드할 PDF 파일
   * @returns 파일 메타데이터
   */
  public async uploadPDF(file: File): Promise<FileMetadata> {
    if (!this.geminiClient) {
      throw new Error('Gemini API 설정을 먼저 완료해주세요.');
    }

    // File을 Blob으로 변환
    const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type });

    // 파일 업로드
    const uploadedFile = await this.geminiClient.files.upload({
      file: fileBlob,
      config: {
        displayName: file.name,
      },
    });

    // 파일 처리 완료 대기
    let fileStatus = await this.geminiClient.files.get({ name: uploadedFile.name! });
    while (fileStatus.state === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      fileStatus = await this.geminiClient.files.get({ name: uploadedFile.name! });
      console.log(`📄 PDF 처리 중: ${fileStatus.state}`);
    }

    if (fileStatus.state === 'FAILED') {
      throw new Error('PDF 파일 처리에 실패했습니다.');
    }

    return {
      name: uploadedFile.name!,
      uri: uploadedFile.uri!,
      mimeType: uploadedFile.mimeType!,
      state: fileStatus.state!,
    };
  }

  /**
   * PDF 파일과 함께 분석 수행
   * @param fileUri - 업로드된 파일 URI
   * @param prompt - 분석 프롬프트
   * @param mimeType - 파일 MIME 타입
   */
  public async analyzeWithPDF(
    fileUri: string,
    mimeType: string,
    prompt: string
  ): Promise<string> {
    if (!this.geminiClient) {
      throw new Error('Gemini API 설정을 먼저 완료해주세요.');
    }

    const fileContent = createPartFromUri(fileUri, mimeType);

    const response = await this.geminiClient.models.generateContent({
      model: this.currentConfig?.modelName || 'gemini-2.5-flash',
      contents: [prompt, fileContent],
    });

    return response.text || '';
  }

  /**
   * 버크만 진단 레포트 분석
   * @param fileUri - 업로드된 버크만 PDF URI
   * @param mimeType - 파일 MIME 타입
   * @param cultureMapContext - 컬쳐맵 컨텍스트 (선택)
   */
  public async analyzeBerkmanReport(
    fileUri: string,
    mimeType: string,
    cultureMapContext?: string
  ): Promise<string> {
    const prompt = `
당신은 버크만 진단 전문가이자 조직문화 컨설턴트입니다.

다음 버크만 시그니처 레포트를 분석하고 아래 정보를 JSON 형식으로 추출해주세요:

1. **대상자 기본 정보**
   - 이름
   - 주요 행동 스타일 (Usual Behavior)
   - 욕구/니즈 (Needs)
   - 스트레스 반응 (Stress Behavior)

2. **강점 분석**
   - 업무 강점 3가지
   - 대인관계 강점 2가지
   - 리더십 스타일

3. **변화 주도 적합성**
   - 유형 변화 요인 (제도, 프로세스, 구조 등) 적합도
   - 무형 변화 요인 (문화, 가치관, 행동 등) 적합도
   - 추천 변화 영역

4. **솔루션 아이디어**
   - 이 사람이 주도하기 좋은 조직문화 변화 이니셔티브 3가지
   - 각 이니셔티브에서 활용할 강점

${cultureMapContext ? `
5. **컬쳐맵 연결**
현재 조직의 컬쳐맵 상태:
${cultureMapContext}

이 대상자가 위 컬쳐맵에서 가장 임팩트 있게 기여할 수 있는 영역과 방법을 제안해주세요.
` : ''}

응답은 반드시 유효한 JSON 형식으로 해주세요.
`;

    return this.analyzeWithPDF(fileUri, mimeType, prompt);
  }

  /**
   * Gemini API 호출 (신규 SDK)
   */
  private async callGemini(prompt: string, schema?: object): Promise<string> {
    if (!this.geminiClient) {
      throw new Error('Gemini 클라이언트가 초기화되지 않았습니다.');
    }

    const modelName = this.currentConfig?.modelName || 'gemini-2.5-flash';

    const response = await this.geminiClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: schema ? {
        responseMimeType: 'application/json',
        responseSchema: schema,
      } : undefined,
    });

    return response.text || '';
  }

  /**
   * Claude API 호출
   */
  private async callClaude(prompt: string): Promise<string> {
    if (!this.claudeClient) {
      throw new Error('Claude 클라이언트가 초기화되지 않았습니다.');
    }

    const response = await this.claudeClient.messages.create({
      model: this.currentConfig?.modelName || 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    return textContent ? (textContent as { type: 'text'; text: string }).text : '';
  }

  /**
   * 사용 가능한 Gemini 모델 목록
   */
  public getAvailableGeminiModels(): string[] {
    return [
      'gemini-3-flash-preview',   // 최신 Gemini 3 Flash
      'gemini-2.5-pro',           // 안정적인 고성능 모델
      'gemini-2.5-flash',         // 빠른 응답, 비용 효율
      'gemini-2.5-flash-lite',    // 가장 빠름, 저비용
    ];
  }
}

export const aiService = new AIService();
export default aiService;

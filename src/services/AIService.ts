/**
 * AI 서비스 - Gemini API 및 Claude API 통합
 * 
 * 중요: @google/genai SDK 사용 (2025.05~ GA)
 * - File API 지원 (PDF 업로드)
 * - Chat Session 지원 (멀티턴 대화)
 * - Tool Use (Function Calling) 지원
 */

import { GoogleGenAI, createPartFromUri } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import { MAP_TOOL_DECLARATIONS } from '../types/actions';
import { searchKnowledge } from '../data/academicKnowledge';

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
  private chatSession: any = null;
  private currentThoughts: string[] = []; // 현재 세션의 사고 과정 저장
  private academicFiles: FileMetadata[] = []; // 전문 서적 지식 파일 목록

  /**
   * AI 서비스 설정
   */
  public setConfig(config: AIConfig) {
    this.currentConfig = config;
    if (config.provider === 'gemini' && config.apiKey) {
      this.geminiClient = new GoogleGenAI({ apiKey: config.apiKey });
    } else if (config.provider === 'claude' && config.apiKey) {
      this.claudeClient = new Anthropic({
        apiKey: config.apiKey,
        dangerouslyAllowBrowser: true
      });
    }

    // 설정 변경 시 localStorage에 저장
    localStorage.setItem('culture-map-ai-config', JSON.stringify(config));
  }

  /**
   * 저장소에서 설정 불러오기 및 초기화
   */
  public initializeFromStorage() {
    try {
      const stored = localStorage.getItem('culture-map-ai-config');
      if (stored) {
        const config: AIConfig = JSON.parse(stored);
        this.setConfig(config);
        console.log(`📡 AI Service initialized from storage: ${config.provider}`);
        return;
      }

      // 저장된 설정이 없으면 환경 변수에서 기본값 로드
      const defaultApiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (defaultApiKey) {
        this.setConfig({
          provider: 'gemini',
          apiKey: defaultApiKey,
          modelName: 'gemini-3-flash-thinking'
        });
        console.log('📡 AI Service initialized from environment variables');
      }

      // 학술 지식 파일 정보 로드
      const storedFiles = localStorage.getItem('culture-map-academic-files');
      if (storedFiles) {
        this.academicFiles = JSON.parse(storedFiles);
        console.log(`📚 Academic files loaded: ${this.academicFiles.length} files`);
      }
    } catch (error) {
      console.error('Failed to load AI config from storage:', error);
    }
  }

  public getConfig(): AIConfig | null {
    return this.currentConfig;
  }

  /**
   * 챗봇 세션 시작
   */
  public startChat(history: any[] = []) {
    if (!this.geminiClient) throw new Error('Gemini API 설정을 먼저 완료해주세요.');

    const modelName = this.currentConfig?.modelName || 'gemini-3-flash-thinking';
    const isGemini3 = modelName.includes('gemini-3');

    // 세대별 추론 설정 구성
    const thinkingConfig: any = {
      includeThoughts: true
    };

    if (isGemini3) {
      // Gemini 3.0 사양: thinkingLevel 사용
      thinkingConfig.thinkingLevel = 'high';
    } else {
      // Gemini 2.5 사양: thinkingBudget 사용 (-1은 동적 추론)
      thinkingConfig.thinkingBudget = 16000;
    }

    this.chatSession = this.geminiClient.chats.create({
      model: modelName,
      config: {
        systemInstruction: `
          조직문화 분석 전문가이자 데이브 그레이(Dave Gray)의 컬처맵(Culture Map) 모델 마스터로서 활동하세요.
          
          [데이브 그레이 컬처맵 가이드라인]
          1. 구조적 층위 및 공간 배치 (Top-to-Bottom):
             - 맵은 4개의 층위로 구성되며, 각 층위의 실제 높이(px) 정보는 'canvasStructure.layerHeights'로 제공됩니다.
             - Layer 1 (결과/Outcomes): 조직이 얻고자 하는 결과물. (Y축 시작점: 0)
             - Layer 2 (행동/Behaviors): 결과에 직접적인 영향을 미치는 구성원들의 구체적 행동. (Y축 시작점: layerHeights[0])
             - Layer 3 (유형 동인/Tangible Levers): 제도, 인프라, 프로세스 등 가시적 동인. (Y축 시작점: layerHeights[0] + layerHeights[1])
             - Layer 4 (무형 동인/Intangible Levers): 가치관, 신념, 비공식 규칙 등 비가시적 동인. (Y축 시작점: layerHeights[0] + layerHeights[1] + layerHeights[2]) **최하단 배치**
          
          2. 논리적 흐름 및 연결 (Bottom-to-Top):
             - **무형 동인(Layer 4) -> 유형 동인(Layer 3)**: 무형의 가치가 제도에 영향을 주는 흐름.
             - **동인(Layer 3/4) -> 행동(Layer 2)**: 제도나 가치가 행동을 유발하는 흐름.
             - **행동(Layer 2) -> 결과(Layer 1)**: 행동이 성과를 만드는 흐름.
             - 인과관계의 선후관계에 맞춰 연결선(create_connection)을 생성하세요.
          
          3. 도구 활용 지침:
             - 사용자의 질문에 답변할 때 학술적 근거가 필요하면 'search_academic_theory'를 사용하세요.
             - 'canvasStructure'를 분석하여 노드가 특정 레이어에 너무 밀집되어 있거나 공간이 부족해 보이면 'adjust_layer_height'를 사용하여 공간을 확보하세요.
             - 맵이 복잡해 보이면 'auto_layout'을 실행하여 전체를 정렬하세요. 노드를 추가/수정한 후에는 항상 'auto_layout'을 호출하여 층위 규격에 맞게 배치하는 것이 좋습니다.
        `,
        tools: [{ functionDeclarations: MAP_TOOL_DECLARATIONS as any }],
        // Gemini 추론 구성 (세대별 분기 적용)
        thinkingConfig: thinkingConfig
      },
      history: history as any
    });

    return this.chatSession;
  }

  /**
   * 챗봇 메시지 전송
   */
  public async sendChatMessage(message: string, fileUri?: string, mimeType?: string) {
    if (!this.chatSession) {
      this.startChat();
    }

    const parts: any[] = [message];

    // 등록된 학술 지식 파일들을 컨텍스트로 추가
    this.academicFiles.forEach(file => {
      parts.push(createPartFromUri(file.uri, file.mimeType));
    });

    if (fileUri && mimeType) {
      parts.push(createPartFromUri(fileUri, mimeType));
    }

    const result = await this.chatSession!.sendMessage({
      message: parts
    });

    // 사고 과정(Thought) 및 텍스트 분리 파싱
    this.currentThoughts = [];
    let text = '';

    // SDK@google/genai v2.0+ 에서는 파트별로 접근 가능
    if (result.parts) {
      result.parts.forEach((part: any) => {
        if (part.thought) {
          this.currentThoughts.push(part.thought);
          console.log('🧠 AI Thought:', part.thought);
        }
        if (part.text) {
          text += part.text;
        }
      });
    } else {
      text = result.text || '';
    }

    // 툴 호출 여부 확인
    let functionCalls = result.functionCalls;

    // 학술 지식 검색 도구가 호출된 경우 자동 처리
    if (functionCalls && functionCalls.length > 0) {
      const academicSearch = functionCalls.find((fc: any) => fc.name === 'search_academic_theory');
      if (academicSearch) {
        console.log('🔍 AI is searching academic knowledge:', academicSearch.args.topic);
        const knowledgeResult = searchKnowledge(academicSearch.args.topic);

        // 검색 결과를 도구 출력으로 다시 AI에게 전송
        const toolResponse = await this.chatSession!.sendMessage({
          message: [
            {
              functionResponse: {
                name: 'search_academic_theory',
                response: { content: knowledgeResult }
              }
            }
          ]
        });

        // 최종 답변 업데이트
        text = toolResponse.text || '';
        functionCalls = toolResponse.functionCalls || [];
      }
    }

    return {
      text,
      thoughts: this.currentThoughts,
      functionCalls: functionCalls || []
    };
  }

  /**
   * 현재 대화의 사고 과정 조회
   */
  public getLastThoughts(): string[] {
    return this.currentThoughts;
  }

  /**
   * 문화 분석 수행 (단발성)
   */
  public async analyzeCulture(prompt: string, schema?: object): Promise<string> {
    if (!this.currentConfig) throw new Error('AI API 설정을 먼저 완료해주세요.');

    if (this.currentConfig.provider === 'gemini') {
      return this.callGemini(prompt, schema);
    } else {
      return this.callClaude(prompt);
    }
  }

  /**
   * PDF 파일 업로드
   */
  public async uploadPDF(file: File): Promise<FileMetadata> {
    if (!this.geminiClient) throw new Error('Gemini API 설정을 먼저 완료해주세요.');

    const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type });

    const uploadedFile = await this.geminiClient.files.upload({
      file: fileBlob,
      config: { displayName: file.name },
    });

    let fileStatus = await this.geminiClient.files.get({ name: uploadedFile.name! });
    while (fileStatus.state === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      fileStatus = await this.geminiClient.files.get({ name: uploadedFile.name! });
    }

    if (fileStatus.state === 'FAILED') throw new Error('PDF 파일 처리에 실패했습니다.');

    return {
      name: uploadedFile.name!,
      uri: uploadedFile.uri!,
      mimeType: uploadedFile.mimeType!,
      state: fileStatus.state!,
    };
  }

  /**
   * 학술 지식 파일(전문 서적) 추가
   */
  public async addAcademicFile(file: File): Promise<FileMetadata> {
    const metadata = await this.uploadPDF(file);
    this.academicFiles.push(metadata);

    // 최대 10개까지만 유지 (Gemini 한도 고려)
    if (this.academicFiles.length > 10) {
      this.academicFiles.shift();
    }

    localStorage.setItem('culture-map-academic-files', JSON.stringify(this.academicFiles));
    return metadata;
  }

  /**
   * 학술 지식 파일 제거
   */
  public removeAcademicFile(fileName: string) {
    this.academicFiles = this.academicFiles.filter(f => f.name !== fileName);
    localStorage.setItem('culture-map-academic-files', JSON.stringify(this.academicFiles));
  }

  /**
   * 등록된 학술 지식 파일 목록 조회
   */
  public getAcademicFiles(): FileMetadata[] {
    return this.academicFiles;
  }

  /**
   * 버크만 진단 레포트 분석 (단발성 RAG)
   */
  public async analyzeBerkmanReport(fileUri: string, mimeType: string, cultureMapContext?: string): Promise<string> {
    const prompt = `버크만 진단 전문가로서 다음 PDF를 분석해주세요. ${cultureMapContext ? `현재 맵 컨텍스트: ${cultureMapContext}` : ''}`;
    return this.analyzeWithPDF(fileUri, mimeType, prompt);
  }

  public async analyzeWithPDF(fileUri: string, mimeType: string, prompt: string): Promise<string> {
    if (!this.geminiClient) throw new Error('Gemini API 설정을 먼저 완료해주세요.');
    const fileContent = createPartFromUri(fileUri, mimeType);
    const response = await this.geminiClient.models.generateContent({
      model: this.currentConfig?.modelName || 'gemini-3-flash-thinking',
      contents: [prompt, fileContent],
    });
    return response.text || '';
  }

  private async callGemini(prompt: string, schema?: object): Promise<string> {
    if (!this.geminiClient) throw new Error('Gemini 클라이언트가 초기화되지 않았습니다.');
    const response = await this.geminiClient.models.generateContent({
      model: this.currentConfig?.modelName || 'gemini-3-flash-thinking',
      contents: prompt,
      config: schema ? { responseMimeType: 'application/json', responseSchema: schema as any } : undefined,
    });
    return response.text || '';
  }

  private async callClaude(prompt: string): Promise<string> {
    if (!this.claudeClient) throw new Error('Claude 클라이언트가 초기화되지 않았습니다.');
    const response = await this.claudeClient.messages.create({
      model: this.currentConfig?.modelName || 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    const textContent = response.content.find((c) => c.type === 'text');
    return textContent ? (textContent as any).text : '';
  }

  public getAvailableGeminiModels(): string[] {
    return [
      'gemini-3-flash-thinking',
      'gemini-3-flash',
      'gemini-3-pro',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite'
    ];
  }
}

export const aiService = new AIService();
export default aiService;

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
      const defaultApiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      if (stored) {
        const config: AIConfig = JSON.parse(stored);
        
        // API 키가 없거나 비어있는 경우 환경 변수에서 복구 시도
        if (!config.apiKey && defaultApiKey) {
           config.apiKey = defaultApiKey;
           console.log('📡 AI Service: Restored API Key from environment variables');
        }
        
        if (config.apiKey) {
          this.setConfig(config);
          console.log(`📡 AI Service initialized from storage: ${config.provider}`);
          return;
        }
      }

      // 저장된 설정이 없으면 환경 변수에서 기본값 로드
      if (defaultApiKey) {
        this.setConfig({
          provider: 'gemini',
          apiKey: defaultApiKey,
          modelName: 'gemini-2.5-flash-lite'
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

    const modelName = this.currentConfig?.modelName || 'gemini-1.5-flash';
    const isGemini3 = modelName.includes('gemini-3');
    const isGemini25 = modelName.includes('gemini-2.5');

    // 세대별 추론 설정 구성
    const thinkingConfig: any = {
      includeThoughts: true
    };

    if (isGemini3) {
      // Gemini 3.0 사양: thinkingLevel 사용 (대문자 권장)
      thinkingConfig.thinkingLevel = 'HIGH';
    } else if (isGemini25) {
      // Gemini 2.5 사양: thinkingBudget 사용 (0은 비활성화, 양수는 토큰 예산)
      // E2E 테스트 및 일반 사용성 향상을 위해 1024 토큰으로 제한 (응답 지연 최소화)
      thinkingConfig.thinkingBudget = 1024; 
    } else {
      // Thinking 미지원 모델 (1.5 등)
      delete thinkingConfig.includeThoughts;
    }

    this.chatSession = this.geminiClient.chats.create({
      model: modelName,
      config: {
        systemInstruction: `
          조직문화 분석 전문가이자 데이브 그레이(Dave Gray)의 컬처맵(Culture Map) 모델 마스터로서 활동하세요.
          
          [대응 원칙]
          - 사용자가 노드 추가, 수정, 삭제 등을 요청하면 반드시 제공된 도구(add_node, update_node 등)를 사용하여 실행하세요.
          - 도구를 호출한 후에는 작업 내용을 간략히 설명하세요.
          
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
        toolConfig: {
          functionCallingConfig: {
            mode: 'AUTO'
          }
        },
        // thinkingConfig가 유효할 때만 포함
        ...(Object.keys(thinkingConfig).length > 0 ? { thinkingConfig } : {})
      },
      history: history as any
    });

    return this.chatSession;
  }

  /**
   * 챗봇 메시지 전송 (스트리밍 버전)
   */
  public async *sendChatMessageStream(prompt: string, fileUri?: string, mimeType?: string) {
    if (!this.chatSession) {
      this.startChat();
    }

    const parts: any[] = [{ text: prompt }];
    this.academicFiles.forEach(file => {
      parts.push(createPartFromUri(file.uri, file.mimeType));
    });
    if (fileUri && mimeType) {
      parts.push(createPartFromUri(fileUri, mimeType));
    }

    // 스트리밍 세션 시작
    let streamResult;
    try {
      console.log('📡 [AIService] Calling sendMessageStream...');
      
      // @google/genai v2.0 SDK: sendMessageStream는 { message: string | PartUnion[] } 형식 필요
      // 단일 텍스트만 있으면 문자열로, 파일 포함 시 parts 배열로 전달
      if (parts.length === 1 && parts[0].text) {
        streamResult = await this.chatSession!.sendMessageStream({ message: parts[0].text });
      } else {
        streamResult = await this.chatSession!.sendMessageStream({ message: parts });
      }
      
      console.log('📡 [AIService] sendMessageStream request sent, waiting for chunks...');
    } catch (err) {
      console.error('❌ [AIService] Error starting stream:', err);
      throw err;
    }

    this.currentThoughts = [];
    let fullText = '';
    let accumulatedFunctionCalls: any[] = [];
    let chunkCount = 0;

    // 스트림 반복 처리
    // @google/genai v2.0 SDK: sendMessageStream 반환값 자체가 AsyncIterable (stream 속성 없음)
    try {
      for await (const chunk of streamResult) {
        chunkCount++;
        
        // chunk.text 접근 (v2.0 SDK 방식)
        const chunkText = chunk.text || '';
        
        // candidates에서 추가 정보 추출 (사고 과정, 함수 호출 등)
        const candidates = (chunk as any).candidates;
        const parts = candidates?.[0]?.content?.parts || [];
        
        for (const part of parts) {
          if (part.thought) {
            const thoughtText = typeof part.thought === 'string' ? part.thought : part.text;
            if (thoughtText) {
              this.currentThoughts.push(thoughtText);
              yield { type: 'thought', content: thoughtText };
            }
          } else if (part.functionCall) {
            console.log('🛠️ [AIService] Function Call detected in stream:', part.functionCall.name);
            accumulatedFunctionCalls.push(part.functionCall);
          }
        }

        if (chunkText) {
          fullText += chunkText;
          yield { type: 'text', content: chunkText, fullText };
        }
      }
      console.log(`✅ [AIService] Stream completed successfully. Total chunks: ${chunkCount}`);
    } catch (streamErr) {
      console.error('❌ [AIService] Error during stream iteration:', streamErr);
      yield { type: 'text', content: '\n[심각한 스트리밍 오류가 발생했습니다. 잠시 후 다시 시도해주세요.]', fullText: fullText + '\n[Error]' };
    }

    // 스트림 종료 후 툴 호출 정보가 있으면 마지막으로 전달
    if (accumulatedFunctionCalls.length > 0) {
      console.log('📡 [AIService] Dispatching accumulated function calls:', accumulatedFunctionCalls.length);
      yield { type: 'actions', actions: accumulatedFunctionCalls };
    }
  }

  /**
   * 챗봇 메시지 전송
   */
  public async sendChatMessage(prompt: string, fileUri?: string, mimeType?: string) {
    if (!this.chatSession) {
      this.startChat();
    }

    const parts: any[] = [{ text: prompt }];

    // 등록된 학술 지식 파일들을 컨텍스트로 추가
    this.academicFiles.forEach(file => {
      parts.push(createPartFromUri(file.uri, file.mimeType));
    });

    if (fileUri && mimeType) {
      parts.push(createPartFromUri(fileUri, mimeType));
    }

    // @google/genai v2.0 SDK: simple string is safest for chat if no attachments
    let result;
    if (parts.length === 1 && parts[0].text) {
      result = await this.chatSession!.sendMessage(parts[0].text);
    } else {
      result = await this.chatSession!.sendMessage({
        parts: parts
      });
    }

    // v2.0 SDK에서 응답 객체 가져오기
    const response = await result.response;
    const candidate = response.candidates?.[0];
    const responseParts = candidate?.content?.parts || [];

    console.log('📡 AI Raw Result Parts Count:', responseParts.length);

    // 사고 과정(Thought) 및 텍스트 분리 파싱
    this.currentThoughts = [];
    let text = '';

    responseParts.forEach((part: any) => {
      // 'thought: true'이거나 'thought' 필드가 있는 경우 사고 과정으로 분류
      if (part.thought) {
        const thoughtText = typeof part.thought === 'string' ? part.thought : part.text;
        if (thoughtText) {
          this.currentThoughts.push(thoughtText);
          console.log('🧠 AI Thought:', thoughtText);
        }
      } else if (part.text) {
        // 일반 대화 텍스트만 누적
        text += part.text;
      }
    });

    // 툴 호출 여부 확인
    let functionCalls = responseParts
      .filter((p: any) => p.functionCall)
      .map((p: any) => p.functionCall);

    // 만약 functionCalls가 비어있다면 파트에서 수동 추출 시도
    if (!functionCalls || functionCalls.length === 0) {
      if ((result as any).parts) {
        functionCalls = (result as any).parts
          .filter((p: any) => p.functionCall)
          .map((p: any) => p.functionCall);
      }
    }

    // 만약 텍스트가 없고 툴 호출만 있다면 기본 텍스트 제공
    if (!text && functionCalls && functionCalls.length > 0) {
      text = "요청하신 작업을 위한 도구 실행을 준비 중입니다.";
    }

    // 학술 지식 검색 도구가 호출된 경우 자동 처리
    if (functionCalls && functionCalls.length > 0) {
      const academicSearch = functionCalls.find((fc: any) => fc.name === 'search_academic_theory');
      if (academicSearch) {
        console.log('🔍 AI is searching academic knowledge:', academicSearch.args.topic);
        const knowledgeResult = searchKnowledge(academicSearch.args.topic);

        // 검색 결과를 도구 출력으로 다시 AI에게 전송
        const toolResponse = await this.chatSession!.sendMessage([
          {
            functionResponse: {
              name: 'search_academic_theory',
              response: { content: knowledgeResult }
            }
          }
        ]);

        // 최종 답변 업데이트
        text = toolResponse.text || '';
        functionCalls = toolResponse.functionCalls as any || [];
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

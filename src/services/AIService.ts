/**
 * AI 서비스 - Gemini API 전용
 * 
 * 중요: @google/genai SDK 사용 (2025.05~ GA)
 * - File API 지원 (PDF 업로드)
 * - Chat Session 지원 (멀티턴 대화)
 * - Tool Use (Function Calling) 지원
 */

import { GoogleGenAI, createPartFromUri, FunctionCallingConfigMode, type ThinkingConfig, type ThinkingLevel } from '@google/genai';
import { MAP_TOOL_DECLARATIONS } from '../types/actions';
import { searchKnowledge } from '../data/academicKnowledge';
import type { Insight, InsightType } from '../types/liveblocks';

export type AIProvider = 'gemini';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  modelName?: string;
  autoExecuteFunctionCalls?: boolean; // true면 function call 자동 실행, false면 사용자 확인 후 실행
}

export interface FileMetadata {
  name: string;
  displayName: string; // 원본 파일명
  uri: string;
  mimeType: string;
  state: string;
  keywords?: string[]; // 키워드 (지능형 선택용)
}

/**
 * 외부 AI API 직접 호출 서비스
 * BYOK(Bring Your Own Key) 방식 - API 키는 localStorage에 저장
 */
class AIService {
  private geminiClient: GoogleGenAI | null = null;
  private currentConfig: AIConfig | null = null;
  private chatSession: any = null;
  private currentThoughts: string[] = []; // 현재 세션의 사고 과정 저장
  private academicFiles: FileMetadata[] = []; // 전문 서적 지식 파일 목록
  private insights: Insight[] = []; // AI 동적 인사이트 캐싱

  /**
   * AI 서비스 설정
   */
  public setConfig(config: AIConfig) {
    const normalized = this.normalizeModelConfig(config);
    this.currentConfig = normalized;
    if (config.provider === 'gemini' && config.apiKey) {
      this.geminiClient = new GoogleGenAI({ apiKey: config.apiKey });
    }

    // 설정 변경 시 localStorage에 저장
    localStorage.setItem('culture-map-ai-config', JSON.stringify(normalized));
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
          console.log('📡 AI Service initialized from storage: gemini');
          return;
        }
      }

      // 저장된 설정이 없으면 환경 변수에서 기본값 로드
      if (defaultApiKey) {
        this.setConfig({
          provider: 'gemini',
          apiKey: defaultApiKey,
          modelName: 'gemini-2.5-flash-lite'  // Function Calling 완벽 지원, 저비용/고속
        });
        console.log('📡 AI Service initialized from environment variables');
      }

      // 학술 지식 파일 정보 로드
      const storedFiles = localStorage.getItem('culture-map-academic-files');
      if (storedFiles) {
        this.academicFiles = JSON.parse(storedFiles);
        console.log(`📚 Academic files loaded: ${this.academicFiles.length} files`);
        this.normalizeAcademicFiles();
      }

      // 인사이트 캐시 로드
      const storedInsights = localStorage.getItem('culture-map-insights');
      if (storedInsights) {
        this.insights = JSON.parse(storedInsights);
        console.log(`💡 Insights loaded: ${this.insights.length} insights`);
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

    const modelName = this.currentConfig?.modelName || 'gemini-2.5-flash-lite';
    const thinkingConfig = this.getThinkingConfig(modelName);

    this.chatSession = this.geminiClient.chats.create({
      model: modelName,
      config: {
        systemInstruction: `
# Culture-MAP V2 AI 컨설턴트

## 프로그램 소개
Culture-MAP V2는 에드가 샤인(Edgar Schein)의 조직문화 3계층 이론을 기반으로 한 **조직문화 진단 및 시각화 프로그램**입니다.

### 핵심 기능
- **4계층 문화 맵**: 결과(Outcomes) → 행동(Behaviors) → 유형 레버(Type Levers) → 무형 레버(Intangible Levers)
- **노드 기반 시각화**: 각 레이어에 문화 요소를 노드로 추가하고 연결
- **버크만 진단 통합**: 개인 성격 유형과 조직문화 연계 분석
- **AI 컨설팅**: 학술 이론 기반 문화 진단 및 개선 전략 제안

### 샤인 이론과의 연계
- **Artifacts (인공물)** → 결과/행동 레이어
- **Espoused Values (표방 가치)** → 유형 레버 레이어  
- **Basic Assumptions (기본 가정)** → 무형 레버 레이어

## 당신의 역할
1. **문화 진단 전문가**: 샤인 이론, 로빈스 조직행동론 등 학술 지식 기반 분석
2. **맵 편집 도우미**: 사용자 요청 시 노드 추가/수정/삭제 (도구 사용)
3. **전략 컨설턴트**: 문화 변화 전략 및 실행 계획 제안

## 도구 사용 규칙
1. 노드 추가/수정 후 반드시 auto_layout 호출하여 정리
2. 공간 부족/겹침/연결선 가림이 발생하면 adjust_layer_height 호출
3. 사용자가 명시적으로 노드 생성을 요청할 때만 도구 사용
4. 여러 노드와 연결을 동시에 만들 때는 add_nodes_with_connections로 단일 호출 수행
5. 특정 좌표로 이동할 필요가 있으면 update_node에 x/y 포함
6. delete_node는 **사용자가 명시적으로 삭제를 요청한 특정 노드 ID**에만 사용하며, 연결선 유무로 임의 삭제하지 말 것
7. 도구 호출은 **코드 블록/print/default_api/tool_code**로 출력하지 말고 반드시 실제 function call로 실행
8. 사용자가 "그렇게 해", "해줘", "진행해"처럼 직전 제안을 수락하면 즉시 해당 도구를 호출
9. 코드 예시는 사용자가 명시적으로 코드 요청 시에만 제공하며, 도구 호출과는 분리

## 연결선(인과관계) 생성 규칙
1. **노드 생성 후 연결 권장**: 새 노드 추가 후, 관련된 기존 노드와 create_connection 호출 권장
2. **층위 간 인과 흐름**: 무형레버(Layer 4) → 유형레버(Layer 3) → 행동(Layer 2) → 결과(Layer 1) 방향
3. **sourceId/targetId 순서**: sourceId = 원인 노드(상위 층위), targetId = 결과 노드(하위 층위)
4. **다수 노드 생성 시**: 모든 노드 생성 완료 → 일괄 연결(create_connection) → auto_layout 순서
5. **대량 생성 최적화**: 노드+연결 요청이 함께 오면 add_nodes_with_connections로 노드/연결을 한 번에 생성

### ✅ 예시 (DO)
사용자: "리더십 문화 관련 노드 3개 만들어줘"
→ 순서: add_node(Layer4 "리더십 가치관") → add_node(Layer3 "리더십 평가제도") → add_node(Layer2 "솔선수범 행동") → create_connection(source: Layer4노드ID, target: Layer3노드ID) → create_connection(source: Layer3노드ID, target: Layer2노드ID) → auto_layout()

사용자: "A,B,C 노드 만들고 A-B, B-C 연결해줘"
→ 순서: add_nodes_with_connections(nodes:[{tempId:"A", label:"A", layer:4, type:"무형_레버"}, {tempId:"B", label:"B", layer:3, type:"유형_레버"}, {tempId:"C", label:"C", layer:2, type:"행동"}], connections:[{sourceId:"A", targetId:"B"}, {sourceId:"B", targetId:"C"}]) → auto_layout()

사용자: "노드 X를 (900, 420)로 옮겨줘"
→ 순서: update_node(id:"노드X_ID", x:900, y:420) → auto_layout()

사용자: "노드가 겹치고 연결선이 가려져"
→ 순서: adjust_layer_height(layer: 4, height: 350) → adjust_layer_height(layer: 3, height: 350) → auto_layout()

### ❌ 금지 (DON'T)
- 노드만 생성하고 연결선 없이 끝내기
- 연결 방향 반대로 하기 (하위→상위)
- 연결선 없는 노드를 추정해서 삭제하기
        `,
        tools: [{ functionDeclarations: MAP_TOOL_DECLARATIONS as any }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO
          }
        },
        // thinkingConfig가 유효할 때만 포함
        ...(thinkingConfig ? { thinkingConfig } : {})
      },
      history: history as any
    });

    console.log('🔧 [AIService] startChat: Model =', modelName, 'Tools count =', MAP_TOOL_DECLARATIONS.length);
    console.log('🔧 [AIService] Tool names:', MAP_TOOL_DECLARATIONS.map((t: any) => t.name).join(', '));

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

    // [토큰 최적화] PDF 자동 로드 제거 - AI가 load_academic_knowledge 도구로 필요시에만 로드
    // 이제 AI가 동적으로 판단하여 학술 지식이 필요할 때만 도구를 호출합니다.
    // 기존 자동 로드 로직은 selectRelevantFiles()로 이동되어 도구 호출 시 사용됩니다.

    // 채팅창을 통해 직접 업로드된 파일 (버크만 레포트 등 참가자 자료)
    if (fileUri && mimeType) {
      console.log('📄 [AIService] Including session participant data (uploaded file)');
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

        // candidates에서 parts 직접 추출 (chunk.text 접근 시 SDK 내부 경고 방지)
        const candidates = (chunk as any).candidates;
        const parts = candidates?.[0]?.content?.parts || [];

        // parts에서 텍스트, 사고 과정, 함수 호출 분리 추출
        let chunkText = '';
        for (const part of parts) {
          if (part.thought) {
            // 사고 과정 (Thinking)
            const thoughtText = typeof part.thought === 'string' ? part.thought : part.text;
            if (thoughtText) {
              this.currentThoughts.push(thoughtText);
              yield { type: 'thought', content: thoughtText };
            }
          } else if (part.functionCall) {
            // 함수 호출 (Function Call)
            console.log('🛠️ [AIService] Function Call detected:', part.functionCall.name, 'args:', JSON.stringify(part.functionCall.args));
            accumulatedFunctionCalls.push(part.functionCall);
          } else if (part.text) {
            // 일반 텍스트만 추출
            chunkText += part.text;
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

    // 내부 도구 (load_academic_knowledge, search_academic_theory)는 자동 처리, 나머지만 외부로 dispatch
    const internalTools = ['search_academic_theory', 'load_academic_knowledge'];
    const externalActions = accumulatedFunctionCalls.filter(fc => !internalTools.includes(fc.name));
    const internalActions = accumulatedFunctionCalls.filter(fc => internalTools.includes(fc.name));

    // 내부 도구 자동 처리 (학술 지식 검색 등)
    for (const internalCall of internalActions) {
      // [신규] AI가 동적으로 PDF 로드 요청
      if (internalCall.name === 'load_academic_knowledge') {
        const topic = internalCall.args?.topic || '';
        console.log('📚 [AIService] AI requested academic knowledge:', topic);
        
        // PDF 선택 (AI가 제공한 topic 기반)
        const selectedFile = this.selectRelevantFilesForTopic(topic);
        
        if (selectedFile) {
          console.log('📚 [AIService] Loading PDF:', selectedFile.displayName);
          
          // PDF를 포함하여 후속 응답 생성
          try {
            const followUp = await this.chatSession!.sendMessage({
              message: [
                {
                  text: `[시스템] "${topic}" 관련 학술 자료를 로드했습니다. 전체를 통독하기보다 주제와 관련된 섹션/챕터를 우선 탐색해 핵심 근거만 요약해 주세요. 가능하면 장/절 제목을 함께 제시하고, 불확실한 내용은 추정하지 마세요.`
                },
                createPartFromUri(selectedFile.uri, selectedFile.mimeType)
              ]
            });
            const followUpResponse = await followUp.response;
            const followUpParts = followUpResponse.candidates?.[0]?.content?.parts || [];
            for (const part of followUpParts) {
              if (part.text) {
                fullText += '\n\n' + part.text;
                yield { type: 'text', content: '\n\n' + part.text, fullText };
              } else if (part.functionCall && !internalTools.includes(part.functionCall.name)) {
                externalActions.push(part.functionCall);
              }
            }
          } catch (err) {
            console.error('❌ [AIService] Error loading academic PDF:', err);
            yield { type: 'text', content: '\n\n[학술 자료 로드 중 오류가 발생했습니다]', fullText: fullText + '\n\n[Error]' };
          }
        } else {
          // PDF 없으면 하드코딩된 지식으로 폴백
          console.log('📚 [AIService] No PDF found, falling back to static knowledge');
          const knowledgeResult = searchKnowledge(topic);
          
          try {
            const followUp = await this.chatSession!.sendMessage({
              message: `[시스템] 관련 학술 지식: ${knowledgeResult}`
            });
            const followUpResponse = await followUp.response;
            const followUpParts = followUpResponse.candidates?.[0]?.content?.parts || [];
            for (const part of followUpParts) {
              if (part.text) {
                fullText += '\n\n' + part.text;
                yield { type: 'text', content: '\n\n' + part.text, fullText };
              }
            }
          } catch (err) {
            console.error('❌ [AIService] Error with fallback knowledge:', err);
          }
        }
      }
      // [레거시] 기존 search_academic_theory 호환
      else if (internalCall.name === 'search_academic_theory') {
        console.log('🔍 [AIService] Auto-handling internal tool: search_academic_theory');
        const knowledgeResult = searchKnowledge(internalCall.args?.topic || '');

        // 검색 결과를 AI에게 다시 전달하여 후속 응답 생성
        try {
          const followUp = await this.chatSession!.sendMessage({
            message: [
              {
                functionResponse: {
                  name: 'search_academic_theory',
                  response: { content: knowledgeResult }
                }
              }
            ]
          });
          const followUpResponse = await followUp.response;
          // 후속 응답에서 텍스트와 function call 추출
          const followUpParts = followUpResponse.candidates?.[0]?.content?.parts || [];
          for (const part of followUpParts) {
            if (part.text) {
              fullText += '\n\n' + part.text;
              yield { type: 'text', content: '\n\n' + part.text, fullText };
            } else if (part.functionCall && !internalTools.includes(part.functionCall.name)) {
              externalActions.push(part.functionCall);
            }
          }
        } catch (err) {
          console.error('❌ [AIService] Error processing internal tool response:', err);
        }
      }
    }

    // 맵 조작 도구만 외부로 dispatch
    if (externalActions.length > 0) {
      console.log('📡 [AIService] Dispatching external actions:', externalActions.map(a => a.name).join(', '));
      yield { type: 'actions', actions: externalActions };
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

    // 등록된 학술 지식 파일 중 관련성 높은 파일만 동적으로 추가
    const selectedFiles = this.selectRelevantFiles(prompt, 1);
    selectedFiles.forEach(file => {
      parts.push(createPartFromUri(file.uri, file.mimeType));
    });

    if (fileUri && mimeType) {
      parts.push(createPartFromUri(fileUri, mimeType));
    }

    // @google/genai SDK: sendMessage는 { message: string | PartUnion[] } 형식 필요
    let result;
    if (parts.length === 1 && parts[0].text) {
      result = await this.chatSession!.sendMessage({ message: parts[0].text });
    } else {
      result = await this.chatSession!.sendMessage({ message: parts });
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
        const toolResponsePayload = await toolResponse.response;
        const toolParts = toolResponsePayload.candidates?.[0]?.content?.parts || [];

        // 최종 답변 업데이트
        text = toolParts
          .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
          .filter(Boolean)
          .join('');
        functionCalls = toolParts
          .filter((part: any) => part?.functionCall)
          .map((part: any) => part.functionCall);
      }
    }

    // 인사이트 자동 추출 (AI 응답에서 중요 분석 결과 캐싱)
    if (text && text.length > 200) {
      this.extractInsightsFromResponse(text, 'AI 대화');
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

    return this.callGemini(prompt, schema);
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

    // 파일명에서 키워드 추출
    const keywords = this.extractKeywords(file.name);

    return {
      name: uploadedFile.name!,
      displayName: file.name, // 원본 파일명 저장
      uri: uploadedFile.uri!,
      mimeType: uploadedFile.mimeType!,
      state: fileStatus.state!,
      keywords,
    };
  }

  /**
   * 파일명에서 키워드 추출
   */
  private extractKeywords(fileName: string): string[] {
    const keywords: string[] = [];
    const lowerName = fileName.toLowerCase();

    // 주요 주제 키워드 매핑
    const keywordMap: Record<string, string[]> = {
      'berkman': ['버크만', 'berkman', '진단', '레포트', '성격', '유형'],
      'organizational_behavior': ['로빈스', 'robbins', 'organizational', 'behavior', '조직행동', '행동'],
      'edgar_schein': ['샤인', 'schein', 'culture', '문화', '리더십', 'leadership'],
      'od_change': ['cummings', 'worley', 'organization development', 'od', '조직개발', '변화', 'change'],
    };

    for (const [, kws] of Object.entries(keywordMap)) {
      if (kws.some(kw => lowerName.includes(kw))) {
        keywords.push(...kws);
      }
    }

    return [...new Set(keywords)];
  }

  private normalizeAcademicFiles(): void {
    if (this.academicFiles.length === 0) {
      return;
    }

    let changed = false;
    this.academicFiles = this.academicFiles.map((file) => {
      const displayName = file.displayName || file.name;
      const keywords = file.keywords && file.keywords.length > 0
        ? file.keywords
        : this.extractKeywords(displayName);

      if (displayName !== file.displayName || keywords !== file.keywords) {
        changed = true;
      }

      return {
        ...file,
        displayName,
        keywords,
      };
    });

    if (changed) {
      localStorage.setItem('culture-map-academic-files', JSON.stringify(this.academicFiles));
      console.log('📚 Academic files metadata normalized');
    }
  }

  /**
      for (const keyword of keywords) {
        if (lowerPrompt.includes(keyword.toLowerCase())) {
          score += 10; // 키워드 매칭 시 점수 부여
        }
      }

      // displayName에서 직접 매칭 확인
      const displayName = (file.displayName || '').toLowerCase();
      if (lowerPrompt.includes('버크만') && displayName.includes('버크만')) score += 20;
      if (lowerPrompt.includes('문화') && displayName.includes('문화')) score += 15;
      if (lowerPrompt.includes('샤인') && displayName.includes('샤인')) score += 20;
      if (lowerPrompt.includes('조직') && displayName.includes('organizational')) score += 10;
      if (lowerPrompt.includes('행동') && displayName.includes('behavior')) score += 10;
      if (lowerPrompt.includes('변화') && displayName.includes('change')) score += 10;

      return { file, score };
    });

    // 점수순 정렬 후 상위 N개만 선택 (점수가 0인 파일은 제외)
    const selected = scoredFiles
      .filter(sf => sf.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxFiles)
      .map(sf => sf.file);

    // 관련 파일이 없으면 가장 작은 파일 1개만 선택 (버크만 레포트 우선)
    if (selected.length === 0 && this.academicFiles.length > 0) {
      const berkmanFile = this.academicFiles.find(f =>
        (f.displayName || f.name).toLowerCase().includes('버크만')
      );
      if (berkmanFile) {
        return [berkmanFile];
      }
    }

    return selected;
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
   * 프롬프트와 관련된 파일만 선택 (지능형 선택)
   * 1000페이지 제한(INVALID_ARGUMENT) 방지를 위해 최대 1개만 선택하도록 변경
   * 
   * [토큰 비용 최적화] 학술 지식이 필요한 질문에만 PDF 로드
   */
  private selectRelevantFiles(prompt: string, maxFiles: number = 1): FileMetadata[] {
    this.normalizeAcademicFiles();
    if (this.academicFiles.length === 0) return [];

    const lowerPrompt = prompt.toLowerCase();

    // [1단계] 학술 지식이 필요한 질문인지 먼저 판단
    // 단순 인사, 노드 생성 요청, 일반 대화에는 PDF 로드 안 함 (토큰 절약)
    const academicKeywords = [
      // 이론가/학자 이름
      '샤인', 'schein', '에드가', 'edgar', '로빈스', 'robbins', 'cummings', 'worley',
      // 학술 개념
      '이론', '관점', '모델', '프레임워크', '원리', '원칙', '연구', '학술',
      '인공물', 'artifact', '가정', 'assumption', '가치', 'value',
      '조직문화', '조직행동', '리더십', '변화관리', 'od', '조직개발',
      // 분석 요청
      '분석', '진단', '평가', '해석', '설명', '비교', '적용',
      '장점', '단점', '의미', '가치', '중요성', '시사점'
    ];

    const needsAcademicKnowledge = academicKeywords.some(kw => lowerPrompt.includes(kw));
    
    if (!needsAcademicKnowledge) {
      console.log('📚 [AIService] No academic knowledge needed for this prompt - skipping PDF load');
      return [];
    }

    // [2단계] 각 파일의 관련도 점수 계산
    const scoredFiles = this.academicFiles.map(file => {
      let score = 0;
      const keywords = file.keywords || this.extractKeywords(file.displayName || file.name);

      for (const keyword of keywords) {
        if (lowerPrompt.includes(keyword.toLowerCase())) {
          score += 10;
        }
      }

      // displayName에서 직접 매칭 확인
      const displayName = (file.displayName || '').toLowerCase();

      // 사용자 지침 반영: '버크만'은 전문지식베이스가 아닌 채팅 업로드로 들어오므로 
      // 전문지식베이스에서는 선택 우선순위를 낮춤 (중복 제거용)
      if (displayName.includes('버크만')) score -= 50;

      if (lowerPrompt.includes('샤인') && displayName.includes('샤인')) score += 30;
      if (lowerPrompt.includes('에드가') && displayName.includes('에드가')) score += 20;
      if (lowerPrompt.includes('로빈스') && displayName.includes('robbins')) score += 30;
      if (lowerPrompt.includes('조직행동') && displayName.includes('behavior')) score += 20;
      if (lowerPrompt.includes('문화') && displayName.includes('culture')) score += 10;
      if (lowerPrompt.includes('개발') && (displayName.includes('development') || displayName.includes('change'))) score += 15;

      return { file, score };
    });

    // 점수순 정렬 후 상위 N개 선택 (점수가 0보다 큰 것만)
    const selected = scoredFiles
      .filter(sf => sf.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxFiles)
      .map(sf => sf.file);

    // [토큰 최적화] 키워드 매칭 점수가 0이면 PDF 로드하지 않음
    // 1단계에서 이미 학술 지식 필요 여부를 판단했으므로, 
    // 점수가 0이면 특정 서적을 참조할 필요 없이 시스템 프롬프트로 충분
    if (selected.length === 0) {
      console.log('📚 [AIService] No specific academic file matched - using system knowledge only');
      return [];
    }

    return selected;
  }

  // 대용량 PDF 제외 키워드 (Gemini API 1000페이지 제한 초과 파일들)
  // ⚠️ 분할된 PDF는 여기서 제외하지 않음 (예: 로빈스_Part1, Part2, Part3)
  private static readonly LARGE_PDF_EXCLUSIONS: string[] = [
    // 현재 제외 대상 없음 - 분할된 PDF 사용 시 이 배열은 비워둠
    // 분할되지 않은 대용량 PDF가 있다면 여기에 키워드 추가
  ];

  /**
   * AI 도구 호출용: 주제 기반 PDF 선택 (단일 파일 반환)
   * AI가 load_academic_knowledge 도구를 호출할 때 사용
   * ⚠️ Gemini API 제한: PDF 최대 1000페이지
   */
  private selectRelevantFilesForTopic(topic: string): FileMetadata | null {
    this.normalizeAcademicFiles();
    if (this.academicFiles.length === 0) return null;

    const lowerTopic = topic.toLowerCase();

    // 주제별 파일 매칭 (AI가 전달한 topic 기반)
    const scoredFiles = this.academicFiles.map(file => {
      let score = 0;
      const displayName = (file.displayName || file.name).toLowerCase();

      // [페이지 제한 체크] 대용량 PDF 제외 (1000페이지 초과 파일들)
      const isLargePDF = AIService.LARGE_PDF_EXCLUSIONS.some(keyword => 
        displayName.includes(keyword.toLowerCase())
      );
      if (isLargePDF) {
        console.warn('⚠️ [AIService] Excluded large PDF (>1000 pages):', file.displayName);
        return { file, score: -999 }; // 최저 점수로 제외
      }

      // 에드가 샤인 관련
      if ((lowerTopic.includes('샤인') || lowerTopic.includes('schein') || lowerTopic.includes('에드가')) &&
          (displayName.includes('샤인') || displayName.includes('schein') || displayName.includes('culture'))) {
        score += 50;
      }

      // 로빈스 조직행동론 (분할된 파트별 매칭)
      if (lowerTopic.includes('로빈스') || lowerTopic.includes('robbins') || lowerTopic.includes('조직행동')) {
        if (displayName.includes('로빈스') || displayName.includes('robbins')) {
          // 파트별 세부 매칭
          if ((lowerTopic.includes('개인') || lowerTopic.includes('성격') || lowerTopic.includes('동기') || lowerTopic.includes('지각')) &&
              displayName.includes('part1')) {
            score += 60; // Part1 우선
          } else if ((lowerTopic.includes('집단') || lowerTopic.includes('팀') || lowerTopic.includes('리더십') || lowerTopic.includes('의사소통')) &&
              displayName.includes('part2')) {
            score += 60; // Part2 우선
          } else if ((lowerTopic.includes('조직') || lowerTopic.includes('문화') || lowerTopic.includes('구조') || lowerTopic.includes('변화')) &&
              displayName.includes('part3')) {
            score += 60; // Part3 우선
          } else {
            score += 40; // 일반 로빈스 매칭
          }
        }
      }

      // 조직개발/변화관리 관련
      if ((lowerTopic.includes('변화') || lowerTopic.includes('개발') || lowerTopic.includes('od') || lowerTopic.includes('change')) &&
          (displayName.includes('change') || displayName.includes('development') || displayName.includes('cummings'))) {
        score += 50;
      }

      // 버크만은 제외 (별도 채팅 업로드로 처리)
      if (displayName.includes('버크만')) score -= 100;

      // 일반 키워드 매칭
      const keywords = file.keywords || [];
      for (const kw of keywords) {
        if (lowerTopic.includes(kw.toLowerCase())) score += 10;
      }

      return { file, score };
    });

    // 최고 점수 파일 반환 (0점 이상만)
    const best = scoredFiles.filter(sf => sf.score > 0).sort((a, b) => b.score - a.score)[0];
    
    if (!best) {
      const fallback = this.academicFiles[this.academicFiles.length - 1] ?? null;
      if (fallback) {
        console.log('📚 [AIService] No suitable PDF matched, using fallback file:', fallback.displayName);
      } else {
        console.log('📚 [AIService] No suitable PDF found for topic, will use static knowledge');
      }
      return fallback;
    }

    return best.file;
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
    const result = await this.analyzeWithPDF(fileUri, mimeType, prompt);
    
    // 버크만 분석 결과에서 인사이트 자동 추출
    if (result && result.length > 200) {
      this.extractInsightsFromResponse(result, '버크만 진단 레포트');
    }
    
    return result;
  }

  public async analyzeWithPDF(fileUri: string, mimeType: string, prompt: string): Promise<string> {
    if (!this.geminiClient) throw new Error('Gemini API 설정을 먼저 완료해주세요.');
    const modelName = this.currentConfig?.modelName || 'gemini-2.5-flash-lite';
    const thinkingConfig = this.getThinkingConfig(modelName);
    const fileContent = createPartFromUri(fileUri, mimeType);
    const response = await this.geminiClient.models.generateContent({
      model: modelName,
      contents: [prompt, fileContent],
      ...(thinkingConfig ? { config: { thinkingConfig } } : {})
    });
    return response.text || '';
  }

  private async callGemini(prompt: string, schema?: object): Promise<string> {
    if (!this.geminiClient) throw new Error('Gemini 클라이언트가 초기화되지 않았습니다.');
    const modelName = this.currentConfig?.modelName || 'gemini-2.5-flash-lite';
    const thinkingConfig = this.getThinkingConfig(modelName);
    const response = await this.geminiClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        ...(schema ? { responseMimeType: 'application/json', responseSchema: schema as any } : {}),
        ...(thinkingConfig ? { thinkingConfig } : {})
      },
    });
    return response.text || '';
  }

  public getAvailableGeminiModels(): string[] {
    return [
      'gemini-2.5-flash',        // Function Calling 지원, 추론 강화
      'gemini-2.5-flash-lite',   // Function Calling 지원, 저비용/고속
      'gemini-2.5-pro',          // 고성능 추론
      'gemini-3-flash',          // 최신 thinkingLevel 지원
      'gemini-3-pro',            // 최신 플래그십
    ];
  }

  private normalizeModelConfig(config: AIConfig): AIConfig {
    const normalized = { ...config, provider: 'gemini' as const };
    const available = this.getAvailableGeminiModels();
    if (!normalized.modelName || !available.includes(normalized.modelName)) {
      normalized.modelName = 'gemini-2.5-flash-lite';
    }
    return normalized;
  }

  private getThinkingConfig(modelName: string): ThinkingConfig | null {
    const lowerName = modelName.toLowerCase();

    if (lowerName.includes('gemini-3')) {
      return {
        includeThoughts: true,
        thinkingLevel: 'HIGH' as ThinkingLevel
      };
    }

    if (lowerName.includes('gemini-2.5')) {
      return {
        thinkingBudget: 1024
      };
    }

    return null;
  }

  // ============================================
  // 인사이트 캐싱 시스템
  // ============================================

  /**
   * 캐싱된 인사이트 조회
   */
  public getInsights(): Insight[] {
    return this.insights;
  }

  /**
   * 인사이트 추가
   */
  public addInsight(insight: Omit<Insight, 'id' | 'timestamp'>): void {
    const newInsight: Insight = {
      ...insight,
      id: `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    this.insights.push(newInsight);
    
    // 최대 100개 인사이트 유지
    if (this.insights.length > 100) {
      this.insights = this.insights.slice(-100);
    }
    
    localStorage.setItem('culture-map-insights', JSON.stringify(this.insights));
    console.log(`💡 Insight added: ${newInsight.title} (${newInsight.type})`);
  }

  /**
   * 인사이트 초기화
   */
  public clearInsights(): void {
    this.insights = [];
    localStorage.removeItem('culture-map-insights');
    console.log('💡 Insights cleared');
  }

  /**
   * AI 응답에서 인사이트 자동 추출
   * 마크다운 헤딩과 키워드 기반으로 중요 분석 결과 추출
   */
  public extractInsightsFromResponse(responseText: string, source?: string): void {
    if (!responseText || responseText.length < 200) return;

    // 인사이트 타입별 키워드 매핑
    const typeKeywords: Record<InsightType, string[]> = {
      'berkman': ['버크만', 'berkman', '행동유형', '스트레스 행동', '욕구', '관심사'],
      'raci': ['raci', '책임', '담당', '협의', '참조', '역할 분담'],
      'org-chart': ['조직도', '조직 구조', '부서', '팀 구성', '보고 라인'],
      'diagnosis': ['진단', '분석 결과', '현황', '문제점', '이슈', '원인'],
      'solution': ['솔루션', '해결', '개선', '방안', '대책', '실행 계획'],
      'recommendation': ['추천', '제안', '권고', '조언', '가이드'],
      'general': [],
    };

    // 마크다운 섹션 파싱 (## 또는 ### 헤딩 기준)
    const sections = responseText.split(/(?=^##\s)/m).filter(s => s.trim().length > 0);

    for (const section of sections) {
      // 헤딩 추출
      const headingMatch = section.match(/^##\s*(.+?)[\n\r]/);
      if (!headingMatch) continue;

      const title = headingMatch[1].trim();
      const content = section.replace(/^##\s*.+?[\n\r]/, '').trim();

      // 너무 짧은 섹션 스킵 (300자 미만)
      if (content.length < 300) continue;

      // 타입 결정 (키워드 매칭)
      let detectedType: InsightType = 'general';
      const lowerSection = section.toLowerCase();

      for (const [type, keywords] of Object.entries(typeKeywords)) {
        if (keywords.some(kw => lowerSection.includes(kw.toLowerCase()))) {
          detectedType = type as InsightType;
          break;
        }
      }

      // 중요 키워드가 없는 일반 섹션은 스킵
      const importantKeywords = ['분석', '진단', '추천', '제안', '결과', '솔루션', '개선', '버크만', 'raci'];
      const hasImportantKeyword = importantKeywords.some(kw => lowerSection.includes(kw));
      if (detectedType === 'general' && !hasImportantKeyword) continue;

      // 관련 인물 추출 (이름 패턴: 한글 2-4자)
      const personMatches = content.match(/[가-힣]{2,4}(씨|님|팀장|부장|과장|대리|사원|매니저)?/g);
      const persons = personMatches ? [...new Set(personMatches.map(p => p.replace(/(씨|님|팀장|부장|과장|대리|사원|매니저)$/, '')))] : undefined;

      // 중복 방지: 같은 제목의 인사이트가 이미 있으면 스킵
      if (this.insights.some(i => i.title === title)) continue;

      this.addInsight({
        type: detectedType,
        title,
        content: content.slice(0, 2000), // 최대 2000자
        source,
        persons: persons?.length ? persons.slice(0, 10) : undefined,
      });
    }
  }
}

export const aiService = new AIService();
export default aiService;

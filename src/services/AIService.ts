/**
 * AI 서비스 - Gemini API 전용
 * 
 * 중요: @google/genai SDK 사용 (2025.05~ GA)
 * - File API 지원 (PDF 업로드)
 * - Chat Session 지원 (멀티턴 대화)
 * - Tool Use (Function Calling) 지원
 */

import { GoogleGenAI, createPartFromUri, FunctionCallingConfigMode, type ThinkingConfig, type ThinkingLevel } from '@google/genai';
import { MAP_TOOL_DECLARATIONS, type AiFunctionCall, type ToolDeclaration } from '../types/actions';
import { searchKnowledge } from '../data/academicKnowledge';
import type { ChatMessage, Insight, InsightType } from '../types/liveblocks';
import ragService from './RagService';
import liveblocksService from './LiveblocksService';

export type AIProvider = 'gemini';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  modelName?: string;
  autoExecuteFunctionCalls?: boolean; // true면 function call 자동 실행, false면 사용자 확인 후 실행
  sharedApiKeyMode?: boolean; // 세션 공용 API 키 모드 (동시 호출 제한)
}

export interface FileMetadata {
  name: string;
  displayName: string; // 원본 파일명
  uri: string;
  mimeType: string;
  state: string;
  keywords?: string[]; // 키워드 (지능형 선택용)
}

type MessagePart =
  | { text?: string }
  | ReturnType<typeof createPartFromUri>
  | { functionResponse?: { name: string; response: { content: string } } }
  | { functionCall?: AiFunctionCall };

type ChatHistoryItem = {
  role: 'user' | 'model';
  parts: MessagePart[];
};

type StreamPart = {
  text?: string;
  thought?: string | boolean;
  functionCall?: AiFunctionCall;
};

type StreamChunk = {
  candidates?: Array<{ content?: { parts?: StreamPart[] } }>;
  text?: string;
};

export type AIStreamChunk =
  | { type: 'text'; content: string; fullText: string }
  | { type: 'thought'; content: string }
  | { type: 'actions'; actions: AiFunctionCall[] };

type SendMessageResult = {
  response?: unknown;
  parts?: StreamPart[];
};

type ChatSessionLike = {
  sendMessageStream: (input: { message: string | MessagePart[] }) => Promise<AsyncIterable<StreamChunk>>;
  sendMessage: (input: { message: string | MessagePart[] }) => Promise<SendMessageResult>;
};

/**
 * 외부 AI API 직접 호출 서비스
 * BYOK(Bring Your Own Key) 방식 - API 키는 localStorage에 저장
 */
class AIService {
  private geminiClient: GoogleGenAI | null = null;
  private currentConfig: AIConfig | null = null;
  private chatSession: ChatSessionLike | null = null;
  private chatHistory: ChatHistoryItem[] = [];
  private currentThoughts: string[] = []; // 현재 세션의 사고 과정 저장
  private academicFiles: FileMetadata[] = []; // 전문 서적 지식 파일 목록
  private insights: Insight[] = []; // AI 동적 인사이트 캐싱
  private modelTokenLimitCache: Record<string, { inputTokenLimit: number; outputTokenLimit: number; updatedAt: number }> = {};
  private availableModelsCache: string[] | null = null;
  private readonly academicKeywords = [
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

  private getSystemInstruction(): string {
    return `
# Culture-MAP V2 AI 컨설턴트

## 프로그램 소개
Culture-MAP V2는 **Dave Gray의 Culture Map 모델**을 기반으로 한 조직문화 진단 및 시각화 프로그램입니다. 샤인(Edgar Schein)의 3계층 이론은 **해석과 설명을 보강하는 참고 프레임워크**로 활용됩니다.

### 핵심 기능
- **4계층 문화 맵**: 결과(Outcomes) → 행동(Behaviors) → 유형 레버(Type Levers) → 무형 레버(Intangible Levers)
- **노드 기반 시각화**: 각 레이어에 문화 요소를 노드로 추가하고 연결
- **버크만 진단 통합**: 개인 성격 유형과 조직문화 연계 분석
- **AI 컨설팅**: 학술 이론 기반 문화 진단 및 개선 전략 제안

### Dave Gray 모델 기반 구조 + 샤인 이론 매핑
- **Dave Gray Culture Map 핵심 요소**: Outcomes(결과) · Behaviors(행동) · Enablers/Blockers(유형 레버) · Assumptions/Beliefs(무형 레버)
- **샤인 이론 매핑(참고)**:
  - Artifacts (인공물) → 결과/행동 레이어
  - Espoused Values (표방 가치) → 유형 레버 레이어  
  - Basic Assumptions (기본 가정) → 무형 레버 레이어

## 당신의 역할
1. **문화 진단 전문가**: Dave Gray 문화맵 모델을 중심으로, 샤인 이론·로빈스 조직행동론 등 학술 지식 기반 분석
2. **맵 편집 도우미**: 사용자 요청 시 노드 추가/수정/삭제 (도구 사용)
3. **전략 컨설턴트**: 문화 변화 전략 및 실행 계획 제안

## 수동 조작 안내 원칙
- 사용자가 "직접 생성/편집 방법"을 묻는 경우 **마우스/키보드 기반 UI 절차**를 우선 안내한다.
- “텍스트 명령만 가능” 같은 안내는 금지한다.
- 기본 안내 항목: 빈 캔버스 우클릭 → 레이어 선택으로 노드 생성, 노드 더블클릭 편집, 노드/연결선 우클릭 메뉴, 핸들 드래그로 연결선 생성, 상단 PNG/JSON/Excel 내보내기.

## 커뮤니케이션 페르소나
- **포지션**: 조직문화 컨설팅 파트너
- **톤**: 전문적이되 친절하고 단정한 존댓말
- **구조**: 핵심 요약 → 근거/진단 → 실행 제안(담당/우선순위 포함)
- **원칙**: 불확실한 내용은 추정하지 말고 질문으로 확인

## 도구 사용 규칙
1. 노드 추가/수정 후 반드시 auto_layout 호출하여 정리
2. 공간 부족/겹침/연결선 가림이 발생하면 adjust_layer_height 호출
3. 사용자가 명시적으로 노드 생성을 요청할 때만 도구 사용
4. 여러 노드와 연결을 동시에 만들 때는 add_nodes_with_connections로 단일 호출 수행
5. 특정 좌표로 이동할 필요가 있으면 update_node에 x/y 포함
6. delete_node는 **사용자가 명시적으로 삭제를 요청한 특정 노드 ID**에만 사용하며, 연결선 유무로 임의 삭제하지 말 것
7. delete_connection은 **사용자가 명시적으로 삭제를 요청한 특정 연결선 ID**에만 사용하며, 노드 삭제의 부수 효과로 호출하지 말 것
8. 도구 호출은 **코드 블록/print/default_api/tool_code**로 출력하지 말고 반드시 실제 function call로 실행
9. 사용자가 "그렇게 해", "해줘", "진행해"처럼 직전 제안을 수락하면 즉시 해당 도구를 호출
10. 코드 예시는 사용자가 명시적으로 코드 요청 시에만 제공하며, 도구 호출과는 분리
11. 사용자가 "현재 위치 유지", "정렬하지 말고"라고 요청하면 auto_layout을 호출하지 말고 기존 좌표를 유지
12. 간격을 좁히거나 넓히라는 요청이 있으면 auto_layout 호출 시 spacing(compact/normal/wide)을 사용
13. 연결선 재정렬/재조정 요청(“연결선”, “선 다시”, “연결선도 정렬”)은 reroute_edges를 사용
14. 줌/팬/전체 보기 요청은 set_viewport, pan_viewport, zoom_viewport, fit_view를 사용
14. 특정 노드로 이동 요청은 focus_node를 사용
15. 레이어 투명도/배경 표시 요청은 set_layer_opacity, toggle_layer_background를 사용
16. UI 표시/숨김 요청(컨트롤, 미니맵, 레이어 패널, 배경, 내보내기)은 set_ui_visibility를 사용
17. 노드/엣지 스타일(색상, 폰트, 테두리, 그림자) 변경 요청은 set_style_variables를 사용
18. 노드 위치 고정 요청은 pin_node, 해제 요청은 unpin_node를 사용
19. **스냅샷/백업**을 명시적으로 언급한 복원 요청에만 save_snapshot, restore_snapshot을 사용
20. **자동 정렬 직전 상태로 되돌리는 요청**(되돌려, 원복, 취소, 이전 상태로)은 undo_layout을 사용
21. “이전 상태로”, “되돌려”처럼 스냅샷/백업 언급이 없는 복원 표현은 restore_snapshot이 아니라 undo_layout을 사용
22. set_layer_opacity 사용 시 opacity는 CSS 표준 (1=완전불투명, 0=완전투명). "투명도 50%" 요청 시 opacity=0.5, "불투명도 50%" 요청 시에도 opacity=0.5를 사용. layer 파라미터는 반드시 숫자(1,2,3,4)로 전달
23. 사용자가 "설명해", "왜?", "근거"처럼 **설명/근거 요청**을 하면 도구 호출 없이 텍스트로 먼저 설명한다.
24. 컨텍스트에 "워크샵 모드"가 표시된 경우 **빈도/강도(intensity/frequency) 표기를 사용하지 않는다**.
25. 노드 감성(긍정/부정/중립) 변경 요청은 update_node의 sentiment로 처리한다.
26. 노드 강도/빈도(다/중/소) 변경 요청은 컨설팅 모드에서만 update_node의 intensity를 사용한다.

## ✅ 도구 호출 후 항상 채팅 메시지 제공
- 도구만 호출하고 침묵하지 말 것
- 무엇을 했는지, 제한이 있었다면 왜인지 간결하게 안내

## 연결선(인과관계) 생성 규칙
1. **노드 생성 후 연결 권장**: 새 노드 추가 후, 관련된 기존 노드와 create_connection 호출 권장
2. **층위 간 인과 흐름**: 무형레버(Layer 4) → 유형레버(Layer 3) → 행동(Layer 2) → 결과(Layer 1) 방향
3. **sourceId/targetId 순서**: sourceId = 원인 노드(상위 층위), targetId = 결과 노드(하위 층위)
4. **다수 노드 생성 시**: 모든 노드 생성 완료 → 일괄 연결(create_connection) → auto_layout 순서
5. **대량 생성 최적화**: 노드+연결 요청이 함께 오면 add_nodes_with_connections로 노드/연결을 한 번에 생성
6. **relationType 의미**: direct=직접 인과관계(실선), indirect=간접 인과관계(점선)

### ✅ 예시 (DO)
사용자: "리더십 문화 관련 노드 3개 만들어줘"
→ 순서: add_node(Layer4 "리더십 가치관") → add_node(Layer3 "리더십 평가제도") → add_node(Layer2 "솔선수범 행동") → create_connection(source: Layer4노드ID, target: Layer3노드ID) → create_connection(source: Layer3노드ID, target: Layer2노드ID) → auto_layout()

사용자: "A,B,C 노드 만들고 A-B, B-C 연결해줘"
→ 순서: add_nodes_with_connections(nodes:[{tempId:"A", label:"A", layer:4, type:"무형_레버"}, {tempId:"B", label:"B", layer:3, type:"유형_레버"}, {tempId:"C", label:"C", layer:2, type:"행동"}], connections:[{sourceId:"A", targetId:"B"}, {sourceId:"B", targetId:"C"}]) → auto_layout()

사용자: "노드 X를 (900, 420)로 옮겨줘"
→ 순서: update_node(id:"노드X_ID", x:900, y:420) → auto_layout()

사용자: "노드가 겹치고 연결선이 가려져"
→ 순서: adjust_layer_height(layer: 4, height: 350) → adjust_layer_height(layer: 3, height: 350) → auto_layout() → reroute_edges()

### ❌ 금지 (DON'T)
- 노드만 생성하고 연결선 없이 끝내기
- 연결 방향 반대로 하기 (하위→상위)
- 연결선 없는 노드를 추정해서 삭제하기
        `;
  }

  private isRateLimitError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status?: number }).status
      : (typeof (error as { code?: unknown }).code === 'number' ? (error as { code?: number }).code : undefined);
    return status === 429 || message.includes('rate limit') || message.includes('429') || message.includes('resource_exhausted');
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private createChatSession(
    mode: FunctionCallingConfigMode = FunctionCallingConfigMode.AUTO,
    history?: ChatHistoryItem[],
    allowedFunctionNames?: string[]
  ) {
    if (!this.geminiClient) throw new Error('Gemini API 설정을 먼저 완료해주세요.');

    const modelName = this.currentConfig?.modelName || 'gemini-2.5-flash-lite';
    const thinkingConfig = this.getThinkingConfig(modelName);
    const mapEditTools = [
      'add_node',
      'add_nodes_with_connections',
      'update_node',
      'delete_node',
      'delete_connection',
      'create_connection',
      'auto_layout',
      'reroute_edges',
      'adjust_layer_height',
      'set_viewport',
      'pan_viewport',
      'zoom_viewport',
      'fit_view',
      'focus_node',
      'set_layer_opacity',
      'toggle_layer_background',
      'set_ui_visibility',
      'set_style_variables',
      'save_snapshot',
      'restore_snapshot'
    ];
    const allowedToolNames = mode === FunctionCallingConfigMode.ANY
      ? (allowedFunctionNames ?? mapEditTools)
      : allowedFunctionNames;
    const toolDeclarations: ToolDeclaration[] = allowedToolNames
      ? MAP_TOOL_DECLARATIONS.filter((tool) => allowedToolNames.includes(tool.name))
      : MAP_TOOL_DECLARATIONS;
    const functionCallingConfig = mode === FunctionCallingConfigMode.ANY
      ? { mode, allowedFunctionNames: allowedToolNames }
      : { mode };

    return this.geminiClient.chats.create({
      model: modelName,
      config: {
        systemInstruction: this.getSystemInstruction(),
        tools: [{ functionDeclarations: toolDeclarations }],
        toolConfig: {
          functionCallingConfig
        },
        ...(thinkingConfig ? { thinkingConfig } : {})
      },
      ...(history && history.length > 0 ? { history } : {})
    }) as ChatSessionLike;
  }

  /**
   * AI 서비스 설정
   */
  public setConfig(config: AIConfig) {
    const normalized = this.normalizeModelConfig(config);
    this.currentConfig = normalized;
    if (config.provider === 'gemini' && config.apiKey) {
      this.geminiClient = new GoogleGenAI({ apiKey: config.apiKey });
    }

    ragService.setClient(this.geminiClient);

    if (normalized.modelName) {
      void this.validateModelAvailability(normalized.modelName);
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
  public startChat(history: ChatHistoryItem[] = []) {
    this.chatHistory = Array.isArray(history) ? [...history] : [];
    this.chatSession = this.createChatSession(FunctionCallingConfigMode.AUTO, this.chatHistory);

    console.log('🔧 [AIService] startChat: Model =', this.currentConfig?.modelName || 'gemini-2.5-flash-lite', 'Tools count =', MAP_TOOL_DECLARATIONS.length);
    console.log('🔧 [AIService] Tool names:', MAP_TOOL_DECLARATIONS.map((t) => t.name).join(', '));

    return this.chatSession;
  }

  /**
   * 챗봇 세션/히스토리 초기화
   */
  public resetChatSession(): void {
    this.chatHistory = [];
    this.currentThoughts = [];
    this.chatSession = null;
    console.log('🧹 [AIService] Chat session reset');
  }

  /**
   * 챗봇 메시지 전송 (스트리밍 버전)
   */
  public async *sendChatMessageStream(
    prompt: string,
    fileUri?: string,
    mimeType?: string,
    options?: { forceFunctionCall?: boolean; allowExternalTools?: boolean }
  ): AsyncGenerator<AIStreamChunk, void, void> {
    const forceFunctionCall = options?.forceFunctionCall ?? false;
    const allowExternalTools = options?.allowExternalTools ?? true;
    const internalTools = ['search_academic_theory', 'load_academic_knowledge'];

    let session = forceFunctionCall
      ? this.createChatSession(FunctionCallingConfigMode.ANY, this.chatHistory)
      : (allowExternalTools
          ? (this.chatSession || this.startChat())
          : this.createChatSession(FunctionCallingConfigMode.AUTO, this.chatHistory, internalTools));

    const parts: MessagePart[] = [{ text: prompt }];
    if (prompt) {
      this.chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
    }

    // [토큰 최적화] PDF 자동 로드 제거 - AI가 load_academic_knowledge 도구로 필요시에만 로드
    // 이제 AI가 동적으로 판단하여 학술 지식이 필요할 때만 도구를 호출합니다.
    // 기존 자동 로드 로직은 selectRelevantFiles()로 이동되어 도구 호출 시 사용됩니다.

    // 채팅창을 통해 직접 업로드된 파일 (버크만 레포트 등 참가자 자료)
    if (fileUri && mimeType) {
      console.log('📄 [AIService] Including session participant data (uploaded file)');
      parts.push(createPartFromUri(fileUri, mimeType));
    }

    // 스트리밍 세션 시작
    let streamResult: AsyncIterable<StreamChunk> | null = null;
    let streamRetried = false;
    let rateLimitRetries = 0;
    const maxRateLimitRetries = 2;
    while (true) {
      try {
        console.log('📡 [AIService] Calling sendMessageStream...');

        // @google/genai v2.0 SDK: sendMessageStream는 { message: string | PartUnion[] } 형식 필요
        // 단일 텍스트만 있으면 문자열로, 파일 포함 시 parts 배열로 전달
        const firstPart = parts[0];
        if (parts.length === 1 && 'text' in firstPart && firstPart.text) {
          streamResult = await session!.sendMessageStream({ message: firstPart.text });
        } else {
          streamResult = await session!.sendMessageStream({ message: parts });
        }

        console.log('📡 [AIService] sendMessageStream request sent, waiting for chunks...');
        break;
      } catch (err) {
        if (!streamRetried && this.isModelNotFoundError(err)) {
          console.warn('⚠️ [AIService] Model not available for stream, retrying with validated model');
          streamRetried = true;
          await this.validateModelAvailability(this.currentConfig?.modelName || '');
          session = forceFunctionCall
            ? this.createChatSession(FunctionCallingConfigMode.ANY, this.chatHistory)
            : (allowExternalTools
                ? this.startChat(this.chatHistory)
                : this.createChatSession(FunctionCallingConfigMode.AUTO, this.chatHistory, internalTools));
          continue;
        }
        if (this.isRateLimitError(err) && rateLimitRetries < maxRateLimitRetries) {
          rateLimitRetries += 1;
          const backoffMs = 1500 * Math.pow(2, rateLimitRetries - 1);
          console.warn(`⏳ [AIService] Rate limited. Retrying in ${backoffMs}ms (attempt ${rateLimitRetries}/${maxRateLimitRetries})`);
          await this.sleep(backoffMs);
          continue;
        }
        console.error('❌ [AIService] Error starting stream:', err);
        throw err;
      }
    }

    this.currentThoughts = [];
    let fullText = '';
    const accumulatedFunctionCalls: AiFunctionCall[] = [];
    let chunkCount = 0;

    // 스트림 반복 처리
    // @google/genai v2.0 SDK: sendMessageStream 반환값 자체가 AsyncIterable (stream 속성 없음)
    try {
      if (!streamResult) {
        throw new Error('Stream result is not available');
      }

      for await (const chunk of streamResult) {
        chunkCount++;

        // candidates에서 parts 직접 추출 (chunk.text 접근 시 SDK 내부 경고 방지)
        const candidates = chunk.candidates;
        const parts = candidates?.[0]?.content?.parts ?? [];

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
    const externalActions = accumulatedFunctionCalls.filter(fc => !internalTools.includes(fc.name));
    const internalActions = accumulatedFunctionCalls.filter(fc => internalTools.includes(fc.name));

    const extractPartsFromResponse = (result: unknown): StreamPart[] => {
      const response = (result as { response?: unknown })?.response ?? result;
      if (!response || typeof response !== 'object') return [];
      const candidates = (response as { candidates?: unknown }).candidates;
      const firstCandidate = Array.isArray(candidates) ? candidates[0] : undefined;
      const partsCandidate = (firstCandidate as { content?: { parts?: unknown } })?.content?.parts;
      if (Array.isArray(partsCandidate)) {
        return partsCandidate.filter((part): part is StreamPart => typeof part === 'object' && part !== null);
      }
      const text = (response as { text?: unknown }).text;
      if (typeof text === 'string') {
        return [{ text }];
      }
      return [];
    };

    // 내부 도구 자동 처리 (학술 지식 검색 등)
    for (const internalCall of internalActions) {
      // [신규] AI가 동적으로 PDF 로드 요청
      if (internalCall.name === 'load_academic_knowledge') {
        const topicRaw = internalCall.args?.topic;
        const topic = typeof topicRaw === 'string' ? topicRaw : '';
        console.log('📚 [AIService] AI requested academic knowledge:', topic);
        const availableFiles = this.academicFiles.map(file => file.displayName || file.name).filter(Boolean);
        console.log('📚 [AIService] Academic files available:', availableFiles.join(', '));

        const ragContext = await ragService.retrieveContext(topic, {
          topK: 6,
          minScore: 0.2,
          maxContextChars: 7000
        });

        if (ragContext?.contextText) {
          try {
            const followUp = await session!.sendMessage({
              message: `[시스템] 다음은 문서 기반 RAG 검색 결과입니다. 이 근거를 우선 사용하여 답변하세요. 불확실한 내용은 추정하지 마세요.\n\n${ragContext.contextText}\n\n[질문]\n${topic}`
            });
            const followUpParts = extractPartsFromResponse(followUp);
            for (const part of followUpParts) {
              if (part.text) {
                fullText += '\n\n' + part.text;
                yield { type: 'text', content: '\n\n' + part.text, fullText };
              } else if (part.functionCall && !internalTools.includes(part.functionCall.name)) {
                externalActions.push(part.functionCall);
              }
            }
          } catch (err) {
            console.error('❌ [AIService] Error using RAG context:', err);
          }

          continue;
        }
        
        // PDF 선택 (AI가 제공한 topic 기반)
        const topicStr = typeof topic === 'string' ? topic : '';
        const selectedFiles = await this.selectAcademicFilesForTopic(topicStr);
        const limitedFiles = this.limitAcademicAttachments(selectedFiles);
        const selectedNames = limitedFiles.map(file => file.displayName).filter(Boolean);

        if (limitedFiles.length > 0) {
          console.log('📚 [AIService] Loading academic files:', selectedNames.join(', '));

          // PDF를 포함하여 후속 응답 생성
          try {
            const parts: Array<{ text?: string } | ReturnType<typeof createPartFromUri>> = [
              {
                text: `[시스템] "${topicStr}" 관련 학술 자료를 로드했습니다. 전체를 통독하기보다 주제와 관련된 섹션/챕터를 우선 탐색해 핵심 근거만 요약해 주세요. 가능하면 장/절 제목을 함께 제시하고, 불확실한 내용은 추정하지 마세요.`
              }
            ];

            limitedFiles.forEach(file => {
              parts.push(createPartFromUri(file.uri, file.mimeType));
            });

            const followUp = await session!.sendMessage({
              message: parts
            });
            const followUpParts = extractPartsFromResponse(followUp);
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

            if (this.isTokenLimitError(err)) {
              console.warn('⚠️ [AIService] Token limit exceeded, retrying without attachments');
              const knowledgeResult = searchKnowledge(topicStr);
              try {
                const followUp = await session!.sendMessage({
                  message: `[시스템] 업로드된 학술 자료 첨부 없이 "${topicStr}"에 대해 일반 지식으로 답변하세요. 자료 미포함 여부는 보조 설명으로만 언급하세요. 관련 학술 지식(요약/키워드): ${knowledgeResult}`
                });
                const followUpParts = extractPartsFromResponse(followUp);
                for (const part of followUpParts) {
                  if (part.text) {
                    fullText += '\n\n' + part.text;
                    yield { type: 'text', content: '\n\n' + part.text, fullText };
                  }
                }
              } catch (retryErr) {
                console.error('❌ [AIService] Error after token-limit retry:', retryErr);
                yield { type: 'text', content: '\n\n[학술 자료 로드 중 오류가 발생했습니다]', fullText: fullText + '\n\n[Error]' };
              }
            } else {
              yield { type: 'text', content: '\n\n[학술 자료 로드 중 오류가 발생했습니다]', fullText: fullText + '\n\n[Error]' };
            }
          }
        } else {
          // 매칭된 PDF가 없으면 하드코딩된 지식 + 일반 지식 응답 유도
          console.log('📚 [AIService] No suitable academic file matched, using static knowledge and general answer');
          const knowledgeResult = searchKnowledge(topicStr);

          try {
            const followUp = await session!.sendMessage({
              message: `[시스템] 업로드된 학술 자료에서 "${topicStr}"에 대한 직접 근거가 없다면 일반 지식으로 답변하세요. 자료 미포함 여부는 보조 설명으로만 언급하세요. 관련 학술 지식(요약/키워드): ${knowledgeResult}`
            });
            const followUpParts = extractPartsFromResponse(followUp);
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
        const topicArg = internalCall.args?.topic;
        const topicStr = typeof topicArg === 'string' ? topicArg : '';
        const knowledgeResult = searchKnowledge(topicStr);

        // 검색 결과를 AI에게 다시 전달하여 후속 응답 생성
        try {
          const followUp = await session!.sendMessage({
            message: [
              {
                functionResponse: {
                  name: 'search_academic_theory',
                  response: { content: knowledgeResult }
                }
              }
            ]
          });
          // 후속 응답에서 텍스트와 function call 추출
          const followUpParts = extractPartsFromResponse(followUp);
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

    if (!fullText.trim() && externalActions.length === 0) {
      const fallbackText = 'AI 응답이 비어 있습니다. 잠시 후 다시 시도해주세요.';
      fullText = fallbackText;
      yield { type: 'text', content: fallbackText, fullText };
    }

    const modelParts: MessagePart[] = [];
    if (fullText) {
      modelParts.push({ text: fullText });
    }
    accumulatedFunctionCalls.forEach((call) => modelParts.push({ functionCall: call }));
    if (modelParts.length > 0) {
      this.chatHistory.push({ role: 'model', parts: modelParts });
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

    // 등록된 학술 지식 파일 중 관련성 높은 파일만 동적으로 추가
    const selectedFiles = this.selectRelevantFiles(prompt, 1);
    const buildParts = (messageText: string, includeAcademicFiles: boolean): MessagePart[] => {
      const messageParts: MessagePart[] = [{ text: messageText }];

      if (includeAcademicFiles) {
        selectedFiles.forEach(file => {
          messageParts.push(createPartFromUri(file.uri, file.mimeType));
        });
      }

      if (fileUri && mimeType) {
        messageParts.push(createPartFromUri(fileUri, mimeType));
      }

      return messageParts;
    };

    const runSendMessage = async (messageParts: MessagePart[]): Promise<SendMessageResult> => {
        const firstPart = messageParts[0];
        if (messageParts.length === 1 && 'text' in firstPart && firstPart.text) {
          return this.chatSession!.sendMessage({ message: firstPart.text });
        }
        return this.chatSession!.sendMessage({ message: messageParts });
      };

    const coerceParts = (value: unknown): StreamPart[] =>
      Array.isArray(value)
        ? value.filter((part): part is StreamPart => typeof part === 'object' && part !== null)
        : [];

    const parseResponse = (response: unknown, fallbackParts?: StreamPart[]) => {
      const candidate = (response as { candidates?: unknown })?.candidates;
      const firstCandidate = Array.isArray(candidate) ? candidate[0] : undefined;
      const responseParts = coerceParts((firstCandidate as { content?: { parts?: unknown } })?.content?.parts);
      const responseText = typeof (response as { text?: unknown })?.text === 'string'
        ? String((response as { text?: string }).text)
        : '';

      console.log('📡 AI Raw Result Parts Count:', responseParts.length);

      this.currentThoughts = [];
      let parsedText = '';

      responseParts.forEach((part) => {
        if (part.thought) {
          const thoughtText = typeof part.thought === 'string' ? part.thought : part.text;
          if (thoughtText) {
            this.currentThoughts.push(thoughtText);
            console.log('🧠 AI Thought:', thoughtText);
          }
        } else if (part.text) {
          parsedText += part.text;
        }
      });

      if (!parsedText && responseText) {
        parsedText = responseText;
      }

      let parsedFunctionCalls = responseParts
        .filter((p) => p.functionCall)
        .map((p) => p.functionCall as AiFunctionCall);

      if (parsedFunctionCalls.length === 0 && Array.isArray(fallbackParts)) {
        parsedFunctionCalls = fallbackParts
          .filter((p) => p.functionCall)
          .map((p) => p.functionCall as AiFunctionCall);
      }

      if (!parsedText && parsedFunctionCalls && parsedFunctionCalls.length > 0) {
        parsedText = '요청하신 작업을 위한 도구 실행을 준비 중입니다.';
      }

      return { parsedText, parsedFunctionCalls, responseParts };
    };

    if (prompt) {
      this.chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
    }

    const initialParts = buildParts(prompt, true);
    let result = await runSendMessage(initialParts);

    let response = await result.response;
    if (!response) {
      console.warn('⚠️ [AIService] Empty response payload from sendMessage');
    }

    let { parsedText: text, parsedFunctionCalls: functionCalls } = parseResponse(response, result.parts);

    if (!text?.trim() && (!functionCalls || functionCalls.length === 0)) {
      console.warn('⚠️ [AIService] Empty content detected, retrying without academic attachments');
      const retryPrompt = `${prompt}\n\n[시스템] 이전 응답이 비어 있었습니다. 동일 요청에 대해 반드시 텍스트로 답변하세요. 최소 5문장 이상으로 작성하세요.`;
      this.chatHistory.push({ role: 'user', parts: [{ text: retryPrompt }] });

      const retryParts = buildParts(retryPrompt, false);
      result = await runSendMessage(retryParts);
      response = await result.response;

      if (!response) {
        console.error('❌ [AIService] Empty response from sendMessage after retry');
        throw new Error('AI 응답이 비어 있습니다. 잠시 후 다시 시도해주세요.');
      }

      const retryParsed = parseResponse(response, result.parts);
      text = retryParsed.parsedText;
      functionCalls = retryParsed.parsedFunctionCalls;
    }

    // 학술 지식 검색 도구가 호출된 경우 자동 처리
    if (functionCalls && functionCalls.length > 0) {
      const academicSearch = functionCalls.find((fc) => fc.name === 'search_academic_theory');
      if (academicSearch) {
        const topic = typeof academicSearch.args?.topic === 'string' ? academicSearch.args.topic : '';
        console.log('🔍 AI is searching academic knowledge:', topic);
        const knowledgeResult = searchKnowledge(topic);

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
        if (!toolResponsePayload) {
          console.warn('⚠️ [AIService] Empty tool response payload for academic search');
        }
        const toolParts = coerceParts(
          (toolResponsePayload as { candidates?: unknown })?.candidates &&
            (Array.isArray((toolResponsePayload as { candidates?: unknown }).candidates)
              ? ((toolResponsePayload as { candidates?: unknown }).candidates as unknown[])[0]
              : undefined)
              ? ((Array.isArray((toolResponsePayload as { candidates?: unknown }).candidates)
                  ? ((toolResponsePayload as { candidates?: unknown }).candidates as unknown[])[0]
                  : undefined) as { content?: { parts?: unknown } })?.content?.parts
              : undefined
        );

        // 최종 답변 업데이트
        const toolText = toolParts
          .map((part) => (typeof part?.text === 'string' ? part.text : ''))
          .filter(Boolean)
          .join('');
        if (toolText) {
          text = toolText;
        }
        functionCalls = toolParts
          .filter((part) => part?.functionCall)
          .map((part) => part.functionCall as AiFunctionCall);
      }
    }

    const responsePartsForHistory: MessagePart[] = [];
    if (text) {
      responsePartsForHistory.push({ text });
    }
    (functionCalls || []).forEach((call) => responsePartsForHistory.push({ functionCall: call }));
    if (responsePartsForHistory.length > 0) {
      this.chatHistory.push({ role: 'model', parts: responsePartsForHistory });
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
  public async analyzeCulture(prompt: string, schema?: Record<string, unknown>): Promise<string> {
    if (!this.currentConfig) throw new Error('AI API 설정을 먼저 완료해주세요.');

    return this.callGemini(prompt, schema);
  }

  /**
   * PDF 파일 업로드
   */
  public async uploadPDF(file: File): Promise<FileMetadata> {
    if (!file.type.includes('pdf')) {
      throw new Error('PDF 파일만 업로드 가능합니다.');
    }

    return this.uploadFileToGemini(file, 'PDF 파일 처리에 실패했습니다.');
  }

  /**
   * 학술 파일 업로드 (PDF/이미지)
   */
  public async uploadAcademicFile(file: File): Promise<FileMetadata> {
    if (file.type === 'application/pdf') {
      const metadata = await this.uploadPDF(file);
      this.indexAcademicPdfInBackground(file, metadata);
      return metadata;
    }

    if (file.type.startsWith('image/')) {
      const resizedFile = await this.resizeImageIfNeeded(file);
      await this.validateImageDimensions(resizedFile);
      const metadata = await this.uploadFileToGemini(resizedFile, '이미지 파일 처리에 실패했습니다.');
      const mindmapKeywords = await this.extractMindmapKeywords(metadata.uri, metadata.mimeType);
      if (mindmapKeywords.length > 0) {
        return { ...metadata, keywords: mindmapKeywords };
      }
      return metadata;
    }

    throw new Error('PDF 또는 이미지 파일만 업로드 가능합니다.');
  }

  private indexAcademicPdfInBackground(file: File, metadata: FileMetadata) {
    if (!this.geminiClient) return;
    void ragService
      .indexAcademicPdf(file, { id: metadata.name, name: metadata.displayName })
      .then((result) => {
        if (result && result.chunkCount > 0) {
          console.log(`📚 [AIService] RAG indexed: ${metadata.displayName} (${result.chunkCount} chunks)`);
        }
      })
      .catch((error) => {
        console.warn('⚠️ [AIService] RAG indexing failed:', metadata.displayName, error);
      });
  }

  /**
   * PDF를 공유 RAG로 인덱싱 (Liveblocks에 벡터 저장)
   */
  public async indexAcademicPdfToShared(file: File, metadata: FileMetadata): Promise<{ chunkCount: number } | null> {
    if (!this.geminiClient) {
      throw new Error('Gemini API 설정을 먼저 완료해주세요.');
    }
    
    return ragService.indexAcademicPdfToShared(file, { id: metadata.name, name: metadata.displayName });
  }

  /**
   * 공유 RAG 문서 삭제
   */
  public removeSharedRagDocument(docId: string): void {
    ragService.removeSharedDocument(docId);
  }

  private async uploadFileToGemini(file: File, failureMessage: string): Promise<FileMetadata> {
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

    if (fileStatus.state === 'FAILED') throw new Error(failureMessage);

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

  private async validateImageDimensions(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) return;

    const { width, height } = await this.getImageDimensions(file);

    if (width > 3600 || height > 3600) {
      throw new Error(`이미지 해상도는 최대 3600x3600 픽셀까지 지원합니다. (현재 ${width}x${height})`);
    }
  }

  private async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    const objectUrl = URL.createObjectURL(file);
    try {
      return await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = () => reject(new Error('이미지 파일을 읽을 수 없습니다.'));
        img.src = objectUrl;
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private async resizeImageIfNeeded(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) return file;

    const { width, height } = await this.getImageDimensions(file);
    const maxDimension = Math.max(width, height);

    if (maxDimension <= 3600) {
      return file;
    }

    const scale = 3600 / maxDimension;
    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);
    const objectUrl = URL.createObjectURL(file);

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('이미지 리사이즈에 실패했습니다.'));
        image.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('이미지 리사이즈 컨텍스트를 생성할 수 없습니다.');
      }
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const targetType = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
        ? file.type
        : 'image/png';

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, targetType, 0.92));
      if (!blob) {
        throw new Error('이미지 리사이즈 결과를 생성하지 못했습니다.');
      }

      console.log(`📚 [AIService] Image resized: ${width}x${height} → ${targetWidth}x${targetHeight}`);
      const nameParts = file.name.split('.');
      const extension = nameParts.length > 1 ? nameParts.pop() : '';
      const baseName = nameParts.join('.') || 'mindmap';
      const resizedName = extension ? `${baseName}_resized.${extension}` : `${baseName}_resized`;

      return new File([blob], resizedName, { type: targetType });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private async extractMindmapKeywords(fileUri: string, mimeType: string): Promise<string[]> {
    if (!this.geminiClient) return [];

    let modelName = this.currentConfig?.modelName || 'gemini-2.5-flash-lite';
    const prompt = `다음 마인드맵 이미지를 보고 핵심 주제 키워드를 8~15개 이내로 추출하세요.\n- 중복 없이 간결한 명사/구로 작성\n- 결과는 JSON으로만 반환 (형식: {"keywords": ["..."]})`;
    const schema = {
      type: 'object',
      properties: {
        keywords: { type: 'array', items: { type: 'string' } }
      },
      required: ['keywords'],
      propertyOrdering: ['keywords']
    };

    let retryAttempted = false;
    while (true) {
      try {
        const response = await this.geminiClient.models.generateContent({
          model: modelName,
          contents: [prompt, createPartFromUri(fileUri, mimeType)],
          config: {
            responseMimeType: 'application/json',
            responseSchema: schema
          }
        });
        const parsed = this.safeParseJson(response.text || '');
        if (parsed && Array.isArray(parsed.keywords)) {
          return parsed.keywords.filter((item) => typeof item === 'string' && item.trim().length > 0);
        }
        break;
      } catch (err) {
        if (!retryAttempted && this.isModelNotFoundError(err)) {
          console.warn('⚠️ [AIService] Model not available for mindmap, retrying with validated model');
          retryAttempted = true;
          await this.validateModelAvailability(this.currentConfig?.modelName || modelName);
          modelName = this.currentConfig?.modelName || modelName;
          continue;
        }
        console.warn('⚠️ [AIService] Failed to extract mindmap keywords:', err);
        break;
      }
    }

    return [];
  }

  private safeParseJson(value: string): { [key: string]: unknown } | null {
    if (!value) return null;
    try {
      return JSON.parse(value) as { [key: string]: unknown };
    } catch {
      return null;
    }
  }

  private splitAcademicFiles() {
    const pdfFiles = this.academicFiles.filter(file => file.mimeType === 'application/pdf');
    const imageFiles = this.academicFiles.filter(file => file.mimeType.startsWith('image/'));
    return { pdfFiles, imageFiles };
  }

  private async selectAcademicFilesForTopic(topic: string): Promise<FileMetadata[]> {
    const { pdfFiles, imageFiles } = this.splitAcademicFiles();
    const fallbackSelected = this.limitAcademicAttachments(this.selectRelevantFilesForTopic(topic));

    if (pdfFiles.length === 0 || imageFiles.length === 0) {
      return fallbackSelected;
    }

    const mindmapSelected = await this.selectPdfFilesFromMindmaps(topic, pdfFiles, imageFiles);
    const imageSelected = this.selectRelevantMindmapImages(topic, imageFiles);

    const combined = this.limitAcademicAttachments([
      ...mindmapSelected,
      ...imageSelected,
      ...fallbackSelected
    ]);

    return combined;
  }

  private selectRelevantMindmapImages(topic: string, imageFiles: FileMetadata[]): FileMetadata[] {
    const lowerTopic = topic.toLowerCase();
    return imageFiles
      .map(file => {
        const keywords = file.keywords || [];
        const score = keywords.reduce((acc, keyword) => {
          if (lowerTopic.includes(keyword.toLowerCase())) {
            return acc + 10;
          }
          return acc;
        }, 0);
        return { file, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.file);
  }

  private async selectPdfFilesFromMindmaps(
    topic: string,
    pdfFiles: FileMetadata[],
    imageFiles: FileMetadata[]
  ): Promise<FileMetadata[]> {
    if (!this.geminiClient) return [];

    const limitedImages = imageFiles.slice(0, 3);
    const pdfNames = pdfFiles.map(file => file.displayName || file.name);
    if (limitedImages.length === 0 || pdfNames.length === 0) return [];

    const schema = {
      type: 'object',
      properties: {
        fileNames: { type: 'array', items: { type: 'string' } },
        rationale: { type: 'string' }
      },
      required: ['fileNames'],
      propertyOrdering: ['fileNames', 'rationale']
    };

    const prompt = `다음 마인드맵 이미지들을 참고하여 질문 주제와 가장 관련성이 높은 PDF 이름을 선택하세요.\n- 주제: "${topic}"\n- 선택지는 아래 PDF 목록 중에서만 고르세요.\n- 출력은 JSON으로만 반환 (형식: {"fileNames": ["..."] , "rationale": "..." })\n\nPDF 목록:\n${pdfNames.map((name) => `- ${name}`).join('\n')}`;

    try {
      const response = await this.geminiClient.models.generateContent({
        model: this.currentConfig?.modelName || 'gemini-2.5-flash-lite',
        contents: [prompt, ...limitedImages.map(file => createPartFromUri(file.uri, file.mimeType))],
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      });

      const parsed = this.safeParseJson(response.text || '');
      const fileNames = Array.isArray(parsed?.fileNames) ? parsed?.fileNames : [];
      const normalizedNames = fileNames
        .filter((name) => typeof name === 'string')
        .map((name) => name.toLowerCase());

      if (normalizedNames.length === 0) return [];

      const matched = pdfFiles.filter(file => {
        const displayName = (file.displayName || file.name).toLowerCase();
        return normalizedNames.some((name) => displayName.includes(name));
      });

      console.log('📚 [AIService] Mindmap-guided PDF selection:', matched.map(file => file.displayName).join(', '));
      return matched;
    } catch (err) {
      console.warn('⚠️ [AIService] Mindmap selection failed:', err);
      return [];
    }
  }

  private limitAcademicAttachments(files: FileMetadata[]): FileMetadata[] {
    const pdfFile = files.find(file => file.mimeType === 'application/pdf');
    const imageFile = files.find(file => file.mimeType.startsWith('image/'));
    const limited: FileMetadata[] = [];
    if (pdfFile) limited.push(pdfFile);
    if (imageFile) limited.push(imageFile);
    return limited;
  }

  private isTokenLimitError(error: unknown): boolean {
    if (!error) return false;
    if (typeof error === 'string') {
      return error.toLowerCase().includes('input token count exceeds');
    }

    if (typeof error === 'object' && 'message' in error) {
      const message = String((error as { message?: string }).message || '').toLowerCase();
      return message.includes('input token count exceeds') || message.includes('1048576');
    }

    return false;
  }

  private isModelNotFoundError(error: unknown): boolean {
    if (!error) return false;

    if (typeof error === 'object') {
      const errObj = error as { code?: number | string; message?: string };
      const code = typeof errObj.code === 'string' ? Number(errObj.code) : errObj.code;
      const message = String(errObj.message || '').toLowerCase();
      if (code === 404) return true;
      if (message.includes('not found for api version') || message.includes('not supported for generatecontent')) {
        return true;
      }
    }

    if (typeof error === 'string') {
      const message = error.toLowerCase();
      return message.includes('not found for api version') || message.includes('not supported for generatecontent');
    }

    return false;
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
    const pdfCount = this.academicFiles.filter(item => item.mimeType === 'application/pdf').length;
    const imageCount = this.academicFiles.filter(item => item.mimeType.startsWith('image/')).length;
    if (file.type === 'application/pdf' && pdfCount >= 10) {
      throw new Error('PDF 전문 지식은 최대 10개까지 등록할 수 있습니다.');
    }
    if (file.type.startsWith('image/') && imageCount >= 10) {
      throw new Error('이미지 지식은 최대 10개까지 등록할 수 있습니다.');
    }

    const metadata = await this.uploadAcademicFile(file);
    this.academicFiles.push(metadata);

    // PDF/이미지 각각 최대 10개 유지
    const pdfFiles = this.academicFiles.filter(item => item.mimeType === 'application/pdf');
    const imageFiles = this.academicFiles.filter(item => item.mimeType.startsWith('image/'));

    if (pdfFiles.length > 10) {
      pdfFiles.splice(0, pdfFiles.length - 10);
    }
    if (imageFiles.length > 10) {
      imageFiles.splice(0, imageFiles.length - 10);
    }

    this.academicFiles = [...pdfFiles, ...imageFiles];

    localStorage.setItem('culture-map-academic-files', JSON.stringify(this.academicFiles));
    return metadata;
  }

  /**
   * 학술 지식 파일 제거
   */
  public removeAcademicFile(fileName: string) {
    this.academicFiles = this.academicFiles.filter(f => f.name !== fileName);
    localStorage.setItem('culture-map-academic-files', JSON.stringify(this.academicFiles));
    void ragService.removeDocument(fileName).catch((error) => {
      console.warn('⚠️ [AIService] Failed to remove RAG index for file:', fileName, error);
    });
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
    const needsAcademicKnowledge = this.needsAcademicKnowledge(lowerPrompt);
    
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

  private needsAcademicKnowledge(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();
    return this.academicKeywords.some((keyword) => lowerPrompt.includes(keyword));
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
  private selectRelevantFilesForTopic(topic: string, maxFiles: number = 2): FileMetadata[] {
    this.normalizeAcademicFiles();
    if (this.academicFiles.length === 0) return [];

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

    // 점수순 정렬 후 상위 N개 선택 (0점 이하는 제외)
    const selected = scoredFiles
      .filter(sf => sf.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxFiles)
      .map(sf => sf.file);

    if (selected.length === 0) {
      console.log('📚 [AIService] No suitable academic file found for topic, will use static knowledge');
    }

    return selected;
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

  private async callGemini(prompt: string, schema?: Record<string, unknown>): Promise<string> {
    if (!this.geminiClient) throw new Error('Gemini 클라이언트가 초기화되지 않았습니다.');
    const modelName = this.currentConfig?.modelName || 'gemini-2.5-flash-lite';
    const thinkingConfig = this.getThinkingConfig(modelName);
    const response = await this.geminiClient.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        ...(schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}),
        ...(thinkingConfig ? { thinkingConfig } : {})
      },
    });
    return response.text || '';
  }

  public getAvailableGeminiModels(): string[] {
    if (this.availableModelsCache?.length) {
      return this.availableModelsCache;
    }

    return [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.5-pro',
      'gemini-3-flash',
      'gemini-3-flash-preview',
      'gemini-3-pro',
      'gemini-3-pro-preview',
    ];
  }

  public async getAvailableGeminiModelsAsync(): Promise<string[]> {
    const fetched = await this.fetchAvailableModels();
    if (fetched.length > 0) {
      const filtered = this.filterOfficialGeminiModels(fetched);
      this.availableModelsCache = filtered;
      return filtered;
    }

    return this.getAvailableGeminiModels();
  }

  private filterOfficialGeminiModels(models: string[]): string[] {
    const normalized = models
      .map((model) => this.normalizeModelId(model))
      .filter((name) => !!name);

    const allowed = normalized.filter((name) => {
      if (!/^gemini-(2\.5|3)/.test(name)) {
        return false;
      }

      if (name.includes('flash-lite')) {
        return true;
      }

      return name.includes('flash') || name.includes('pro');
    });

    return Array.from(new Set(allowed));
  }

  private normalizeModelId(modelName: string): string {
    return modelName.replace(/^models\//, '').trim();
  }

  private resolveModelAlias(preferredModel: string, available: string[]): string | null {
    const aliasMap: Record<string, string> = {
      'gemini-flash-latest': 'gemini-3-flash',
      'gemini-pro-latest': 'gemini-3-pro',
    };

    const directAlias = aliasMap[preferredModel];
    if (directAlias) {
      if (available.length === 0 || available.includes(directAlias)) {
        return directAlias;
      }
    }

    return null;
  }

  private async fetchAvailableModels(): Promise<string[]> {
    if (this.availableModelsCache) return this.availableModelsCache;
    if (!this.geminiClient) return [];

    try {
      const result = await this.geminiClient.models.list();
      const rawModels: Array<Record<string, unknown>> = [];
      const resultObj = result as {
        models?: unknown;
        iterateAll?: () => AsyncIterable<unknown>;
      };

      if (Array.isArray(resultObj?.models)) {
        rawModels.push(...(resultObj.models as Array<Record<string, unknown>>));
      } else if (typeof resultObj?.iterateAll === 'function') {
        for await (const model of resultObj.iterateAll()) {
          if (model && typeof model === 'object') {
            rawModels.push(model as Record<string, unknown>);
          }
        }
      } else if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
        for await (const page of result as AsyncIterable<unknown>) {
          if (page && typeof page === 'object' && Array.isArray((page as { models?: unknown }).models)) {
            rawModels.push(...((page as { models?: unknown }).models as Array<Record<string, unknown>>));
          }
        }
      }

      const names = rawModels
        .map((model) => {
          const info = model as { name?: unknown; id?: unknown; displayName?: unknown };
          return this.normalizeModelId(
            String(info?.name || info?.id || info?.displayName || '')
          );
        })
        .filter((name) => !!name);

      const filtered = this.filterOfficialGeminiModels(names);
      this.availableModelsCache = filtered;
      return filtered;
    } catch (error) {
      console.warn('⚠️ [AIService] Failed to fetch available models:', error);
      return [];
    }
  }

  private async validateModelAvailability(preferredModel: string) {
    if (!preferredModel) return;
    const available = await this.fetchAvailableModels();
    const normalizedPreferred = this.normalizeModelId(preferredModel);
    const currentConfig = this.currentConfig;
    if (!currentConfig) return;
    if (available.length > 0 && available.includes(normalizedPreferred)) {
      return;
    }

    const alias = this.resolveModelAlias(normalizedPreferred, available);
    if (alias) {
      console.warn('⚠️ [AIService] Model alias resolved:', preferredModel, '→', alias);
      this.currentConfig = { ...currentConfig, modelName: alias };
      localStorage.setItem('culture-map-ai-config', JSON.stringify(this.currentConfig));
      return;
    }

    if (available.length === 0) {
      return;
    }

    const fallback = available.includes('gemini-2.5-flash-lite')
      ? 'gemini-2.5-flash-lite'
      : available[0];

    console.warn('⚠️ [AIService] Selected model not available:', preferredModel, '→ using', fallback);
    this.currentConfig = { ...currentConfig, modelName: fallback };
    localStorage.setItem('culture-map-ai-config', JSON.stringify(this.currentConfig));
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

  public estimateTokenCount(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  public async getModelTokenLimits(modelName?: string): Promise<{ inputTokenLimit: number; outputTokenLimit: number }> {
    const resolvedModel = modelName || this.currentConfig?.modelName || 'gemini-2.5-flash-lite';
    const cached = this.modelTokenLimitCache[resolvedModel];
    if (cached) return { inputTokenLimit: cached.inputTokenLimit, outputTokenLimit: cached.outputTokenLimit };

    const fallback = { inputTokenLimit: 200000, outputTokenLimit: 8192 };
    if (!this.geminiClient) {
      console.warn('⚠️ [AIService] Gemini client not initialized, using fallback token limits');
      return fallback;
    }

    try {
      const modelInfo = await this.geminiClient.models.get({ model: resolvedModel });
      const inputTokenLimit = modelInfo?.inputTokenLimit ?? fallback.inputTokenLimit;
      const outputTokenLimit = modelInfo?.outputTokenLimit ?? fallback.outputTokenLimit;
      this.modelTokenLimitCache[resolvedModel] = {
        inputTokenLimit,
        outputTokenLimit,
        updatedAt: Date.now(),
      };
      return { inputTokenLimit, outputTokenLimit };
    } catch (error) {
      console.warn('⚠️ [AIService] Failed to fetch model token limits, using fallback', error);
      return fallback;
    }
  }

  public async summarizeChatMessages(
    messages: ChatMessage[],
    options?: {
      maxInputTokens?: number;
      maxOutputChars?: number;
      maxMessages?: number;
      includeSystem?: boolean;
    }
  ): Promise<string> {
    const maxOutputChars = options?.maxOutputChars ?? 1200;
    const maxInputTokens = options?.maxInputTokens ?? 3000;
    const includeSystem = options?.includeSystem ?? false;
    const maxMessages = options?.maxMessages ?? 120;

    const filtered = messages
      .filter((msg) => !!msg?.content && (includeSystem || msg.role !== 'system'))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-maxMessages);

    if (filtered.length === 0) return '';

    const formatLine = (msg: ChatMessage) => {
      const roleLabel = msg.role === 'assistant' ? 'AI' : msg.role === 'system' ? 'SYSTEM' : msg.userName || 'USER';
      return `[${roleLabel}] ${msg.content}`.trim();
    };

    let trimmed = [...filtered];
    let logText = trimmed.map(formatLine).join('\n');

    while (trimmed.length > 1 && this.estimateTokenCount(logText) > maxInputTokens) {
      trimmed = trimmed.slice(1);
      logText = trimmed.map(formatLine).join('\n');
    }

    if (!logText) return '';

    const prompt = `다음은 Culture-MAP 프로젝트의 채팅 로그입니다.\n\n${logText}\n\n요약 지침:\n- 보고서 생성에 필요한 핵심 사실/결론/결정 사항 중심\n- 불필요한 수사와 반복 제거\n- ${maxOutputChars}자 이내\n- 한국어로 간결한 문장 또는 불릿으로 정리`;

    try {
      const summary = (await this.callGemini(prompt)).trim();
      if (!summary) return '';
      if (summary.length > maxOutputChars) {
        return summary.slice(0, maxOutputChars) + '…';
      }
      return summary;
    } catch (error) {
      console.error('❌ [AIService] Chat summary failed, using fallback', error);
      const fallback = trimmed.slice(-8).map(formatLine).join('\n');
      if (!fallback) return '';
      if (fallback.length > maxOutputChars) {
        return fallback.slice(0, maxOutputChars) + '…';
      }
      return fallback;
    }
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

  public setInsights(insights: Insight[]): void {
    const next = Array.isArray(insights) ? insights.slice(-100) : [];
    this.insights = next;
    localStorage.setItem('culture-map-insights', JSON.stringify(this.insights));
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
    if (liveblocksService.isConnected()) {
      liveblocksService.addInsight(newInsight);
    }

    const exists = this.insights.some(existing =>
      existing.id === newInsight.id || existing.title === newInsight.title
    );

    if (!exists) {
      this.insights.push(newInsight);
    }
    
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
    if (liveblocksService.isConnected()) {
      liveblocksService.clearInsights();
    }
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

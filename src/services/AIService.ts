/**
 * AI 서비스 - Gemini API 전용
 * 
 * 중요: @google/genai SDK 사용 (2025.05~ GA)
 * - File API 지원 (PDF 업로드)
 * - Chat Session 지원 (멀티턴 대화)
 * - Tool Use (Function Calling) 지원
 */

import { GoogleGenAI, createPartFromUri, FunctionCallingConfigMode, type ThinkingConfig } from '@google/genai';
import { MAP_TOOL_DECLARATIONS, type AiFunctionCall, type ToolDeclaration } from '../types/actions';
import type { ChatMessage, EvidenceSource, Insight, InsightType, MessageEvidence } from '../types/liveblocks';
import ragService from './RagService';
import type { RagSearchScope } from './RagService';
import liveblocksService from './LiveblocksService';

export type AIProvider = 'gemini';

export type ReasoningPreset = 'default' | 'fast' | 'balanced' | 'deep';

/**
 * AI 분석 시 사용할 컨텍스트 보강 모드.
 * auto: 기존 일반 채팅 동작 (학술 RAG + 웹 검색 자동 판단)
 * none: 보강 없음 — 사용자 메시지만 전달 (컨설팅 1차 분석용)
 * attached-files-only: 선택 첨부 자료만 사용 (학술 RAG·웹 검색 금지)
 * academic-rag: 학술 RAG만 사용
 * web: 웹 검색만 사용
 * hybrid: 학술 RAG + 웹 검색 모두 사용
 */
export type GroundingMode = 'auto' | 'none' | 'attached-files-only' | 'academic-rag' | 'web' | 'hybrid';

export type GeminiModelListResult = {
  models: string[];
  source: 'api' | 'cache' | 'fallback';
  reason?:
    | 'missing-api-key'
    | 'client-not-initialized'
    | 'api-error'
    | 'empty-api-result'
    | 'filter-empty'
    | 'stale-cache-after-refresh-error';
  errorMessage?: string;
  rawCount?: number;
  filteredCount?: number;
  hasConfiguredApiKey?: boolean;
  clientReady?: boolean;
  stale?: boolean;
  rawSourceShape?: 'models-array' | 'pager-page' | 'async-iterator' | 'iterate-all' | 'unknown';
};

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  tavilyApiKey?: string;
  modelName?: string;
  reasoningPreset?: ReasoningPreset;
  ragSearchScope?: RagSearchScope;
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
  | { type: 'metadata'; evidence: MessageEvidence }
  | { type: 'text'; content: string; fullText: string }
  | { type: 'thought'; content: string }
  | { type: 'actions'; actions: AiFunctionCall[] };

type SendMessageResult = {
  response?: unknown;
  parts?: StreamPart[];
};

type AcademicGroundingResult =
  | { status: 'not-needed'; prompt: string; evidence: MessageEvidence }
  | { status: 'grounded'; prompt: string; evidence: MessageEvidence }
  | { status: 'fallback'; prompt: string; evidence: MessageEvidence }
  | { status: 'web'; prompt: string; evidence: MessageEvidence }
  | { status: 'hybrid'; prompt: string; evidence: MessageEvidence };

type WebSearchHit = {
  title: string;
  url: string;
  content: string;
  source?: string;
  publishedDate?: string;
};

type WebSearchBundle = {
  status: 'ok' | 'empty' | 'unavailable';
  contextText: string;
  sources: EvidenceSource[];
  errorMessage?: string;
};

type ChatSessionLike = {
  sendMessageStream: (input: { message: string | MessagePart[] }) => Promise<AsyncIterable<StreamChunk>>;
  sendMessage: (input: { message: string | MessagePart[] }) => Promise<SendMessageResult>;
};

// 우선순위 순서로 정렬된 기본 모델 선호 목록 (API 조회 결과에 있는 경우만 실제 사용)
const FALLBACK_MODEL_PRIORITY = [
  'gemini-3.5-flash',               // Latest stable
  'gemini-3.1-flash-lite',          // Stable
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const;

// API 조회 전 하드코딩 fallback 기본값
const DEFAULT_GEMINI_MODEL = FALLBACK_MODEL_PRIORITY[0];

/**
 * available 목록에서 FALLBACK_MODEL_PRIORITY 순서로 첫 번째 일치 모델을 반환.
 * 일치하는 모델이 없으면 available[0]을 반환.
 */
function getDefaultGeminiModelId(available: string[]): string {
  for (const preferred of FALLBACK_MODEL_PRIORITY) {
    if (available.includes(preferred)) return preferred;
  }
  return available[0] ?? DEFAULT_GEMINI_MODEL;
}

/**
 * 외부 AI API 직접 호출 서비스
 * BYOK(Bring Your Own Key) 방식 - API 키는 localStorage에 저장
 */
class AIService {
  private geminiClient: GoogleGenAI | null = null;
  private currentConfig: AIConfig | null = null;
  private chatSession: ChatSessionLike | null = null;
  private chatHistory: ChatHistoryItem[] = [];
  private currentThoughts: string[] = [];
  private academicFiles: FileMetadata[] = [];
  private insights: Insight[] = [];
  private modelTokenLimitCache: Record<string, { inputTokenLimit: number; outputTokenLimit: number; updatedAt: number }> = {};
  private availableModelsCache: string[] | null = null;
  private availableModelsCacheTime = 0;
  private readonly MODELS_CACHE_TTL_MS = 10 * 60 * 1000; // 10분
  private readonly academicKeywords = [
    '샤인', 'schein', '에드가', 'edgar', '로빈스', 'robbins', 'cummings', 'worley',
    '이론', '관점', '모델', '프레임워크', '원리', '원칙', '연구', '학술',
    '인공물', 'artifact', '가정', 'assumption', '가치', 'value',
    '조직문화', '조직행동', '리더십', '변화관리', 'od', '조직개발',
    '분석', '진단', '평가', '해석', '설명', '비교', '적용',
    '장점', '단점', '의미', '가치', '중요성', '시사점'
  ];
  private readonly academicGroundingKeywords = [
    '학술', '학술적', '이론', '이론적', '근거', '출처', '문헌', '논문', '저서',
    '연구', '인용', 'citation', 'evidence', 'reference',
    '샤인', 'schein', '로빈스', 'robbins', 'cummings', 'worley'
  ];
  private readonly webSearchKeywords = [
    '최신', '동향', '트렌드', '뉴스', '기사', '현황',
    '사례', '벤치마크', '업데이트', '시장', '실무', '발표', '보도'
  ];
  private readonly webSearchFreshnessKeywords = [
    '최근', '최신', '현재', '요즘', '이번', '올해', '방금', '근래', '방향'
  ];
  private readonly webSearchSubjectKeywords = [
    '동향', '트렌드', '뉴스', '기사', '현황', '사례', '벤치마크', '시장', '실무',
    '기업', '회사', '산업', '업계', '채용', '조직문화', '리더십', '변화관리'
  ];
  private readonly webSearchHardBlockKeywords = [
    '버크만', '컬쳐맵', 'culture map', '노드', '연결선', '레이어', '스냅샷',
    '이 맵', '현재 맵', '우리 맵', '업로드한 pdf', '업로드한 문서', '첨부한 파일',
    '세션', '워크샵', '컨설팅 노트', '대화 내용', '이 보고서', 'pdf', '문헌'
  ];

  private getSystemInstruction(): string {
    return `
# Culture-MAP V2 AI 컨설턴트

당신은 조직문화 분석과 Culture Map 편집을 돕는 AI입니다.

핵심 원칙:
- 학술 근거가 제공되면 그 근거를 우선 사용합니다.
- 최신 사례나 동향이 필요하면 웹 검색 근거를 보조적으로 사용할 수 있습니다.
- 학술 근거가 없으면 일반 지식 기반으로 답변할 수 있지만, 그 한계를 분명히 밝힙니다.
- 불확실한 내용은 단정하지 말고 추정이라고 표시합니다.
- 사용자가 명시적으로 요청한 경우에만 맵 편집 도구를 호출합니다.

맵 편집 규칙:
- 노드와 연결은 Layer 4 → 3 → 2 → 1 방향의 인과 흐름을 우선합니다.
- 여러 노드와 연결을 함께 만들 때는 add_nodes_with_connections를 우선합니다.
- 새 노드/연결을 실제로 추가하거나 삭제/수정한 경우에만 후속 정렬(auto_layout)을 고려합니다.
- auto_layout은 노드 배치 정렬용입니다. 연결선 경로만 바꾸려는 요청에는 reroute_edges를 사용합니다.
- 연결선/선/엣지 정리 요청에서는 기존 노드나 연결을 재생성하지 말고 reroute_edges만 사용합니다.
- reroute_edges는 사용자가 "연결선", "선", "엣지" 재정렬을 명시적으로 요청할 때만 사용합니다. 일반적인 설명, 분석, 요약 요청에는 사용하지 않습니다.
- "정리", "검토", "요약", "분석", "설명"이 내용 이해를 뜻하면 도구를 호출하지 말고 텍스트로 답변합니다.
- 사용자가 설명이나 근거를 요청하면 먼저 텍스트로 설명합니다.

응답 규칙:
- 도구 호출 후에는 무엇을 했는지 짧게 설명합니다.
- 학술 근거 기반 답변이라면 사용한 출처를 간단히 정리합니다.
- 웹 검색을 사용했다면 최신성 참고 자료임을 밝히고 URL 또는 매체명을 간단히 정리합니다.
- 학술 근거가 없는 일반 답변이라면, 참고용 설명이며 정확한 검증을 위해 문헌 업로드가 필요하다고 안내합니다.
`;
  }

  private createEvidence(level: MessageEvidence['level'], summary: string, note?: string, sources?: EvidenceSource[]): MessageEvidence {
    return {
      level,
      summary,
      ...(note ? { note } : {}),
      ...(sources && sources.length > 0 ? { sources } : {})
    };
  }

  private buildAcademicEvidence(
    sources: Array<{ docName: string; pageNumber?: number }>,
    note?: string
  ): MessageEvidence {
    const evidenceSources = sources.slice(0, 5).map((source) => ({
      kind: 'academic' as const,
      title: source.docName,
      detail: source.pageNumber ? `p.${source.pageNumber}` : undefined
    }));

    return this.createEvidence('academic', '문헌 근거 기반 답변', note, evidenceSources);
  }

  private buildWebEvidence(sources: EvidenceSource[], note?: string): MessageEvidence {
    return this.createEvidence('web', '웹 검색 기반 답변', note, sources.slice(0, 5));
  }

  private buildHybridEvidence(
    academicSources: Array<{ docName: string; pageNumber?: number }>,
    webSources: EvidenceSource[],
    note?: string
  ): MessageEvidence {
    const combined = [
      ...academicSources.slice(0, 3).map((source) => ({
        kind: 'academic' as const,
        title: source.docName,
        detail: source.pageNumber ? `p.${source.pageNumber}` : undefined
      })),
      ...webSources.slice(0, 3)
    ];

    return this.createEvidence('hybrid', '문헌 근거와 웹 검색을 함께 사용한 답변', note, combined);
  }

  private buildGeneralEvidence(note?: string): MessageEvidence {
    return this.createEvidence('general', '일반 지식 기반 답변', note);
  }
  private getAcademicGroundingGuardInstruction(): string {
    return '현재 Culture Map 데이터 유무와 문헌 검색 가능 여부는 별개입니다. 문헌 근거 부족이나 검색 실패만으로 현재 맵 데이터가 없다고 말하지 마세요.';
  }

  private buildAcademicFallbackLead(hasIndex: boolean, ragUnavailable: boolean, topic?: string): string {
    const target = topic ? `"${topic}"에 대한 직접 근거` : '질문과 직접 연결되는 근거';

    if (!hasIndex) {
      return '현재 검색 가능한 학술 RAG 문서가 없습니다.';
    }

    if (ragUnavailable) {
      return `업로드된 학술 RAG 문서는 있을 수 있지만, 현재 임베딩 검색을 사용할 수 없어 ${target}를 조회하지 못했습니다.`;
    }

    return `업로드된 학술 RAG 문서에서 ${target}를 찾지 못했습니다.`;
  }

  private extractHostname(url: string): string | undefined {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return undefined;
    }
  }

  private requiresWebSearch(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();

    if (this.webSearchHardBlockKeywords.some((keyword) => lowerPrompt.includes(keyword))) {
      return false;
    }

    let score = 0;

    if (this.webSearchKeywords.some((keyword) => lowerPrompt.includes(keyword))) {
      score += 2;
    }

    if (this.webSearchFreshnessKeywords.some((keyword) => lowerPrompt.includes(keyword))) {
      score += 1;
    }

    if (this.webSearchSubjectKeywords.some((keyword) => lowerPrompt.includes(keyword))) {
      score += 1;
    }

    if (/(2024|2025|2026|올해|작년|내년)/.test(lowerPrompt)) {
      score += 1;
    }

    if (/(검색|찾아|조사|정리|비교).*(해줘|해봐|해 줄|해줘요)|링크|url|출처/.test(lowerPrompt)) {
      score += 1;
    }

    if (/(우리 팀|우리조직|우리 조직|이 회사|우리 회사|이 맵|이 문서|첨부|업로드)/.test(lowerPrompt)) {
      score -= 2;
    }

    if (score >= 2) {
      return true;
    }

    return [
      /(최근|최신|현재|요즘).*(동향|사례|현황|뉴스|이슈)/,
      /(국내|해외).*(사례|동향|트렌드)/,
      /(2024|2025|2026).*(사례|동향|전망|이슈)/,
      /(실무|시장).*(사례|동향|변화)/,
      /(뉴스|기사|시장).*(정리|요약|비교)/
    ].some((pattern) => pattern.test(lowerPrompt));
  }

  private async searchWeb(query: string, maxResults: number = 5): Promise<WebSearchBundle | null> {
    try {
      const tavilyApiKey = this.currentConfig?.tavilyApiKey?.trim();
      const response = await fetch('/api/web-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tavilyApiKey ? { 'x-tavily-api-key': tavilyApiKey } : {})
        },
        body: JSON.stringify({ query, maxResults })
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const errorMessage = typeof errorPayload?.error === 'string'
          ? errorPayload.error
          : `웹 검색 실패 (${response.status})`;
        throw new Error(errorMessage);
      }

      const payload = await response.json() as { results?: WebSearchHit[] };
      const results = Array.isArray(payload.results) ? payload.results : [];
      if (results.length === 0) {
        return {
          status: 'empty',
          contextText: '',
          sources: []
        };
      }

      const contextBlocks: string[] = [];
      const sources: EvidenceSource[] = [];

      results.slice(0, maxResults).forEach((result, index) => {
        const host = this.extractHostname(result.url);
        const detailParts = [result.source, host, result.publishedDate].filter(Boolean);
        const detail = detailParts.join(' · ');

        contextBlocks.push(
          `[웹 출처 ${index + 1}] ${result.title}\n` +
          `${detail ? `${detail}\n` : ''}` +
          `${result.url}\n` +
          `${result.content}`
        );

        sources.push({
          kind: 'web',
          title: result.title,
          detail: detail || undefined,
          url: result.url
        });
      });

      return {
        status: 'ok',
        contextText: contextBlocks.join('\n\n'),
        sources
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '웹 검색을 사용할 수 없습니다.';
      console.warn('⚠️ [AIService] Web search unavailable:', error);
      return {
        status: 'unavailable',
        contextText: '',
        sources: [],
        errorMessage: message
      };
    }
  }

  private appendWebSearchFailureNote(baseNote: string, webContext: WebSearchBundle | null): string {
    if (!webContext || webContext.status !== 'unavailable') {
      return baseNote;
    }

    return `${baseNote} 웹 검색을 시도했지만 현재 사용할 수 없어 외부 최신 자료는 반영하지 못했습니다.`;
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

    const modelName = this.currentConfig?.modelName || DEFAULT_GEMINI_MODEL;
    const thinkingConfig = this.getThinkingConfig(modelName, this.currentConfig?.reasoningPreset);
    const mapEditTools = [
      'add_node',
      'add_nodes_with_connections',
      'update_node',
      'delete_node',
      'delete_connection',
      'create_connection',
      'pin_node',
      'unpin_node',
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
      'restore_snapshot',
      'undo_layout'
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
    const toolConfig = toolDeclarations.length > 0
      ? {
          tools: [{ functionDeclarations: toolDeclarations }],
          toolConfig: {
            functionCallingConfig
          }
        }
      : {};

    return this.geminiClient.chats.create({
      model: modelName,
      config: {
        systemInstruction: this.getSystemInstruction(),
        ...toolConfig,
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

    this.geminiClient =
      normalized.provider === 'gemini' && normalized.apiKey
        ? new GoogleGenAI({ apiKey: normalized.apiKey })
        : null;

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
          tavilyApiKey: undefined,
          modelName: DEFAULT_GEMINI_MODEL,
          ragSearchScope: 'shared'
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

  /** API 키는 있는데 geminiClient가 null인 경우 클라이언트를 재초기화한다. */
  public ensureClientInitialized(): boolean {
    if (this.geminiClient) return true;
    const config = this.currentConfig;
    if (config?.apiKey) {
      this.geminiClient = new GoogleGenAI({ apiKey: config.apiKey });
      ragService.setClient(this.geminiClient);
      return true;
    }
    return false;
  }

  public getRagSearchScope(): RagSearchScope {
    return 'shared';
  }

  /**
   * 챗봇 세션 시작
   */
  public startChat(history: ChatHistoryItem[] = []) {
    this.chatHistory = Array.isArray(history) ? [...history] : [];
    this.chatSession = this.createChatSession(FunctionCallingConfigMode.AUTO, this.chatHistory);

    console.log('🔧 [AIService] startChat: Model =', this.currentConfig?.modelName || DEFAULT_GEMINI_MODEL, 'Tools count =', MAP_TOOL_DECLARATIONS.length);
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
    options?: {
      forceFunctionCall?: boolean;
      allowExternalTools?: boolean;
      groundingQuery?: string;
      allowedFunctionNames?: string[];
      groundingMode?: GroundingMode;
    }
  ): AsyncGenerator<AIStreamChunk, void, void> {
    const forceFunctionCall = options?.forceFunctionCall ?? false;
    const allowExternalTools = options?.allowExternalTools ?? true;
    const allowedFunctionNames = options?.allowedFunctionNames;
    const groundingMode = options?.groundingMode ?? 'auto';
    const suppressGrounding = groundingMode === 'none' || groundingMode === 'attached-files-only';
    const internalTools = suppressGrounding ? [] : ['search_academic_theory', 'load_academic_knowledge'];
    const effectiveForceFunctionCall = suppressGrounding ? false : forceFunctionCall;
    const effectiveAllowExternalTools = suppressGrounding ? false : allowExternalTools;

    // groundingMode가 'none' 또는 'attached-files-only'이면 학술 RAG/웹 검색 보강을 건너뜀
    let academicGrounding: Awaited<ReturnType<typeof this.prepareAcademicGrounding>>;
    if (suppressGrounding) {
      academicGrounding = {
        status: 'not-needed',
        prompt,
        evidence: this.createEvidence(
          'general',
          '선택 자료 기반 답변',
          '학술 RAG와 웹 검색을 사용하지 않고 사용자가 선택한 자료만 전달했습니다.'
        )
      };
    } else {
      academicGrounding = await this.prepareAcademicGrounding(options?.groundingQuery ?? prompt);
    }
    const promptToSend = academicGrounding.prompt;

    yield { type: 'metadata', evidence: academicGrounding.evidence };

    let session = effectiveForceFunctionCall
      ? this.createChatSession(FunctionCallingConfigMode.ANY, this.chatHistory, allowedFunctionNames)
      : (effectiveAllowExternalTools
          ? (this.chatSession || this.startChat())
          : this.createChatSession(FunctionCallingConfigMode.AUTO, this.chatHistory, internalTools));

    if (prompt) {
      this.chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
    }

    const parts: MessagePart[] = [{ text: promptToSend }];

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
          session = effectiveForceFunctionCall
            ? this.createChatSession(FunctionCallingConfigMode.ANY, this.chatHistory, allowedFunctionNames)
            : (effectiveAllowExternalTools
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
          maxContextChars: 7000,
          scope: this.getRagSearchScope()
        });
        const ragRetrievalError = ragService.getLastRetrievalError();

        if (ragContext?.contextText) {
          yield {
            type: 'metadata',
            evidence: this.buildAcademicEvidence(
              ragContext.sources.map((source) => ({ docName: source.docName, pageNumber: source.pageNumber })),
              'AI가 업로드된 문헌에서 직접 근거를 다시 찾아 답변했습니다.'
            )
          };
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

        try {
          const followUp = await session!.sendMessage({
            message: `[시스템] ${this.buildAcademicFallbackLead(true, Boolean(ragRetrievalError), topic)} 일반 지식으로 답변하되, 문헌 근거가 확인되지 않은 참고용 설명임을 명확히 밝히고, ${this.getAcademicGroundingGuardInstruction()} 마지막에 "정확한 학술 검증을 위해 관련 문헌 업로드가 필요합니다"라고 안내하세요.`
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
          console.error('❌ [AIService] Error processing no-evidence fallback:', err);
        }
        continue;
      }
      // [레거시] 기존 search_academic_theory 호환
      else if (internalCall.name === 'search_academic_theory') {
        console.log('🔍 [AIService] Auto-handling internal tool: search_academic_theory');
        const topicArg = internalCall.args?.topic;
        const topicStr = typeof topicArg === 'string' ? topicArg : '';
        const ragContext = await ragService.retrieveContext(topicStr, {
          topK: 6,
          minScore: 0.2,
          maxContextChars: 7000,
          scope: this.getRagSearchScope()
        });
        const ragRetrievalError = ragService.getLastRetrievalError();
        if (ragContext?.contextText) {
          yield {
            type: 'metadata',
            evidence: this.buildAcademicEvidence(
              ragContext.sources.map((source) => ({ docName: source.docName, pageNumber: source.pageNumber })),
              'AI가 업로드된 문헌에서 관련 이론 근거를 검색했습니다.'
            )
          };
        }
        const knowledgeResult = ragContext?.contextText?.trim()
          ? ragContext.contextText
          : `${this.buildAcademicFallbackLead(true, Boolean(ragRetrievalError), topicStr)} 일반 지식으로만 설명하되 문헌 근거가 확인되지 않은 참고용 설명임을 명시하고, ${this.getAcademicGroundingGuardInstruction()} 정확한 학술 검증을 위해 관련 문헌 업로드가 필요하다고 안내하세요.`;

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

    const academicGrounding = await this.prepareAcademicGrounding(prompt);
    if (prompt) {
      this.chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
    }

    const promptToSend = academicGrounding.prompt;

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

    const initialParts = buildParts(promptToSend, academicGrounding.status === 'not-needed');
    let result = await runSendMessage(initialParts);

    let response = await result.response;
    if (!response) {
      console.warn('⚠️ [AIService] Empty response payload from sendMessage');
    }

    let { parsedText: text, parsedFunctionCalls: functionCalls } = parseResponse(response, result.parts);

    if (!text?.trim() && (!functionCalls || functionCalls.length === 0)) {
      console.warn('⚠️ [AIService] Empty content detected, retrying without academic attachments');
      const retryPrompt = `${promptToSend}\n\n[시스템] 이전 응답이 비어 있었습니다. 동일 요청에 대해 반드시 텍스트로 답변하세요. 최소 5문장 이상으로 작성하세요.`;
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
        const ragContext = await ragService.retrieveContext(topic, {
          topK: 6,
          minScore: 0.2,
          maxContextChars: 7000,
          scope: this.getRagSearchScope()
        });
        const knowledgeResult = ragContext?.contextText?.trim()
          ? ragContext.contextText
          : '업로드된 학술 RAG 문서에서 관련 근거를 찾지 못했습니다. 할루시네이션 방지를 위해 추정 답변은 제공하지 마세요.';

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
      functionCalls: functionCalls || [],
      evidence: academicGrounding.evidence
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
    return this.uploadAcademicFileWithOptions(file);
  }

  public async uploadAcademicFileWithOptions(file: File, options?: { indexLocally?: boolean }): Promise<FileMetadata> {
    const indexLocally = options?.indexLocally ?? true;
    if (file.type === 'application/pdf') {
      const metadata = await this.uploadPDF(file);
      if (indexLocally) {
        this.indexAcademicPdfInBackground(file, metadata);
      }
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

    let modelName = this.currentConfig?.modelName || DEFAULT_GEMINI_MODEL;
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

  private requiresAcademicGrounding(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();

    if (this.academicGroundingKeywords.some((keyword) => lowerPrompt.includes(keyword))) {
      return true;
    }

    return [
      /근거.*설명/,
      /출처.*설명/,
      /학술.*설명/,
      /이론.*설명/,
      /논문.*기반/,
      /문헌.*기반/,
      /저자.*관점/,
      /학자.*관점/
    ].some((pattern) => pattern.test(lowerPrompt));
  }

  private async prepareAcademicGrounding(prompt: string): Promise<AcademicGroundingResult> {
    const needsAcademicGrounding = this.requiresAcademicGrounding(prompt);
    const needsWebGrounding = this.requiresWebSearch(prompt);
    const groundingGuard = this.getAcademicGroundingGuardInstruction();

    const webContext = needsWebGrounding
      ? await this.searchWeb(prompt, needsAcademicGrounding ? 4 : 5)
      : null;

    if (!needsAcademicGrounding) {
      if (webContext?.status === 'ok' && webContext.contextText) {
        return {
          status: 'web',
          prompt: `[시스템] 다음은 웹 검색 결과입니다. 최신성이나 사례 설명이 필요한 부분은 아래 자료를 우선 사용하세요. 웹 자료는 학술 문헌과 동일하지 않으므로, 사실과 해석을 구분하고 과장하지 마세요. 답변 끝에는 참고한 웹 출처를 간단히 정리하세요.\n\n[웹 검색 근거]\n${webContext.contextText}\n\n[사용자 질문]\n${prompt}`,
          evidence: this.buildWebEvidence(webContext.sources, '최신 사례나 동향 확인을 위해 웹 검색 근거를 사용했습니다.')
        };
      }

      return {
        status: 'not-needed',
        prompt,
        evidence: this.buildGeneralEvidence(
          this.appendWebSearchFailureNote('문헌이나 웹 근거를 별도로 적용하지 않은 일반 답변입니다.', webContext)
        )
      };
    }

    const hasIndex = await ragService.hasIndex();
    const ragContext = hasIndex
      ? await ragService.retrieveContext(prompt, {
        topK: 6,
        minScore: 0.2,
        maxContextChars: 7000,
        scope: this.getRagSearchScope()
      })
      : null;
    const ragRetrievalError = hasIndex ? ragService.getLastRetrievalError() : null;

    if (ragContext?.contextText?.trim() && webContext?.status === 'ok' && webContext.contextText) {
      return {
        status: 'hybrid',
        prompt: `[시스템] 다음 질문에는 문헌 기반 근거와 웹 검색 근거가 함께 제공됩니다. 답변 시 우선순위는 1) 문헌 기반 개념과 원리, 2) 웹 기반 최신 사례와 동향입니다. 문헌으로 확인되지 않은 내용을 학술적 사실처럼 단정하지 마세요. ${groundingGuard} 답변 끝에는 문헌 출처와 웹 출처를 구분해 짧게 정리하세요.\n\n[문헌 근거]\n${ragContext.contextText}\n\n[웹 검색 근거]\n${webContext.contextText}\n\n[사용자 질문]\n${prompt}`,
        evidence: this.buildHybridEvidence(
          ragContext.sources.map((source) => ({ docName: source.docName, pageNumber: source.pageNumber })),
          webContext.sources,
          '문헌으로 개념을 고정하고 웹 검색으로 최신 사례를 보강했습니다.'
        )
      };
    }

    if (ragContext?.contextText?.trim()) {
      return {
        status: 'grounded',
        prompt: `[시스템] 다음은 문서 기반 RAG 검색 결과입니다. 아래 근거에 포함된 정보만 사용해 답변하세요. 근거가 부족하면 모른다고 답하고 추정하지 마세요. ${groundingGuard} 답변 끝에는 사용한 출처를 간단히 정리하세요.\n\n[문서 근거]\n${ragContext.contextText}\n\n[사용자 질문]\n${prompt}`,
        evidence: this.buildAcademicEvidence(
          ragContext.sources.map((source) => ({ docName: source.docName, pageNumber: source.pageNumber })),
          '업로드된 문헌 RAG에서 직접 근거를 확보했습니다.'
        )
      };
    }

    if (webContext?.status === 'ok' && webContext.contextText) {
      const fallbackLead = this.buildAcademicFallbackLead(hasIndex, Boolean(ragRetrievalError));
      return {
        status: 'web',
        prompt: `[시스템] 사용자는 학술 근거를 기대하고 있습니다. ${fallbackLead} 대신 아래 웹 검색 자료를 참고해 답변할 수 있습니다. 단, 웹 자료는 학술 검증을 대체하지 않으므로 첫 부분에 학술 문헌으로 검증된 답변은 아니라는 점을 밝히고, ${groundingGuard} 답변 끝에 관련 문헌 업로드가 필요하다고 안내하세요.\n\n[웹 검색 근거]\n${webContext.contextText}\n\n[사용자 질문]\n${prompt}`,
        evidence: this.buildWebEvidence(
          webContext.sources,
          ragRetrievalError
            ? '문헌 검색 시스템을 사용할 수 없어 웹 검색 자료로만 보조 설명했습니다.'
            : '문헌 RAG 근거가 부족해 웹 검색 자료로만 보조 설명했습니다.'
        )
      };
    }

    const fallbackLead = this.buildAcademicFallbackLead(hasIndex, Boolean(ragRetrievalError));
    return {
      status: 'fallback',
      prompt: hasIndex
        ? `[시스템] ${fallbackLead} 또한 웹 검색 근거도 확보하지 못했습니다. 일반 지식으로 답변할 수는 있지만, 다음을 반드시 지키세요. 1) 문헌 근거가 확인되지 않은 참고용 일반 설명임을 첫 부분에 명시할 것. 2) 확실하지 않은 내용은 추정이라고 밝힐 것. 3) ${groundingGuard} 4) 마지막에 더 정확한 답변을 위해 관련 학술 문헌 업로드가 필요하다고 안내할 것.\n\n[사용자 질문]\n${prompt}`
        : `[시스템] 사용자는 학술 근거가 있는 설명을 기대하고 있습니다. ${fallbackLead} 또한 웹 검색 근거도 확보하지 못했습니다. 따라서 일반 지식으로 답변하되, 다음을 반드시 지키세요. 1) 지금 답변은 문헌 근거가 확인되지 않은 일반 설명이라고 첫 부분에 명시할 것. 2) 단정적 표현을 줄이고 불확실성은 분명히 밝힐 것. 3) ${groundingGuard} 4) 답변 마지막에 정확한 학술 검증을 위해 관련 문헌 또는 PDF 업로드가 필요하다고 안내할 것.\n\n[사용자 질문]\n${prompt}`,
      evidence: this.buildGeneralEvidence(
        this.appendWebSearchFailureNote(
          ragRetrievalError
            ? '문헌 검색 시스템 문제로 문헌 근거를 조회하지 못해 일반 지식으로만 설명합니다.'
            : '문헌 또는 웹 근거를 확보하지 못해 일반 지식으로만 설명합니다.',
          webContext
        )
      )
    };
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
    const modelName = this.currentConfig?.modelName || DEFAULT_GEMINI_MODEL;
    const thinkingConfig = this.getThinkingConfig(modelName, this.currentConfig?.reasoningPreset);
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
    const modelName = this.currentConfig?.modelName || DEFAULT_GEMINI_MODEL;
    const thinkingConfig = this.getThinkingConfig(modelName, this.currentConfig?.reasoningPreset);
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
    // API 조회 전 최소 fallback (Stable 우선)
    return [...FALLBACK_MODEL_PRIORITY];
  }

  public async getAvailableGeminiModelsAsync(forceRefresh = false): Promise<string[]> {
    return (await this.getAvailableGeminiModelsResult(forceRefresh)).models;
  }

  public async getAvailableGeminiModelsResult(forceRefresh = false): Promise<GeminiModelListResult> {
    const hasApiKey = !!(this.currentConfig?.apiKey);
    const clientReady = !!this.geminiClient;
    const cacheAge = Date.now() - this.availableModelsCacheTime;
    const isCacheValid = !forceRefresh && !!this.availableModelsCache?.length && cacheAge < this.MODELS_CACHE_TTL_MS;

    if (isCacheValid) {
      return { models: this.availableModelsCache!, source: 'cache', clientReady, hasConfiguredApiKey: hasApiKey };
    }

    // API 키 없음: 조회 시도 불필요
    if (!hasApiKey) {
      return {
        models: [...FALLBACK_MODEL_PRIORITY],
        source: 'fallback',
        reason: 'missing-api-key',
        hasConfiguredApiKey: false,
        clientReady,
      };
    }

    // API 키는 있지만 클라이언트 미초기화
    if (!clientReady) {
      return {
        models: [...FALLBACK_MODEL_PRIORITY],
        source: 'fallback',
        reason: 'client-not-initialized',
        hasConfiguredApiKey: true,
        clientReady: false,
      };
    }

    const outcome = await this.fetchModelsFromApi();

    if (outcome.status === 'ok') {
      return {
        models: outcome.models,
        source: 'api',
        rawCount: outcome.rawCount,
        filteredCount: outcome.models.length,
        rawSourceShape: outcome.shape,
        hasConfiguredApiKey: true,
        clientReady: true,
      };
    }

    if (outcome.status === 'filter-empty') {
      // raw 모델은 있었으나 필터 후 0개 → 기존 캐시 우선, 없으면 fallback
      if (this.availableModelsCache?.length) {
        return {
          models: this.availableModelsCache,
          source: 'cache',
          stale: true,
          reason: 'stale-cache-after-refresh-error',
          rawCount: outcome.rawCount,
          filteredCount: 0,
          rawSourceShape: outcome.shape,
          hasConfiguredApiKey: true,
          clientReady: true,
        };
      }
      return {
        models: [...FALLBACK_MODEL_PRIORITY],
        source: 'fallback',
        reason: 'filter-empty',
        rawCount: outcome.rawCount,
        filteredCount: 0,
        rawSourceShape: outcome.shape,
        hasConfiguredApiKey: true,
        clientReady: true,
      };
    }

    if (outcome.status === 'empty-raw') {
      if (this.availableModelsCache?.length) {
        return {
          models: this.availableModelsCache,
          source: 'cache',
          stale: true,
          reason: 'stale-cache-after-refresh-error',
          rawCount: 0,
          rawSourceShape: outcome.shape,
          hasConfiguredApiKey: true,
          clientReady: true,
        };
      }
      return {
        models: [...FALLBACK_MODEL_PRIORITY],
        source: 'fallback',
        reason: 'empty-api-result',
        rawCount: 0,
        rawSourceShape: outcome.shape,
        hasConfiguredApiKey: true,
        clientReady: true,
      };
    }

    // api-error: 기존 캐시 있으면 stale cache, 없으면 fallback
    const errorMsg = outcome.status === 'api-error'
      ? String(outcome.error instanceof Error ? outcome.error.message : outcome.error)
      : undefined;

    if (this.availableModelsCache?.length) {
      return {
        models: this.availableModelsCache,
        source: 'cache',
        stale: true,
        reason: 'stale-cache-after-refresh-error',
        errorMessage: errorMsg,
        hasConfiguredApiKey: true,
        clientReady: true,
      };
    }
    return {
      models: [...FALLBACK_MODEL_PRIORITY],
      source: 'fallback',
      reason: 'api-error',
      errorMessage: errorMsg,
      hasConfiguredApiKey: true,
      clientReady: true,
    };
  }

  private filterOfficialGeminiModels(models: string[]): string[];
  private filterOfficialGeminiModels(models: Array<{ id: string; supportedGenerationMethods?: string[] }>): string[];
  private filterOfficialGeminiModels(models: string[] | Array<{ id: string; supportedGenerationMethods?: string[] }>): string[] {
    const entries: Array<{ id: string; supportsGenerate: boolean }> = models.map((m) => {
      if (typeof m === 'string') {
        // 문자열 오버로드: capability 정보가 없으므로 이름 기반 fallback 허용
        return { id: this.normalizeModelId(m), supportsGenerate: true };
      }
      const id = this.normalizeModelId(m.id);
      const methods = m.supportedGenerationMethods;
      let supportsGenerate: boolean;
      if (methods === undefined) {
        // SDK가 필드 자체를 내려주지 않은 경우: 이름 기반 fallback 허용
        supportsGenerate = true;
      } else if (methods.length === 0) {
        // 빈 배열: 지원 메서드 없음으로 명시 → 제외
        supportsGenerate = false;
      } else {
        supportsGenerate = methods.includes('generateContent');
      }
      return { id, supportsGenerate };
    });

    const allowed = entries.filter(({ id, supportsGenerate }) => {
      if (!id || !id.startsWith('gemini-')) return false;
      if (!supportsGenerate) return false;
      // 임베딩/TTS/Live/이미지전용 등 특수 모델 제외
      if (/embedding|tts|live|vision-only|imagen/.test(id)) return false;
      return true;
    });

    return Array.from(new Set(allowed.map(({ id }) => id)));
  }

  private normalizeModelId(modelName: string): string {
    return modelName.replace(/^models\//, '').trim();
  }

  private resolveModelAlias(preferredModel: string, available: string[]): string | null {
    // Stable 모델을 Preview보다 우선하는 alias 순서로 정의
    const aliasMap: Record<string, string[]> = {
      'gemini-flash-latest':            ['gemini-3.5-flash', 'gemini-3-flash-preview'],
      'gemini-pro-latest':              ['gemini-3.1-pro-preview'],
      // Preview → Stable 마이그레이션
      'gemini-3.1-flash-lite-preview':  ['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite-preview'],
      // 레거시 3.x → 3.5 자동 전환
      'gemini-3-flash-preview':         ['gemini-3.5-flash', 'gemini-3-flash-preview'],
      'gemini-3-flash':                 ['gemini-3.5-flash', 'gemini-3-flash-preview'],
      // 레거시 2.x → 3.5 자동 전환
      'gemini-2.5-flash-lite':          ['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite-preview'],
      'gemini-2.5-flash':               ['gemini-3.5-flash', 'gemini-3-flash-preview'],
      'gemini-2.5-pro':                 ['gemini-3.1-pro-preview'],
      'gemini-3-pro':                   ['gemini-3.1-pro-preview'],
      'gemini-3-pro-preview':           ['gemini-3.1-pro-preview'],
    };

    const candidates = aliasMap[preferredModel];
    if (candidates) {
      for (const candidate of candidates) {
        if (available.length === 0 || available.includes(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  }

  // 내부 API 호출 결과 타입 — 오류를 삼키지 않고 구조화하여 반환
  // models.list() 응답에서 raw model 객체 배열을 수집하는 헬퍼.
  // SDK 버전·응답 형태에 무관하게 동작해야 한다.
  private async collectRawModelsFromListResult(
    result: unknown,
  ): Promise<{ rawModels: Array<Record<string, unknown>>; shape: GeminiModelListResult['rawSourceShape'] }> {
    const rawModels: Array<Record<string, unknown>> = [];
    const obj = result as Record<string, unknown> | null;
    if (!obj || typeof obj !== 'object') {
      return { rawModels, shape: 'unknown' };
    }

    // 1) { models: [...] } — 레거시 직접 배열형
    if (Array.isArray(obj.models)) {
      rawModels.push(...(obj.models as Array<Record<string, unknown>>));
      return { rawModels, shape: 'models-array' };
    }

    // 2) { page: [...] } — @google/genai Pager 최초 페이지
    if (Array.isArray(obj.page)) {
      rawModels.push(...(obj.page as Array<Record<string, unknown>>));
      return { rawModels, shape: 'pager-page' };
    }

    // 3) iterateAll() — 구버전 SDK의 페이지 순회
    if (typeof obj.iterateAll === 'function') {
      for await (const model of (obj as { iterateAll: () => AsyncIterable<unknown> }).iterateAll()) {
        if (model && typeof model === 'object') {
          rawModels.push(model as Record<string, unknown>);
        }
      }
      return { rawModels, shape: 'iterate-all' };
    }

    // 4) async iterator — Pager<Model>는 모델 객체를 직접 yield한다
    if (Symbol.asyncIterator in obj) {
      for await (const item of obj as AsyncIterable<unknown>) {
        if (item && typeof item === 'object') {
          rawModels.push(item as Record<string, unknown>);
        }
      }
      return { rawModels, shape: 'async-iterator' };
    }

    return { rawModels, shape: 'unknown' };
  }

  private async fetchModelsFromApi(): Promise<
    | { status: 'no-client' }
    | { status: 'api-error'; error: unknown }
    | { status: 'empty-raw'; shape: GeminiModelListResult['rawSourceShape'] }
    | { status: 'filter-empty'; rawCount: number; shape: GeminiModelListResult['rawSourceShape'] }
    | { status: 'ok'; models: string[]; rawCount: number; shape: GeminiModelListResult['rawSourceShape'] }
  > {
    if (!this.geminiClient) return { status: 'no-client' };

    let rawModels: Array<Record<string, unknown>>;
    let shape: GeminiModelListResult['rawSourceShape'];
    try {
      const result = await this.geminiClient.models.list();
      ({ rawModels, shape } = await this.collectRawModelsFromListResult(result));
    } catch (error) {
      return { status: 'api-error', error };
    }

    if (rawModels.length === 0) return { status: 'empty-raw', shape };

    const entries = rawModels
      .map((model) => {
        const info = model as {
          name?: unknown; id?: unknown; displayName?: unknown;
          supportedGenerationMethods?: unknown; supportedActions?: unknown;
        };
        const rawId = String(info?.name || info?.id || info?.displayName || '');
        const id = this.normalizeModelId(rawId);
        // SDK 버전에 따라 필드명이 다를 수 있어 방어적으로 처리
        // undefined = 필드 없음(fallback 허용), [] = 지원 메서드 없음(제외), ['generateContent'...] = 명시 지원
        const methods: string[] | undefined = Array.isArray(info?.supportedGenerationMethods)
          ? (info.supportedGenerationMethods as string[])
          : Array.isArray(info?.supportedActions)
            ? (info.supportedActions as string[])
            : undefined;
        return { id, supportedGenerationMethods: methods };
      })
      .filter(({ id }) => !!id);

    const filtered = this.filterOfficialGeminiModels(entries);
    if (filtered.length === 0) return { status: 'filter-empty', rawCount: rawModels.length, shape };

    this.availableModelsCache = filtered;
    this.availableModelsCacheTime = Date.now();
    return { status: 'ok', models: filtered, rawCount: rawModels.length, shape };
  }

  // validateModelAvailability 등 내부 호출용 — 오류 시 기존 캐시 또는 [] 반환
  private async fetchAvailableModels(forceRefresh = false): Promise<string[]> {
    const cacheAge = Date.now() - this.availableModelsCacheTime;
    if (!forceRefresh && this.availableModelsCache && cacheAge < this.MODELS_CACHE_TTL_MS) {
      return this.availableModelsCache;
    }
    const outcome = await this.fetchModelsFromApi();
    if (outcome.status === 'ok') return outcome.models;
    if (outcome.status === 'api-error') {
      console.warn('⚠️ [AIService] Failed to fetch available models:', outcome.error);
    }
    return this.availableModelsCache ?? [];
  }

  private async validateModelAvailability(preferredModel: string) {
    if (!preferredModel) return;
    const available = await this.fetchAvailableModels();
    const normalizedPreferred = this.normalizeModelId(preferredModel);
    const currentConfig = this.currentConfig;
    if (!currentConfig) return;

    // 현재 모델이 available 목록에 있으면 그대로 유지 (alias migration 불필요)
    if (available.length > 0 && available.includes(normalizedPreferred)) {
      return;
    }

    if (available.length === 0) {
      return;
    }

    // available에 없을 때만 alias migration 시도
    const alias = this.resolveModelAlias(normalizedPreferred, available);
    if (alias) {
      console.warn('⚠️ [AIService] Model alias resolved:', preferredModel, '→', alias);
      this.currentConfig = { ...currentConfig, modelName: alias };
      localStorage.setItem('culture-map-ai-config', JSON.stringify(this.currentConfig));
      return;
    }

    const fallback = getDefaultGeminiModelId(available);
    console.warn('⚠️ [AIService] Selected model not available:', preferredModel, '→ using', fallback);
    this.currentConfig = { ...currentConfig, modelName: fallback };
    localStorage.setItem('culture-map-ai-config', JSON.stringify(this.currentConfig));
  }

  private normalizeModelConfig(config: AIConfig): AIConfig {
    const normalized = {
      ...config,
      provider: 'gemini' as const,
      apiKey: config.apiKey.trim(),
      tavilyApiKey: config.tavilyApiKey?.trim() || undefined,
      ragSearchScope: 'shared' as const,
      reasoningPreset: config.reasoningPreset ?? 'default'
    };
    const available = this.getAvailableGeminiModels();
    const modelId = normalized.modelName ? this.normalizeModelId(normalized.modelName) : null;

    if (modelId && available.includes(modelId)) {
      // available 목록에 있으면 그대로 유지 (alias migration 불필요)
      normalized.modelName = modelId;
    } else if (modelId) {
      // available에 없을 때만 alias migration 시도
      const alias = this.resolveModelAlias(modelId, available);
      normalized.modelName = alias ?? getDefaultGeminiModelId(available);
    } else {
      normalized.modelName = getDefaultGeminiModelId(available);
    }
    return normalized;
  }

  private getGeminiModelFamily(modelName: string): 'gemini-3' | 'gemini-2.5' | 'other' {
    const id = modelName.toLowerCase();
    // gemini-3.x 계열 (3.5-flash, 3.1-flash-lite, 3-flash-preview 등 포함)
    if (/^gemini-3(\.|-)/.test(id) || id === 'gemini-3') return 'gemini-3';
    // gemini-2.5 계열
    if (/^gemini-2\.5/.test(id)) return 'gemini-2.5';
    return 'other';
  }

  private getThinkingConfig(modelName: string, preset: ReasoningPreset = 'default'): ThinkingConfig | null {
    const family = this.getGeminiModelFamily(modelName);

    if (family === 'gemini-3') {
      // Gemini 3.x: thinkingLevel만 사용 (thinkingBudget 금지)
      // 공식 JS 예시와 동일하게 소문자 literal 사용
      const isProModel = /pro/.test(modelName.toLowerCase());

      if (preset === 'default') {
        // default: Google 기본값. thought stream 표시를 위해 includeThoughts만 설정
        return { includeThoughts: true };
      }
      if (preset === 'fast') {
        return { includeThoughts: true, thinkingLevel: 'low' as ThinkingConfig['thinkingLevel'] };
      }
      if (preset === 'balanced') {
        // Pro 계열은 medium을 지원하지 않을 수 있어 high fallback
        const level = isProModel ? 'high' : 'medium';
        return { includeThoughts: true, thinkingLevel: level as ThinkingConfig['thinkingLevel'] };
      }
      if (preset === 'deep') {
        return { includeThoughts: true, thinkingLevel: 'high' as ThinkingConfig['thinkingLevel'] };
      }
    }

    if (family === 'gemini-2.5') {
      // Gemini 2.5: thinkingBudget만 사용 (thinkingLevel 금지)
      if (preset === 'default') {
        // 모델 기본값을 따름 (2.5 Flash-Lite 기본은 thinking 없음)
        return null;
      }
      if (preset === 'fast') {
        return { includeThoughts: true, thinkingBudget: 1024 };
      }
      if (preset === 'balanced') {
        return { includeThoughts: true, thinkingBudget: 8192 };
      }
      if (preset === 'deep') {
        return { includeThoughts: true, thinkingBudget: 24576 };
      }
    }

    // Other 모델: thinking 설정 생략
    return null;
  }

  public estimateTokenCount(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  public async getModelTokenLimits(modelName?: string): Promise<{ inputTokenLimit: number; outputTokenLimit: number }> {
    const resolvedModel = modelName || this.currentConfig?.modelName || DEFAULT_GEMINI_MODEL;
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

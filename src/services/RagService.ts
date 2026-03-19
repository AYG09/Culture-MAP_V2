import { GoogleGenAI } from '@google/genai';
import documentService from './DocumentService';
import liveblocksService from './LiveblocksService';
import type { SharedRagChunk } from '../types/liveblocks';

export interface RagDocumentInfo {
  id: string;
  name: string;
}

export interface RagChunkRecord {
  id: string;
  docId: string;
  docName: string;
  content: string;
  embedding: number[];
  pageNumber?: number; // Optional for backward compatibility with existing chunks
}

export interface RagQueryOptions {
  topK?: number;
  minScore?: number;
  maxContextChars?: number;
  scope?: RagSearchScope;
}

export interface RagQueryResult {
  contextText: string;
  sources: Array<{ docId: string; docName: string; score: number; pageNumber?: number }>;
}

type EmbedContentResponse = {
  embeddings?: Array<{ values?: number[] }>;
  embedding?: { values?: number[] };
};

export type RagSearchScope = 'both' | 'local' | 'shared';

type EmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

const EMBEDDING_MODEL_CANDIDATES = ['text-embedding-004', 'embedding-001', 'models/embedding-001'] as const;
const DEFAULT_EMBEDDING_DIM = 768;

class RagIndexStore {
  private static readonly DB_NAME = 'culture-map-rag';
  private static readonly STORE_NAME = 'chunks';
  private static readonly DB_VERSION = 1;

  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryFallback: RagChunkRecord[] = [];

  private isIndexedDbAvailable() {
    return typeof indexedDB !== 'undefined';
  }

  private openDb(): Promise<IDBDatabase> {
    if (!this.isIndexedDbAvailable()) {
      return Promise.reject(new Error('IndexedDB is not available'));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(RagIndexStore.DB_NAME, RagIndexStore.DB_VERSION);
        request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(RagIndexStore.STORE_NAME)) {
            const store = db.createObjectStore(RagIndexStore.STORE_NAME, { keyPath: 'id' });
            store.createIndex('docId', 'docId', { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
      });
    }

    return this.dbPromise;
  }

  private async withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => Promise<T>): Promise<T> {
    try {
      const db = await this.openDb();
      return await new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(RagIndexStore.STORE_NAME, mode);
        const store = transaction.objectStore(RagIndexStore.STORE_NAME);
        action(store)
          .then((result) => resolve(result))
          .catch((error) => reject(error));
        transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
      });
    } catch (error) {
      throw error instanceof Error ? error : new Error('IndexedDB access failed');
    }
  }

  public async putChunks(chunks: RagChunkRecord[]): Promise<void> {
    if (!this.isIndexedDbAvailable()) {
      const existing = new Map(this.memoryFallback.map((item) => [item.id, item]));
      chunks.forEach((chunk) => existing.set(chunk.id, chunk));
      this.memoryFallback = Array.from(existing.values());
      return;
    }

    await this.withStore('readwrite', (store) => {
      return new Promise<void>((resolve, reject) => {
        try {
          chunks.forEach((chunk) => store.put(chunk));
          resolve();
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Failed to store chunks'));
        }
      });
    });
  }

  public async getAllChunks(): Promise<RagChunkRecord[]> {
    if (!this.isIndexedDbAvailable()) {
      return [...this.memoryFallback];
    }

    return this.withStore('readonly', (store) => {
      return new Promise<RagChunkRecord[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve((request.result as RagChunkRecord[]) || []);
        request.onerror = () => reject(request.error || new Error('Failed to read chunks'));
      });
    });
  }

  public async hasDoc(docId: string): Promise<boolean> {
    if (!this.isIndexedDbAvailable()) {
      return this.memoryFallback.some((chunk) => chunk.docId === docId);
    }

    return this.withStore('readonly', (store) => {
      return new Promise<boolean>((resolve, reject) => {
        const index = store.index('docId');
        const request = index.count(docId);
        request.onsuccess = () => resolve((request.result || 0) > 0);
        request.onerror = () => reject(request.error || new Error('Failed to count chunks'));
      });
    });
  }

  public async removeDoc(docId: string): Promise<void> {
    if (!this.isIndexedDbAvailable()) {
      this.memoryFallback = this.memoryFallback.filter((chunk) => chunk.docId !== docId);
      return;
    }

    await this.withStore('readwrite', (store) => {
      return new Promise<void>((resolve, reject) => {
        const index = store.index('docId');
        const request = index.getAllKeys(docId);
        request.onsuccess = () => {
          const keys = request.result as Array<IDBValidKey>;
          keys.forEach((key) => store.delete(key));
          resolve();
        };
        request.onerror = () => reject(request.error || new Error('Failed to remove chunks'));
      });
    });
  }
}

class RagService {
  private client: GoogleGenAI | null = null;
  private store = new RagIndexStore();
  private cachedChunks: RagChunkRecord[] | null = null;
  private loadingPromise: Promise<RagChunkRecord[]> | null = null;
  private resolvedEmbeddingModel: string | null = null;
  private lastRetrievalError: string | null = null;

  public setClient(client: GoogleGenAI | null) {
    this.client = client;
    this.resolvedEmbeddingModel = null;
    this.lastRetrievalError = null;
  }

  public getLastRetrievalError(): string | null {
    return this.lastRetrievalError;
  }

  public async indexAcademicPdf(file: File, info: RagDocumentInfo): Promise<{ chunkCount: number } | null> {
    if (!this.client) {
      throw new Error('Gemini API 설정을 먼저 완료해주세요.');
    }

    if (!file.type.includes('pdf')) return null;

    const alreadyIndexed = await this.store.hasDoc(info.id);
    if (alreadyIndexed) {
      return { chunkCount: 0 };
    }

    const chunks = await this.buildChunksFromPdf(file, info.name);
    if (chunks.length === 0) {
      return { chunkCount: 0 };
    }

    const embeddedChunks = await this.embedChunks(chunks, info);
    await this.store.putChunks(embeddedChunks);
    await this.refreshCache();

    return { chunkCount: embeddedChunks.length };
  }

  /**
   * PDF를 공유 RAG로 인덱싱 (Liveblocks Y.Array에 저장)
   */
  public async indexAcademicPdfToShared(file: File, info: RagDocumentInfo): Promise<{ chunkCount: number } | null> {
    if (!this.client) {
      throw new Error('Gemini API 설정을 먼저 완료해주세요.');
    }

    if (!file.type.includes('pdf')) return null;

    // 이미 공유 RAG에 있는지 확인
    if (liveblocksService.hasSharedRagDoc(info.id)) {
      console.log(`📚 [RagService] 이미 공유됨: ${info.name}`);
      return { chunkCount: 0 };
    }

    const chunks = await this.buildChunksFromPdf(file, info.name);
    if (chunks.length === 0) {
      return { chunkCount: 0 };
    }

    const embeddedChunks = await this.embedChunks(chunks, info);
    
    // SharedRagChunk 형태로 변환
    const userId = liveblocksService.getCurrentUserId();
    const userName = liveblocksService.getCurrentUserDisplayName();
    const uploadedAt = Date.now();

    const sharedChunks: SharedRagChunk[] = embeddedChunks.map(chunk => ({
      id: chunk.id,
      docId: chunk.docId,
      docName: chunk.docName,
      content: chunk.content,
      embedding: chunk.embedding,
      pageNumber: chunk.pageNumber,
      uploaderId: userId,
      uploaderName: userName,
      uploadedAt,
    }));

    // Liveblocks에 저장
    liveblocksService.addSharedRagChunks(sharedChunks);

    return { chunkCount: sharedChunks.length };
  }

  /**
   * 공유 RAG 문서 삭제
   */
  public removeSharedDocument(docId: string): void {
    liveblocksService.removeSharedRagDoc(docId);
  }

  public async removeDocument(docId: string) {
    await this.store.removeDoc(docId);
    await this.refreshCache();
  }

  /**
   * 통합 검색: 로컬 + 공유 RAG 청크 모두 검색
   */
  public async retrieveContext(query: string, options: RagQueryOptions = {}): Promise<RagQueryResult | null> {
    if (!this.client) {
      this.lastRetrievalError = null;
      return null;
    }

    try {
      const localChunks = await this.ensureChunksLoaded();
      const sharedChunks = this.getSharedChunks();
      const allChunks = this.getScopedChunks(localChunks, sharedChunks, options.scope ?? 'both');
      if (allChunks.length === 0) {
        this.lastRetrievalError = null;
        return null;
      }

      const queryEmbedding = await this.embedQuery(query);
      if (queryEmbedding.length === 0) {
        this.lastRetrievalError = null;
        return null;
      }

      const topK = options.topK ?? 6;
      const minScore = options.minScore ?? 0.2;
      const maxContextChars = options.maxContextChars ?? 6000;

      const VECTOR_WEIGHT = 0.7;
      const KEYWORD_WEIGHT = 0.3;

      const scored = allChunks
        .map((chunk) => {
          const vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding);
          const keywordScore = keywordMatchScore(query, chunk.content);
          const hybridScore = vectorScore * VECTOR_WEIGHT + keywordScore * KEYWORD_WEIGHT;
          return {
            chunk,
            score: hybridScore,
            vectorScore,
            keywordScore
          };
        })
        .filter((item) => Number.isFinite(item.score) && item.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      if (scored.length === 0) {
        this.lastRetrievalError = null;
        return null;
      }

      const sources: Array<{ docId: string; docName: string; score: number; pageNumber?: number }> = [];
      const contextParts: string[] = [];
      let usedChars = 0;

      scored.forEach((item, index) => {
        const pageInfo = item.chunk.pageNumber ? ` (p.${item.chunk.pageNumber})` : '';
        const header = `[출처 ${index + 1}] ${item.chunk.docName}${pageInfo}`;
        const body = item.chunk.content.trim();
        const block = `${header}\n${body}`;
        if (usedChars + block.length > maxContextChars) {
          return;
        }
        usedChars += block.length;
        contextParts.push(block);
        sources.push({ docId: item.chunk.docId, docName: item.chunk.docName, score: item.score, pageNumber: item.chunk.pageNumber });
      });

      this.lastRetrievalError = null;
      return {
        contextText: contextParts.join('\n\n'),
        sources
      };
    } catch (error) {
      this.lastRetrievalError = this.buildRetrievalErrorMessage(error);
      console.warn('⚠️ [RagService] Academic retrieval skipped:', this.lastRetrievalError);
      return null;
    }
  }

  /**
   * 인덱스 존재 여부 확인 (로컬 + 공유 모두)
   */
  public async hasIndex(): Promise<boolean> {
    const localChunks = await this.ensureChunksLoaded();
    const sharedChunks = liveblocksService.getSharedRagChunks();
    return localChunks.length > 0 || sharedChunks.length > 0;
  }

  private async ensureChunksLoaded(): Promise<RagChunkRecord[]> {
    if (this.cachedChunks) return this.cachedChunks;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this.store.getAllChunks().then((chunks) => {
      this.cachedChunks = chunks;
      this.loadingPromise = null;
      return chunks;
    });

    return this.loadingPromise;
  }

  private async refreshCache() {
    this.cachedChunks = await this.store.getAllChunks();
  }

  private getSharedChunks(): RagChunkRecord[] {
    const sharedChunks = liveblocksService.getSharedRagChunks();
    return sharedChunks.map(chunk => ({
      id: chunk.id,
      docId: chunk.docId,
      docName: chunk.docName,
      content: chunk.content,
      embedding: chunk.embedding,
      pageNumber: chunk.pageNumber,
    }));
  }

  private getScopedChunks(localChunks: RagChunkRecord[], sharedChunks: RagChunkRecord[], scope: RagSearchScope): RagChunkRecord[] {
    if (scope === 'local') {
      return localChunks;
    }

    if (scope === 'shared') {
      return sharedChunks;
    }

    return [...localChunks, ...sharedChunks];
  }

  private async buildChunksFromPdf(file: File, docName: string): Promise<Array<{ content: string; docName: string; pageNumber?: number }>> {
    const chunkSize = 1600;
    const overlap = 200;
    let buffer = '';
    let currentPageNum = 1;
    const chunks: Array<{ content: string; docName: string; pageNumber?: number }> = [];

    for await (const page of documentService.iteratePdfPages(file)) {
      const cleaned = normalizeText(page.text);
      const pageNum = page.pageNumber ?? currentPageNum;
      currentPageNum = pageNum + 1;
      if (!cleaned) continue;

      buffer = buffer ? `${buffer}\n${cleaned}` : cleaned;

      if (buffer.length >= chunkSize) {
        const split = splitTextWithOverlap(buffer, chunkSize, overlap);
        if (split.length > 1) {
          const last = split.pop();
          split.forEach((part) => {
            const trimmed = part.trim();
            if (trimmed) chunks.push({ content: trimmed, docName, pageNumber: pageNum });
          });
          buffer = last ? last.trim() : '';
        }
      }
    }

    if (buffer.trim()) {
      splitTextWithOverlap(buffer, chunkSize, overlap).forEach((part) => {
        const trimmed = part.trim();
        if (trimmed) chunks.push({ content: trimmed, docName, pageNumber: currentPageNum });
      });
    }

    return chunks;
  }

  private async embedChunks(
    chunks: Array<{ content: string; docName: string; pageNumber?: number }>,
    info: RagDocumentInfo
  ): Promise<RagChunkRecord[]> {
    if (!this.client) return [];

    const batchSize = 16;
    const records: RagChunkRecord[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const texts = batch.map((item) => item.content);
      const embeddings = await this.embedDocuments(texts);

      batch.forEach((item, idx) => {
        const embedding = embeddings[idx] || [];
        records.push({
          id: `${info.id}:${i + idx}`,
          docId: info.id,
          docName: info.name,
          content: item.content,
          embedding,
          pageNumber: item.pageNumber
        });
      });
    }

    return records;
  }

  private async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.requestEmbeddings(texts, 'RETRIEVAL_DOCUMENT');
  }

  private async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this.requestEmbeddings(text ? [text] : [], 'RETRIEVAL_QUERY');
    return embeddings[0] || [];
  }

  private async requestEmbeddings(texts: string[], taskType: EmbeddingTaskType): Promise<number[][]> {
    if (!this.client || texts.length === 0) return [];

    let lastError: unknown = null;

    for (const model of this.getEmbeddingModelCandidates()) {
      try {
        const response = (await this.client.models.embedContent({
          model,
          contents: texts,
          config: {
            taskType,
            outputDimensionality: DEFAULT_EMBEDDING_DIM
          }
        })) as EmbedContentResponse;

        this.resolvedEmbeddingModel = model;
        return this.extractEmbeddings(response);
      } catch (error) {
        lastError = error;
        if (!this.isRetryableEmbeddingModelError(error)) {
          throw error;
        }
      }
    }

    throw new Error(this.buildEmbeddingUnavailableMessage(lastError));
  }

  private getEmbeddingModelCandidates(): string[] {
    const orderedModels = [this.resolvedEmbeddingModel, ...EMBEDDING_MODEL_CANDIDATES].filter(
      (model): model is string => Boolean(model)
    );

    return orderedModels.filter((model, index) => orderedModels.indexOf(model) === index);
  }

  private extractEmbeddings(response: EmbedContentResponse): number[][] {
    if (response.embeddings && response.embeddings.length > 0) {
      return response.embeddings.map((item) => item.values || []);
    }

    if (response.embedding?.values) {
      return [response.embedding.values];
    }

    return [];
  }

  private isRetryableEmbeddingModelError(error: unknown): boolean {
    const message = this.getErrorMessage(error).toLowerCase();
    return message.includes('not found') || message.includes('not supported') || message.includes('unsupported') || message.includes('404');
  }

  private buildEmbeddingUnavailableMessage(error: unknown): string {
    const detail = this.getErrorMessage(error);
    return detail
      ? `현재 환경에서 사용할 수 있는 Gemini 임베딩 모델을 찾지 못했습니다. ${detail}`
      : '현재 환경에서 사용할 수 있는 Gemini 임베딩 모델을 찾지 못했습니다.';
  }

  private buildRetrievalErrorMessage(error: unknown): string {
    if (this.isRetryableEmbeddingModelError(error)) {
      return '현재 Gemini 임베딩 모델을 사용할 수 없어 업로드된 문헌 검색을 건너뛰었습니다.';
    }

    const detail = this.getErrorMessage(error);
    return detail
      ? `업로드된 문헌 검색 중 오류가 발생해 문헌 근거를 조회하지 못했습니다. ${detail}`
      : '업로드된 문헌 검색 중 오류가 발생해 문헌 근거를 조회하지 못했습니다.';
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return typeof error === 'string' ? error : '';
  }
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function splitTextWithOverlap(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  if (!text) return chunks;

  let start = 0;
  const safeOverlap = Math.min(overlap, Math.max(chunkSize - 1, 0));

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(0, end - safeOverlap);
  }

  return chunks;
}

/**
 * Keyword matching score for hybrid search.
 * Returns a score between 0 and 1 based on how many query terms appear in the content.
 */
function keywordMatchScore(query: string, content: string): number {
  // Extract terms (2+ chars) from query
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (queryTerms.length === 0) return 0;

  const contentLower = content.toLowerCase();
  let matches = 0;

  queryTerms.forEach((term) => {
    if (contentLower.includes(term)) {
      matches += 1;
    }
  });

  return matches / queryTerms.length;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return -1;
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }

  if (magA === 0 || magB === 0) return -1;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export const ragService = new RagService();
export default ragService;

import type { ConnectionData, NoteData, NoteType, PerceptionIntensity } from '../types/culture';
import { FREQUENCY_LABELS } from '../types/culture';

/**
 * 현재 컬쳐맵(노드/연결)을 파서 호환 [태그] 텍스트로 직렬화한다.
 * parseAIOutput가 다시 파싱할 수 있는 형식이며, 컨설팅 Step 3(진단·전략)의
 * "컬쳐맵 생성 결과" 입력으로 그대로 사용할 수 있다.
 */

const SENTIMENT_LABEL: Record<NoteData['sentiment'], string> = {
  positive: '긍정',
  negative: '부정',
  neutral: '중립',
};

const LEVER_TYPES: NoteType[] = ['유형_레버', '무형_레버'];

const buildTypeTag = (note: NoteData, includeFrequency: boolean): string => {
  const intensity: PerceptionIntensity =
    note.perceptionIntensity ?? note.frequency ?? null;
  if (includeFrequency && intensity) {
    return `${note.type}_${FREQUENCY_LABELS[intensity]}`;
  }
  return note.type;
};

const buildNodeLine = (note: NoteData, includeFrequency: boolean): string => {
  const tag = buildTypeTag(note, includeFrequency);
  const sentiment = SENTIMENT_LABEL[note.sentiment] ?? '중립';
  const content = (note.content || '').trim();
  const basis = note.basis?.trim();
  const basisSuffix = basis && LEVER_TYPES.includes(note.type) ? ` (${basis})` : '';
  return `[${tag}] (${sentiment}) ${content}${basisSuffix}`;
};

const buildConnectionLine = (
  connection: ConnectionData,
  noteById: Map<string, NoteData>,
  includeFrequency: boolean
): string | null => {
  const source = noteById.get(connection.sourceId);
  const target = noteById.get(connection.targetId);
  if (!source || !target) return null;

  const isIndirect = connection.relationType === 'indirect';
  const prefix = isIndirect ? '[간접연결]' : '[연결]';
  const suffix = isIndirect ? '(간접)' : '(직접)';

  const sourceTag = buildTypeTag(source, includeFrequency);
  const targetTag = buildTypeTag(target, includeFrequency);
  const sourceSentiment = SENTIMENT_LABEL[source.sentiment] ?? '중립';
  const targetSentiment = SENTIMENT_LABEL[target.sentiment] ?? '중립';

  return (
    `${prefix} [${sourceTag}] (${sourceSentiment}) ${(source.content || '').trim()}` +
    ` → [${targetTag}] (${targetSentiment}) ${(target.content || '').trim()} ${suffix}`
  );
};

export const serializeCultureMapToText = (
  notes: NoteData[],
  connections: ConnectionData[],
  options?: { includeFrequency?: boolean }
): string => {
  const includeFrequency = options?.includeFrequency ?? true;

  // insight 노드는 컬쳐맵 텍스트에서 제외
  const mappableNotes = notes.filter((note) => note.type !== 'insight');
  if (mappableNotes.length === 0) return '';

  const noteById = new Map<string, NoteData>();
  mappableNotes.forEach((note) => noteById.set(note.id, note));

  const lines: string[] = [];
  mappableNotes.forEach((note) => lines.push(buildNodeLine(note, includeFrequency)));
  connections.forEach((connection) => {
    const line = buildConnectionLine(connection, noteById, includeFrequency);
    if (line) lines.push(line);
  });

  return lines.join('\n');
};

export default serializeCultureMapToText;

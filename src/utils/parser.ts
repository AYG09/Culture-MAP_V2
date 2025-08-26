import { v4 as uuidv4 } from 'uuid';
import type { NoteData, ConnectionData, PerceptionIntensity } from '../types/culture';

const layerNameToIndex: { [key: string]: number } = {
  결과: 0,
  행동: 1,
  유형_레버: 2,
  유형: 2, // Alias
  무형_레버: 3,
  무형: 3, // Alias
};

// 인식 강도(PerceptionIntensity) 추출 함수
const extractPerceptionIntensity = (type: string): PerceptionIntensity => {
  if (type.endsWith('_집중')) return '집중';
  if (type.endsWith('_관심')) return '관심';
  if (type.endsWith('_언급')) return '언급';
  return '언급'; // 기본값
};

// 타입 정규화 함수 (인식강도 suffix 처리 포함)
const normalizeType = (type: string): string => {
  let typeWithoutIntensity = type;
  if (type.endsWith('_집중')) {
    typeWithoutIntensity = type.slice(0, -3);
  } else if (type.endsWith('_관심')) {
    typeWithoutIntensity = type.slice(0, -3);
  } else if (type.endsWith('_언급')) {
    typeWithoutIntensity = type.slice(0, -3);
  }

  const trimmedType = typeWithoutIntensity.trim();

  if (trimmedType === '유형') return '유형_레버';
  if (trimmedType === '무형') return '무형_레버';
  return trimmedType;
};

export const parseAIOutput = (
  text: string
): { notes: NoteData[]; connections: ConnectionData[] } => {
  const lines = text.split('\n').filter(line => line.trim() !== '');

  const notes: NoteData[] = [];
  const connections: ConnectionData[] = [];
  const noteContentToIdMap = new Map<string, string>();
  const pendingConnections: string[] = [];

  // 정규식 단순화: 타입에 모든 문자를 허용
  const nodeRegex =
    /^\[(?<type>[^\]]+)\]\s*\((?<sentiment>[^)]+)\)\s*(?<content>.*?)\s*(?:\((?<metadata>(?:저자|이론|연도):.*?)\))?$/i;

  // 1차: 모든 노드를 생성 (위치 계산은 나중에)
  lines.forEach(line => {
    if (line.startsWith('[연결]') || line.startsWith('[간접연결]')) {
      pendingConnections.push(line);
      return;
    }

    const nodeMatch = line.match(nodeRegex);

    if (nodeMatch?.groups) {
      const { type, sentiment, content, metadata } = nodeMatch.groups;

      // 인식 강도 추출
      const perceptionIntensity = extractPerceptionIntensity(type);

      // 인식 강도 suffix 제거 후 레이어 인덱스 찾기
      const normalizedType = normalizeType(type);
      const layerIndex = layerNameToIndex[normalizedType];
      const trimmedContent = content.trim();

      // 메타데이터 파싱 (저자, 이론, 연도 추출)
      let basis: { author: string; theory: string; year: string } | undefined = undefined;

      if (metadata) {
        const authorMatch = metadata.match(/저자:\s*([^,]+)/);
        const theoryMatch = metadata.match(/이론:\s*([^,]+)/);
        const yearMatch = metadata.match(/연도:\s*([^,)]+)/);

        if (authorMatch && theoryMatch && yearMatch) {
          basis = {
            author: authorMatch[1].trim(),
            theory: theoryMatch[1].trim(),
            year: yearMatch[1].trim(),
          };
        }
      }

      if (layerIndex === undefined || !trimmedContent) {
        return;
      }

      let sentimentValue: 'positive' | 'negative' | 'neutral' = 'neutral';
      if (sentiment?.includes('긍정')) {
        sentimentValue = 'positive';
      } else if (sentiment?.includes('부정')) {
        sentimentValue = 'negative';
      }

      const newNote: NoteData = {
        id: uuidv4(),
        text: trimmedContent,
        position: { x: 0, y: 0 }, // 임시 위치
        width: 200,
        height: 120,
        type: normalizedType as unknown, // 타입 단언
        sentiment: sentimentValue,
        perceptionIntensity: perceptionIntensity, // 인식 강도 필드 추가
        basis: basis, // 이론적 근거 필드 추가
        layer: (layerIndex + 1) as 1 | 2 | 3 | 4,
      };

      notes.push(newNote);
      noteContentToIdMap.set(trimmedContent, newNote.id);
    }
  });

  // 2차: 층위별로 위치 계산 -> layout.ts로 이동됨

  // 3차: 모든 연결선을 생성합니다.
  pendingConnections.forEach(line => {
    // 정규식 개선: 메타데이터를 고려하여 소스/타겟에서 내용만 정확히 추출
    const connectionRegex =
      /\[(간접)?연결\]\s*\[(?<sourceType>[^\]]+)\]\s*\((?<sourceSentiment>[^)]+)\)\s*(?<sourceContent>.+?)(?:\s*\((?:저자|이론|연도):.*?\))?\s*→\s*\[(?<targetType>[^\]]+)\]\s*\((?<targetSentiment>[^)]+)\)\s*(?<targetContent>.+?)(?:\s*\((?:저자|이론|연도):.*?\))?\s*(?:\((?<relationType>직접|간접)\))?$/;
    const connectionMatch = line.match(connectionRegex);

    if (connectionMatch?.groups) {
      const {
        sourceContent,
        targetContent,
        relationType: relationTypeSuffix,
      } = connectionMatch.groups;
      const isIndirectPrefix = line.startsWith('[간접연결]');

      // 메타데이터 제거하여 순수 내용만 추출
      const cleanSourceContent = sourceContent
        .trim()
        .replace(/\s*\((?:저자|이론|연도):.*?\)\s*$/, '');
      const cleanTargetContent = targetContent
        .trim()
        .replace(/\s*\((?:저자|이론|연도):.*?\)\s*$/, '');

      const sourceId = noteContentToIdMap.get(cleanSourceContent);
      const targetId = noteContentToIdMap.get(cleanTargetContent);

      if (sourceId && targetId) {
        let relationType = 'direct';
        if (isIndirectPrefix || relationTypeSuffix === '간접') {
          relationType = 'indirect';
        }

        const newConnection: ConnectionData = {
          id: uuidv4(),
          sourceId: sourceId,
          targetId: targetId,
          isPositive: true, // 연결선 극성은 일단 '긍정'으로 고정
          relationType: relationType as 'direct' | 'indirect',
        };
        connections.push(newConnection);
      } else {
        // 디버깅을 위한 로그 (개발 환경에서만)
        if (process.env.NODE_ENV === 'development') {
          console.warn('연결선 파싱 실패:', {
            line,
            cleanSourceContent,
            cleanTargetContent,
            sourceId,
            targetId,
            availableNotes: Array.from(noteContentToIdMap.keys()),
          });
        }
      }
    }
  });

  return { notes, connections };
};

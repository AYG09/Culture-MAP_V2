import { v4 as uuidv4 } from 'uuid';
import type { NoteData, ConnectionData, PerceptionIntensity, NoteType } from '../types/culture';

const layerNameToIndex: { [key: string]: number } = {
  결과: 0,
  행동: 1,
  유형_레버: 2,
  유형: 2, // Alias
  무형_레버: 3,
  무형: 3, // Alias
};

// 인식 강도(PerceptionIntensity) 추출 함수
// 빈도多/中/少를 high/medium/low로 자동 변환 (레거시 호환)
const extractPerceptionIntensity = (type: string): PerceptionIntensity => {
  // 신규 형식: 빈도多/中/少
  if (type.includes('빈도多') || type.includes('빈도_多')) return 'high';
  if (type.includes('빈도中') || type.includes('빈도_中')) return 'medium';
  if (type.includes('빈도少') || type.includes('빈도_少')) return 'low';

  // 레거시 형식: 집중/관심/언급 → high/medium/low 변환
  if (type.endsWith('_집중')) return 'high';
  if (type.endsWith('_관심')) return 'medium';
  if (type.endsWith('_언급')) return 'low';

  return null; // 명시적 표기가 없으면 빈도 없음 처리
};

// 타입 정규화 함수 (인식강도 suffix 처리 포함)
const normalizeType = (type: string): string => {
  let typeWithoutIntensity = type;

  // 신규 형식: 빈도多/中/少 제거
  if (type.includes('빈도多') || type.includes('빈도_多')) {
    typeWithoutIntensity = type.replace(/[_]?빈도[_]?多/g, '');
  } else if (type.includes('빈도中') || type.includes('빈도_中')) {
    typeWithoutIntensity = type.replace(/[_]?빈도[_]?中/g, '');
  } else if (type.includes('빈도少') || type.includes('빈도_少')) {
    typeWithoutIntensity = type.replace(/[_]?빈도[_]?少/g, '');
  }
  // 레거시 형식: 집중/관심/언급 제거
  else if (type.endsWith('_집중')) {
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

const extractTrailingMetadataSegments = (
  line: string
): { lineWithoutMetadata: string; metadataParts: string[] } => {
  let workingLine = line.trimEnd();
  const segments: string[] = [];

  while (true) {
    // 중첩 괄호를 지원하기 위한 개선된 매칭 로직
    let depth = 0;
    let endPos = -1;
    let startPos = -1;
    
    // 뒤에서부터 괄호 매칭
    for (let i = workingLine.length - 1; i >= 0; i--) {
      if (workingLine[i] === ')') {
        if (depth === 0) {
          endPos = i;
        }
        depth++;
      } else if (workingLine[i] === '(') {
        depth--;
        if (depth === 0 && endPos !== -1) {
          startPos = i;
          break;
        }
      }
    }
    
    // 매칭된 괄호가 없거나 불완전하면 종료
    if (startPos === -1 || endPos === -1 || depth !== 0) {
      break;
    }
    
    // 괄호가 문자열 끝에 있는지 확인 (공백 및 구분자 허용)
    const afterParen = workingLine.slice(endPos + 1).trim();
    if (afterParen !== '' && !/^[,·…ㆍ\s]*$/.test(afterParen)) {
      break;
    }

    const inner = workingLine.slice(startPos + 1, endPos).trim();
    workingLine = workingLine.slice(0, startPos).trimEnd();

    if (!inner) {
      continue;
    }

    segments.unshift(inner);
  }

  return {
    lineWithoutMetadata: workingLine.trim(),
    metadataParts: segments,
  };
};

// (저자, 이론, 연도) 혹은 (저자: ..., 이론: ..., 연도: ...) 형식을 정규화
const normalizeMetadataBasis = (metadataInner: string): string | null => {
  const trimmed = metadataInner.trim();
  if (!trimmed) {
    return null;
  }

  const labelMap = new Map<string, string>();
  
  // 개선된 파싱: 중첩 괄호를 고려한 수동 파싱
  const labels = ['저자', '이론', '연도', '출처', '개념', '분류'];
  let currentPos = 0;
  
  while (currentPos < trimmed.length) {
    // 다음 레이블 찾기
    let nextLabelPos = trimmed.length;
    let foundLabel = '';
    
    for (const label of labels) {
      const pattern = new RegExp(`${label}\\s*:`, 'i');
      const match = pattern.exec(trimmed.slice(currentPos));
      if (match && match.index < nextLabelPos) {
        nextLabelPos = match.index;
        foundLabel = label;
      }
    }
    
    if (!foundLabel) {
      break;
    }
    
    // 레이블 위치로 이동
    currentPos += nextLabelPos;
    
    // "레이블:" 다음 위치
    const colonMatch = trimmed.slice(currentPos).match(/^([^:]+):\s*/);
    if (!colonMatch) {
      break;
    }
    currentPos += colonMatch[0].length;
    
    // 값의 끝 찾기: 다음 레이블이나 구분자(,·ㆍ)까지
    let valueEndPos = trimmed.length;
    let parenDepth = 0;
    
    for (let i = currentPos; i < trimmed.length; i++) {
      const char = trimmed[i];
      
      if (char === '(') {
        parenDepth++;
      } else if (char === ')') {
        parenDepth--;
      } else if (parenDepth === 0 && (char === ',' || char === '·' || char === 'ㆍ')) {
        // 구분자 발견 (괄호 밖에서)
        valueEndPos = i;
        break;
      }
    }
    
    const value = trimmed.slice(currentPos, valueEndPos).trim();
    if (value) {
      labelMap.set(foundLabel, value);
    }
    
    // 구분자 건너뛰기
    currentPos = valueEndPos;
    while (currentPos < trimmed.length && /[,·ㆍ\s]/.test(trimmed[currentPos])) {
      currentPos++;
    }
  }

  const author = labelMap.get('저자');
  const theory = labelMap.get('이론');
  const year = labelMap.get('연도');

  if (author && theory && year) {
    return `${author}, ${theory}, ${year}`;
  }

  const source = labelMap.get('출처');
  const concept = labelMap.get('개념');
  const category = labelMap.get('분류');

  if (source && concept && category) {
    return `${source}, ${concept}, ${category}`;
  }

  if (labelMap.size > 0) {
    const orderedValues = Array.from(labelMap.values())
      .map(value => value.trim())
      .filter(Boolean);

    if (orderedValues.length > 0) {
      return orderedValues.join(', ');
    }
  }

  const sanitizedParts = trimmed
    .split(',')
    .map(part => part.replace(/^(저자|이론|연도|출처|개념|분류)\s*:\s*/i, '').trim())
    .filter(part => part.length > 0);

  if (sanitizedParts.length >= 3) {
    return sanitizedParts.join(', ');
  }

  if (sanitizedParts.length > 0) {
    return sanitizedParts.join(', ');
  }

  return trimmed;
};

export const parseAIOutput = (
  text: string
): { notes: NoteData[]; connections: ConnectionData[] } => {
  console.log('🔍 parseAIOutput 입력 텍스트:', text);

  // 입력이 한 줄로 붙어있을 수 있으므로, 대괄호 기준으로 분리
  // 1. 먼저 줄바꿈으로 분리
  const rawLines = text.split('\n').filter(line => line.trim() !== '');

  // 2. 각 라인에서 대괄호로 시작하는 항목들을 추가로 분리
  const lines: string[] = [];
  rawLines.forEach(rawLine => {
    // [로 시작하는 패턴을 찾아서 분리
    const items = rawLine.split(/(?=\[)/).filter(item => item.trim() !== '');
    lines.push(...items);
  });

  console.log('🔍 파싱할 라인 수:', lines.length);
  console.log('🔍 각 라인:', lines);

  const notes: NoteData[] = [];
  const connections: ConnectionData[] = [];
  const noteContentToIdMap = new Map<string, string>();
  const noteIdToNote = new Map<string, NoteData>();
  const pendingConnections: string[] = [];
  let accumulatingConnection = '';

  // Step 2: 메타데이터 제거 후 노드 파싱 (content가 greedy)
  const nodeRegex = /^\[(?<type>[^\]]+)\]\s*\((?<sentiment>[^)]+)\)\s*(?<content>.+)$/i;

  // 1차: 모든 노드를 생성 (위치 계산은 나중에)
  lines.forEach((line, index) => {
    console.log(`🔍 라인 ${index + 1}: "${line}"`);

    // 연결선 시작 감지
    if (line.startsWith('[연결]') || line.startsWith('[간접연결]')) {
      console.log(`🔍 연결선 시작: ${line}`);
      // 이전에 누적된 연결선이 있으면 저장
      if (accumulatingConnection) {
        pendingConnections.push(accumulatingConnection);
        console.log(`🔍 이전 연결선 저장: ${accumulatingConnection}`);
      }
      // 새 연결선 시작 (공백으로 이어붙일 준비)
      accumulatingConnection = line.trim();
      return;
    }

    // 연결선 누적 중인 경우
    if (accumulatingConnection) {
      accumulatingConnection += ' ' + line.trim();
      console.log(`🔍 연결선 누적 중: ${accumulatingConnection}`);

      // 연결선 완성 조건: (직접) 또는 (간접) 또는 끝에 ]로 끝나는 경우
      if (line.includes('(직접)') || line.includes('(간접)') || line.trim().endsWith(']')) {
        pendingConnections.push(accumulatingConnection);
        console.log(`🔍 연결선 완성: ${accumulatingConnection}`);
        accumulatingConnection = '';
      }
      return;
    }

    // 2단계 파싱: 메타데이터 먼저 추출
    const trimmedLine = line.trimEnd();
    const { lineWithoutMetadata, metadataParts } = extractTrailingMetadataSegments(trimmedLine);
    const combinedMetadataInner = metadataParts.join(', ');
    const normalizedMetadata = combinedMetadataInner
      ? normalizeMetadataBasis(combinedMetadataInner)
      : null;
    const fallbackMetadata = combinedMetadataInner || undefined;

    console.log(`🔍 메타데이터 추출:`, metadataParts);
    console.log(`🔍 메타데이터 제거 후:`, lineWithoutMetadata);

    const nodeMatch = lineWithoutMetadata.match(nodeRegex);
    console.log(`🔍 정규식 매치 결과:`, nodeMatch);

    if (nodeMatch?.groups) {
      const { type, sentiment, content } = nodeMatch.groups;

      // 인식 강도 추출
      const perceptionIntensity = extractPerceptionIntensity(type);

      // 인식 강도 suffix 제거 후 레이어 인덱스 찾기
      const normalizedType = normalizeType(type);
      const layerIndex = layerNameToIndex[normalizedType];
      const trimmedContent = content.trim();

      // 메타데이터 파싱 (문자열로 저장)
      const basis: string | undefined = normalizedMetadata ?? fallbackMetadata;

      if (layerIndex === undefined || !trimmedContent) {
        console.log(
          `🔍 노드 생성 실패 - layerIndex: ${layerIndex}, trimmedContent: "${trimmedContent}"`
        );
        return;
      }

      console.log(`🔍 노드 생성 성공 - 타입: ${normalizedType}, 내용: ${trimmedContent}`);

      let sentimentValue: 'positive' | 'negative' | 'neutral' = 'neutral';
      if (sentiment?.includes('긍정')) {
        sentimentValue = 'positive';
      } else if (sentiment?.includes('부정')) {
        sentimentValue = 'negative';
      }

      const newNote: NoteData = {
        id: uuidv4(),
        text: trimmedContent,
        position: { x: 0, y: 0 }, // 임시 위치 - 아래에서 계산됨
        width: 200,
        height: 120,
        type: normalizedType as NoteType, // 타입 단언
        sentiment: sentimentValue,
        perceptionIntensity: perceptionIntensity, // 인식 강도 필드 추가
        basis: basis, // 이론적 근거 필드 추가
        layer: (layerIndex + 1) as 1 | 2 | 3 | 4,
      };

  notes.push(newNote);
  noteContentToIdMap.set(trimmedContent, newNote.id);
  noteIdToNote.set(newNote.id, newNote);
    } else {
      // 파싱 실패 케이스 - 상세 로깅
      if (process.env.NODE_ENV === 'development') {
        const openBrackets = (line.match(/\[/g) || []).length;
        const closeBrackets = (line.match(/\]/g) || []).length;
        const openParens = (line.match(/\(/g) || []).length;
        const closeParens = (line.match(/\)/g) || []).length;
        const hasMetadata =
          line.includes('저자:') || line.includes('이론:') || line.includes('연도:');

        console.warn(`❌ [파싱 실패] 라인 ${index + 1}:`, {
          line: line,
          length: line.length,
          brackets: { open: openBrackets, close: closeBrackets },
          parenthesis: { open: openParens, close: closeParens },
          hasMetadata: hasMetadata,
          startsWithConnection: line.startsWith('[연결]') || line.startsWith('[간접연결]'),
          lineWithoutMetadata: lineWithoutMetadata,
        });
      } else {
        console.warn(`파싱 실패: 라인 ${index + 1}`);
      }
    }
  });

  // 루프 종료 후 마지막 누적된 연결선 처리
  if (accumulatingConnection) {
    pendingConnections.push(accumulatingConnection);
    console.log(`🔍 마지막 연결선 저장: ${accumulatingConnection}`);
  }

  console.log(`🔍 최종 결과 - 생성된 노트 수: ${notes.length}`);
  console.log(`🔍 최종 결과 - 연결선 대기 수: ${pendingConnections.length}`);

  // 2차: 층위별로 위치 계산 🔧 FIX: 결과가 최상층, 무형_레버가 최하층
  const layerTops: { [key: string]: number } = {
    결과: 150, // Layer 1 - 제일 위 (가시적 요소)
    행동: 150 + 150 + 150, // Layer 2 - 관찰 행동
    유형_레버: 150 + 2 * (150 + 150), // Layer 3 - 규범/가치
    무형_레버: 150 + 3 * (150 + 150), // Layer 4 - 제일 아래 (기본 가정)
  };

  const nodesByLayer: { [key: string]: NoteData[] } = {
    결과: [],
    행동: [],
    유형_레버: [],
    무형_레버: [],
  };

  // 층위별로 노트 분류
  notes.forEach(note => {
    const layerType = note.type as keyof typeof nodesByLayer;
    if (layerType in nodesByLayer) {
      nodesByLayer[layerType].push(note);
    } else {
      nodesByLayer['행동'].push(note); // 기본값
    }
  });

  // 각 층위별로 위치 계산
  Object.keys(nodesByLayer).forEach(layer => {
    const layerNodes = nodesByLayer[layer];
    const startX = 100;

    layerNodes.forEach((node, index) => {
      node.position = {
        x: startX + index * (250 + 100), // 250px 간격 + 100px 패딩
        y: layerTops[layer] || layerTops['행동'],
      };
    });
  });

  // 3차: 모든 연결선을 생성합니다.
  pendingConnections.forEach(line => {
    // 정규식 개선: 레가시 형식 (:: 실선/점선) 지원
    // 레가시: [무형_레버_언급] '사람 중심' (유지 및 강화) → [유형_레버_언급] 리더 (유지 및 강화) :: 실선
    // 신규: [간접연결] [무형_레버] (긍정) 내용 (저자: XXX) → [유형_레버] (긍정) 내용 (직접)

    // 🔧 FIX: greedy 매칭으로 변경 ([^→]+ 사용)
    // 작은따옴표, 괄호 등 모든 문자를 → 전까지 매칭
    const legacyRegex =
      /\[(?<sourceType>[^\]]+)\]\s*(?<sourceContent>[^→]+)\s*\((?<sourceSentiment>[^)]+)\)\s*→\s*\[(?<targetType>[^\]]+)\]\s*(?<targetContent>[^:]+)\s*\((?<targetSentiment>[^)]+)\)\s*::\s*(?<relationType>실선|점선)/;
    const modernRegex =
      /\[(간접)?연결\]\s*\[(?<sourceType>[^\]]+)\]\s*\((?<sourceSentiment>[^)]+)\)\s*(?<sourceContent>.+?)(?:\s*\((?:저자|이론|연도):.*?\))?\s*→\s*\[(?<targetType>[^\]]+)\]\s*\((?<targetSentiment>[^)]+)\)\s*(?<targetContent>.+?)(?:\s*\((?:저자|이론|연도):.*?\))?\s*(?:\((?<relationType>직접|간접)\))?$/;

    const connectionMatch = line.match(legacyRegex) || line.match(modernRegex);

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

      // 정확한 매칭 시도
      let sourceId = noteContentToIdMap.get(cleanSourceContent);
      let targetId = noteContentToIdMap.get(cleanTargetContent);

      // 정확한 매칭 실패 시, 부분 매칭 시도 (괄호 포함 노드 매칭)
      if (!sourceId) {
        for (const [content, id] of noteContentToIdMap.entries()) {
          if (content.startsWith(cleanSourceContent) || cleanSourceContent.startsWith(content)) {
            sourceId = id;
            break;
          }
        }
      }

      if (!targetId) {
        for (const [content, id] of noteContentToIdMap.entries()) {
          if (content.startsWith(cleanTargetContent) || cleanTargetContent.startsWith(content)) {
            targetId = id;
            break;
          }
        }
      }

      if (sourceId && targetId) {
        const sourceNote = noteIdToNote.get(sourceId);
        const targetNote = noteIdToNote.get(targetId);

        let resolvedSourceId = sourceId;
        let resolvedTargetId = targetId;

        if (sourceNote && targetNote) {
          const sourceLayer = sourceNote.layer ?? 0;
          const targetLayer = targetNote.layer ?? 0;

          if (sourceLayer < targetLayer) {
            resolvedSourceId = targetId;
            resolvedTargetId = sourceId;
          }
        }

        // 레가시 형식: 실선=direct, 점선=indirect
        // 신규 형식: [간접연결] or (간접)
        let relationType = 'direct';
        if (isIndirectPrefix || relationTypeSuffix === '간접' || relationTypeSuffix === '점선') {
          relationType = 'indirect';
        }

        // 층위 간 연결은 항상 아래층(숫자 큰 layer)에서 위층으로 향하도록 강제한다
        const newConnection: ConnectionData = {
          id: uuidv4(),
          sourceId: resolvedSourceId,
          targetId: resolvedTargetId,
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

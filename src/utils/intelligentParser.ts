import type { ReportElement, InlineElement, ListItem } from '../types/report';

// 인라인 스타일 (굵은 글씨 등)을 파싱하는 헬퍼 함수
const parseInline = (text: string): InlineElement[] => {
  const elements: InlineElement[] = [];
  // 정규식을 사용하여 **...** 패턴을 찾음
  const regex = /(\*\*.+?\*\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // **...** 앞의 일반 텍스트
    if (match.index > lastIndex) {
      elements.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    // **...** 부분 (굵은 글씨)
    elements.push({ type: 'bold', content: match[1].slice(2, -2) });
    lastIndex = regex.lastIndex;
  }

  // 마지막 **...** 뒤의 남은 일반 텍스트
  if (lastIndex < text.length) {
    elements.push({ type: 'text', content: text.substring(lastIndex) });
  }

  return elements.length > 0 ? elements : [{ type: 'text', content: text }];
};

// 메인 파서 함수
export const parseIntelligent = (text: string): ReportElement[] => {
  const elements: ReportElement[] = [];

  // 1. 전처리: LLM 특화 노이즈 제거
  let processedText = text.replace(/\(노드: [a-fA-F0-9]+\)/g, ''); // Grok (노드: ...) 제거
  processedText = processedText.replace(/\\([*`])/g, '$1'); // 이스케이프 문자 처리

  const lines = processedText.split('\n');
  let i = 0;

  while (i < lines.length) {
    // 현재 줄과 다음 줄(미리보기용)
    const line = lines[i]?.trim() ?? '';

    // 빈 줄은 무시하고 다음 줄로
    if (!line) {
      i++;
      continue;
    }

    // 헤더 (h1-h4)
    if (line.startsWith('#')) {
      if (line.startsWith('#### ')) {
        elements.push({ type: 'heading', level: 4, content: line.substring(5).trim() });
      } else if (line.startsWith('### ')) {
        elements.push({ type: 'heading', level: 3, content: line.substring(4).trim() });
      } else if (line.startsWith('## ')) {
        elements.push({ type: 'heading', level: 2, content: line.substring(3).trim() });
      } else if (line.startsWith('# ')) {
        elements.push({ type: 'heading', level: 1, content: line.substring(2).trim() });
      }
      i++;
      continue;
    }

    // 구분선
    if (line.match(/^(-{3,}|\*{3,})$/)) {
      elements.push({ type: 'thematicBreak' });
      i++;
      continue;
    }

    // 목록 (순서 있/없음, 화살표)
    const unorderedMatch = line.match(/^([-*]|->)\s+(.*)/);
    const orderedMatch = line.match(/^(\d+)\.\s+(.*)/);

    if (unorderedMatch || orderedMatch) {
      const listItems: ListItem[] = [];
      const listType = orderedMatch ? 'ordered' : 'unordered';

      // 목록이 끝날 때까지 라인 순회
      while (i < lines.length) {
        const currentLine = lines[i]?.trim();
        if (!currentLine) {
          // 목록 중간의 빈 줄은 목록의 끝으로 간주
          break;
        }

        const currentUnordered = currentLine.match(/^([-*]|->)\s+(.*)/);
        const currentOrdered = currentLine.match(/^(\d+)\.\s+(.*)/);

        const isUnorderedItem = listType === 'unordered' && currentUnordered;
        const isOrderedItem = listType === 'ordered' && currentOrdered;

        if (isUnorderedItem || isOrderedItem) {
          const content = (isUnorderedItem ? currentUnordered[2] : currentOrdered![2]) ?? '';
          listItems.push({ type: 'listItem', content: parseInline(content) });
          i++;
        } else {
          break; // 현재 목록 타입과 맞지 않으면 중단
        }
      }

      elements.push({ type: 'list', ordered: listType === 'ordered', items: listItems });
      continue; // 목록 처리가 끝났으므로 while 루프의 처음으로 돌아감
    }

    // 위 규칙에 해당하지 않으면 일반 문단
    elements.push({ type: 'paragraph', content: parseInline(line) });
    i++;
  }

  return elements;
};

import type { NoteData, ConnectionData } from '../types';

interface LayoutedElements {
  nodes: NoteData[];
  connections: ConnectionData[];
}

const PADDING_X = 100;
const PADDING_Y = 150;
const AVG_NOTE_WIDTH = 250;
const AVG_NOTE_HEIGHT = 150;

export const getLayoutedElements = (
  notes: NoteData[],
  connections: ConnectionData[]
): LayoutedElements => {
  const layerTops: { [key: string]: number } = {
    결과: PADDING_Y,
    행동: PADDING_Y + AVG_NOTE_HEIGHT + PADDING_Y,
    유형_레버: PADDING_Y + 2 * (AVG_NOTE_HEIGHT + PADDING_Y),
    무형_레버: PADDING_Y + 3 * (AVG_NOTE_HEIGHT + PADDING_Y),
  };

  const nodesByLayer: { [key: string]: NoteData[] } = {
    결과: [],
    행동: [],
    유형_레버: [],
    무형_레버: [],
  };

  notes.forEach(note => {
    const layerType = note.type as keyof typeof nodesByLayer;
    if (layerType in nodesByLayer) {
      nodesByLayer[layerType].push(note);
    } else {
      console.warn(
        `[Layout] Unknown note type "${note.type}" found for note "${note.text}". Assigning to '행동' by default.`
      );
      nodesByLayer['행동'].push(note);
    }
  });

  const layoutedNodes: NoteData[] = [];

  Object.keys(nodesByLayer).forEach(layer => {
    const layerNodes = nodesByLayer[layer];
    // const totalWidth = layerNodes.length * (AVG_NOTE_WIDTH + PADDING_X) - PADDING_X; // 중앙 정렬에 사용되었으나 현재는 불필요
    const startX = PADDING_X; // 중앙 정렬(-totalWidth / 2) 대신 왼쪽 여백을 기준으로 시작

    layerNodes.forEach((node, index) => {
      layoutedNodes.push({
        ...node,
        position: {
          x: startX + index * (AVG_NOTE_WIDTH + PADDING_X),
          y: layerTops[layer] || layerTops['행동'],
        },
      });
    });
  });

  return { nodes: layoutedNodes, connections };
};

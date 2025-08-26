// src/components/ConnectionsLayer.tsx
import { useState, useEffect } from 'react';
import type { MouseEvent } from 'react';
import type { ConnectionData } from '../App';
import type { NoteData } from './StickyNote';
import EditingIndicator from './EditingIndicator';

interface ConnectionsLayerProps {
  connections: ConnectionData[];
  notes: NoteData[];
  onConnectionContextMenu: (e: MouseEvent, connectionId: string) => void;
  onUpdateConnection: (id: string, newType: 'direct' | 'indirect') => void;
  onDeleteConnection: (id: string) => void;
  editingItems?: { [itemId: string]: { userId: string; itemType: string } };
}

interface Point {
  x: number;
  y: number;
}

interface LineCoord {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  relationType: 'direct' | 'indirect';
}

const ConnectionsLayer = ({
  connections,
  notes,
  onConnectionContextMenu,
  editingItems = {},
}: ConnectionsLayerProps) => {
  const [lineCoords, setLineCoords] = useState<LineCoord[]>([]);

  useEffect(() => {
    const notesById = new Map(notes.map(note => [note.id, note]));

    const getNoteCenter = (note: NoteData): Point => {
      const noteElement = document.getElementById(note.id);
      if (!noteElement) {
        // 요소가 아직 DOM에 없으면 prop의 위치를 우선 사용
        return { x: note.position.x + 100, y: note.position.y + 60 };
      }
      return {
        x: note.position.x + noteElement.offsetWidth / 2,
        y: note.position.y + noteElement.offsetHeight / 2,
      };
    };

    const newCoords = connections
      .map(conn => {
        const sourceNote = notesById.get(conn.sourceId);
        const targetNote = notesById.get(conn.targetId);

        if (!sourceNote || !targetNote) return null;

        const sourceCenter = getNoteCenter(sourceNote);
        const targetCenter = getNoteCenter(targetNote);

        let stroke = 'var(--color-connection-neutral)'; // 기본 검정
        if (sourceNote.sentiment === 'positive' && targetNote.sentiment === 'positive') {
          stroke = 'var(--color-connection-positive)';
        } else if (sourceNote.sentiment === 'negative' && targetNote.sentiment === 'negative') {
          stroke = 'var(--color-connection-negative)';
        }

        return {
          id: conn.id,
          x1: sourceCenter.x,
          y1: sourceCenter.y,
          x2: targetCenter.x,
          y2: targetCenter.y,
          stroke: stroke,
          relationType: conn.relationType,
        };
      })
      .filter((c): c is LineCoord => c !== null);

    setLineCoords(newCoords);
  }, [connections, notes]);

  return (
    <svg
      className="connections-svg"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}
    >
      {lineCoords.map(coords => {
        const isBeingEdited = editingItems[coords.id]?.itemType === 'connection';
        const midX = (coords.x1 + coords.x2) / 2;
        const midY = (coords.y1 + coords.y2) / 2;

        return (
          <g key={coords.id}>
            {/* 보이는 선 */}
            <line
              x1={coords.x1}
              y1={coords.y1}
              x2={coords.x2}
              y2={coords.y2}
              stroke={coords.stroke}
              strokeWidth="2"
              strokeDasharray={coords.relationType === 'direct' ? 'none' : '6, 4'}
              style={{ pointerEvents: 'none' }}
            />
            {/* 클릭을 위한 투명한 선 (더 두꺼움) */}
            <line
              x1={coords.x1}
              y1={coords.y1}
              x2={coords.x2}
              y2={coords.y2}
              stroke="transparent"
              strokeWidth="12"
              style={{ cursor: 'context-menu', pointerEvents: 'auto' }}
              onContextMenu={e => onConnectionContextMenu(e, coords.id)}
            />
            {/* 편집 중 표시기 */}
            {isBeingEdited && (
              <foreignObject x={midX - 9} y={midY - 9} width="18" height="18">
                <EditingIndicator isVisible={true} className="connection" />
              </foreignObject>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default ConnectionsLayer;

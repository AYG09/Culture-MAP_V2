// src/components/CultureMapCanvas.tsx
import type { RefObject, MouseEvent } from 'react';
import ConnectionsLayer from './ConnectionsLayer';
import EnhancedStickyNote from './EnhancedStickyNote';
import LayerBoundaryGuide from './LayerBoundaryGuide';
import type { LayerSystemState, LayerVisualizationOptions, LayerIndex } from '../types/layerSystem';
import type { NoteData, ConnectionData } from '../types/culture';

interface CultureMapCanvasProps {
  notes: NoteData[];
  connections: ConnectionData[];
  boardTransform: { x: number; y: number };
  selection: { startX: number; startY: number; endX: number; endY: number } | null;
  connectingNoteId: string | null;
  selectedNoteIds: Set<string>;
  editingNoteId: string | null;
  draggingNoteId?: string | null;
  editingItems?: { [itemId: string]: { userId: string; itemType: string } };

  layerState: LayerSystemState;
  visualizationOptions: LayerVisualizationOptions;
  highlightedLayers: LayerIndex[];

  boardRef: RefObject<HTMLDivElement | null>;

  handleMouseDownOnBoard: (e: MouseEvent<HTMLDivElement>) => void;
  handleBoardContextMenu: (e: MouseEvent<HTMLDivElement>) => void;
  handleUpdateConnection: (id: string, newType: 'direct' | 'indirect') => void;
  handleDeleteConnection: (id: string) => void;
  handleConnectionContextMenu: (e: MouseEvent, connectionId: string) => void;
  handleMouseDownOnNote: (noteId: string, e: MouseEvent<HTMLDivElement>) => void;
  handleMouseDownOnResizeHandle: (noteId: string, e: MouseEvent<HTMLDivElement>) => void;
  handleNoteClick: (targetNoteId: string) => void;
  handleUpdateNote: (noteId: string, updates: Partial<NoteData>) => void;
  handleNoteContextMenu: (e: MouseEvent, noteId: string) => void;
  handleMouseDownOnLayerResizeHandle: (layerIndex: number, e: MouseEvent) => void;
  onStartEdit?: (noteId: string) => void;
  onEditComplete?: (noteId: string) => void;
}

export const CultureMapCanvas = ({
  notes,
  connections,
  boardTransform,
  selection,
  connectingNoteId,
  selectedNoteIds,
  editingNoteId,
  draggingNoteId,
  editingItems = {},
  layerState,
  visualizationOptions,
  highlightedLayers,
  boardRef,
  handleMouseDownOnBoard,
  handleBoardContextMenu,
  handleUpdateConnection,
  handleDeleteConnection,
  handleConnectionContextMenu,
  handleMouseDownOnNote,
  handleMouseDownOnResizeHandle,
  handleNoteClick,
  handleUpdateNote,
  handleNoteContextMenu,
  handleMouseDownOnLayerResizeHandle,
  onStartEdit,
  onEditComplete,
}: CultureMapCanvasProps) => {
  const boardHeight =
    layerState.boundaries.reduce((total, b) => total + b.height, 0) +
    layerState.boundaries.length * layerState.layerGap;

  return (
    <div
      ref={boardRef}
      id="enhanced-notes-board"
      className="notes-board enhanced"
      onMouseDown={handleMouseDownOnBoard}
      onContextMenu={handleBoardContextMenu}
      style={{
        transform: `translate(${boardTransform.x}px, ${boardTransform.y}px)`,
        width: '5000px',
        height: `${Math.max(2000, boardHeight)}px`,
      }}
    >
      <LayerBoundaryGuide
        layerState={layerState}
        visualizationOptions={visualizationOptions}
        containerWidth={5000}
        highlightedLayers={highlightedLayers}
        onMouseDownOnResizeHandle={handleMouseDownOnLayerResizeHandle}
      />

      {selection && (
        <div
          className="selection-box"
          style={{
            left: Math.min(selection.startX, selection.endX),
            top: Math.min(selection.startY, selection.endY),
            width: Math.abs(selection.startX - selection.endX),
            height: Math.abs(selection.startY - selection.endY),
          }}
        />
      )}

      <ConnectionsLayer
        connections={connections}
        notes={notes}
        onUpdateConnection={handleUpdateConnection}
        onDeleteConnection={handleDeleteConnection}
        onConnectionContextMenu={handleConnectionContextMenu}
        editingItems={editingItems}
      />

      {notes.map(note => (
        <EnhancedStickyNote
          key={note.id}
          note={note}
          onMouseDown={e => handleMouseDownOnNote(note.id, e)}
          onResizeStart={e => handleMouseDownOnResizeHandle(note.id, e)}
          onClick={handleNoteClick}
          onStartEdit={onStartEdit}
          onUpdate={handleUpdateNote}
          onContextMenu={e => handleNoteContextMenu(e, note.id)}
          onEditComplete={onEditComplete}
          isConnecting={connectingNoteId === note.id}
          isSelected={selectedNoteIds.has(note.id)}
          isEditing={editingNoteId === note.id}
          connectingNoteId={connectingNoteId}
          isDragging={draggingNoteId === note.id}
          isBeingEdited={editingItems[note.id]?.itemType === 'note'}
          animateTransitions={visualizationOptions.animateTransitions}
        />
      ))}
    </div>
  );
};

export default CultureMapCanvas;

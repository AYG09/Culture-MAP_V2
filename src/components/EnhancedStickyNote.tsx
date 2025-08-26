// src/components/EnhancedStickyNote.tsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { MouseEvent } from 'react';
import type { NoteData, PerceptionIntensity, NoteType } from '../types/culture';
import EditingIndicator from './EditingIndicator';

interface EnhancedStickyNoteProps {
  note: NoteData;
  onMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
  onResizeStart: (e: MouseEvent<HTMLDivElement>) => void;
  onUpdate: (noteId: string, updates: Partial<NoteData>) => void;
  onContextMenu: (e: MouseEvent, noteId: string) => void;
  onClick: (noteId: string) => void;
  onEditComplete?: (noteId: string) => void;

  isSelected: boolean;
  isEditing: boolean;
  isConnecting: boolean;
  connectingNoteId: string | null;
  isDragging?: boolean;
  isBeingEdited?: boolean; // 다른 사용자가 편집 중인지

  animateTransitions?: boolean;
}

const TypeTag: React.FC<{ type: NoteType }> = ({ type }) => {
  const typeStyleMap: { [key: string]: { label: string; style: React.CSSProperties } } = {
    결과: { label: '결과', style: { backgroundColor: '#F3E8FF', color: '#581C87' } },
    행동: { label: '행동', style: { backgroundColor: '#DBEAFE', color: '#1E40AF' } },
    유형_레버: { label: '유형', style: { backgroundColor: '#D1FAE5', color: '#065F46' } },
    무형_레버: { label: '무형', style: { backgroundColor: '#DBEAFE', color: '#1E40AF' } },
    insight: { label: '인사이트', style: { backgroundColor: '#E0E7FF', color: '#3730A3' } },
    default: { label: '기타', style: { backgroundColor: '#E5E7EB', color: '#1F2937' } },
  };

  const { label, style } = typeStyleMap[type] || typeStyleMap['default'];

  return (
    <div className="tag type-tag" style={style}>
      {label}
    </div>
  );
};

const PerceptionTag: React.FC<{ intensity: PerceptionIntensity }> = ({ intensity }) => {
  const perceptionStyles: Record<PerceptionIntensity, React.CSSProperties> = {
    집중: { backgroundColor: '#FECACA', color: '#991B1B' }, // red-200, red-800
    관심: { backgroundColor: '#FDE68A', color: '#92400E' }, // amber-200, amber-800
    언급: { backgroundColor: '#E5E7EB', color: '#1F2937' }, // gray-200, gray-800
  };

  return (
    <div className="tag perception-tag" style={perceptionStyles[intensity]}>
      {intensity}
    </div>
  );
};

export const EnhancedStickyNote: React.FC<EnhancedStickyNoteProps> = ({
  note,
  onMouseDown,
  onResizeStart,
  onUpdate,
  onContextMenu,
  onClick,
  onEditComplete,
  isSelected,
  isEditing,
  isConnecting,
  connectingNoteId,
  isDragging = false,
  isBeingEdited = false,
  animateTransitions = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [editContent, setEditContent] = useState(note.text || '');

  const getSentimentBorderStyle = useCallback(() => {
    const sentimentStyles: Record<string, React.CSSProperties> = {
      positive: { borderColor: '#3B82F6' }, // blue-500
      negative: { borderColor: '#EF4444' }, // red-500
      neutral: { borderColor: '#A1A1AA' }, // zinc-400
    };
    return sentimentStyles[note.sentiment] || sentimentStyles.neutral;
  }, [note.sentiment]);

  // 실시간 동기화는 비활성화됨 - 수동 저장만 사용

  const handleEditComplete = useCallback(() => {
    console.log(`💾 [EnhancedStickyNote ${note.id}] Edit complete - saving changes`);
    if (contentRef.current) {
      const newContent = contentRef.current.value;
      console.log(`📤 [EnhancedStickyNote ${note.id}] Sending final update:`, {
        oldText: note.text,
        newText: newContent,
      });
      onUpdate(note.id, { text: newContent, content: newContent });
    } else {
      onUpdate(note.id, {});
    }

    // 편집 완료 알림
    if (onEditComplete) {
      console.log(`🔚 [EnhancedStickyNote ${note.id}] Calling onEditComplete`);
      onEditComplete(note.id);
    }
  }, [note.id, note.text, onUpdate, onEditComplete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleEditComplete();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onUpdate(note.id, {});
      }
    },
    [handleEditComplete, onUpdate, note.id]
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      console.log(`🖱️ [EnhancedStickyNote ${note.id}] handleMouseDown:`, { isEditing });
      e.stopPropagation(); // 이벤트 전파를 막아 보드 핸들러 방지
      if (isEditing) {
        console.log(`🚫 [EnhancedStickyNote ${note.id}] Blocking mousedown in edit mode`);
        return;
      }
      // 드래그 시작 시 커서 즉시 변경
      if (e.currentTarget) {
        e.currentTarget.style.cursor = 'grabbing';
      }
      onMouseDown(e);
    },
    [isEditing, onMouseDown, note.id]
  );

  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.stopPropagation(); // 클릭 이벤트 전파도 막습니다.
      onClick(note.id);
    },
    [note.id, onClick]
  );

  const sentimentBorderStyle = getSentimentBorderStyle();

  // 편집 모드 변경 모니터링
  useEffect(() => {
    console.log(`🔄 [EnhancedStickyNote ${note.id}] Editing mode changed:`, {
      isEditing,
      noteText: note.text,
      editContent,
      hasContentRef: !!contentRef.current,
    });

    if (isEditing) {
      console.log(`▶️ [EnhancedStickyNote ${note.id}] Starting edit mode`);
      setEditContent(note.text || '');

      // 약간의 딜레이 후 포커스 (DOM 업데이트 대기)
      setTimeout(() => {
        if (contentRef.current) {
          console.log(`🎯 [EnhancedStickyNote ${note.id}] Setting focus to textarea`);
          contentRef.current.focus();
          contentRef.current.select();
        } else {
          console.log(`❌ [EnhancedStickyNote ${note.id}] contentRef is null - cannot focus`);
        }
      }, 50);
    } else {
      console.log(`⏸️ [EnhancedStickyNote ${note.id}] Exiting edit mode`);
    }
  }, [isEditing, note.id, note.text, editContent]);

  // 편집 중에는 실시간 동기화 비활성화 - 수동 저장만 사용
  // useEffect(() => {
  //   if (isEditing && editContent !== (note.text || '')) {
  //     console.log(`🔍 [EnhancedStickyNote ${note.id}] Content changed:`, {
  //       editContent,
  //       noteText: note.text,
  //       shouldUpdate: editContent !== (note.text || '')
  //     });
  //     debouncedUpdate(editContent);
  //   }

  //   // cleanup
  //   return () => {
  //     if (debounceTimerRef.current) {
  //       clearTimeout(debounceTimerRef.current);
  //     }
  //   };
  // }, [editContent, isEditing, note.text, debouncedUpdate]);

  const noteStyle: React.CSSProperties = {
    position: 'absolute',
    left: note.position.x,
    top: note.position.y,
    width: note.width || 200,
    height: note.height || 'auto', // 자동 높이
    minHeight: 120,
    backgroundColor: 'white',
    borderStyle: 'solid',
    borderWidth: '3px',
    borderRadius: '12px',
    padding: '12px',
    cursor: isEditing ? 'text' : 'grab',
    zIndex: isSelected || isDragging ? 1000 : note.layer,
    transition:
      animateTransitions && !isSelected && !isDragging
        ? 'box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out'
        : 'none',
    boxShadow: isSelected
      ? '0 6px 18px rgba(0, 0, 0, 0.3)'
      : isHovered
        ? '0 3px 10px rgba(0, 0, 0, 0.2)'
        : '0 1px 4px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    willChange: isSelected || isDragging ? 'transform' : 'auto',
    ...sentimentBorderStyle,
  };

  return (
    <div
      id={note.id}
      className={`enhanced-sticky-note ${isSelected ? 'selected' : ''} ${isConnecting ? 'connecting' : ''} ${isDragging ? 'is-dragging' : ''}`}
      style={noteStyle}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={e => onContextMenu(e, note.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="note-header">
        <TypeTag type={note.type} />
        {note.perceptionIntensity && <PerceptionTag intensity={note.perceptionIntensity} />}
      </div>

      {/* 다른 사용자 편집 중 표시기 */}
      <EditingIndicator isVisible={isBeingEdited && !isEditing} className="sticky-note" />

      <div className="note-content">
        {isEditing ? (
          <div>
            <div style={{ fontSize: '10px', color: 'red' }}>편집 모드 활성화됨</div>
            <textarea
              ref={contentRef}
              value={editContent}
              onChange={e => {
                console.log(`📝 [EnhancedStickyNote ${note.id}] onChange:`, {
                  oldValue: editContent,
                  newValue: e.target.value,
                });
                setEditContent(e.target.value);
              }}
              onFocus={() => console.log(`🎯 [EnhancedStickyNote ${note.id}] textarea focused`)}
              onBlur={() => {
                console.log(`👋 [EnhancedStickyNote ${note.id}] textarea blurred`);
                handleEditComplete();
              }}
              onKeyDown={handleKeyDown}
              onMouseDown={e => {
                console.log(`🖱️ [EnhancedStickyNote ${note.id}] textarea mousedown`);
                e.stopPropagation();
              }}
              onClick={e => {
                console.log(`👆 [EnhancedStickyNote ${note.id}] textarea clicked`);
                e.stopPropagation();
              }}
              className="note-textarea"
              style={{
                width: '100%',
                height: '60px',
                resize: 'none',
                border: '2px solid red',
                background: 'yellow',
                zIndex: 9999,
              }}
            />
          </div>
        ) : (
          <>
            <div className="note-text">{note.text}</div>
            {note.basis && (
              <div className="note-basis">
                <div className="note-basis-content">
                  <span>
                    {note.basis.author}, {note.basis.year}
                  </span>
                  <span className="note-basis-theory">&lt;{note.basis.theory}&gt;</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {isConnecting && (
        <div className="connection-indicator">
          <div className="connection-pulse" />
        </div>
      )}

      {connectingNoteId && connectingNoteId !== note.id && (
        <div className="connection-target">Connect</div>
      )}

      {isSelected && !isEditing && (
        <div
          className="resize-handle"
          onMouseDown={onResizeStart}
          style={{
            background: sentimentBorderStyle.borderColor,
          }}
        />
      )}
    </div>
  );
};

export default EnhancedStickyNote;

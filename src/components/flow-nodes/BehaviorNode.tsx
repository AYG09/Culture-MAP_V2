// src/components/flow-nodes/BehaviorNode.tsx
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import type { PerceptionIntensity } from '../../types/culture';
import { FREQUENCY_LABELS } from '../../types/culture';
import EditingIndicator from '../EditingIndicator';
import './FlowNodes.css';

export interface BehaviorNodeData {
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  concept?: string;
  source?: string;
  category?: string;
  frequency?: PerceptionIntensity; // 빈도 추가
  onUpdate: (id: string, content: string) => void;
  onEditStart?: (id: string) => boolean | void;
  onEditEnd?: (id: string) => void;
  isLocked?: boolean;
  lockedBy?: string;
}

const BehaviorNode = ({ id, data, selected }: NodeProps & { data: BehaviorNodeData }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(data.content);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isLockedByOther = Boolean(data.isLocked);

  useEffect(() => {
    if (!isEditing) {
      setContent(data.content);
    }
  }, [data.content, isEditing]);

  useEffect(() => {
    if (isEditing && isLockedByOther) {
      setIsEditing(false);
      data.onEditEnd?.(id);
    }
  }, [data, id, isEditing, isLockedByOther]);

  const handleDoubleClick = useCallback(() => {
    if (isLockedByOther) {
      return;
    }

    const canEdit = data.onEditStart ? data.onEditStart(id) !== false : true;
    if (!canEdit) {
      return;
    }

    setIsEditing(true);
  }, [data, id, isLockedByOther]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (content !== data.content) {
      data.onUpdate(id, content);
    }
    data.onEditEnd?.(id);
  }, [content, data, id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      textareaRef.current?.blur();
    }
    if (e.key === 'Escape') {
      setContent(data.content);
      setIsEditing(false);
      textareaRef.current?.blur();
    }
  }, [data.content]);

  const sentimentColors = {
    positive: '#3b82f6', // 파랑
    negative: '#ef4444', // 빨강
    neutral: '#9ca3af', // 회색
  };

  const sentimentLabels = {
    positive: '긍정',
    negative: '부정',
    neutral: '중립',
  };

  const frequencyColors = {
    high: '#ef4444', // 빨강
    medium: '#f59e0b', // 주황
    low: '#10b981', // 초록
  };

  const getFrequencyLabel = (frequency?: PerceptionIntensity) => {
    if (!frequency) return null;
    return FREQUENCY_LABELS[frequency];
  };

  return (
    <div
      className={`flow-node behavior-node ${data.sentiment} ${selected ? 'selected' : ''} ${isLockedByOther ? 'locked' : ''
        }`}
      onDoubleClick={handleDoubleClick}
      style={{ border: `3px solid ${sentimentColors[data.sentiment]}` }}
      title={
        isLockedByOther
          ? `다른 사용자가 편집 중입니다${data.lockedBy ? ` (${data.lockedBy})` : ''}`
          : undefined
      }
    >
      <NodeResizer
        minWidth={180}
        minHeight={100}
        isVisible={selected}
        lineClassName="node-resizer-line"
        handleClassName="node-resizer-handle"
      />
      <div className="node-header">
        <span className="layer-badge">행동</span>
        <span
          className="sentiment-badge"
          style={{
            backgroundColor: sentimentColors[data.sentiment],
            color: 'white',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            marginLeft: '6px'
          }}
        >
          {sentimentLabels[data.sentiment]}
        </span>
        {data.frequency && (
          <span
            className="frequency-badge"
            style={{ backgroundColor: frequencyColors[data.frequency] }}
          >
            {getFrequencyLabel(data.frequency)}
          </span>
        )}
        {data.concept && <span className="concept-tag">{data.concept}</span>}
      </div>

      <div className="node-body">
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="행동을 입력하세요..."
            autoFocus
            className="node-textarea"
            ref={textareaRef}
            readOnly={isLockedByOther}
          />
        ) : (
          <div className="node-content">{data.content || '빈 노트'}</div>
        )}
      </div>

      {data.source && (
        <div className="node-footer">
          <span className="source-tag">📚 {data.source}</span>
        </div>
      )}

      {/* 연결 핸들 - 행동: 4방향 (source/target 모두 필요) */}
      <Handle
        id="top-source"
        type="source"
        position={Position.Top}
        className="custom-handle"
        isConnectable={true}
      />
      <Handle
        id="top-target"
        type="target"
        position={Position.Top}
        className="custom-handle"
        style={{ left: '40%' }}
        isConnectable={true}
      />
      <Handle
        id="bottom-target"
        type="target"
        position={Position.Bottom}
        className="custom-handle"
        isConnectable={true}
      />
      <Handle
        id="bottom-source"
        type="source"
        position={Position.Bottom}
        className="custom-handle"
        style={{ left: '40%' }}
        isConnectable={true}
      />
      <Handle
        id="left-target"
        type="target"
        position={Position.Left}
        className="custom-handle handle-side"
        isConnectable={true}
      />
      <Handle
        id="left-source"
        type="source"
        position={Position.Left}
        className="custom-handle handle-side"
        style={{ top: '40%' }}
        isConnectable={true}
      />
      <Handle
        id="right-source"
        type="source"
        position={Position.Right}
        className="custom-handle handle-side"
        isConnectable={true}
      />
      <Handle
        id="right-target"
        type="target"
        position={Position.Right}
        className="custom-handle handle-side"
        style={{ top: '40%' }}
        isConnectable={true}
      />

      <EditingIndicator isVisible={isLockedByOther} userLabel={data.lockedBy} className="sticky-note" />
    </div>
  );
};

export default memo(BehaviorNode);

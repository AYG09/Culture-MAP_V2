// src/components/flow-nodes/TangibleLeverNode.tsx
import { memo, useCallback, useEffect, useState } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import type { PerceptionIntensity } from '../../types/culture';
import { FREQUENCY_LABELS } from '../../types/culture';
import './FlowNodes.css';

export interface TangibleLeverNodeData {
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  concept?: string;
  source?: string;
  category?: string;
  basis?: string; // 이론적 근거
  frequency?: PerceptionIntensity; // 빈도 추가
  onUpdate: (id: string, content: string) => void;
  onEdit?: () => void;
}

const TangibleLeverNode = ({ id, data, selected }: NodeProps & { data: TangibleLeverNodeData }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(data.content);

  useEffect(() => {
    if (!isEditing) {
      setContent(data.content);
    }
  }, [data.content, isEditing]);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
    data.onEdit?.();
  }, [data]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (content !== data.content) {
      data.onUpdate(id, content);
    }
  }, [content, data, id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === 'Escape') {
      setContent(data.content);
      setIsEditing(false);
    }
  }, [data.content, handleBlur]);

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

  // 디버깅: 빈도 데이터 확인
  if (data.frequency) {
    console.log('🔍 TangibleLeverNode frequency:', data.frequency, '→', getFrequencyLabel(data.frequency));
  }

  return (
    <div
      className={`flow-node tangible-lever-node ${data.sentiment} ${selected ? 'selected' : ''}`}
      onDoubleClick={handleDoubleClick}
      style={{ border: `3px solid ${sentimentColors[data.sentiment]}` }}
    >
      <NodeResizer
        minWidth={180}
        minHeight={100}
        isVisible={selected}
        lineClassName="node-resizer-line"
        handleClassName="node-resizer-handle"
      />
      <div className="node-header">
        <span className="layer-badge">유형 레버</span>
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
            placeholder="유형 레버를 입력하세요..."
            autoFocus
            className="node-textarea"
          />
        ) : (
          <div className="node-content">{data.content || '빈 노트'}</div>
        )}
      </div>

      {(data.source || data.basis) && (
        <div className="node-footer">
          {data.source && <span className="source-tag">📚 {data.source}</span>}
          {data.basis && <span className="basis-tag">({data.basis})</span>}
        </div>
      )}

      {/* 연결 핸들 - 유형레버 (아래에서 받고, 위로 보냄) */}
      <Handle
        type="source"
        position={Position.Top}
        className="custom-handle"
        isConnectable={true}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        className="custom-handle"
        isConnectable={true}
      />
    </div>
  );
};

export default memo(TangibleLeverNode);

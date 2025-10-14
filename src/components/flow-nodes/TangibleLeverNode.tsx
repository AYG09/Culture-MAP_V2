// src/components/flow-nodes/TangibleLeverNode.tsx
import { memo, useCallback, useEffect, useState } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import './FlowNodes.css';

export interface TangibleLeverNodeData {
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  concept?: string;
  source?: string;
  category?: string;
  basis?: string; // 이론적 근거
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
    positive: '#10b981',
    negative: '#ef4444',
    neutral: '#6b7280',
  };

  return (
    <div
      className={`flow-node tangible-lever-node ${data.sentiment} ${selected ? 'selected' : ''}`}
      onDoubleClick={handleDoubleClick}
    >
      <NodeResizer
        minWidth={180}
        minHeight={100}
        isVisible={selected}
        lineClassName="node-resizer-line"
        handleClassName="node-resizer-handle"
      />
      <div className="node-header" style={{ borderLeftColor: sentimentColors[data.sentiment] }}>
        <span className="layer-badge">유형 레버</span>
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
          {data.basis && <span className="basis-tag">💡 {data.basis}</span>}
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

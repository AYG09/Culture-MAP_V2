// src/components/flow-nodes/ResultNode.tsx
import { memo, useCallback, useState } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import './FlowNodes.css';

export interface ResultNodeData {
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  concept?: string;
  source?: string;
  category?: string;
  onUpdate: (content: string) => void;
  onEdit?: () => void;
}

const ResultNode = ({ data, selected }: NodeProps & { data: ResultNodeData }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(data.content);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
    data.onEdit?.();
  }, [data]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (content !== data.content) {
      data.onUpdate(content);
    }
  }, [content, data]);

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
      className={`flow-node result-node ${data.sentiment} ${selected ? 'selected' : ''}`}
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
        <span className="layer-badge">결과</span>
        {data.concept && <span className="concept-tag">{data.concept}</span>}
      </div>

      <div className="node-body">
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="결과를 입력하세요..."
            autoFocus
            className="node-textarea"
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

      {/* 연결 핸들 - 결과는 최상층이므로 아래에서만 연결을 받음 (target만) */}
      <Handle
        type="target"
        position={Position.Bottom}
        className="custom-handle"
        isConnectable={true}
      />
    </div>
  );
};

export default memo(ResultNode);

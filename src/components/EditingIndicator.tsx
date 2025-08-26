import React from 'react';
import './EditingIndicator.css';

interface EditingIndicatorProps {
  isVisible: boolean;
  userId?: string;
  className?: string;
}

const EditingIndicator: React.FC<EditingIndicatorProps> = ({
  isVisible,
  userId,
  className = '',
}) => {
  if (!isVisible) return null;

  return (
    <div
      className={`editing-indicator ${className}`}
      title={`${userId ? `사용자 ${userId}` : '다른 사용자'}가 편집 중입니다`}
    >
      {/* 공구 아이콘 (wrench/tool icon) */}
      <div className="editing-icon">🔧</div>
      <div className="editing-pulse"></div>
    </div>
  );
};

export default EditingIndicator;

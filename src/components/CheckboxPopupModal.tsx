import React, { useState } from 'react';
import './ModalBase.css';
import './CheckboxPopupModal.css';

export interface CheckboxItem {
  id: string;        // 고유 식별자
  label: string;     // 사용자에게 보이는 레이블
  content: string;   // 실제 복사될 내용
  checked: boolean;  // 기본 선택 상태
}

interface CheckboxPopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: CheckboxItem[];
  originalPrompt: string;
  onCopy: (combinedContent: string) => void;
}

const CheckboxPopupModal: React.FC<CheckboxPopupModalProps> = ({
  isOpen,
  onClose,
  title,
  items,
  originalPrompt,
  onCopy
}) => {
  // State: 체크박스 선택 상태 (Set으로 관리)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(
    new Set(items.filter(item => item.checked).map(item => item.id))
  );
  
  // Handler: 체크박스 토글
  const handleToggle = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  // Handler: 복사하기
  const handleCopy = () => {
    const selectedContents = items
      .filter(item => checkedItems.has(item.id))
      .map(item => item.content)
      .join('\n\n---\n\n');
    
    const combined = selectedContents 
      ? `=== 컨텍스트 ===\n\n${selectedContents}\n\n=== 프롬프트 ===\n\n${originalPrompt}`
      : originalPrompt;
    
    onCopy(combined);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="cm-modal-overlay checkbox-popup-overlay" onClick={onClose}>
      <div className="cm-modal checkbox-popup-modal" onClick={e => e.stopPropagation()}>
        <div className="cm-modal-header checkbox-popup-header">
          <h2 className="cm-modal-title">{title}</h2>
          <button className="cm-modal-close checkbox-popup-close" onClick={onClose}>×</button>
        </div>
        
        <div className="cm-modal-body checkbox-popup-body">
          <p className="description">프롬프트에 포함할 컨텍스트를 선택하세요.</p>
          
          <div className="checkbox-list">
            {items.map(item => (
              <label key={item.id} className="checkbox-option">
                <input
                  type="checkbox"
                  checked={checkedItems.has(item.id)}
                  onChange={() => handleToggle(item.id)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>
        
        <div className="cm-modal-footer checkbox-popup-footer">
          <button className="cancel-btn" onClick={onClose}>취소</button>
          <button className="copy-btn" onClick={handleCopy}>
            📋 복사하기 ({checkedItems.size}개 선택)
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckboxPopupModal;

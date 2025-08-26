// src/components/LayerControlPanel.tsx

import React from 'react';
import type { LayerSystemState, LayerVisualizationOptions } from '../types/layerSystem';

interface LayerControlPanelProps {
  layerState: LayerSystemState;
  visualizationOptions: LayerVisualizationOptions;

  // 액션 핸들러
  onUpdateVisualizationOptions: (options: Partial<LayerVisualizationOptions>) => void;
  onUpdateLayerState: (state: Partial<LayerSystemState>) => void;

  // UI 상태
  isVisible: boolean;
  onToggleVisibility: () => void;
}

export const LayerControlPanel: React.FC<LayerControlPanelProps> = ({
  visualizationOptions,
  onUpdateVisualizationOptions,
  isVisible,
  onToggleVisibility,
}) => {
  /**
   * 설정 탭 렌더링
   */
  const renderSettingsTab = () => (
    <div className="settings-tab">
      <div className="setting-group">
        <h4>시각화 옵션</h4>
        <label className="setting-item">
          <span>층위 경계 표시:</span>
          <input
            type="checkbox"
            checked={visualizationOptions.showLayerBoundaries}
            onChange={e => onUpdateVisualizationOptions({ showLayerBoundaries: e.target.checked })}
          />
        </label>
        <label className="setting-item">
          <span>층위 라벨 표시:</span>
          <input
            type="checkbox"
            checked={visualizationOptions.showLayerLabels}
            onChange={e => onUpdateVisualizationOptions({ showLayerLabels: e.target.checked })}
          />
        </label>
        <label className="setting-item">
          <span>애니메이션 효과:</span>
          <input
            type="checkbox"
            checked={visualizationOptions.animateTransitions}
            onChange={e => onUpdateVisualizationOptions({ animateTransitions: e.target.checked })}
          />
        </label>
        <label className="setting-item">
          <span>층위 불투명도:</span>
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.05"
            value={visualizationOptions.layerOpacity}
            onChange={e =>
              onUpdateVisualizationOptions({ layerOpacity: parseFloat(e.target.value) })
            }
          />
          <span className="range-value">
            {(visualizationOptions.layerOpacity * 100).toFixed(0)}%
          </span>
        </label>
      </div>

      {/* 층위 시스템 슬라이드바 제거됨 - 사용하지 않는 기능 */}
    </div>
  );

  if (!isVisible) {
    return (
      <div className="layer-control-toggle" onClick={onToggleVisibility}>
        <span className="toggle-icon">⚙️</span>
        <span className="toggle-text">보기 설정</span>
      </div>
    );
  }

  return (
    <div className="layer-control-panel">
      <div className="panel-header">
        <h3>⚙️ 보기 설정</h3>
        <button className="close-btn" onClick={onToggleVisibility}>
          ×
        </button>
      </div>

      <div className="panel-content">{renderSettingsTab()}</div>
    </div>
  );
};

export default LayerControlPanel;

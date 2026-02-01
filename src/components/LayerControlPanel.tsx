import { memo } from 'react';
import { Panel } from '@xyflow/react';

type LayerControlPanelProps = {
  isMobile: boolean;
  showLayerControlPanel: boolean;
  showLayerBackground: boolean;
  selectedLayerIndex: number | null;
  layerHeights: number[];
  layerOpacities: number[];
  layerMaxHeight: number;
  onOpenPanel: () => void;
  onClosePanel: () => void;
  onToggleLayerBackground: () => void;
  onSelectLayerIndex: (index: number) => void;
  onChangeLayerHeight: (value: number) => void;
  onChangeLayerOpacity: (value: number) => void;
};

const LayerControlPanel = memo(({
  isMobile,
  showLayerControlPanel,
  showLayerBackground,
  selectedLayerIndex,
  layerHeights,
  layerOpacities,
  layerMaxHeight,
  onOpenPanel,
  onClosePanel,
  onToggleLayerBackground,
  onSelectLayerIndex,
  onChangeLayerHeight,
  onChangeLayerOpacity,
}: LayerControlPanelProps) => {
  return (
    <>
      {!showLayerControlPanel && (
        <Panel
          position="top-center"
          style={{
            backgroundColor: 'transparent',
            padding: 0,
            boxShadow: 'none',
            border: 'none',
          }}
        >
          <button
            onClick={onOpenPanel}
            style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              color: '#666',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
            }}
            title="층위 관리 패널 열기"
          >
            📐 층위 관리
          </button>
        </Panel>
      )}

      {showLayerControlPanel && (
        <Panel
          position="top-center"
          className="layer-control-panel"
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '8px' : '16px',
            alignItems: isMobile ? 'stretch' : 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: isMobile ? '10px' : '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            maxWidth: isMobile ? '90vw' : 'auto',
            maxHeight: isMobile ? '80vh' : 'auto',
            overflowY: isMobile ? 'auto' : 'visible',
          }}
        >
          <button
            onClick={onClosePanel}
            style={{
              padding: '4px 8px',
              backgroundColor: 'transparent',
              color: '#999',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              lineHeight: 1,
              alignSelf: isMobile ? 'flex-end' : 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
              e.currentTarget.style.color = '#666';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#999';
            }}
            title="층위 관리 패널 닫기"
          >
            ✕
          </button>

          {!isMobile && (
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e0e0e0' }} />
          )}

          <button
            onClick={onToggleLayerBackground}
            style={{
              padding: isMobile ? '10px 14px' : '6px 12px',
              backgroundColor: showLayerBackground ? '#4CAF50' : '#f5f5f5',
              color: showLayerBackground ? 'white' : '#666',
              border: 'none',
              borderRadius: '6px',
              fontSize: isMobile ? '13px' : '12px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              width: isMobile ? '100%' : 'auto',
            }}
            title="층위 배경 표시/숨김"
          >
            {showLayerBackground ? '🎨 층위 표시' : '🚫 층위 숨김'}
          </button>

          {!isMobile && (
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e0e0e0' }} />
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: '8px',
              width: isMobile ? '100%' : 'auto',
            }}
          >
            <label
              htmlFor="layer-select"
              style={{ fontSize: '12px', fontWeight: '500', color: '#666', whiteSpace: 'nowrap' }}
            >
              조절할 층위:
            </label>
            <select
              id="layer-select"
              value={selectedLayerIndex ?? 0}
              onChange={(e) => onSelectLayerIndex(Number(e.target.value))}
              style={{
                padding: isMobile ? '10px 12px' : '6px 10px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: isMobile ? '13px' : '12px',
                fontWeight: '500',
                cursor: 'pointer',
                backgroundColor: 'white',
                width: isMobile ? '100%' : 'auto',
              }}
            >
              <option value={0}>📊 결과</option>
              <option value={1}>🎬 행동</option>
              <option value={2}>🔧 유형 레버</option>
              <option value={3}>💡 무형 레버</option>
            </select>
          </div>

          {!isMobile && (
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e0e0e0' }} />
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: '10px',
              width: isMobile ? '100%' : 'auto',
              minWidth: isMobile ? 'auto' : '220px',
            }}
          >
            <label
              htmlFor="layer-height-input"
              style={{ fontSize: '12px', fontWeight: '500', color: '#666', whiteSpace: 'nowrap' }}
            >
              높이:
            </label>
            <input
              type="range"
              id="layer-height-input"
              min="100"
              max={layerMaxHeight}
              step="20"
              value={layerHeights[selectedLayerIndex ?? 0]}
              onChange={(e) => onChangeLayerHeight(Number(e.target.value))}
              style={{ flex: 1, minWidth: isMobile ? 'auto' : '100px', width: isMobile ? '100%' : 'auto' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                min="100"
                max={layerMaxHeight}
                step="20"
                value={layerHeights[selectedLayerIndex ?? 0]}
                onChange={(e) => onChangeLayerHeight(Number(e.target.value))}
                style={{
                  width: '60px',
                  padding: isMobile ? '8px' : '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '12px',
                  textAlign: 'right',
                }}
              />
              <span style={{ fontSize: '11px', color: '#999' }}>px</span>
            </div>
          </div>

          {!isMobile && (
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e0e0e0' }} />
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'stretch' : 'center',
              gap: '10px',
              width: isMobile ? '100%' : 'auto',
              minWidth: isMobile ? 'auto' : '180px',
            }}
          >
            <label
              htmlFor="global-opacity"
              style={{ fontSize: '12px', fontWeight: '500', color: '#666', whiteSpace: 'nowrap' }}
            >
              투명도:
            </label>
            <input
              type="range"
              id="global-opacity"
              min="0"
              max="1"
              step="0.01"
              value={layerOpacities[selectedLayerIndex ?? 0]}
              onChange={(e) => onChangeLayerOpacity(Number(e.target.value))}
              style={{ flex: 1, minWidth: isMobile ? 'auto' : '80px', width: isMobile ? '100%' : 'auto' }}
            />
            <span style={{ fontSize: '11px', color: '#999', minWidth: '35px', textAlign: 'right' }}>
              {Math.round(layerOpacities[selectedLayerIndex ?? 0] * 100)}%
            </span>
          </div>
        </Panel>
      )}
    </>
  );
});

LayerControlPanel.displayName = 'LayerControlPanel';

export default LayerControlPanel;

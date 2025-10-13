// src/components/FlowLayerBackground.tsx
import React from 'react';
import './FlowLayerBackground.css';

interface LayerConfig {
  name: string;
  color: string;
  yStart: number;
  height: number;
}

interface FlowLayerBackgroundProps {
  layerSpacing: number; // 층위 간격 (기본값: 200)
  showBoundaries?: boolean;
  showLabels?: boolean;
  opacity?: number;
}

export const FlowLayerBackground: React.FC<FlowLayerBackgroundProps> = ({
  layerSpacing = 200,
  showBoundaries = true,
  showLabels = true,
  opacity = 0.05,
}) => {
  const layers: LayerConfig[] = [
    {
      name: '결과 (가시적 요소)',
      color: 'rgba(255, 107, 107, OPACITY)',
      yStart: 0,
      height: layerSpacing,
    },
    {
      name: '행동 (관찰 행동)',
      color: 'rgba(78, 205, 196, OPACITY)',
      yStart: layerSpacing,
      height: layerSpacing,
    },
    {
      name: '유형 레버 (규범/가치)',
      color: 'rgba(149, 225, 211, OPACITY)',
      yStart: layerSpacing * 2,
      height: layerSpacing,
    },
    {
      name: '무형 레버 (기본 가정)',
      color: 'rgba(255, 230, 109, OPACITY)',
      yStart: layerSpacing * 3,
      height: layerSpacing,
    },
  ];

  return (
    <div
      className="flow-layer-background"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {layers.map((layer, index) => (
        <React.Fragment key={layer.name}>
          {/* 배경색 */}
          <div
            className="layer-background"
            style={{
              position: 'absolute',
              top: `${layer.yStart}px`,
              left: 0,
              width: '100%',
              height: `${layer.height}px`,
              backgroundColor: layer.color.replace('OPACITY', opacity.toString()),
              transition: 'all 0.3s ease',
            }}
          />

          {/* 레이블 */}
          {showLabels && (
            <div
              className="layer-label"
              style={{
                position: 'absolute',
                top: `${layer.yStart + 10}px`,
                left: '10px',
                padding: '6px 12px',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                color: layer.color.replace('OPACITY', '0.8'),
                border: `2px solid ${layer.color.replace('OPACITY', '0.5')}`,
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                zIndex: 1,
              }}
            >
              {layer.name}
            </div>
          )}

          {/* 경계선 (마지막 층 제외) */}
          {showBoundaries && index < layers.length - 1 && (
            <div
              className="layer-boundary"
              style={{
                position: 'absolute',
                top: `${layer.yStart + layer.height}px`,
                left: 0,
                width: '100%',
                height: '2px',
                background: `linear-gradient(to right, 
                  ${layer.color.replace('OPACITY', '0.3')}, 
                  ${layer.color.replace('OPACITY', '0.1')})`,
                borderTop: `1px dashed ${layer.color.replace('OPACITY', '0.3')}`,
                zIndex: 1,
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default FlowLayerBackground;

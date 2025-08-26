// src/components/LayerBoundaryGuide.tsx

import React from 'react';
import type {
  LayerBoundary,
  LayerSystemState,
  LayerVisualizationOptions,
} from '../types/layerSystem';
import { LAYER_CONFIG } from '../types/layerSystem';

interface LayerBoundaryGuideProps {
  layerState: LayerSystemState;
  visualizationOptions: LayerVisualizationOptions;
  containerWidth: number;
  onMouseDownOnResizeHandle: (layerIndex: number, e: React.MouseEvent<HTMLDivElement>) => void;
  highlightedLayers?: number[];
}

export const LayerBoundaryGuide: React.FC<LayerBoundaryGuideProps> = ({
  layerState,
  visualizationOptions,
  containerWidth,
  onMouseDownOnResizeHandle,
  highlightedLayers = [],
}) => {
  if (!visualizationOptions.showLayerBoundaries) {
    return null;
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, layerIndex: number) => {
    onMouseDownOnResizeHandle(layerIndex, e);
  };

  const renderLayerLabel = (boundary: LayerBoundary) => {
    if (!visualizationOptions.showLayerLabels) return null;

    const config = Object.values(LAYER_CONFIG).find(c => c.index === boundary.layerIndex);
    if (!config) return null;

    const isHighlighted = highlightedLayers.includes(boundary.layerIndex);

    const labelStyle: React.CSSProperties = {
      position: 'absolute',
      top: `${boundary.yMin + 20}px`,
      left: '20px',
      padding: '8px 16px',
      backgroundColor: isHighlighted ? config.color : 'rgba(255, 255, 255, 0.9)',
      color: isHighlighted ? '#FFFFFF' : config.color,
      border: `2px solid ${config.color}`,
      borderRadius: '20px',
      fontSize: '14px',
      fontWeight: 'bold',
      transition: visualizationOptions.animateTransitions ? 'all 0.3s ease' : 'none',
      zIndex: 10,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      pointerEvents: 'none',
    };

    return (
      <div key={`label-${boundary.layerIndex}`} style={labelStyle}>
        {config.label}
      </div>
    );
  };

  const renderBoundary = (boundary: LayerBoundary, isLast: boolean) => {
    if (isLast) return null;

    const lineStyle: React.CSSProperties = {
      position: 'absolute',
      top: `${boundary.yMax}px`,
      left: 0,
      right: 0,
      height: '1px',
      backgroundColor: 'rgba(107, 114, 128, 0.3)',
      pointerEvents: 'none',
      zIndex: 5,
    };

    const handleStyle: React.CSSProperties = {
      position: 'absolute',
      top: `${boundary.yMax}px`,
      left: '10px', // A little padding from the edge
      transform: 'translateY(-50%)',
      zIndex: 25,
      pointerEvents: 'auto', // Make this element interactive
    };

    return (
      <React.Fragment key={`boundary-wrapper-${boundary.layerIndex}`}>
        <div style={lineStyle} />
        <div
          className="layer-resize-handle"
          style={handleStyle}
          onMouseDown={e => handleMouseDown(e, boundary.layerIndex)}
        />
      </React.Fragment>
    );
  };

  const renderLayerBackground = (boundary: LayerBoundary) => {
    const isHighlighted = highlightedLayers.includes(boundary.layerIndex);

    const backgroundStyle: React.CSSProperties = {
      position: 'absolute',
      top: `${boundary.yMin}px`,
      left: 0,
      width: '100%',
      height: `${boundary.height}px`,
      backgroundColor: boundary.color,
      opacity: isHighlighted ? 0.2 : visualizationOptions.layerOpacity,
      transition: visualizationOptions.animateTransitions ? 'all 0.3s ease' : 'none',
      zIndex: 1,
      pointerEvents: 'none',
    };

    return <div key={`background-${boundary.layerIndex}`} style={backgroundStyle} />;
  };

  return (
    <div
      className="layer-boundary-guide"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: containerWidth,
        height: '100%',
        pointerEvents: 'none', // 자식 요소(핸들)만 이벤트 받도록 설정
        zIndex: 2, // 배경보다는 위, 노트보다는 아래
      }}
    >
      {layerState.boundaries.map(renderLayerBackground)}
      {layerState.boundaries.map((boundary, index) =>
        renderBoundary(boundary, index === layerState.boundaries.length - 1)
      )}
      {layerState.boundaries.map(renderLayerLabel)}
    </div>
  );
};

export default LayerBoundaryGuide;

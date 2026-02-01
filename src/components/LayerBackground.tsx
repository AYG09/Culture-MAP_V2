import { memo } from 'react';
import { ViewportPortal } from '@xyflow/react';

type LayerDefinition = {
  name: string;
  color: string;
  gradient?: string;
  index: number;
  description: string;
  examples: string;
};

type LayerBackgroundProps = {
  showLayerBackground: boolean;
  layerDefinitions: LayerDefinition[];
  layerHeights: number[];
  layerOpacities: number[];
  selectedLayerIndex: number | null;
  onLayerLabelClick: (layerIndex: number) => void;
};

const LayerBackground = memo(({
  showLayerBackground,
  layerDefinitions,
  layerHeights,
  layerOpacities,
  selectedLayerIndex,
  onLayerLabelClick,
}: LayerBackgroundProps) => {
  if (!showLayerBackground) return null;

  return (
    <>
      <ViewportPortal>
        <div
          data-layer-background-root="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '10000px',
            height: '10000px',
            pointerEvents: 'none',
            zIndex: -1,
          }}
        >
          {layerDefinitions.map((layer, displayIndex, layers) => {
            let y = 0;
            for (let i = 0; i < displayIndex; i++) {
              const previousLayer = layers[i];
              y += layerHeights[previousLayer.index] ?? 0;
            }

            const getLayerColor = (opacity: number) => layer.color.replace('OPACITY', String(opacity));
            const bgFill = layer.gradient
              ? layer.gradient.replace(/OPACITY/g, String(layerOpacities[layer.index]))
              : getLayerColor(layerOpacities[layer.index]);

            return (
              <div
                data-layer-capture="segment"
                key={layer.name}
                style={{
                  position: 'absolute',
                  transform: `translate(0px, ${y}px)`,
                  left: 0,
                  width: '100%',
                  height: `${layerHeights[layer.index]}px`,
                  background: bgFill,
                  borderBottom: layer.index < 3 ? `2px dashed ${getLayerColor(0.3)}` : 'none',
                }}
              />
            );
          })}
        </div>
      </ViewportPortal>
      <ViewportPortal>
        <div
          data-layer-label-root="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '10000px',
            height: '10000px',
            pointerEvents: 'none',
            zIndex: 6,
          }}
        >
          {layerDefinitions.map((layer, displayIndex, layers) => {
            let y = 0;
            for (let i = 0; i < displayIndex; i++) {
              const previousLayer = layers[i];
              y += layerHeights[previousLayer.index] ?? 0;
            }

            const getLayerColor = (opacity: number) => layer.color.replace('OPACITY', String(opacity));

            return (
              <div
                key={`${layer.name}-label`}
                style={{
                  position: 'absolute',
                  transform: `translate(0px, ${y}px)`,
                  left: 0,
                  width: '100%',
                  height: `${layerHeights[layer.index]}px`,
                  pointerEvents: 'none',
                }}
              >
                <div
                  data-layer-capture="label"
                  onClick={() => onLayerLabelClick(layer.index)}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: '32px',
                    padding: '6px 16px',
                    backgroundColor:
                      selectedLayerIndex === layer.index
                        ? 'rgba(255, 255, 255, 1)'
                        : 'rgba(255, 255, 255, 0.9)',
                    border: `2px solid ${selectedLayerIndex === layer.index ? getLayerColor(0.8) : getLayerColor(0.5)}`,
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: layer.color.replace('0.05', '0.8'),
                    boxShadow:
                      selectedLayerIndex === layer.index
                        ? '0 4px 12px rgba(0, 0, 0, 0.2)'
                        : '0 2px 6px rgba(0, 0, 0, 0.12)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    pointerEvents: 'auto',
                    zIndex: 7,
                  }}
                  className="nopan nodrag layer-label"
                  title={
                    selectedLayerIndex === layer.index
                      ? '다시 클릭하여 선택 해제 및 패널 닫기'
                      : '클릭하여 이 층위 선택 및 높이 조절'
                  }
                >
                  {selectedLayerIndex === layer.index ? '📌 ' : ''}
                  {layer.name}
                  <div className="layer-tooltip" role="tooltip">
                    <div className="layer-tooltip-title">{layer.name}</div>
                    <div className="layer-tooltip-body">{layer.description}</div>
                    <div className="layer-tooltip-examples">예시: {layer.examples}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ViewportPortal>
    </>
  );
});

LayerBackground.displayName = 'LayerBackground';

export default LayerBackground;

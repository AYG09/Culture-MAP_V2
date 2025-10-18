import { useState } from 'react';
import { toPng } from 'html-to-image';
import { getNodesBounds, type ReactFlowInstance } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import './ExportMenu.css';

interface ExportMenuProps {
  reactFlowInstance: ReactFlowInstance | null;
  nodes: Node[];
  // edges는 향후 JSON/Excel 내보내기에서 사용
  edges: Edge[];
}

export default function ExportMenu({ reactFlowInstance, nodes }: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  /**
   * PNG 이미지로 내보내기
   * React Flow 공식 예제 기반 구현
   */
  const exportPNG = async () => {
    if (!reactFlowInstance) {
      setExportError('컬쳐맵이 아직 로드되지 않았습니다.');
      return;
    }

    if (nodes.length === 0) {
      setExportError('내보낼 노드가 없습니다. 먼저 컬쳐맵을 생성해주세요.');
      return;
    }

    setIsExporting(true);
    setExportError(null);

    let captureElement: HTMLElement | null = null;
    const restoreStyleCallbacks: Array<() => void> = [];

    try {
      const reactFlowNodes = reactFlowInstance.getNodes();
      if (!reactFlowNodes.length) {
        throw new Error('React Flow 노드를 찾을 수 없습니다.');
      }

      const nodesBounds = getNodesBounds(reactFlowNodes);
      captureElement = document.querySelector('[data-capture-root="true"]') as HTMLElement;

      if (!captureElement) {
        throw new Error('캡처할 영역을 찾을 수 없습니다.');
      }

      const viewportState = reactFlowInstance.getViewport();
      const rootRect = captureElement.getBoundingClientRect();

      let minX = nodesBounds.x;
      let minY = nodesBounds.y;
      let maxX = nodesBounds.x + nodesBounds.width;
      let maxY = nodesBounds.y + nodesBounds.height;

      const layerElements = Array.from(
        captureElement.querySelectorAll('[data-layer-capture]')
      ) as HTMLElement[];

      const applyRelativeBoundsToWorld = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const relativeLeft = rect.left - rootRect.left;
        const relativeTop = rect.top - rootRect.top;
        const relativeRight = rect.right - rootRect.left;
        const relativeBottom = rect.bottom - rootRect.top;

        const worldLeft = (relativeLeft - viewportState.x) / viewportState.zoom;
        const worldTop = (relativeTop - viewportState.y) / viewportState.zoom;
        const worldRight = (relativeRight - viewportState.x) / viewportState.zoom;
        const worldBottom = (relativeBottom - viewportState.y) / viewportState.zoom;

        minX = Math.min(minX, worldLeft);
        minY = Math.min(minY, worldTop);
        maxX = Math.max(maxX, worldRight);
        maxY = Math.max(maxY, worldBottom);
      };

      layerElements.forEach(applyRelativeBoundsToWorld);

      const padding = {
        top: 120,
        right: 160,
        bottom: 160,
        left: 320,
      };

      const paddedMinX = minX - padding.left;
      const paddedMinY = minY - padding.top;
      const paddedMaxX = maxX + padding.right;
      const paddedMaxY = maxY + padding.bottom;

      const exportWidth = Math.max(1, Math.ceil(paddedMaxX - paddedMinX));
      const exportHeight = Math.max(1, Math.ceil(paddedMaxY - paddedMinY));

      const translateX = -paddedMinX;
      const translateY = -paddedMinY;

      const viewportElement = captureElement.querySelector('.react-flow__viewport') as HTMLElement | null;
      const backgroundRoot = captureElement.querySelector('[data-layer-background-root="true"]') as HTMLElement | null;
      const reactFlowRoot = captureElement.querySelector('.react-flow') as HTMLElement | null;

      const setTemporaryStyle = (element: HTMLElement | null, property: string, value: string) => {
        if (!element) return;
        const previousValue = element.style.getPropertyValue(property);
        const hadValue = previousValue !== '';
        restoreStyleCallbacks.push(() => {
          if (hadValue) {
            element.style.setProperty(property, previousValue);
          } else {
            element.style.removeProperty(property);
          }
        });
        element.style.setProperty(property, value);
      };

      setTemporaryStyle(captureElement, 'overflow', 'visible');
      setTemporaryStyle(captureElement, 'width', `${exportWidth}px`);
      setTemporaryStyle(captureElement, 'height', `${exportHeight}px`);
      setTemporaryStyle(captureElement, 'position', 'relative');

      setTemporaryStyle(reactFlowRoot, 'width', `${exportWidth}px`);
      setTemporaryStyle(reactFlowRoot, 'height', `${exportHeight}px`);

      setTemporaryStyle(viewportElement, 'transform-origin', '0 0');
      setTemporaryStyle(viewportElement, 'transform', `translate(${translateX}px, ${translateY}px) scale(1)`);

      setTemporaryStyle(backgroundRoot, 'transform-origin', '0 0');
      setTemporaryStyle(backgroundRoot, 'transform', `translate(${translateX}px, ${translateY}px)`);

      const dataUrl = await toPng(captureElement, {
        filter: node => {
          if (!node?.classList) return true;

          const excludeClasses = [
            'react-flow__minimap',
            'react-flow__controls',
            'culture-top-bar',
            'left-panel',
            'no-print',
            'layer-legend',
            'mobile-gesture-guide-overlay',
          ];

          return !excludeClasses.some(cls => node.classList.contains(cls));
        },
        backgroundColor: '#ffffff',
        width: exportWidth,
        height: exportHeight,
        pixelRatio: 4,
        cacheBust: true,
        style: {
          width: `${exportWidth}px`,
          height: `${exportHeight}px`,
        },
      });

      // 다운로드
      const a = document.createElement('a');
      a.download = `culture-map-${Date.now()}.png`;
      a.href = dataUrl;
      a.click();

      console.log('✅ PNG 내보내기 완료 (고화질, 층위 배경 포함)');
    } catch (error) {
      console.error('❌ PNG 내보내기 실패:', error);
      setExportError('이미지 내보내기에 실패했습니다.');
    } finally {
      while (restoreStyleCallbacks.length > 0) {
        const restore = restoreStyleCallbacks.pop();
        if (restore) {
          restore();
        }
      }
      setIsExporting(false);
    }
  };

  /**
   * JSON 파일로 내보내기
   */
  const exportJSON = () => {
    if (!reactFlowInstance) {
      setExportError('컬쳐맵이 아직 로드되지 않았습니다.');
      return;
    }

    if (nodes.length === 0) {
      setExportError('내보낼 노드가 없습니다. 먼저 컬쳐맵을 생성해주세요.');
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      const flowData = {
        nodes: reactFlowInstance.getNodes(),
        edges: reactFlowInstance.getEdges(),
        viewport: reactFlowInstance.getViewport(),
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0',
          nodeCount: nodes.length,
          edgeCount: reactFlowInstance.getEdges().length,
        },
      };

      const jsonString = JSON.stringify(flowData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      saveAs(blob, `culture-map-${Date.now()}.json`);

      console.log('✅ JSON 내보내기 완료');
    } catch (error) {
      console.error('❌ JSON 내보내기 실패:', error);
      setExportError('JSON 내보내기에 실패했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Excel 파일로 내보내기
   */
  const exportExcel = () => {
    if (nodes.length === 0) {
      setExportError('내보낼 노드가 없습니다. 먼저 컬쳐맵을 생성해주세요.');
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      // 노드 타입을 한글로 변환
      const getLayerName = (type: string): string => {
        switch (type) {
          case 'result':
            return '결과';
          case 'behavior':
            return '행동';
          case 'tangible_lever':
            return '유형 레버';
          case 'intangible_lever':
            return '무형 레버';
          default:
            return type;
        }
      };

      // 감성을 한글로 변환
      const getSentimentName = (sentiment: string): string => {
        switch (sentiment) {
          case 'positive':
            return '긍정';
          case 'negative':
            return '부정';
          case 'neutral':
            return '중립';
          default:
            return sentiment;
        }
      };

      // 노드 데이터를 Excel 행으로 변환
      const worksheetData = nodes.map(node => ({
        ID: node.id,
        층위: getLayerName(node.type || ''),
        내용: (node.data as { content?: string }).content || '',
        감성: getSentimentName((node.data as { sentiment?: string }).sentiment || 'neutral'),
        'X 좌표': Math.round(node.position.x),
        'Y 좌표': Math.round(node.position.y),
      }));

      // 워크시트 생성
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);

      // 열 너비 자동 조정
      const maxWidths = worksheetData.reduce((acc, row) => {
        Object.keys(row).forEach((key, idx) => {
          const value = String(row[key as keyof typeof row]);
          const width = Math.max(value.length, key.length) + 2;
          acc[idx] = Math.max(acc[idx] || 10, width);
        });
        return acc;
      }, [] as number[]);

      worksheet['!cols'] = maxWidths.map(w => ({ wch: w }));

      // 워크북 생성 및 시트 추가
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Culture Map');

      // 파일 다운로드
      XLSX.writeFile(workbook, `culture-map-${Date.now()}.xlsx`);

      console.log('✅ Excel 내보내기 완료');
    } catch (error) {
      console.error('❌ Excel 내보내기 실패:', error);
      setExportError('Excel 내보내기에 실패했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPNG = async () => {
    await exportPNG();
  };

  const handleExportJSON = () => {
    exportJSON();
  };

  const handleExportExcel = () => {
    exportExcel();
  };

  return (
    <div className="export-menu">
      <button
        className="export-button export-button-png"
        onClick={handleExportPNG}
        disabled={isExporting}
        title="컬쳐맵을 PNG 이미지로 다운로드"
      >
        {isExporting ? <span className="spinner"></span> : '📷'} <span>PNG</span>
      </button>

      <button
        className="export-button export-button-json"
        onClick={handleExportJSON}
        disabled={isExporting}
        title="컬쳐맵을 JSON 파일로 다운로드"
      >
        {isExporting ? <span className="spinner"></span> : '📄'} <span>JSON</span>
      </button>

      <button
        className="export-button export-button-excel"
        onClick={handleExportExcel}
        disabled={isExporting}
        title="컬쳐맵을 Excel 파일로 다운로드"
      >
        {isExporting ? <span className="spinner"></span> : '📊'} <span>Excel</span>
      </button>

      {exportError && (
        <div className="export-error" role="alert">
          {exportError}
        </div>
      )}
    </div>
  );
}

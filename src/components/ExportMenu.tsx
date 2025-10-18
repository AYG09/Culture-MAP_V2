import { useState } from 'react';
import { toPng } from 'html-to-image';
import { type ReactFlowInstance, getNodesBounds, getViewportForBounds } from '@xyflow/react';
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
   * React Flow 공식 Download Image 예제 패턴 기반
   * https://reactflow.dev/examples/misc/download-image
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

    try {
      // 1. 노드들의 실제 bounds 계산
      const nodesBounds = getNodesBounds(reactFlowInstance.getNodes());
      
      // 2. 층위 라벨 위치 추가 계산
      const viewportElement = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!viewportElement) {
        throw new Error('React Flow viewport element not found');
      }

      const layerBackgrounds = document.querySelectorAll('[data-layer-capture="segment"]');
      const layerLabels = document.querySelectorAll('[data-layer-capture="label"]');
      
      let minX = nodesBounds.x;
      let minY = nodesBounds.y;
      let maxX = nodesBounds.x + nodesBounds.width;
      let maxY = nodesBounds.y + nodesBounds.height;
      
      // 층위 배경(segment)의 Y 좌표를 파싱하여 bounds 확장
      layerBackgrounds.forEach((bgElement) => {
        const bg = bgElement as HTMLElement;
        const parentTransform = bg.style.transform;
        const match = parentTransform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        
        if (match) {
          const y = parseFloat(match[2]);
          const height = parseFloat(bg.style.height || '0');
          
          // Y축 방향으로만 확장 (배경은 전체 너비)
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y + height);
        }
      });
      
      // 층위 라벨의 실제 위치 계산 (부모 transform + 자신의 position)
      layerLabels.forEach((labelElement) => {
        const label = labelElement as HTMLElement;
        const parent = label.parentElement as HTMLElement;
        
        if (parent) {
          // 부모의 transform에서 Y 좌표 파싱
          const parentTransform = parent.style.transform;
          const parentMatch = parentTransform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
          
          if (parentMatch) {
            const parentY = parseFloat(parentMatch[2]);
            const labelTop = parseFloat(label.style.top || '0');
            const labelLeft = parseFloat(label.style.left || '0');
            const rect = label.getBoundingClientRect();
            
            // 실제 flow 좌표 계산
            const labelX = labelLeft;
            const labelY = parentY + labelTop;
            
            minX = Math.min(minX, labelX);
            minY = Math.min(minY, labelY);
            maxX = Math.max(maxX, labelX + rect.width);
            maxY = Math.max(maxY, labelY + rect.height);
          }
        }
      });

      // 3. 패딩 추가
      const padding = 40;
      const finalBounds = {
        x: minX - padding,
        y: minY - padding,
        width: (maxX - minX) + (padding * 2),
        height: (maxY - minY) + (padding * 2),
      };

      // 4. bounds에 맞는 viewport 계산
      const viewport = getViewportForBounds(
        finalBounds,
        finalBounds.width,
        finalBounds.height,
        0.5,  // minZoom
        2,    // maxZoom
        0     // padding (이미 직접 추가함)
      );

      // 5. .react-flow__viewport 요소를 타겟으로 캡처
      const dataUrl = await toPng(viewportElement, {
        backgroundColor: '#ffffff',
        width: finalBounds.width,
        height: finalBounds.height,
        style: {
          width: `${finalBounds.width}px`,
          height: `${finalBounds.height}px`,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        },
      });

      // 6. 다운로드
      const a = document.createElement('a');
      a.download = `culture-map-${Date.now()}.png`;
      a.href = dataUrl;
      a.click();

      console.log('✅ PNG 내보내기 완료');
    } catch (error) {
      console.error('❌ PNG 내보내기 실패:', error);
      setExportError('이미지 내보내기에 실패했습니다.');
    } finally {
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

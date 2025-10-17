import { useState } from 'react';
import { toPng } from 'html-to-image';
import { getNodesBounds, getViewportForBounds, type ReactFlowInstance } from '@xyflow/react';
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

    try {
      // 실제 노드 경계 기반 동적 크기 계산
      const nodesBounds = getNodesBounds(nodes);
      const PADDING = 100; // 각 방향 100px 여백
      const imageWidth = nodesBounds.width + PADDING * 2;
      const imageHeight = nodesBounds.height + PADDING * 2;

      // 노드들이 이미지 중앙에 오도록 viewport 계산
      const transform = getViewportForBounds(
        nodesBounds,
        imageWidth,
        imageHeight,
        0.5, // minZoom
        2,   // maxZoom
        PADDING / Math.max(imageWidth, imageHeight)  // 동적 padding 비율
      );

      // 변경: viewport 대신 flowWrapperRef를 포함하는 부모 선택 (층위 배경 포함)
      const captureElement = document.querySelector('[data-capture-root="true"]') as HTMLElement;
      
      if (!captureElement) {
        throw new Error('캡처할 영역을 찾을 수 없습니다.');
      }

      // PNG 이미지 생성 (초고화질, 4K 디스플레이 지원)
      const dataUrl = await toPng(captureElement, {
        // 불필요한 UI 요소 제외 (MiniMap, Controls, 상단 바, 좌측 패널)
        filter: (node) => {
          if (!node?.classList) return true;

          // 제외할 클래스 목록
          const excludeClasses = [
            'react-flow__minimap',
            'react-flow__controls',
            'culture-top-bar',      // 상단 바 제외
            'left-panel',           // 좌측 AI 패널 제외
            'no-print',             // no-print 클래스 제외
            'layer-legend',         // Panel 범례 제외 (선택적)
          ];

          return !excludeClasses.some(cls => node.classList.contains(cls));
        },
        backgroundColor: '#ffffff',
        width: imageWidth,
        height: imageHeight,
        pixelRatio: 4,            // 초고화질 (4배 해상도, 4K 디스플레이 최적화)
        cacheBust: true,          // 캐시 문제 방지
        fontEmbedCSS: '',         // 폰트 임베딩 최적화 (볼드 처리 보장)
        skipFonts: false,         // 폰트 정보 포함
        style: {
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
          fontWeight: '700',      // 볼드 명시적 적용
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
      const worksheetData = nodes.map((node) => ({
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

      worksheet['!cols'] = maxWidths.map((w) => ({ wch: w }));

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

import { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css'; // Quill Snow 테마 CSS
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import { createDocxBlobFromHtml } from '../utils/htmlToDocx';
import { ensurePdfFont, PDF_FONT_FAMILY_NAME } from '../utils/pdfFonts';
import './ReportEditor.css';

interface ReportEditorProps {
  /** 초기 HTML 콘텐츠 */
  initialContent: string;
  /** 콘텐츠 변경 시 호출되는 콜백 */
  onSave: (content: string) => void;
}

/**
 * ReportEditor - React Quill 기반 리치 텍스트 편집기
 * 
 * 편집 모드와 뷰어 모드를 토글할 수 있으며,
 * AI가 생성한 보고서를 수정하거나 새로 작성할 수 있습니다.
 */
export default function ReportEditor({ initialContent, onSave }: ReportEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 콘텐츠 변경 핸들러 (debounce 적용)
   * 300ms 대기 후 onSave 호출하여 성능 최적화
   */
  const handleChange = (value: string) => {
    setContent(value);
    
    // 기존 타이머 취소
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // 300ms 후 저장
    saveTimeoutRef.current = setTimeout(() => {
      onSave(value);
    }, 300);
  };

  /**
   * 컴포넌트 언마운트 시 타이머 정리
   */
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  /**
   * 편집 모드 토글
   */
  const toggleEditMode = () => {
    setIsEditing((prev) => !prev);
  };

  /**
   * Word 문서로 내보내기
   * HTML을 Plain Text로 변환하여 .docx 파일 생성
   */
  const handleExportWord = async () => {
    if (!content) {
      alert('내보낼 콘텐츠가 없습니다.');
      return;
    }

    setIsExporting(true);

    try {
      const blob = await createDocxBlobFromHtml(content);
      saveAs(blob, `report-${Date.now()}.docx`);

      console.log('✅ Word 내보내기 완료');
    } catch (error) {
      console.error('❌ Word 내보내기 실패:', error);
      alert('Word 내보내기에 실패했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * PDF 문서로 내보내기
   * HTML 렌더링 결과를 이미지로 변환하여 PDF 생성
   */
  const handleExportPDF = async () => {
    const reportElement = document.querySelector('.report-content') as HTMLElement;
    
    if (!reportElement) {
      alert('내보낼 콘텐츠가 없습니다. 먼저 보고서를 작성해주세요.');
      return;
    }

    setIsExporting(true);

    const restoreCallbacks: Array<() => void> = [];

    try {
      const applyTemporaryStyle = (element: HTMLElement, property: string, value: string) => {
        const previousValue = element.style.getPropertyValue(property);
        const previousPriority = element.style.getPropertyPriority(property);
        restoreCallbacks.push(() => {
          if (previousValue) {
            element.style.setProperty(property, previousValue, previousPriority);
          } else {
            element.style.removeProperty(property);
          }
        });
        element.style.setProperty(property, value);
      };

      const resetScrollTop = (element: HTMLElement) => {
        const previous = element.scrollTop;
        restoreCallbacks.push(() => {
          element.scrollTop = previous;
        });
        element.scrollTop = 0;
      };

      const pdf = new jsPDF({
        unit: 'pt',
        format: 'a4',
      });

      // 1. PDF 폰트 등록 (VFS 기반, Identity-H 인코딩)
      await ensurePdfFont(pdf);
      pdf.setFont(PDF_FONT_FAMILY_NAME, 'normal');

      const pageWidth = pdf.internal.pageSize.getWidth();
      const horizontalMargin = 56; // 0.78in
      const verticalMargin = 56;
      const availableWidth = pageWidth - horizontalMargin * 2;

      // 2. 컨테이너 스타일 완전히 해제하여 실제 콘텐츠 높이 측정
      const viewerElement = reportElement.closest('.report-viewer') as HTMLElement | null;

      if (viewerElement) {
        applyTemporaryStyle(viewerElement, 'overflow', 'visible');
        applyTemporaryStyle(viewerElement, 'overflow-y', 'visible');
        applyTemporaryStyle(viewerElement, 'max-height', 'none');
        applyTemporaryStyle(viewerElement, 'height', 'auto');
        applyTemporaryStyle(viewerElement, 'min-height', 'auto');
        resetScrollTop(viewerElement);
      }

      // reportElement도 제약 해제
      applyTemporaryStyle(reportElement, 'height', 'auto');
      applyTemporaryStyle(reportElement, 'max-height', 'none');

      // 브라우저가 레이아웃 재계산하도록 강제 대기
      await new Promise(resolve => setTimeout(resolve, 100));

      // 3. 실제 콘텐츠 크기 측정 (모든 제약 해제 후)
      // MDN: scrollHeight = 스크롤 없이 모든 콘텐츠를 표시하는 데 필요한 최소 높이
      const actualContentHeight = Math.max(
        reportElement.scrollHeight,
        reportElement.offsetHeight,
        reportElement.clientHeight,
        // documentElement까지 확인 (고전적 방법)
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight,
        document.documentElement.clientHeight
      );
      const actualContentWidth = Math.max(
        reportElement.scrollWidth,
        reportElement.offsetWidth,
        reportElement.clientWidth
      );

      console.log('📐 측정된 콘텐츠 크기:', {
        height: actualContentHeight,
        width: actualContentWidth,
        scrollHeight: reportElement.scrollHeight,
        offsetHeight: reportElement.offsetHeight,
        clientHeight: reportElement.clientHeight,
      });

      // 4. pt -> px 변환 (96 DPI 기준)
      const ptToPx = (value: number) => Math.round((value * 96) / 72);
      
      // windowWidth/Height는 실제 콘텐츠 크기를 반영
      // 공식 문서: windowHeight는 Element.scrollHeight를 사용해야 함
      const windowWidth = Math.max(actualContentWidth, ptToPx(availableWidth));
      const windowHeight = actualContentHeight;

      const htmlOptions: Parameters<typeof pdf.html>[1] = {
        margin: [verticalMargin, horizontalMargin, verticalMargin, horizontalMargin],
        autoPaging: 'text', // 텍스트가 페이지 경계에서 잘리지 않도록
        width: availableWidth,
        x: horizontalMargin,
        y: verticalMargin,
        html2canvas: {
          scale: 0.8, // 낮은 scale로 캔버스 크기 제한 회피 (커뮤니티 권장)
          useCORS: true,
          windowWidth,
          windowHeight,
          scrollX: 0,
          scrollY: 0,
          backgroundColor: '#ffffff',
          logging: true, // 디버깅용 로그 활성화
          allowTaint: false,
          foreignObjectRendering: false,
          // 폰트 렌더링 개선
          onclone: (clonedDoc: Document) => {
            // 복제된 문서에 폰트 스타일 강제 적용
            const clonedElement = clonedDoc.querySelector('.report-content') as HTMLElement;
            if (clonedElement) {
              clonedElement.style.fontFamily = `"${PDF_FONT_FAMILY_NAME}", "Noto Sans KR", sans-serif`;
            }
          },
        },
      };

      await pdf.html(reportElement, htmlOptions);

      pdf.save(`report-${Date.now()}.pdf`);

      console.log('✅ PDF 내보내기 완료');
    } catch (error) {
      console.error('❌ PDF 내보내기 실패:', error);
      alert('PDF 내보내기에 실패했습니다.');
    } finally {
      while (restoreCallbacks.length > 0) {
        const restore = restoreCallbacks.pop();
        if (restore) {
          restore();
        }
      }
      setIsExporting(false);
    }
  };

  /**
   * Quill 에디터 툴바 설정
   * - 기본 서식: 굵게, 기울임, 밑줄
   * - 제목: H1, H2, H3
   * - 목록: 번호 목록, 글머리 목록
   * - 정리: 서식 제거
   */
  const modules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ header: [1, 2, 3, false] }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['clean'],
    ],
  };

  /**
   * Quill 에디터 포맷 설정
   * Note: 'bullet'은 format이 아니며, 'list' format이 toolbar의 { list: 'bullet' } 옵션을 통해 처리됨
   */
  const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'list',
  ];

  return (
    <div className="report-editor">
      {/* 툴바: 편집 모드 토글 버튼 및 내보내기 버튼 */}
      <div className="editor-toolbar">
        <div className="export-buttons">
          <button
            className="export-button"
            onClick={handleExportWord}
            disabled={isExporting || !content}
            type="button"
            title="Word 문서로 다운로드"
          >
            📄 Word
          </button>
          <button
            className="export-button"
            onClick={handleExportPDF}
            disabled={isExporting || !content}
            type="button"
            title="PDF 문서로 다운로드"
          >
            📋 PDF
          </button>
        </div>

        <button
          className={`edit-toggle-button ${isEditing ? 'edit-toggle-button--active' : ''}`}
          onClick={toggleEditMode}
          type="button"
        >
          {isExporting ? '내보내는 중...' : isEditing ? '✅ 편집 완료' : '✏️ 편집하기'}
        </button>
      </div>

      {/* 편집 모드: Quill 에디터 */}
      {isEditing ? (
        <div className="editor-container">
          <ReactQuill
            value={content}
            onChange={handleChange}
            modules={modules}
            formats={formats}
            theme="snow"
            placeholder="AI가 생성한 보고서를 입력하거나 편집하세요..."
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          />
        </div>
      ) : (
        /* 뷰어 모드: HTML 렌더링 */
        <div className="report-viewer">
          {content ? (
            <div
              className="report-content"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <div className="report-empty">
              <p>아직 보고서가 작성되지 않았습니다.</p>
              <p>상단의 "✏️ 편집하기" 버튼을 눌러 보고서를 작성해주세요.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

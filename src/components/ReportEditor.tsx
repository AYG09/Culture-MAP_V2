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

    try {
      const pdf = new jsPDF({
        unit: 'pt',
        format: 'a4',
      });

      await ensurePdfFont(pdf);
      if ('fonts' in document && typeof document.fonts.load === 'function') {
        try {
          await Promise.all([
            document.fonts.load(`400 16px "${PDF_FONT_FAMILY_NAME}"`),
            document.fonts.load(`700 16px "${PDF_FONT_FAMILY_NAME}"`),
          ]);
          await document.fonts.ready;
        } catch (fontError) {
          console.warn('⚠️ PDF 폰트 사전 로드에 실패했습니다.', fontError);
        }
      }
      pdf.setFont(PDF_FONT_FAMILY_NAME, 'normal');

      const pageWidth = pdf.internal.pageSize.getWidth();
      const horizontalMargin = 56; // 0.78in
      const verticalMargin = 56;
      const availableWidth = pageWidth - horizontalMargin * 2;
      const windowWidth = Math.max(reportElement.scrollWidth, availableWidth);

      await pdf.html(reportElement, {
        x: horizontalMargin,
        y: verticalMargin,
        margin: [verticalMargin, horizontalMargin, verticalMargin, horizontalMargin],
        width: availableWidth,
        windowWidth,
        autoPaging: 'text',
        html2canvas: {
          scale: window.devicePixelRatio > 1 ? Math.min(window.devicePixelRatio, 2) : 1,
          useCORS: true,
        },
        callback: (instance) => {
          instance.save(`report-${Date.now()}.pdf`);
        },
      });

      console.log('✅ PDF 내보내기 완료');
    } catch (error) {
      console.error('❌ PDF 내보내기 실패:', error);
      alert('PDF 내보내기에 실패했습니다.');
    } finally {
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

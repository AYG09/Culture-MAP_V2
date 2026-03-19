import { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css'; // Quill Snow 테마 CSS
import { saveAs } from 'file-saver';
import { Sparkles, Loader2 } from 'lucide-react';
import './ReportEditor.css';

interface ReportEditorProps {
  /** 초기 HTML 콘텐츠 */
  initialContent: string;
  /** 콘텐츠 변경 시 호출되는 콜백 */
  onSave: (content: string) => void;
  /** AI 보고서 생성 핸들러 (선택적) */
  onGenerateReport?: () => void;
  /** AI 보고서 생성 중 여부 */
  isGenerating?: boolean;
}

/**
 * ReportEditor - React Quill 기반 리치 텍스트 편집기
 * 
 * 편집 모드와 뷰어 모드를 토글할 수 있으며,
 * AI가 생성한 보고서를 수정하거나 새로 작성할 수 있습니다.
 */
export default function ReportEditor({ initialContent, onSave, onGenerateReport, isGenerating }: ReportEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isEditing) return;
    if (initialContent !== content) {
      setContent(initialContent);
    }
  }, [initialContent, content, isEditing]);

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
      const { createDocxBlobFromHtml } = await import('../utils/htmlToDocx');
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
   * Excel 문서로 내보내기
   * HTML을 파싱하여 Excel 셀에 텍스트 데이터 삽입
   */
  const handleExportExcel = async () => {
    if (!content) {
      alert('내보낼 콘텐츠가 없습니다.');
      return;
    }

    setIsExporting(true);

    try {
      const ExcelJS = (await import('exceljs')).default;

      // HTML을 파싱하여 텍스트 추출
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Report');

      // 기본 스타일 설정
      worksheet.columns = [
        { width: 80 } // A열 너비
      ];

      let currentRow = 1;

      // HTML 요소를 순회하며 Excel 행으로 변환
      const processNode = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          if (text) {
            const cell = worksheet.getCell(`A${currentRow}`);
            cell.value = text;
            cell.alignment = { wrapText: true, vertical: 'top' };
            currentRow++;
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          const tagName = element.tagName.toLowerCase();

          // 제목 스타일 적용
          if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
            const text = element.textContent?.trim();
            if (text) {
              const cell = worksheet.getCell(`A${currentRow}`);
              cell.value = text;
              cell.font = {
                bold: true,
                size: tagName === 'h1' ? 16 : tagName === 'h2' ? 14 : 12
              };
              cell.alignment = { wrapText: true, vertical: 'top' };
              currentRow++;
            }
          }
          // 리스트 아이템
          else if (tagName === 'li') {
            const text = element.textContent?.trim();
            if (text) {
              const cell = worksheet.getCell(`A${currentRow}`);
              cell.value = `• ${text}`;
              cell.alignment = { wrapText: true, vertical: 'top', indent: 1 };
              currentRow++;
            }
          }
          // 단락
          else if (tagName === 'p') {
            const text = element.textContent?.trim();
            if (text) {
              const cell = worksheet.getCell(`A${currentRow}`);
              cell.value = text;
              cell.alignment = { wrapText: true, vertical: 'top' };
              currentRow++;
            }
          }
          // 하위 노드 재귀 처리 (ul, ol, div 등)
          else if (tagName === 'ul' || tagName === 'ol' || tagName === 'div') {
            element.childNodes.forEach(processNode);
          }
          // 기타 요소는 텍스트만 추출
          else {
            element.childNodes.forEach(processNode);
          }
        }
      };

      tempDiv.childNodes.forEach(processNode);

      // Excel 파일 생성 및 다운로드
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      saveAs(blob, `report-${Date.now()}.xlsx`);

      console.log('✅ Excel 내보내기 완료');
    } catch (error) {
      console.error('❌ Excel 내보내기 실패:', error);
      alert('Excel 내보내기에 실패했습니다.');
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
          {/* AI 보고서 생성 버튼 */}
          {onGenerateReport && (
            <button
              className="generate-report-button"
              onClick={onGenerateReport}
              disabled={isGenerating}
              type="button"
              title="AI가 현재 Culture Map을 분석하여 보고서를 생성합니다"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  생성 중...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  AI 보고서 생성
                </>
              )}
            </button>
          )}
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
            onClick={handleExportExcel}
            disabled={isExporting || !content}
            type="button"
            title="Excel 파일로 다운로드"
          >
            📊 Excel
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
              <Sparkles size={48} className="empty-icon" />
              <p className="empty-title">아직 보고서가 작성되지 않았습니다.</p>
              {onGenerateReport ? (
                <p className="empty-description">
                  상단의 "<Sparkles size={14} /> AI 보고서 생성" 버튼을 눌러<br />
                  현재 Culture Map을 분석한 보고서를 자동으로 생성하세요.
                </p>
              ) : (
                <p className="empty-description">
                  상단의 "✏️ 편집하기" 버튼을 눌러 보고서를 작성해주세요.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

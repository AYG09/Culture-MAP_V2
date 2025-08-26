// src/components/AnalysisReport.tsx

import React from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import type { ReportElement, InlineElement } from '../types/report';
import './AnalysisReport.css';

// 인라인 요소 렌더링 컴포넌트
const InlineContent: React.FC<{ content: InlineElement[] }> = ({ content }) => {
  return (
    <>
      {content.map((inline, index) => {
        switch (inline.type) {
          case 'bold':
            return <strong key={index}>{inline.content}</strong>;
          case 'text':
          default:
            return <span key={index}>{inline.content}</span>;
        }
      })}
    </>
  );
};

interface AnalysisReportProps {
  reportData: ReportElement[];
}

const AnalysisReport: React.FC<AnalysisReportProps> = ({ reportData }) => {
  const handlePrint = () => {
    const reportContentElement = document.querySelector('.report-content');
    if (!reportContentElement) {
      console.error('Report content element not found!');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    html2canvas(
      reportContentElement as HTMLElement,
      { scale: 2, window: window, useCORS: true } as any
    ).then(canvas => {
      const componentWidth = reportContentElement.scrollWidth;
      const componentHeight = reportContentElement.scrollHeight;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [componentWidth, componentHeight],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, componentWidth, componentHeight);
      pdf.save('조직문화_분석보고서.pdf');
    });
  };

  const handleWordExport = async () => {
    try {
      if (!reportData || reportData.length === 0) {
        alert('보고서 데이터가 없습니다.');
        return;
      }

      const docxElements = reportData.flatMap(element => {
        switch (element.type) {
          case 'heading': {
            const headingLevel = {
              1: HeadingLevel.HEADING_1,
              2: HeadingLevel.HEADING_2,
              3: HeadingLevel.HEADING_3,
              4: HeadingLevel.HEADING_4,
            }[element.level];

            return new Paragraph({
              text: element.content,
              heading: headingLevel,
              alignment: element.level === 1 ? AlignmentType.CENTER : AlignmentType.START,
            });
          }
          case 'paragraph':
            return new Paragraph({
              children: element.content.map(
                inline =>
                  new TextRun({
                    text: inline.content,
                    bold: inline.type === 'bold',
                  })
              ),
            });

          case 'list':
            return element.items.map(
              item =>
                new Paragraph({
                  children: item.content.map(
                    inline =>
                      new TextRun({
                        text: inline.content,
                        bold: inline.type === 'bold',
                      })
                  ),
                  bullet: { level: 0 },
                })
            );

          case 'thematicBreak':
            return new Paragraph({
              thematicBreak: true,
            });

          default:
            return [];
        }
      });

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: docxElements,
          },
        ],
        styles: {
          paragraphStyles: [
            {
              id: 'Heading1',
              name: 'Heading 1',
              basedOn: 'Normal',
              next: 'Normal',
              quickFormat: true,
              run: { size: 48, bold: true, color: '000000' },
              paragraph: { spacing: { after: 240 } },
            },
            {
              id: 'Heading2',
              name: 'Heading 2',
              basedOn: 'Normal',
              next: 'Normal',
              quickFormat: true,
              run: { size: 36, bold: true, color: '00205B' },
              paragraph: { spacing: { after: 240 } },
            },
            {
              id: 'Heading3',
              name: 'Heading 3',
              basedOn: 'Normal',
              next: 'Normal',
              quickFormat: true,
              run: { size: 28, bold: true, color: '1f3b6d' },
              paragraph: { spacing: { after: 240 } },
            },
          ],
        },
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, '조직문화_분석보고서.docx');
    } catch (error) {
      console.error('Word export failed:', error);
      alert('Word 파일 변환 중 오류가 발생했습니다. 개발자 콘솔을 확인해주세요.');
    }
  };

  if (!reportData || reportData.length === 0) {
    return (
      <div className="analysis-report-container print-container">
        <div className="report-placeholder">
          <p>좌측 패널에서 LLM 분석 결과를 붙여넣고 "보고서 보기" 버튼을 클릭하세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analysis-report-container print-container">
      <div className="report-actions no-print">
        <button onClick={handleWordExport}>Word로 저장</button>
        <button onClick={handlePrint}>PDF로 저장</button>
      </div>
      <div className="report-content" id="report-content">
        {reportData.map((element, index) => {
          switch (element.type) {
            case 'heading':
              switch (element.level) {
                case 1:
                  return <h1 key={index}>{element.content}</h1>;
                case 2:
                  return <h2 key={index}>{element.content}</h2>;
                case 3:
                  return <h3 key={index}>{element.content}</h3>;
                case 4:
                  return <h4 key={index}>{element.content}</h4>;
              }
              break;
            case 'paragraph':
              return (
                <p key={index}>
                  <InlineContent content={element.content} />
                </p>
              );
            case 'thematicBreak':
              return <hr key={index} />;
            case 'list': {
              const ListComponent = element.ordered ? 'ol' : 'ul';
              return (
                <ListComponent key={index} className="report-list">
                  {element.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="report-list-item">
                      <InlineContent content={item.content} />
                    </li>
                  ))}
                </ListComponent>
              );
            }
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
};

export default AnalysisReport;

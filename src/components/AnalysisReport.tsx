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

    // A4 크기 설정 (mm 단위)
    const a4Width = 210; // mm
    const a4Height = 297; // mm
    const margin = 15; // mm
    const contentWidth = a4Width - margin * 2;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    html2canvas(
      reportContentElement as HTMLElement,
      { 
        scale: 2, 
        window: window, 
        useCORS: true,
        logging: false,
        allowTaint: true
      } as any
    ).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageHeight = a4Height - margin * 2;
      let heightLeft = imgHeight;
      let position = margin;

      // 첫 페이지
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // 페이지가 넘어가는 경우 처리
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

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
              spacing: {
                after: 200,
              },
            });
          }
          case 'paragraph': {
            // 텍스트를 줄바꿈 기준으로 분리
            const lines: string[] = [];
            element.content.forEach(inline => {
              const splitLines = inline.content.split('\n');
              splitLines.forEach((line, idx) => {
                if (idx > 0) {
                  lines.push('\n'); // 줄바꿈 마커
                }
                if (line) {
                  lines.push(line);
                }
              });
            });

            // 줄바꿈을 포함한 TextRun 배열 생성
            const textRuns: TextRun[] = [];
            lines.forEach(line => {
              if (line === '\n') {
                textRuns.push(new TextRun({ break: 1 }));
              } else {
                const matchingInline = element.content.find(inline => inline.content.includes(line));
                textRuns.push(
                  new TextRun({
                    text: line,
                    bold: matchingInline?.type === 'bold',
                  })
                );
              }
            });

            return new Paragraph({
              children: textRuns,
              spacing: {
                after: 120,
                line: 276, // 1.15 line spacing (276/240)
              },
            });
          }

          case 'list':
            return element.items.map(item => {
              // 리스트 아이템도 줄바꿈 처리
              const textRuns: TextRun[] = [];
              item.content.forEach(inline => {
                const lines = inline.content.split('\n');
                lines.forEach((line, idx) => {
                  if (idx > 0) {
                    textRuns.push(new TextRun({ break: 1 }));
                  }
                  if (line) {
                    textRuns.push(
                      new TextRun({
                        text: line,
                        bold: inline.type === 'bold',
                      })
                    );
                  }
                });
              });

              return new Paragraph({
                children: textRuns,
                bullet: { level: 0 },
                spacing: {
                  after: 100,
                  line: 276,
                },
              });
            });

          case 'thematicBreak':
            return new Paragraph({
              thematicBreak: true,
              spacing: {
                before: 120,
                after: 120,
              },
            });

          default:
            return [];
        }
      });

      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                // A4 크기 설정
                size: {
                  width: 11906, // 210mm in twips
                  height: 16838, // 297mm in twips
                },
                margin: {
                  top: 1440, // 1 inch = 25.4mm
                  right: 1440,
                  bottom: 1440,
                  left: 1440,
                },
              },
            },
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
              run: { 
                size: 32, // 16pt
                bold: true, 
                color: '000000',
                font: '맑은 고딕'
              },
              paragraph: { 
                spacing: { 
                  before: 240,
                  after: 240,
                  line: 360,
                } 
              },
            },
            {
              id: 'Heading2',
              name: 'Heading 2',
              basedOn: 'Normal',
              next: 'Normal',
              quickFormat: true,
              run: { 
                size: 28, // 14pt
                bold: true, 
                color: '00205B',
                font: '맑은 고딕'
              },
              paragraph: { 
                spacing: { 
                  before: 200,
                  after: 200,
                  line: 320,
                } 
              },
            },
            {
              id: 'Heading3',
              name: 'Heading 3',
              basedOn: 'Normal',
              next: 'Normal',
              quickFormat: true,
              run: { 
                size: 24, // 12pt
                bold: true, 
                color: '1f3b6d',
                font: '맑은 고딕'
              },
              paragraph: { 
                spacing: { 
                  before: 160,
                  after: 160,
                  line: 300,
                } 
              },
            },
            {
              id: 'Normal',
              name: 'Normal',
              run: {
                size: 22, // 11pt
                font: '맑은 고딕',
              },
              paragraph: {
                spacing: {
                  line: 276, // 1.15 line spacing
                },
              },
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

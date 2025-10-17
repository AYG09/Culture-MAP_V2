// src/services/DriveAnalysisService.ts

import type {
  DriveFileInfo,
  DriveError,
  FourLayerAnalysisResult,
  AnalysisWorkflowState,
  WorkflowProgressCallback,
} from '../types/culture';
import { fourLayerAnalysisEngine } from './FourLayerAnalysisEngine'; // 수정됨: fourLayerAnalysisEngine 임포트

/**
 * Google Drive 기반 조직문화 분석 서비스
 * Step 0~4 표준 워크플로우 AI 분석 파이프라인을 지원합니다.
 */
/* // 전체 클래스를 주석 처리 - 미사용
class _FileProcessingEngine { // 미사용으로 앞에 밑줄 추가
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  
  static async preprocessFile(
    fileInfo: DriveFileInfo,
    content: string | ArrayBuffer
  ): Promise<PreprocessingResult> {
    const startTime = performance.now();
    
    try {
      console.log(`📁 파일 전처리 시작: ${fileInfo.name} (${fileInfo.mimeType})`);
      const fileType = this.detectFileType(fileInfo);
      const originalSize = typeof content === 'string' 
        ? new Blob([content]).size 
        : content.byteLength;
      
      if (originalSize > this.MAX_FILE_SIZE) {
        console.warn(`⚠️ 대용량 파일 감지: ${originalSize / 1024 / 1024}MB`);
      }
      
      let processedContent: string;
      
      switch (fileType) {
        case 'txt':
          processedContent = await this.processTxtFile(content);
          break;
        // 다른 파일 타입 처리 로직은 유지됩니다.
        default:
          processedContent = await this.processUnknownFile(content);
      }
      
      const processedSize = new Blob([processedContent]).size;
      const processingTime = performance.now() - startTime;
      
      console.log(`✅ 전처리 완료: ${originalSize}B → ${processedSize}B (${processingTime.toFixed(0)}ms)`);
      
      return {
        success: true,
        content: processedContent,
        metadata: {
          originalSize,
          processedSize,
          processingTime,
          fileType
        }
      };
      
    } catch (error) {
      console.error(`❌ 파일 전처리 실패: ${fileInfo.name}`, error);
      return {
        success: false,
        content: '',
        metadata: {
          originalSize: 0,
          processedSize: 0,
          processingTime: performance.now() - startTime,
          fileType: 'unknown'
        },
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      };
    }
  }
  
  static detectFileType(fileInfo: DriveFileInfo): FileProcessingStatus['fileType'] {
    const mimeType = fileInfo.mimeType?.toLowerCase() || '';
    const fileName = fileInfo.name?.toLowerCase() || '';
    
    if (mimeType.includes('text/plain') || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      return 'txt';
    }
    // 다른 파일 타입 감지 로직은 유지됩니다.
    return 'unknown';
  }
  
  private static async processTxtFile(content: string | ArrayBuffer): Promise<string> {
    if (typeof content === 'string') {
      return content;
    }
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(content);
  }

  private static async processAudioFile(content: string | ArrayBuffer, fileName: string): Promise<string> {
    console.log(`🎤 오디오 파일 전사 시뮬레이션: ${fileName}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return `[오디오 파일 전사 결과: ${fileName}]\n\n화자 1: 조직문화에 대해서 이야기해보겠습니다.\n화자 2: 네, 저희 조직의 특징을 말씀드리면...\n\n[실제 환경에서는 NotebookLM 음성 전사 결과가 여기에 표시됩니다]`;
  }
  
  private static async processPptxFile(content: string | ArrayBuffer): Promise<string> {
    console.log(`📊 PowerPoint 파일 텍스트 추출 시뮬레이션`);
    await new Promise(resolve => setTimeout(resolve, 800));
    return `[PowerPoint 텍스트 추출 결과]`;
  }

  private static async processPdfFile(_content: string | ArrayBuffer): Promise<string> {
    console.log(`📄 PDF 파일 텍스트 추출 시뮬레이션`);
    await new Promise(resolve => setTimeout(resolve, 1200));
    return `[PDF 텍스트 추출 결과]`;
  }
  
  private static async processUnknownFile(content: string | ArrayBuffer): Promise<string> {
    console.warn(`⚠️ 알 수 없는 파일 타입 - 텍스트 변환 시도`);
    if (typeof content === 'string') {
      return content;
    }
    try {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(content);
    } catch (error) {
      console.error('텍스트 변환 실패:', error);
      return '[파일 내용을 읽을 수 없습니다.]';
    }
  }
}
*/ // 미사용 클래스 주석 처리 끝

class DriveAnalysisService {
  private serviceStatus = {
    isConnected: false,
    errorCount: 0,
    lastSuccessfulOperation: undefined as string | undefined,
    lastError: undefined as DriveError | undefined,
  };

  private currentWorkflow: AnalysisWorkflowState | null = null;
  private progressCallback: WorkflowProgressCallback | null = null;

  async startAutomatedAnalysisWorkflow(
    content: string,
    projectId: string,
    fileInfo: DriveFileInfo,
    progressCallback?: WorkflowProgressCallback
  ): Promise<unknown> {
    // 반환 타입을 any로 변경하여 유연성 확보
    return this.executeSafeOperation(
      async () => {
        console.log(`🚀 자동화된 분석 워크플로우 시작: ${fileInfo.name}`);
        const textEncoder = new TextEncoder();
        const audioFileData = textEncoder.encode(content);

        const workflowResult = await this.startStandardAnalysisWorkflow(
          audioFileData,
          fileInfo.name,
          progressCallback
        );

        // 최종 결과는 workflowResult 전체가 될 수 있음
        return workflowResult;
      },
      this.getDefaultAnalysisResult(),
      '자동화된 분석 워크플로우'
    );
  }

  async executeStep0_SpeechToText(
    audioFileData: ArrayBuffer | string,
    fileName: string = 'interview.m4a'
  ): Promise<unknown> {
    return this.executeSafeOperation(
      async () => {
        console.log(`🎤 Step 0: 음성-텍스트 변환 시작 - ${fileName}`);
        // TODO: 실제 NotebookLM API 연동 시 이 부분에 기능 구현
        console.log('Step 0: 현재는 프롬프트 생성 방식으로 대체되었습니다.');
        return {
          transcription: `[시뮬레이션된 전사 결과 for ${fileName}]`,
          metadata: { fileName, speakers: 2, confidence: 95 },
        };
      },
      {
        transcription: '[폴백] 음성 파일 전사 결과',
        metadata: { fileName, speakers: 0, confidence: 0 },
      },
      'Step 0 음성-텍스트 변환'
    );
  }

  async executeStep1_QuantitativeExtraction(): Promise<unknown> {
    return this.executeSafeOperation(
      async () => {
        console.log(`📊 Step 1: 정량 데이터 추출 시작`);
        // TODO: 실제 NotebookLM API 연동 시 이 부분에 기능 구현
        console.log('Step 1: 현재는 프롬프트 생성 방식으로 대체되었습니다.');
        return {
          metadata: {
            totalFiles: 1,
            totalDuration: '00:10:00',
            speakers: { leaders: 1, members: 3 },
          },
          keywordFrequency: [
            { keyword: '소통', totalCount: 15, leaderMentions: 5, memberMentions: 10 },
          ],
          nonVerbalCues: [],
        };
      },
      {
        metadata: {
          totalFiles: 0,
          totalDuration: '00:00:00',
          speakers: { leaders: 0, members: 0 },
        },
        keywordFrequency: [],
        nonVerbalCues: [],
      },
      'Step 1 정량 데이터 추출'
    );
  }

  async executeStep2_GeminiAnalysis(quantitativeData: unknown, fullText: string): Promise<string> {
    return this.executeSafeOperation(
      async () => {
        console.log(`🤖 Step 2: Gemini 분석 프롬프트 생성 시작`);
        this.updateWorkflowStage('step2', 55, 'Gemini 프롬프트 생성 중...');
        const prompt = await fourLayerAnalysisEngine.generateStep2Prompt(fullText);
        console.log('✅ [DEBUG] Step 2 프롬프트 생성 완료! 수정된 코드가 실행되었습니다.');
        console.log(`[DEBUG] 생성된 프롬프트 미리보기: ${prompt.substring(0, 200)}...`);
        this.updateWorkflowStage('step2', 60, 'Gemini 프롬프트 생성 완료');
        return prompt;
      },
      '[폴백] Gemini 분석 프롬프트를 생성할 수 없습니다.',
      'Step 2 Gemini 분석 프롬프트 생성'
    );
  }

  async executeStep3_CultureMap(): Promise<string> {
    return this.executeSafeOperation(
      async () => {
        console.log(`🧠 Step 3: Claude 컬쳐맵 생성 시작`);
        // TODO: 실제 API 연동 시 이 부분에 기능 구현
        console.log('Step 3: 현재는 프롬프트 생성 방식으로 대체되었습니다.');
        return '[폴백] Claude 컬쳐맵 결과가 여기에 표시됩니다.';
      },
      '[폴백] Claude 컬쳐맵 결과가 여기에 표시됩니다.',
      'Step 3 Claude 컬쳐맵 생성'
    );
  }

  async executeStep4_FinalReport(): Promise<unknown> {
    return this.executeSafeOperation(
      async () => {
        console.log(`📊 Step 4: 최종 분석 보고서 생성 시작`);
        // TODO: 실제 API 연동 시 이 부분에 기능 구현
        console.log('Step 4: 현재는 프롬프트 생성 방식으로 대체되었습니다.');
        return {
          analysisResult: this.getDefaultAnalysisResult(),
          visualizationData: null,
        };
      },
      {
        analysisResult: this.getDefaultAnalysisResult(),
        visualizationData: null,
      },
      'Step 4 최종 분석 보고서'
    );
  }

  async startStandardAnalysisWorkflow(
    audioFileData: ArrayBuffer | string,
    fileName: string = 'interview.m4a',
    progressCallback?: WorkflowProgressCallback
  ): Promise<unknown> {
    return this.executeSafeOperation(
      async () => {
        console.log(`🚀 표준 워크플로우 시작: ${fileName}`);
        this.currentWorkflow = {
          stage: 'step0',
          completedStages: new Set<string>(),
          progress: 0,
          isProcessing: true,
          step0Data: null,
          step1Data: null,
          step2Data: null,
          step3Data: null,
          step4Data: null,
        };

        if (progressCallback) {
          this.progressCallback = progressCallback;
        }

        this.updateWorkflowStage('step0', 10, 'Step 0: 음성-텍스트 변환 시작...');
        const step0Result = await this.executeStep0_SpeechToText(audioFileData, fileName);
        if (this.currentWorkflow) {
          this.currentWorkflow.step0Data = step0Result;
          this.currentWorkflow.completedStages.add('step0');
        }

        this.updateWorkflowStage('step1', 30, 'Step 1: 정량 데이터 추출 시작...');
        const step1Result = await this.executeStep1_QuantitativeExtraction(
          step0Result.transcription
        );
        if (this.currentWorkflow) {
          this.currentWorkflow.step1Data = step1Result;
          this.currentWorkflow.completedStages.add('step1');
        }

        this.updateWorkflowStage('step2', 50, 'Step 2: Gemini 분석 시작...');
        const step2Result = await this.executeStep2_GeminiAnalysis(
          step1Result,
          step0Result.transcription
        );
        if (this.currentWorkflow) {
          this.currentWorkflow.step2Data = step2Result;
          this.currentWorkflow.completedStages.add('step2');
        }

        this.updateWorkflowStage('step3', 70, 'Step 3: Claude 컬쳐맵 생성 시작...');
        const step3Result = await this.executeStep3_CultureMap(step2Result, step1Result);
        if (this.currentWorkflow) {
          this.currentWorkflow.step3Data = step3Result;
          this.currentWorkflow.completedStages.add('step3');
        }

        this.updateWorkflowStage('step4', 90, 'Step 4: 최종 분석 보고서 생성 시작...');
        const step4Result = await this.executeStep4_FinalReport(
          step3Result,
          step2Result,
          step1Result
        );
        if (this.currentWorkflow) {
          this.currentWorkflow.step4Data = step4Result;
          this.currentWorkflow.completedStages.add('step4');
          this.currentWorkflow.isProcessing = false;
        }

        this.updateWorkflowStage('step4', 100, '✅ 표준 워크플로우 완료!');

        return {
          step0Result,
          step1Result,
          step2Result,
          step3Result,
          step4Result,
        };
      },
      {
        step0Result: null,
        step1Result: null,
        step2Result: null,
        step3Result: null,
        step4Result: null,
      },
      '표준 워크플로우 실행'
    );
  }

  // ... (다른 헬퍼 함수들은 유지)

  private updateWorkflowStage(
    stage: AnalysisWorkflowState['stage'],
    progress: number,
    message?: string
  ): void {
    if (this.currentWorkflow) {
      this.currentWorkflow.stage = stage;
      this.currentWorkflow.progress = progress;
      this.notifyProgress(message);
    }
  }

  private notifyProgress(message?: string): void {
    if (this.progressCallback && this.currentWorkflow) {
      this.progressCallback({ ...this.currentWorkflow }, message);
    }
  }

  private getDefaultAnalysisResult(): FourLayerAnalysisResult {
    return {
      artifacts: { visible_elements: [], symbols: [], rituals: [], stories: [] },
      behaviors: { patterns: [], interactions: [], decision_making: [], communication: [] },
      norms_values: {
        stated_values: [],
        implicit_norms: [],
        cultural_rules: [],
        belief_systems: [],
      },
      assumptions: {
        basic_assumptions: [],
        mental_models: [],
        worldviews: [],
        unconscious_beliefs: [],
      },
      insights: { patterns: [], gaps: [], risks: [], opportunities: [], recommendations: [] },
      academic_references: [],
      confidence_score: 0,
    };
  }

  private async executeSafeOperation<T>(
    operation: () => Promise<T>,
    fallbackData: T,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error(`❌ ${operationName} 실패:`, error);
      return fallbackData;
    }
  }

  async generateAndDownloadDocx(
    analysisResult: FourLayerAnalysisResult,
    fileName: string = '조직문화_분석_결과.docx'
  ): Promise<void> {
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import(
        'docx'
      );
      const { saveAs } = await import('file-saver');

      const paragraphs: any[] = [];

      // 제목
      paragraphs.push(
        new Paragraph({
          text: '조직문화 분석 보고서',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );

      // 각 섹션 추가
      const sections = [
        { title: '1. 가시적 요소 (Artifacts)', data: analysisResult.artifacts },
        { title: '2. 행동 패턴 (Behaviors)', data: analysisResult.behaviors },
        { title: '3. 규범과 가치 (Norms & Values)', data: analysisResult.norms_values },
        { title: '4. 기본 가정 (Basic Assumptions)', data: analysisResult.assumptions },
        { title: '5. 인사이트', data: analysisResult.insights },
      ];

      sections.forEach(section => {
        // 섹션 제목
        paragraphs.push(
          new Paragraph({
            text: section.title,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          })
        );

        // 섹션 내용
        if (section.data && typeof section.data === 'object') {
          Object.entries(section.data).forEach(([key, values]) => {
            if (Array.isArray(values) && values.length > 0) {
              // 하위 제목
              paragraphs.push(
                new Paragraph({
                  text: key.replace(/_/g, ' ').toUpperCase(),
                  heading: HeadingLevel.HEADING_3,
                  spacing: { before: 200, after: 120 },
                })
              );

              // 항목들
              values.forEach((item: any) => {
                const text = typeof item === 'string' ? item : JSON.stringify(item);
                const lines = text.split('\n');

                lines.forEach((line, idx) => {
                  if (idx === 0) {
                    paragraphs.push(
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `• ${line}`,
                          }),
                        ],
                        spacing: { after: 100, line: 276 },
                      })
                    );
                  } else if (line.trim()) {
                    paragraphs.push(
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `  ${line}`,
                          }),
                        ],
                        spacing: { after: 100, line: 276 },
                      })
                    );
                  }
                });
              });
            }
          });
        }
      });

      // 학술 참고문헌
      if (analysisResult.academic_references && analysisResult.academic_references.length > 0) {
        paragraphs.push(
          new Paragraph({
            text: '학술 참고문헌',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          })
        );

        analysisResult.academic_references.forEach((ref: any) => {
          const refText =
            typeof ref === 'string' ? ref : `${ref.author} (${ref.year}). ${ref.title}`;
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `• ${refText}`,
                }),
              ],
              spacing: { after: 100, line: 276 },
            })
          );
        });
      }

      // 문서 생성
      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                size: {
                  width: 11906, // A4: 210mm
                  height: 16838, // A4: 297mm
                },
                margin: {
                  top: 1440, // 1 inch
                  right: 1440,
                  bottom: 1440,
                  left: 1440,
                },
              },
            },
            children: paragraphs,
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
                font: '맑은 고딕',
              },
              paragraph: {
                spacing: {
                  before: 240,
                  after: 240,
                  line: 360,
                },
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
                font: '맑은 고딕',
              },
              paragraph: {
                spacing: {
                  before: 200,
                  after: 200,
                  line: 320,
                },
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
                font: '맑은 고딕',
              },
              paragraph: {
                spacing: {
                  before: 160,
                  after: 160,
                  line: 300,
                },
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
      saveAs(blob, fileName);
      console.log(`✅ DOCX 파일 다운로드: ${fileName}`);
    } catch (error) {
      console.error('❌ DOCX 생성 실패:', error);
      throw error;
    }
  }

  async generateAndDownloadPdf(
    analysisResult: FourLayerAnalysisResult,
    fileName: string = '조직문화_분석_결과.pdf'
  ): Promise<void> {
    try {
      const jsPDF = (await import('jspdf')).default;
      const html2canvas = (await import('html2canvas')).default;

      // 임시 HTML 요소 생성
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '800px';
      tempDiv.style.padding = '40px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.fontFamily = '맑은 고딕, sans-serif';

      // HTML 내용 구성
      let htmlContent = '<h1 style="text-align: center; margin-bottom: 30px;">조직문화 분석 보고서</h1>';

      const sections = [
        { title: '1. 가시적 요소 (Artifacts)', data: analysisResult.artifacts },
        { title: '2. 행동 패턴 (Behaviors)', data: analysisResult.behaviors },
        { title: '3. 규범과 가치 (Norms & Values)', data: analysisResult.norms_values },
        { title: '4. 기본 가정 (Basic Assumptions)', data: analysisResult.assumptions },
        { title: '5. 인사이트', data: analysisResult.insights },
      ];

      sections.forEach(section => {
        htmlContent += `<h2 style="margin-top: 25px; margin-bottom: 15px; color: #00205B;">${section.title}</h2>`;

        if (section.data && typeof section.data === 'object') {
          Object.entries(section.data).forEach(([key, values]) => {
            if (Array.isArray(values) && values.length > 0) {
              htmlContent += `<h3 style="margin-top: 15px; margin-bottom: 10px; color: #1f3b6d;">${key
                .replace(/_/g, ' ')
                .toUpperCase()}</h3>`;
              htmlContent += '<ul style="margin-left: 20px; line-height: 1.6;">';
              values.forEach((item: any) => {
                const text = typeof item === 'string' ? item : JSON.stringify(item);
                htmlContent += `<li style="margin-bottom: 8px;">${text.replace(/\n/g, '<br/>')}</li>`;
              });
              htmlContent += '</ul>';
            }
          });
        }
      });

      // 학술 참고문헌
      if (analysisResult.academic_references && analysisResult.academic_references.length > 0) {
        htmlContent += `<h2 style="margin-top: 25px; margin-bottom: 15px; color: #00205B;">학술 참고문헌</h2>`;
        htmlContent += '<ul style="margin-left: 20px; line-height: 1.6;">';
        analysisResult.academic_references.forEach((ref: any) => {
          const refText =
            typeof ref === 'string' ? ref : `${ref.author} (${ref.year}). ${ref.title}`;
          htmlContent += `<li style="margin-bottom: 8px;">${refText}</li>`;
        });
        htmlContent += '</ul>';
      }

      tempDiv.innerHTML = htmlContent;
      document.body.appendChild(tempDiv);

      // A4 크기 설정
      const a4Width = 210; // mm
      const a4Height = 297; // mm
      const margin = 15; // mm
      const contentWidth = a4Width - margin * 2;

      // HTML을 캔버스로 변환
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
      });

      document.body.removeChild(tempDiv);

      // PDF 생성
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

      pdf.save(fileName);
      console.log(`✅ PDF 파일 다운로드: ${fileName}`);
    } catch (error) {
      console.error('❌ PDF 생성 실패:', error);
      throw error;
    }
  }
}

export const driveAnalysisService = new DriveAnalysisService();
export default DriveAnalysisService;

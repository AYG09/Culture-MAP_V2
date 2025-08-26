// src/components/DriveAnalysisPanel.tsx
import React, { useState } from 'react';
import type {
  FourLayerAnalysisResult,
  DriveFileInfo,
  CultureProject,
  AnalysisWorkflowState,
  WorkflowStage,
  StageStatus,
  NoteData,
  ConnectionData,
} from '../types/culture';
import { driveAnalysisService } from '../services/DriveAnalysisService';
import DriveFileSelector from './DriveFileSelector';
import ManualInputSection from './ManualInputSection';
import PromptGenerator from './PromptGenerator';
import StickyNote from './StickyNote';
import ConnectionsLayer from './ConnectionsLayer';
import ContextMenu from './ContextMenu';
import './DriveAnalysisPanel.css';

interface DriveAnalysisPanelProps {
  activeProject: CultureProject | null;
  onAnalysisComplete?: (result: FourLayerAnalysisResult) => void;
}

const DriveAnalysisPanel: React.FC<DriveAnalysisPanelProps> = ({
  activeProject,
  onAnalysisComplete,
}) => {
  // 분석 모드 관리 (3가지 모드)
  const [analysisMode, setAnalysisMode] = useState<'auto' | 'manual' | 'prompt'>('auto');

  // Step 0~4 워크플로우 상태 관리
  const [workflowState, setWorkflowState] = useState<AnalysisWorkflowState>({
    stage: 'step0',
    step0Data: null,
    step1Data: null,
    step2Data: null,
    step3Data: null,
    step4Data: null,
    progress: 0,
    isProcessing: false,
    completedStages: new Set(),
  });

  const [selectedFile, setSelectedFile] = useState<DriveFileInfo | null>(null);

  const [showFileSelector, setShowFileSelector] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [showPromptGenerator, setShowPromptGenerator] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');

  // 프롬프트 생성 모드 관련 상태
  const [promptNotes, setPromptNotes] = useState<NoteData[]>([]);
  const [promptConnections, setPromptConnections] = useState<ConnectionData[]>([]);

  // 시각화 관련 상태 (Step 4용) - 현재 미사용
  // const [visualizationNotes, setVisualizationNotes] = useState<NoteData[]>([]);
  // const [visualizationConnections, setVisualizationConnections] = useState<ConnectionData[]>([]);
  // const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  // const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [connectingNoteId, setConnectingNoteId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: Array<{ label: string; action: () => void }>;
  } | null>(null);
  // const [selection, setSelection] = useState<{startX: number; startY: number; endX: number; endY: number} | null>(null);
  const [activeTab, setActiveTab] = useState<'report' | 'visualization'>('report');

  // 5단계 체계적 분석 과정 정의
  const getStageStatuses = (): StageStatus[] => [
    {
      id: 'step0',
      label: '1단계: 음성 전사',
      description: '인터뷰나 회의 음성을 텍스트로 변환',
      icon: '🎤',
      completed: workflowState.completedStages.has('step0'),
      current: workflowState.stage === 'step0',
      isProcessing: workflowState.stage === 'step0' && workflowState.isProcessing,
      data: workflowState.step0Data,
    },
    {
      id: 'step1',
      label: '2단계: 데이터 추출',
      description: '핵심 키워드와 패턴을 자동으로 추출',
      icon: '📊',
      completed: workflowState.completedStages.has('step1'),
      current: workflowState.stage === 'step1',
      isProcessing: workflowState.stage === 'step1' && workflowState.isProcessing,
      data: workflowState.step1Data,
    },
    {
      id: 'step2',
      label: '3단계: 예비 분석',
      description: 'AI가 조직문화 요소들을 1차 분석',
      icon: '🧠',
      completed: workflowState.completedStages.has('step2'),
      current: workflowState.stage === 'step2',
      isProcessing: workflowState.stage === 'step2' && workflowState.isProcessing,
      data: workflowState.step2Data,
    },
    {
      id: 'step3',
      label: '4단계: 컬쳐맵 생성',
      description: '4층위 모델로 조직문화 구조를 시각화',
      icon: '🗺️',
      completed: workflowState.completedStages.has('step3'),
      current: workflowState.stage === 'step3',
      isProcessing: workflowState.stage === 'step3' && workflowState.isProcessing,
      data: workflowState.step3Data,
    },
    {
      id: 'step4',
      label: '5단계: 최종 보고서',
      description: '실행 가능한 개선 방안과 시각화 제공',
      icon: '📋',
      completed: workflowState.completedStages.has('step4'),
      current: workflowState.stage === 'step4',
      isProcessing: workflowState.stage === 'step4' && workflowState.isProcessing,
      data: workflowState.step4Data,
    },
  ];

  // 워크플로우 진행률 추적기 컴포넌트
  const WorkflowTracker: React.FC = () => {
    const stages = getStageStatuses();
    const batchState = workflowState.batchState;

    // 파일별 상태 아이콘 반환 함수
    const getFileStatusIcon = (status: string) => {
      switch (status) {
        case 'pending':
          return '⏳';
        case 'preprocessing':
          return '🔄';
        case 'step0':
        case 'step1':
        case 'step2':
        case 'step3':
        case 'step4':
          return '⚡';
        case 'completed':
          return '✅';
        case 'error':
          return '❌';
        default:
          return '📄';
      }
    };

    // 파일 타입별 아이콘 반환 함수
    const getFileTypeIcon = (fileType: string) => {
      switch (fileType) {
        case 'txt':
          return '📄';
        case 'm4a':
          return '🎤';
        case 'pptx':
          return '📊';
        case 'pdf':
          return '📋';
        default:
          return '📁';
      }
    };

    return (
      <div className="workflow-tracker">
        <h3>5단계 체계적 분석 과정</h3>
        <div className="workflow-progress-bar">
          <div className="progress-fill" style={{ width: `${workflowState.progress}%` }} />
        </div>

        {/* 다중 파일 배치 진행률 시각화 */}
        {batchState && (
          <div className="batch-progress">
            <div className="batch-overview">
              <h4>
                📁 다중 파일 처리: {batchState.completedFiles}/{batchState.totalFiles}
              </h4>
              <div className="batch-progress-bar">
                <div
                  className="batch-progress-fill"
                  style={{ width: `${batchState.overallProgress}%` }}
                />
                <span className="batch-progress-text">{batchState.overallProgress}%</span>
              </div>
              {batchState.memoryUsage && (
                <div className="memory-usage">
                  <span>
                    메모리: {batchState.memoryUsage.current}MB / {batchState.memoryUsage.limit}MB
                  </span>
                  <div className="memory-bar">
                    <div
                      className="memory-fill"
                      style={{
                        width: `${(batchState.memoryUsage.current / batchState.memoryUsage.limit) * 100}%`,
                        backgroundColor:
                          batchState.memoryUsage.current > batchState.memoryUsage.limit * 0.8
                            ? '#e74c3c'
                            : '#3498db',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="file-progress-list">
              {batchState.files.map(file => (
                <div key={file.fileInfo.id} className={`file-progress-card ${file.status}`}>
                  <div className="file-info">
                    <span className="file-type-icon">{getFileTypeIcon(file.fileType)}</span>
                    <span className="file-name">{file.fileInfo.name}</span>
                    <span className="file-status-icon">{getFileStatusIcon(file.status)}</span>
                  </div>

                  <div className="file-progress">
                    <div className="file-progress-bar">
                      <div className="file-progress-fill" style={{ width: `${file.progress}%` }} />
                    </div>
                    <span className="file-progress-text">{file.progress}%</span>
                  </div>

                  {file.error && (
                    <div className="file-error">
                      <span className="error-message">⚠️ {file.error.message}</span>
                      {file.error.canRetry && (
                        <button
                          className="retry-button"
                          onClick={() => {
                            // 재시도 로직은 상위 컴포넌트에서 처리
                            console.log('재시도 요청:', file.fileInfo.id);
                          }}
                        >
                          🔄 재시도
                        </button>
                      )}
                    </div>
                  )}

                  {file.currentStage && (
                    <div className="current-stage">
                      현재 단계:{' '}
                      {file.currentStage === 'preprocessing'
                        ? '전처리'
                        : `Step ${file.currentStage.slice(-1)}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="stages-container">
          {stages.map((stage, index) => (
            <div
              key={stage.id}
              className={`stage-item ${stage.completed ? 'completed' : ''} ${stage.current ? 'current' : ''} ${stage.isProcessing ? 'processing' : ''}`}
            >
              <div className="stage-icon">
                {stage.isProcessing ? (
                  <div className="loading-spinner-small"></div>
                ) : stage.completed ? (
                  '✅'
                ) : (
                  stage.icon
                )}
              </div>
              <div className="stage-content">
                <div className="stage-title">{stage.label}</div>
                <div className="stage-description">{stage.description}</div>
              </div>
              {index < stages.length - 1 && (
                <div className={`stage-connector ${stage.completed ? 'completed' : ''}`} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 시각화 이벤트 핸들러들 (Step 4 시각화 탭용)
  const handleVisualizationMouseDownOnNote = (noteId: string) => {
    console.log('Note mousedown:', noteId);
  };

  const handleVisualizationMouseDownOnResizeHandle = (noteId: string) => {
    console.log('Note resize:', noteId);
  };

  const handleVisualizationConnectStart = (noteId: string) => {
    setConnectingNoteId(noteId);
  };

  const handleVisualizationToggleSentiment = (noteId: string) => {
    console.log('Toggle sentiment:', noteId);
  };

  const handleVisualizationNoteClick = (noteId: string) => {
    console.log('Note click:', noteId);
  };

  const handleVisualizationUpdateNote = (noteId: string, updates: Partial<NoteData>) => {
    console.log('Update note:', noteId, updates);
  };

  const handleVisualizationNoteContextMenu = (e: React.MouseEvent, noteId: string) => {
    console.log('Note context menu:', noteId);
  };

  const handleVisualizationConnectionContextMenu = (e: React.MouseEvent, connectionId: string) => {
    console.log('Connection context menu:', connectionId);
  };

  const handleVisualizationUpdateConnection = (
    connectionId: string,
    updates: Partial<ConnectionData>
  ) => {
    console.log('Update connection:', connectionId, updates);
  };

  const handleVisualizationDeleteConnection = (connectionId: string) => {
    console.log('Delete connection:', connectionId);
  };

  const handleVisualizationCloseContextMenu = () => {
    setContextMenu(null);
  };

  // Step 4 보고서 및 시각화 단계 컴포넌트
  const Step4ReportStage: React.FC = () => {
    // 시각화 탭 컴포넌트
    const VisualizationTab: React.FC = () => {
      if (!workflowState.step4Data?.visualizationData) {
        return (
          <div className="visualization-pending">
            <h4>📊 시각화 데이터 준비 중...</h4>
            <div className="loading-spinner"></div>
            <p>컬쳐맵 시각화를 생성하고 있습니다...</p>
          </div>
        );
      }

      return (
        <div className="visualization-tab">
          <div className="visualization-controls">
            <div className="visualization-info">
              <span>노트: {visualizationNotes.length}개</span>
              <span>연결: {visualizationConnections.length}개</span>
              {selectedNoteIds.size > 0 && <span>선택됨: {selectedNoteIds.size}개</span>}
            </div>
          </div>

          <div className="culture-map-canvas">
            <div
              className="canvas-container"
              style={{ position: 'relative', width: '100%', height: '600px' }}
            >
              {selection && (
                <div
                  className="selection-box"
                  style={{
                    position: 'absolute',
                    left: Math.min(selection.startX, selection.endX),
                    top: Math.min(selection.startY, selection.endY),
                    width: Math.abs(selection.startX - selection.endX),
                    height: Math.abs(selection.startY - selection.endY),
                    border: '2px dashed #3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                />
              )}

              <ConnectionsLayer
                connections={visualizationConnections}
                notes={visualizationNotes}
                onConnectionContextMenu={handleVisualizationConnectionContextMenu}
                onUpdateConnection={handleVisualizationUpdateConnection}
                onDeleteConnection={handleVisualizationDeleteConnection}
                editingItems={{}}
              />

              {visualizationNotes.map(note => (
                <StickyNote
                  key={note.id}
                  note={note}
                  onMouseDown={e => handleVisualizationMouseDownOnNote(note.id, e)}
                  onResizeStart={e => handleVisualizationMouseDownOnResizeHandle(note.id, e)}
                  onConnectStart={handleVisualizationConnectStart}
                  onToggleSentiment={handleVisualizationToggleSentiment}
                  onClick={handleVisualizationNoteClick}
                  onUpdate={handleVisualizationUpdateNote}
                  onContextMenu={e => handleVisualizationNoteContextMenu(e, note.id)}
                  isConnecting={connectingNoteId === note.id}
                  isSelected={selectedNoteIds.has(note.id)}
                  isEditing={editingNoteId === note.id}
                  connectingNoteId={connectingNoteId}
                />
              ))}
            </div>
          </div>
        </div>
      );
    };

    // 보고서 탭 컴포넌트
    const ReportTab: React.FC = () => {
      if (!workflowState.step4Data?.analysisResult) {
        return (
          <div className="report-pending">
            <h4>📋 최종 보고서 생성 중...</h4>
            <div className="loading-spinner"></div>
            <p>종합 분석 보고서를 작성하고 있습니다...</p>
          </div>
        );
      }

      return (
        <div className="report-tab">
          <div className="report-content">
            <AnalysisResults />
          </div>
        </div>
      );
    };

    if (!workflowState.completedStages.has('step3')) {
      return (
        <div className="step4-pending">
          <h4>📋 5단계 대기 중</h4>
          <p>4단계 컬쳐맵 생성이 완료되면 최종 보고서 작성이 시작됩니다.</p>
        </div>
      );
    }

    return (
      <div className="step4-report-stage">
        <div className="step4-header">
          <h4>📋 5단계: 최종 분석 보고서 & 시각화</h4>
          <div className="step4-tabs">
            <button
              className={`tab-button ${activeTab === 'report' ? 'active' : ''}`}
              onClick={() => setActiveTab('report')}
            >
              📄 분석 보고서
            </button>
            <button
              className={`tab-button ${activeTab === 'visualization' ? 'active' : ''}`}
              onClick={() => setActiveTab('visualization')}
            >
              📊 인터랙티브 시각화
            </button>
          </div>
        </div>

        <div className="step4-content">
          {activeTab === 'report' ? <ReportTab /> : <VisualizationTab />}
        </div>
      </div>
    );
  };

  // 워크플로우 진행 상황 업데이트
  const handleProgressUpdate = (updatedState: AnalysisWorkflowState, message?: string) => {
    setWorkflowState(updatedState);
    if (message) {
      setProgressMessage(message);
    }
  };

  // 새로운 분석 시작
  const handleStartNewAnalysis = () => {
    if (analysisMode === 'auto') {
      setShowFileSelector(true);
    } else if (analysisMode === 'manual') {
      setShowManualInput(true);
    } else if (analysisMode === 'prompt') {
      setShowPromptGenerator(true);
    }

    setWorkflowState({
      stage: 'step0',
      step0Data: null,
      step1Data: null,
      step2Data: null,
      step3Data: null,
      step4Data: null,
      progress: 0,
      isProcessing: false,
      completedStages: new Set(),
    });
  };

  // 수동 입력 모드 처리
  const handleManualContentSubmitted = async (content: string, title: string) => {
    if (!activeProject) {
      alert('활성 프로젝트를 먼저 선택해주세요.');
      return;
    }

    // 가상의 파일 정보 생성
    const manualFileInfo: DriveFileInfo = {
      id: `manual_${Date.now()}`,
      name: title + '.txt',
      mimeType: 'text/plain',
      size: content.length,
      modifiedTime: new Date().toISOString(),
      parents: [],
      webViewLink: '',
      description: '수동 입력된 텍스트',
    };

    setSelectedFile(manualFileInfo);
    setShowManualInput(false);

    try {
      console.log('🚀 수동 분석 과정 시작:', title);

      await driveAnalysisService.startAutomatedAnalysisWorkflow(
        content,
        activeProject.id,
        manualFileInfo,
        handleProgressUpdate
      );

      // 결과는 이제 내부적으로 처리됨

      if (onAnalysisComplete) {
        // onAnalysisComplete(finalResult); // finalResult 타입이 더 이상 FourLayerAnalysisResult가 아님
      }

      console.log('✅ 수동 분석 과정 완료');
    } catch (error) {
      console.error('❌ 수동 분석 과정 실패:', error);
      setWorkflowState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.',
      }));
    }
  };

  // 수동 입력 취소
  const handleCancelManualInput = () => {
    setShowManualInput(false);
  };

  // 프롬프트 생성 모드 핸들러들
  const handlePromptGenerateMap = (text: string) => {
    // AI가 생성한 컬쳐맵 텍스트를 파싱하여 시각화
    try {
      const parsed = parseAIOutput(text);
      setPromptNotes(parsed.notes);
      setPromptConnections(parsed.connections);
      console.log('🎨 프롬프트 컬쳐맵 생성 완료:', parsed);
    } catch (error) {
      console.error('❌ 컬쳐맵 파싱 실패:', error);
      alert('컬쳐맵 텍스트 파싱에 실패했습니다. 형식을 확인해주세요.');
    }
  };

  const handlePromptClear = () => {
    setPromptNotes([]);
    setPromptConnections([]);
  };

  const handlePromptShowReport = (report: string) => {
    // 보고서를 별도 창이나 모달로 표시
    const reportWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
    if (reportWindow) {
      reportWindow.document.write(`
        <html>
          <head>
            <title>조직문화 분석 보고서</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; margin: 40px; }
              h1, h2, h3 { color: #2c3e50; }
              p { margin-bottom: 16px; }
              pre { background: #f8f9fa; padding: 16px; border-radius: 8px; overflow-x: auto; }
            </style>
          </head>
          <body>
            <h1>조직문화 분석 보고서</h1>
            <div>${report.replace(/\n/g, '<br>')}</div>
          </body>
        </html>
      `);
      reportWindow.document.close();
    }
  };

  // const handleCancelPromptGenerator = () => {
  //   setShowPromptGenerator(false);
  // }; // 미사용

  // parseAIOutput 함수 (기존 메인화면과 동일한 로직)
  const parseAIOutput = (text: string): { notes: NoteData[]; connections: ConnectionData[] } => {
    const notes: NoteData[] = [];
    const connections: ConnectionData[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    let yPosition = 100;
    const xPositions = { result: 100, behavior: 300, tangible: 500, intangible: 700 };

    for (const line of lines) {
      const trimmedLine = line.trim();

      // 결과 노트 파싱
      if (trimmedLine.startsWith('[결과]')) {
        const match = trimmedLine.match(/\[결과\]\s*\((긍정|부정)\)\s*(.+)/);
        if (match) {
          notes.push({
            id: `result_${Date.now()}_${Math.random()}`,
            text: match[2],
            x: xPositions.result,
            y: yPosition,
            type: 'result',
            layer: 1,
            category: 'results',
            sentiment: match[1] === '긍정' ? 'positive' : 'negative',
            connections: [],
          });
          yPosition += 120;
        }
      }

      // 행동 노트 파싱
      else if (trimmedLine.startsWith('[행동]')) {
        const match = trimmedLine.match(/\[행동\]\s*\((긍정|부정)\)\s*(.+)/);
        if (match) {
          notes.push({
            id: `behavior_${Date.now()}_${Math.random()}`,
            text: match[2],
            x: xPositions.behavior,
            y: yPosition,
            type: 'behavior',
            layer: 2,
            category: 'behaviors',
            sentiment: match[1] === '긍정' ? 'positive' : 'negative',
            connections: [],
          });
          yPosition += 120;
        }
      }

      // 유형 레버 파싱
      else if (trimmedLine.startsWith('[유형_레버')) {
        const match = trimmedLine.match(/\[유형_레버\/([^\]]+)\]\s*\((긍정|부정)\)\s*(.+)/);
        if (match) {
          notes.push({
            id: `tangible_${Date.now()}_${Math.random()}`,
            text: match[3],
            x: xPositions.tangible,
            y: yPosition,
            type: 'tangible_lever',
            layer: 3,
            category: match[1],
            sentiment: match[2] === '긍정' ? 'positive' : 'negative',
            connections: [],
          });
          yPosition += 120;
        }
      }

      // 무형 레버 파싱
      else if (trimmedLine.startsWith('[무형_레버]')) {
        const match = trimmedLine.match(/\[무형_레버\]\s*\((긍정|부정)\)\s*(.+)/);
        if (match) {
          notes.push({
            id: `intangible_${Date.now()}_${Math.random()}`,
            text: match[2],
            x: xPositions.intangible,
            y: yPosition,
            type: 'intangible_lever',
            layer: 4,
            category: 'culture',
            sentiment: match[1] === '긍정' ? 'positive' : 'negative',
            connections: [],
          });
          yPosition += 120;
        }
      }

      // 연결 파싱
      else if (trimmedLine.startsWith('[연결]') || trimmedLine.startsWith('[간접연결]')) {
        const isIndirect = trimmedLine.startsWith('[간접연결]');
        const connectionMatch = trimmedLine.match(
          /\[(?:간접)?연결\]\s*(.+?)\s*→\s*(.+?)\s*\((직접|간접)\)/
        );

        if (connectionMatch) {
          const fromText = connectionMatch[1].trim();
          const toText = connectionMatch[2].trim();
          const connectionType = connectionMatch[3];

          // 노트 찾기 (텍스트 매칭)
          const fromNote = notes.find(
            note => fromText.includes(note.text) || note.text.includes(fromText)
          );
          const toNote = notes.find(
            note => toText.includes(note.text) || note.text.includes(toText)
          );

          if (fromNote && toNote) {
            connections.push({
              id: `conn_${Date.now()}_${Math.random()}`,
              from: fromNote.id,
              to: toNote.id,
              type: connectionType === '직접' ? 'direct' : 'indirect',
              strength: isIndirect ? 0.5 : 0.8,
              description: `${fromNote.text} → ${toNote.text}`,
            });
          }
        }
      }
    }

    return { notes, connections };
  };

  // 파일 내용 제출 후 자동 워크플로우 시작
  const handleFileContentSubmitted = async (fileInfo: DriveFileInfo, content: string) => {
    if (!activeProject) {
      alert('활성 프로젝트를 먼저 선택해주세요.');
      return;
    }

    setSelectedFile(fileInfo);
    setShowFileSelector(false);

    try {
      console.log('🚀 자동 분석 과정 시작:', fileInfo.name);

      await driveAnalysisService.startAutomatedAnalysisWorkflow(
        content,
        activeProject.id,
        fileInfo,
        handleProgressUpdate
      );

      // 결과는 이제 내부적으로 처리됨

      if (onAnalysisComplete) {
        // onAnalysisComplete(finalResult); // finalResult 타입이 더 이상 FourLayerAnalysisResult가 아님
      }

      console.log('✅ 자동 분석 과정 완료');
    } catch (error) {
      console.error('❌ 자동 분석 과정 실패:', error);
      setWorkflowState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.',
      }));
    }
  };

  // 파일 선택 취소
  const handleCancelFileSelection = () => {
    setShowFileSelector(false);
  };

  // DOCX 보고서 다운로드
  const handleDownloadDocx = async () => {
    if (!workflowState.step4Data?.analysisResult) {
      alert('분석 결과가 없습니다.');
      return;
    }

    try {
      const fileName = selectedFile
        ? `조직문화_분석_${selectedFile.name.replace(/\.[^/.]+$/, '')}.docx`
        : '조직문화_분석_결과.docx';

      await driveAnalysisService.generateAndDownloadDocx(
        workflowState.step4Data.analysisResult,
        fileName
      );
    } catch (error) {
      console.error('DOCX 생성 실패:', error);
      alert('DOCX 보고서 생성에 실패했습니다.');
    }
  };

  // 특정 단계로 이동 (디버깅용)
  const moveToStage = (stage: WorkflowStage) => {
    setWorkflowState(prev => ({ ...prev, stage }));
  };

  // Step 2의 프롬프트 결과를 표시하는 새로운 컴포넌트
  const Step2PromptDisplay: React.FC = () => {
    const [isCopied, setIsCopied] = useState(false);
    const promptText = workflowState.step2Data as string | null;

    const handleCopyClick = () => {
      if (promptText) {
        navigator.clipboard.writeText(promptText).then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000); // 2초 후 메시지 숨김
        });
      }
    };

    if (!workflowState.completedStages.has('step2') || !promptText) {
      return null; // Step 2가 완료되지 않았거나 데이터가 없으면 아무것도 표시하지 않음
    }

    // Step 3가 시작되면 이 컴포넌트는 더 이상 표시되지 않도록 함
    if (workflowState.stage === 'step3' || workflowState.completedStages.has('step3')) {
      return null;
    }

    return (
      <div className="step2-prompt-display">
        <h3>🧠 3단계: AI 예비 분석 프롬프트 생성 완료</h3>
        <p>
          아래 생성된 프롬프트를 복사하여 Gemini와 같은 AI 도구에 붙여넣고, 1차 분석 결과를
          얻으세요. 그 결과를 다음 단계에서 사용하게 됩니다.
        </p>
        <div className="prompt-container">
          <textarea readOnly value={promptText} className="prompt-textarea" />
          <button onClick={handleCopyClick} className="copy-button">
            {isCopied ? '✅ 복사 완료!' : '📋 프롬프트 복사'}
          </button>
        </div>
        <div className="next-step-info">
          <p>
            <strong>다음 단계:</strong> 분석 결과를 얻은 후, 다음 단계로 진행하여 컬쳐맵을
            생성하세요.
          </p>
          {/* 사용자가 다음 단계로 넘어갈 수 있는 버튼이나 안내를 추가할 수 있습니다. */}
        </div>
      </div>
    );
  };

  // 분석 결과 렌더링 컴포넌트 (기존 AnalysisResults를 대체)
  const AnalysisResults: React.FC = () => {
    if (!workflowState.step4Data?.analysisResult) return null;
    const analysisResults = workflowState.step4Data.analysisResult;

    return (
      <div className="analysis-results">
        <h3>📊 Dave Gray-Schein 4층위 분석 결과</h3>

        <div className="analysis-header">
          <div className="confidence-score">
            <div>
              신뢰도: <span className="score">{analysisResults.confidence_score}%</span>
            </div>
          </div>
        </div>

        <div className="results-grid">
          <div className="result-section">
            <h4>🏛️ Layer 1: 유물/가시적 요소</h4>
            <div className="result-items">
              <div className="result-category">
                <strong>가시적 요소:</strong>{' '}
                {analysisResults.artifacts.visible_elements.join(', ')}
              </div>
              <div className="result-category">
                <strong>상징:</strong> {analysisResults.artifacts.symbols.join(', ')}
              </div>
              <div className="result-category">
                <strong>의식:</strong> {analysisResults.artifacts.rituals.join(', ')}
              </div>
            </div>
          </div>

          <div className="result-section">
            <h4>👥 Layer 2: 행동 패턴</h4>
            <div className="result-items">
              <div className="result-category">
                <strong>패턴:</strong> {analysisResults.behaviors.patterns.join(', ')}
              </div>
              <div className="result-category">
                <strong>상호작용:</strong> {analysisResults.behaviors.interactions.join(', ')}
              </div>
            </div>
          </div>

          <div className="result-section">
            <h4>💎 Layer 3: 규범/가치</h4>
            <div className="result-items">
              <div className="result-category">
                <strong>명시된 가치:</strong>{' '}
                {analysisResults.norms_values.stated_values.join(', ')}
              </div>
              <div className="result-category">
                <strong>암묵적 규범:</strong>{' '}
                {analysisResults.norms_values.implicit_norms.join(', ')}
              </div>
            </div>
          </div>

          <div className="result-section">
            <h4>🧠 Layer 4: 기본 가정</h4>
            <div className="result-items">
              <div className="result-category">
                <strong>기본 가정:</strong>{' '}
                {analysisResults.assumptions.basic_assumptions.join(', ')}
              </div>
              <div className="result-category">
                <strong>정신 모델:</strong> {analysisResults.assumptions.mental_models.join(', ')}
              </div>
            </div>
          </div>

          <div className="result-section insights">
            <h4>💡 핵심 인사이트</h4>
            <div className="insight-grid">
              <div className="insight-item">
                <strong>패턴:</strong> {analysisResults.insights.patterns.join(', ')}
              </div>
              <div className="insight-item">
                <strong>기회:</strong> {analysisResults.insights.opportunities.join(', ')}
              </div>
              <div className="insight-item">
                <strong>권고사항:</strong> {analysisResults.insights.recommendations.join(', ')}
              </div>
            </div>
          </div>
        </div>

        <div className="academic-references">
          <h4>📚 학술적 참고문헌</h4>
          <ul>
            {analysisResults.academic_references.map((ref, index) => (
              <li key={index}>{ref}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  // 메인 렌더링
  return (
    <div className="drive-analysis-panel">
      <div className="panel-header">
        <h2>📂 조직문화 문서 분석</h2>
        <p>AI가 5단계에 걸쳐 체계적으로 분석하여 실행 가능한 인사이트를 제공합니다</p>
      </div>

      {!activeProject ? (
        <div className="no-project-warning">
          <div className="warning-icon">⚠️</div>
          <div className="warning-content">
            <h3>프로젝트를 먼저 선택해주세요</h3>
            <p>자료 분석을 시작하려면 활성 프로젝트가 필요합니다.</p>
          </div>
        </div>
      ) : (
        <>
          {/* 분석 모드 선택 탭 (3가지 모드) */}
          <div className="analysis-mode-selector">
            <div className="mode-tabs">
              <button
                className={`mode-tab ${analysisMode === 'auto' ? 'active' : ''}`}
                onClick={() => setAnalysisMode('auto')}
                title="Google Drive 파일을 자동으로 연동하여 AI가 5단계로 체계적 분석"
              >
                🔗 자동 연동 분석
              </button>
              <button
                className={`mode-tab ${analysisMode === 'manual' ? 'active' : ''}`}
                onClick={() => setAnalysisMode('manual')}
                title="텍스트를 직접 입력하거나 파일 업로드하여 AI가 5단계로 체계적 분석"
              >
                📝 수동 입력 분석
              </button>
              <button
                className={`mode-tab ${analysisMode === 'prompt' ? 'active' : ''}`}
                onClick={() => setAnalysisMode('prompt')}
                title="다른 AI 도구를 활용한 단계별 프롬프트 생성 및 컬쳐맵 시각화"
              >
                🎯 프롬프트 생성
              </button>
            </div>
            <div className="mode-description">
              {analysisMode === 'auto' && (
                <p>
                  Google Drive에서 파일을 선택하여 <strong>AI가 완전 자동으로 5단계 분석</strong>을
                  진행합니다.
                </p>
              )}
              {analysisMode === 'manual' && (
                <p>
                  텍스트를 직접 입력하거나 파일을 업로드하여{' '}
                  <strong>AI가 완전 자동으로 5단계 분석</strong>을 진행합니다.
                </p>
              )}
              {analysisMode === 'prompt' && (
                <p>
                  <strong>NotebookLM, Gemini, Claude 등 다양한 AI 도구</strong>를 활용한 프롬프트를
                  생성하고 결과를 시각화합니다.
                </p>
              )}
            </div>
            <div className="mode-benefits">
              {analysisMode === 'auto' && (
                <div className="benefits-list">
                  <span className="benefit">🚀 완전 자동화</span>
                  <span className="benefit">📊 MCP 연동</span>
                  <span className="benefit">🔄 실시간 진행률</span>
                </div>
              )}
              {analysisMode === 'manual' && (
                <div className="benefits-list">
                  <span className="benefit">📝 유연한 입력</span>
                  <span className="benefit">📁 파일 업로드</span>
                  <span className="benefit">🎯 즉시 분석</span>
                </div>
              )}
              {analysisMode === 'prompt' && (
                <div className="benefits-list">
                  <span className="benefit">🎨 맞춤 프롬프트</span>
                  <span className="benefit">🔧 AI 도구 선택</span>
                  <span className="benefit">👁️ 실시간 시각화</span>
                </div>
              )}
            </div>
          </div>

          <WorkflowTracker />

          {selectedFile && (
            <div className="selected-file-info">
              <h4>📁 선택한 문서</h4>
              <div className="file-card">
                <span className="file-name">{selectedFile.name}</span>
                <span className="file-type">{selectedFile.mimeType}</span>
              </div>
            </div>
          )}

          {workflowState.isProcessing && (
            <div className="processing-status">
              <div className="loading-spinner"></div>
              <div className="progress-text">분석 진행 중: {progressMessage}</div>
            </div>
          )}

          {workflowState.error && (
            <div className="error-message">
              <div className="error-icon">❌</div>
              <div className="error-text">오류가 발생했습니다: {workflowState.error}</div>
              <button
                className="retry-btn"
                onClick={() => setWorkflowState(prev => ({ ...prev, error: undefined }))}
              >
                다시 시도
              </button>
            </div>
          )}

          {workflowState.stage === 'step0' && workflowState.completedStages.size === 0 && (
            <div className="analysis-start">
              <div className="start-content">
                <h3>조직문화 분석을 시작해보세요</h3>
                {analysisMode === 'auto' && (
                  <p>
                    Google Drive에서 인터뷰, 회의록, 설문조사 등 조직문화 관련 문서를 선택하면 AI가
                    5단계에 걸쳐 체계적으로 분석합니다.
                  </p>
                )}
                {analysisMode === 'manual' && (
                  <p>
                    인터뷰 내용, 회의록, 설문 답변 등을 직접 입력하거나 파일로 업로드하여 AI가
                    5단계에 걸쳐 체계적으로 분석합니다.
                  </p>
                )}
                {analysisMode === 'prompt' && (
                  <p>
                    NotebookLM, Gemini, Claude 등 다양한 AI 도구를 활용할 수 있는 전문 프롬프트를
                    생성하고, 결과를 실시간으로 시각화할 수 있습니다.
                  </p>
                )}

                {analysisMode !== 'prompt' && (
                  <ul className="workflow-benefits">
                    <li>
                      🎤 <strong>1단계:</strong> 음성 전사 - 인터뷰나 회의 내용을 텍스트로 변환
                    </li>
                    <li>
                      📊 <strong>2단계:</strong> 데이터 추출 - 핵심 키워드와 패턴 자동 추출
                    </li>
                    <li>
                      🧠 <strong>3단계:</strong> 예비 분석 - AI가 조직문화 요소들을 1차 분석
                    </li>
                    <li>
                      🗺️ <strong>4단계:</strong> 컬쳐맵 생성 - 4층위 모델로 구조 시각화
                    </li>
                    <li>
                      📋 <strong>5단계:</strong> 최종 보고서 - 실행 가능한 개선 방안 제공
                    </li>
                  </ul>
                )}

                {analysisMode === 'prompt' && (
                  <ul className="workflow-benefits">
                    <li>
                      📋 <strong>워크샵 분석:</strong> 포스트잇 사진을 AI로 분석하여 즉시 컬쳐맵
                      생성
                    </li>
                    <li>
                      🔗 <strong>Google Drive 분석:</strong> 3단계 AI 파이프라인 (NotebookLM →
                      Gemini → Claude)
                    </li>
                    <li>
                      🎨 <strong>실시간 시각화:</strong> AI 결과를 드래그앤드롭 가능한 인터랙티브
                      맵으로 변환
                    </li>
                    <li>
                      📄 <strong>프롬프트 복사:</strong> 각 AI 도구에 최적화된 프롬프트를 원클릭으로
                      복사
                    </li>
                    <li>
                      📊 <strong>심층 분석:</strong> 생성된 컬쳐맵 기반으로 추가 분석 프롬프트 자동
                      생성
                    </li>
                  </ul>
                )}

                <button className="start-btn" onClick={handleStartNewAnalysis}>
                  {analysisMode === 'auto' && '🔗 자동 분석 시작'}
                  {analysisMode === 'manual' && '📝 수동 분석 시작'}
                  {analysisMode === 'prompt' && '🎯 프롬프트 생성 시작'}
                </button>
              </div>
            </div>
          )}

          {showFileSelector && (
            <div className="file-selector-container">
              <DriveFileSelector
                onFileContentSubmitted={handleFileContentSubmitted}
                onCancel={handleCancelFileSelection}
              />
            </div>
          )}

          {showManualInput && (
            <div className="manual-input-container">
              <ManualInputSection
                onContentSubmitted={handleManualContentSubmitted}
                onCancel={handleCancelManualInput}
              />
            </div>
          )}

          {showPromptGenerator && (
            <div className="prompt-generator-container">
              <PromptGenerator
                onGenerateMap={handlePromptGenerateMap}
                onClear={handlePromptClear}
                onShowReport={handlePromptShowReport}
                notes={promptNotes}
                connections={promptConnections}
              />
            </div>
          )}

          {/* 프롬프트 생성 모드의 컬쳐맵 시각화 */}
          {analysisMode === 'prompt' && promptNotes.length > 0 && (
            <div className="prompt-visualization-section">
              <div className="visualization-header">
                <h3>🎨 생성된 컬쳐맵</h3>
                <div className="visualization-info">
                  <span className="note-count">노트: {promptNotes.length}개</span>
                  <span className="connection-count">연결: {promptConnections.length}개</span>
                  <button
                    className="clear-map-btn"
                    onClick={handlePromptClear}
                    title="컬쳐맵 초기화"
                  >
                    🗑️ 초기화
                  </button>
                </div>
              </div>

              <div className="culture-map-container">
                <div
                  className="canvas-container"
                  style={{ position: 'relative', width: '100%', height: '600px' }}
                >
                  <ConnectionsLayer
                    connections={promptConnections}
                    notes={promptNotes}
                    onConnectionContextMenu={() => {}}
                    onUpdateConnection={() => {}}
                    onDeleteConnection={() => {}}
                    editingItems={{}}
                  />

                  {promptNotes.map(note => (
                    <StickyNote
                      key={note.id}
                      note={note}
                      onMouseDown={() => {}}
                      onResizeStart={() => {}}
                      onConnectStart={() => {}}
                      onToggleSentiment={() => {}}
                      onClick={() => {}}
                      onUpdate={() => {}}
                      onContextMenu={() => {}}
                      isConnecting={false}
                      isSelected={false}
                      isEditing={false}
                      connectingNoteId={null}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {workflowState.completedStages.size > 0 && workflowState.completedStages.size < 5 && (
            <div className="workflow-progress">
              <h4>📈 분석 진행 현황</h4>
              <div className="stage-status-grid">
                {workflowState.completedStages.has('step0') && (
                  <div className="stage-status completed">
                    <span className="stage-icon">✅</span>
                    <div>
                      <strong>1단계 완료</strong>
                      <p>음성 전사 완료</p>
                    </div>
                  </div>
                )}

                {workflowState.completedStages.has('step1') && (
                  <div className="stage-status completed">
                    <span className="stage-icon">✅</span>
                    <div>
                      <strong>2단계 완료</strong>
                      <p>데이터 추출 완료</p>
                    </div>
                  </div>
                )}

                {workflowState.completedStages.has('step2') && (
                  <div className="stage-status completed">
                    <span className="stage-icon">✅</span>
                    <div>
                      <strong>3단계 완료</strong>
                      <p>예비 분석 완료</p>
                    </div>
                  </div>
                )}

                {workflowState.completedStages.has('step3') && (
                  <div className="stage-status completed">
                    <span className="stage-icon">✅</span>
                    <div>
                      <strong>4단계 완료</strong>
                      <p>컬쳐맵 생성 완료</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <Step2PromptDisplay />

          {(workflowState.stage === 'step4' || workflowState.completedStages.has('step3')) && (
            <Step4ReportStage />
          )}

          {workflowState.completedStages.has('step4') && <AnalysisResults />}

          {workflowState.completedStages.has('step4') && (
            <div className="analysis-actions">
              <button
                className="download-docx-btn"
                onClick={handleDownloadDocx}
                disabled={workflowState.isProcessing}
              >
                📄 분석 보고서 다운로드
              </button>
              <button className="new-analysis-btn" onClick={handleStartNewAnalysis}>
                🚀 새 분석 시작
              </button>
            </div>
          )}

          {process.env.NODE_ENV === 'development' && (
            <div className="workflow-debug">
              <h4>🛠️ 개발자 도구</h4>
              <div className="debug-buttons">
                <button onClick={() => moveToStage('step0')}>➡️ Step 0</button>
                <button onClick={() => moveToStage('step1')}>➡️ Step 1</button>
                <button onClick={() => moveToStage('step2')}>➡️ Step 2</button>
                <button onClick={() => moveToStage('step3')}>➡️ Step 3</button>
                <button onClick={() => moveToStage('step4')}>➡️ Step 4</button>
              </div>
              <div className="debug-info">
                <p>
                  <strong>현재 단계:</strong> {workflowState.stage}
                </p>
                <p>
                  <strong>완료된 단계:</strong>{' '}
                  {Array.from(workflowState.completedStages).join(', ')}
                </p>
                <p>
                  <strong>진행률:</strong> {workflowState.progress}%
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {contextMenu && (
        <ContextMenu {...contextMenu} onClose={handleVisualizationCloseContextMenu} />
      )}
    </div>
  );
};

export default DriveAnalysisPanel;

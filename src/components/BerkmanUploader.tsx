/**
 * 버크만 진단 레포트 업로더 컴포넌트
 * 
 * PDF 파일 드래그 앤 드롭 또는 클릭으로 업로드
 * Gemini File API를 통해 분석 수행
 */

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { aiService } from '../services/AIService';
import './BerkmanUploader.css';

interface BerkmanUploaderProps {
    onAnalysisComplete?: (result: string) => void;
    cultureMapContext?: string;
}

type UploadState = 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error';

export function BerkmanUploader({
    onAnalysisComplete,
    cultureMapContext
}: BerkmanUploaderProps) {
    const [uploadState, setUploadState] = useState<UploadState>('idle');
    const [fileName, setFileName] = useState<string>('');
    const [analysisResult, setAnalysisResult] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(async (file: File) => {
        // 파일 검증
        if (!file.type.includes('pdf')) {
            setErrorMessage('PDF 파일만 업로드 가능합니다.');
            setUploadState('error');
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            setErrorMessage('파일 크기는 50MB 이하여야 합니다.');
            setUploadState('error');
            return;
        }

        // API 설정 확인
        if (!aiService.getConfig()) {
            setErrorMessage('AI API 설정을 먼저 완료해주세요.');
            setUploadState('error');
            return;
        }

        setFileName(file.name);
        setErrorMessage('');

        try {
            // 1. 파일 업로드
            setUploadState('uploading');
            const fileMetadata = await aiService.uploadPDF(file);
            console.log('📤 파일 업로드 완료:', fileMetadata);

            // 2. 버크만 분석 수행
            setUploadState('analyzing');
            const result = await aiService.analyzeBerkmanReport(
                fileMetadata.uri,
                fileMetadata.mimeType,
                cultureMapContext
            );

            setAnalysisResult(result);
            setUploadState('complete');
            onAnalysisComplete?.(result);

        } catch (error) {
            console.error('❌ 버크만 분석 실패:', error);
            setErrorMessage(
                error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.'
            );
            setUploadState('error');
        }
    }, [onAnalysisComplete, cultureMapContext]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleReset = useCallback(() => {
        setUploadState('idle');
        setFileName('');
        setAnalysisResult('');
        setErrorMessage('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    const renderContent = () => {
        switch (uploadState) {
            case 'uploading':
                return (
                    <div className="berkman-status">
                        <Loader2 className="berkman-spinner" size={32} />
                        <p className="berkman-status-text">파일 업로드 중...</p>
                        <p className="berkman-file-name">{fileName}</p>
                    </div>
                );

            case 'analyzing':
                return (
                    <div className="berkman-status">
                        <Loader2 className="berkman-spinner" size={32} />
                        <p className="berkman-status-text">버크만 레포트 분석 중...</p>
                        <p className="berkman-hint">AI가 강점과 변화 요인을 분석하고 있습니다</p>
                    </div>
                );

            case 'complete':
                return (
                    <div className="berkman-complete">
                        <div className="berkman-complete-header">
                            <CheckCircle className="berkman-success-icon" size={24} />
                            <span>분석 완료</span>
                            <button className="berkman-reset-btn" onClick={handleReset}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className="berkman-result">
                            <pre>{analysisResult}</pre>
                        </div>
                    </div>
                );

            case 'error':
                return (
                    <div className="berkman-error">
                        <AlertCircle className="berkman-error-icon" size={32} />
                        <p className="berkman-error-text">{errorMessage}</p>
                        <button className="berkman-retry-btn" onClick={handleReset}>
                            다시 시도
                        </button>
                    </div>
                );

            default:
                return (
                    <>
                        <Upload className="berkman-upload-icon" size={48} />
                        <p className="berkman-upload-title">버크만 진단 레포트 업로드</p>
                        <p className="berkman-upload-hint">
                            PDF 파일을 드래그하거나 클릭하여 선택하세요
                        </p>
                        <p className="berkman-upload-formats">지원 형식: PDF (최대 50MB)</p>
                    </>
                );
        }
    };

    return (
        <div className="berkman-uploader">
            <div
                className={`berkman-dropzone ${isDragging ? 'dragging' : ''} ${uploadState}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={uploadState === 'idle' ? handleClick : undefined}
            >
                {renderContent()}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileInput}
                style={{ display: 'none' }}
            />

            {uploadState === 'idle' && (
                <div className="berkman-sample-info">
                    <FileText size={16} />
                    <span>샘플 파일: 버크만시그니쳐리포트_샘플.pdf</span>
                </div>
            )}
        </div>
    );
}

export default BerkmanUploader;

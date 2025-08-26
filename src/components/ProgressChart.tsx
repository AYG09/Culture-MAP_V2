// src/components/ProgressChart.tsx

import React from 'react';
import type { ProjectProgress } from '../types/culture';
import './ProgressChart.css';

interface ProgressChartProps {
  progress: ProjectProgress;
}

const ProgressChart: React.FC<ProgressChartProps> = ({ progress }) => {
  const getProgressPercentage = (completed: number, total: number): number => {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  };

  const interviewProgress = getProgressPercentage(
    progress.completed_interviews,
    progress.total_interviews
  );

  const transcriptionProgress = getProgressPercentage(
    progress.transcribed_interviews,
    progress.completed_interviews
  );

  const analysisProgress = getProgressPercentage(
    progress.analyzed_interviews,
    progress.transcribed_interviews
  );

  const layerProgressItems = [
    {
      name: '유물/가시적 요소',
      key: 'artifacts' as const,
      description: '관찰 가능한 조직의 물리적/상징적 요소',
    },
    {
      name: '행동 패턴',
      key: 'behaviors' as const,
      description: '구성원들의 일상적 행동과 상호작용',
    },
    {
      name: '규범/가치',
      key: 'norms_values' as const,
      description: '명시적/암묵적 규칙과 공유 가치',
    },
    {
      name: '기본 가정',
      key: 'assumptions' as const,
      description: '깊이 내재된 무의식적 믿음과 가정',
    },
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="progress-chart">
      {/* 전체 진행률 요약 */}
      <div className="progress-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-value">{progress.completed_interviews}</span>
            <span className="stat-label">완료된 인터뷰</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{progress.insights_count}</span>
            <span className="stat-label">도출된 인사이트</span>
          </div>
        </div>
        <div className="last-activity">마지막 활동: {formatDate(progress.last_activity)}</div>
      </div>

      {/* 인터뷰 단계별 진행률 */}
      <div className="workflow-progress">
        <h4>인터뷰 워크플로우</h4>

        <div className="workflow-step">
          <div className="step-header">
            <span className="step-name">인터뷰 수행</span>
            <span className="step-ratio">
              {progress.completed_interviews}/{progress.total_interviews}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${interviewProgress}%` }} />
          </div>
          <span className="progress-percentage">{interviewProgress}%</span>
        </div>

        <div className="workflow-step">
          <div className="step-header">
            <span className="step-name">음성 전사</span>
            <span className="step-ratio">
              {progress.transcribed_interviews}/{progress.completed_interviews}
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill transcription"
              style={{ width: `${transcriptionProgress}%` }}
            />
          </div>
          <span className="progress-percentage">{transcriptionProgress}%</span>
        </div>

        <div className="workflow-step">
          <div className="step-header">
            <span className="step-name">4층위 분석</span>
            <span className="step-ratio">
              {progress.analyzed_interviews}/{progress.transcribed_interviews}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill analysis" style={{ width: `${analysisProgress}%` }} />
          </div>
          <span className="progress-percentage">{analysisProgress}%</span>
        </div>
      </div>

      {/* 4층위 분석 진행률 */}
      <div className="layer-progress">
        <h4>Dave Gray-Schein 4층위 분석 진행률</h4>
        {layerProgressItems.map((layer, index) => {
          const layerValue = progress.layer_completion[layer.key];
          return (
            <div key={layer.key} className="layer-item">
              <div className="layer-header">
                <div className="layer-info">
                  <span className="layer-index">L{index + 1}</span>
                  <div className="layer-details">
                    <span className="layer-name">{layer.name}</span>
                    <span className="layer-description">{layer.description}</span>
                  </div>
                </div>
                <span className="layer-percentage">{layerValue}%</span>
              </div>
              <div className="progress-bar layer-bar">
                <div
                  className={`progress-fill layer-${index + 1}`}
                  style={{ width: `${layerValue}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressChart;

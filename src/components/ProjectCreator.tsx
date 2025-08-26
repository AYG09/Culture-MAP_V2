// src/components/ProjectCreator.tsx

import React, { useState } from 'react';
import type { CultureProject } from '../types/culture';
import { cultureStateService } from '../services/CultureStateService';
import './ProjectCreator.css';

interface ProjectCreatorProps {
  onProjectCreated: (project: CultureProject) => void;
  onCancel: () => void;
  onEditingChange?: (isEditing: boolean) => void; // 편집 상태 변경 콜백
}

const ProjectCreator: React.FC<ProjectCreatorProps> = ({
  onProjectCreated,
  onCancel,
  onEditingChange,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    organization: '',
    status: 'active' as CultureProject['status'],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '프로젝트 이름을 입력해주세요.';
    } else if (formData.name.length < 2) {
      newErrors.name = '프로젝트 이름은 최소 2자 이상이어야 합니다.';
    }

    if (!formData.organization.trim()) {
      newErrors.organization = '조직명을 입력해주세요.';
    }

    // Description is now optional - no validation required

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const newProject = await cultureStateService.createProject(formData);
      if (newProject) {
        // 편집 상태 해제
        if (onEditingChange) {
          onEditingChange(false);
        }
        onProjectCreated(newProject);
      } else {
        alert('프로젝트 생성에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('프로젝트 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // 입력 시 해당 필드의 에러 메시지 제거
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    // 편집 상태 알림
    if (onEditingChange) {
      onEditingChange(true);
    }
  };

  return (
    <div className="project-creator">
      <div className="creator-header">
        <h2>새 조직문화 분석 프로젝트 생성</h2>
        <p>Dave Gray-Schein 4층위 분석 방법론을 활용한 조직문화 분석 프로젝트를 시작합니다.</p>
      </div>

      <form onSubmit={handleSubmit} className="creator-form">
        <div className="form-group">
          <label htmlFor="name" className="form-label">
            프로젝트 이름 *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className={`form-input ${errors.name ? 'error' : ''}`}
            placeholder="예: 2024년 A팀 조직문화 분석"
            maxLength={100}
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="organization" className="form-label">
            조직명 *
          </label>
          <input
            type="text"
            id="organization"
            name="organization"
            value={formData.organization}
            onChange={handleInputChange}
            className={`form-input ${errors.organization ? 'error' : ''}`}
            placeholder="예: ABC 회사 마케팅팀"
            maxLength={100}
          />
          {errors.organization && <span className="error-message">{errors.organization}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="description" className="form-label">
            프로젝트 설명
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            className={`form-textarea ${errors.description ? 'error' : ''}`}
            placeholder="간단한 메모 (선택사항)"
            rows={4}
            maxLength={500}
          />
          <div className="char-count">{formData.description.length}/500</div>
          {errors.description && <span className="error-message">{errors.description}</span>}
        </div>

        {/* 상태는 자동으로 active로 설정됨 - 사용자 선택 불필요 */}

        <div className="form-actions">
          <button
            type="button"
            onClick={() => {
              // 편집 상태 해제
              if (onEditingChange) {
                onEditingChange(false);
              }
              onCancel();
            }}
            className="cancel-btn"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button type="submit" className="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? '생성 중...' : '프로젝트 생성'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectCreator;

// src/services/FourLayerAnalysisEngine.ts

import { promptLoader } from '../utils/promptLoader';

/**
 * Step 2: Gemini 1차 분석 프롬프트 생성 엔진
 * 사용자의 텍스트를 기반으로 Gemini 분석용 프롬프트를 생성합니다.
 */
class FourLayerAnalysisEngine {
  /**
   * Step 2 분석용 프롬프트를 생성합니다.
   * @param text - 분석할 원본 텍스트 (인터뷰 내용 등)
   * @returns AI 분석을 위한 완전한 프롬프트 문자열
   */
  async generateStep2Prompt(text: string): Promise<string> {
    console.log('🚀 Step 2 프롬프트 생성 시작...', { textLength: text.length });

    try {
      // 1. Step 2 프롬프트 템플릿 로드
      const promptResult = await promptLoader.loadPrompt(2);

      if (!promptResult.success || !promptResult.content) {
        console.error('❌ Step 2 프롬프트 템플릿 로딩 실패', promptResult.error);
        // 실패 시에도 최소한의 분석을 수행할 수 있도록 기본 프롬프트를 구성
        return `아래 내용을 분석해주세요:\n\n---\n\n${text}`;
      }

      // 2. 템플릿과 원본 텍스트 결합
      // Gemini에 명확한 지시를 위해, 분석할 데이터를 상단에 배치하고 구분선을 추가합니다.
      const finalPrompt = `
# 분석 대상 자료

아래에 제공된 인터뷰 텍스트를 분석하여 다음 지침에 따라 조직문화 1차 분석 보고서를 작성해주세요.

---
[인터뷰 내용 시작]
---

${text}

---
[인터뷰 내용 끝]
---

${promptResult.content}
      `.trim();

      console.log('✅ Step 2 프롬프트 생성 완료');
      return finalPrompt;
    } catch (error) {
      console.error('❌ Step 2 프롬프트 생성 중 심각한 오류 발생:', error);
      throw new Error(
        `Step 2 프롬프트 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export const fourLayerAnalysisEngine = new FourLayerAnalysisEngine();
export default FourLayerAnalysisEngine;

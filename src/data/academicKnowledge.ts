/**
 * 학술 지식 베이스 - AI가 조회할 수 있는 정적 지식 데이터
 */

export interface KnowledgeItem {
    author: string;
    modelName: string;
    description: string;
    keyConcepts: string[];
    details: string;
}

export const ACADEMIC_KNOWLEDGE: Record<string, KnowledgeItem> = {
    schein: {
        author: "Edgar Schein",
        modelName: "Organizational Culture Pyramid (3 Levels)",
        description: "조직문화의 근본적인 층위를 3단계(인공물, 표방하는 가치, 근본 가정)로 분석하는 모델입니다.",
        keyConcepts: ["Artifacts", "Espoused Values", "Basic Underlying Assumptions"],
        details: `
            1. 인공물(Artifacts): 눈에 보이는 조직의 물리적 환경, 가구, 의복, 언어, 기술, 제품, 예술품 등.
            2. 표방하는 가치(Espoused Values): 전략, 목표, 철학(표방하는 정당성). 조직이 공식적으로 내세우는 가치관.
            3. 근본 가정(Basic Underlying Assumptions): 무의식적이고 당연하게 받아들여지는 믿음, 지각, 사고, 감정. 문화의 본질이자 변하기 가장 어려운 부분.
        `
    },
    robbins: {
        author: "Stephen Robbins",
        modelName: "Organizational Effectiveness Model",
        description: "조직의 목적 달성 정도를 측정하고 관리하는 다차원적 효과성 모델입니다.",
        keyConcepts: ["Goal Attainment", "Systems Approach", "Strategic Constituencies", "Competing Values"],
        details: `
            1. 목표 달성 접근법: 조직의 최종 성과와 목적 달성 여부에 집중.
            2. 시스템 접근법: 자원 획득, 변환 과정, 산출물의 유기적 연결 중시.
            3. 전략적 이해관계자 접근법: 주요 이해관계자들의 만족도를 기준으로 효과성 측정.
            4. 경합 가치 접근법: 조직 운영의 상충하는 가치들(유연성 vs 통제, 내부 vs 외부) 사이의 균형 강조.
        `
    },
    cummings: {
        author: "Cummings & Worley",
        modelName: "Organization Development and Change",
        description: "조직의 변혁과 개발을 위한 체계적인 진단 및 개입 전략을 제공합니다.",
        keyConcepts: ["Strategic Change", "Intervention Design", "Continuous Improvement", "Organizational Learning"],
        details: `
            1. 조직 진단: 조직 전체, 부서, 직무 수준에서의 체계적 진단.
            2. 개입 전략: 인간 프로세스 개입, 기술-구조적 개입, 인적 자원 관리 개입, 전략적 개입.
            3. 변화 관리: 변화에 대한 저항 관리, 변화의 동기 유발, 비전 수립, 정치적 지지 확보 등.
        `
    }
};

/**
 * 주제어 기반 검색 함수
 */
export const searchKnowledge = (query: string): string => {
    const q = query.toLowerCase();
    if (q.includes('schein') || q.includes('샤인') || q.includes('3층위') || q.includes('피라미드')) {
        return JSON.stringify(ACADEMIC_KNOWLEDGE.schein);
    }
    if (q.includes('robbins') || q.includes('로빈스') || q.includes('효과성')) {
        return JSON.stringify(ACADEMIC_KNOWLEDGE.robbins);
    }
    if (q.includes('cummings') || q.includes('커밍스') || q.includes('변화') || q.includes('od')) {
        return JSON.stringify(ACADEMIC_KNOWLEDGE.cummings);
    }

    // 포괄적 검색 (모든 키 인식)
    const result = Object.values(ACADEMIC_KNOWLEDGE).find(item =>
        item.author.toLowerCase().includes(q) ||
        item.modelName.toLowerCase().includes(q) ||
        item.description.includes(q)
    );

    return result ? JSON.stringify(result) : "해당 주제에 대한 학술 지식을 찾을 수 없습니다. (Schein, Robbins, Cummings 관련 주제로 검색 가능)";
};

// src/contexts/ConsultingContextDef.ts
import { createContext } from 'react';

/**
 * 한국 조직문화 특성 플래그
 */
export interface KoreanCultureFlags {
  silence: boolean;           // 침묵 빈도 (동의/불편함의 간접 표현)
  faceSaving: boolean;        // 체면 문화 (직접적 비판 회피)
  humor: boolean;             // 풍자-해학 (간접적 의견 표현)
  consideration: boolean;     // 배려/겸손 (자기 주장 절제)
  hierarchy: boolean;         // 위계 문화 (권위에 대한 복종)
  collectivism: boolean;      // 집단주의 (개인보다 조직 우선)
  other: string;              // 기타 관찰된 특성
}

/**
 * 컨설팅 모드 컨텍스트 값
 * Step 2-3 간 톤앤매너, 긍부정성, 한국문화, 관찰노트 공유
 */
export interface ConsultingContextValue {
  toneAndManner: string;       // 조직 구성원 톤앤매너
  positivity: string;          // 긍정성 수준
  negativity: string;          // 부정성 수준
  observationNote: string;     // 컨설턴트 관찰 노트
  koreanCulture: KoreanCultureFlags;  // 한국 문화 특성
  setContext: (value: Partial<ConsultingContextValue>) => void;  // 상태 업데이트 함수
}

export const ConsultingContext = createContext<ConsultingContextValue | null>(null);

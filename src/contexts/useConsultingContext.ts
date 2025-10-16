// src/contexts/useConsultingContext.ts
import { useContext } from 'react';
import { ConsultingContext } from './ConsultingContextDef';
import type { ConsultingContextValue } from './ConsultingContextDef';

/**
 * ConsultingContext 훅
 * Provider 외부에서 사용 시 에러 발생
 */
export const useConsultingContext = (): ConsultingContextValue => {
  const context = useContext(ConsultingContext);
  if (!context) {
    throw new Error('useConsultingContext must be used within ConsultingContextProvider');
  }
  return context;
};

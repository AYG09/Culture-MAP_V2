// src/contexts/ConsultingContext.tsx
import React, { useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { ConsultingContext } from './ConsultingContextDef';
import type { ConsultingContextValue } from './ConsultingContextDef';

/**
 * ConsultingContext Provider
 * React 19 Best Practice: useMemo로 context 값 메모이제이션
 */
export const ConsultingContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [context, setContextState] = useState<Omit<ConsultingContextValue, 'setContext'>>({
    toneAndManner: '',
    positivity: '',
    negativity: '',
    observationNote: '',
    koreanCulture: {
      silence: false,
      faceSaving: false,
      humor: false,
      consideration: false,
      hierarchy: false,
      collectivism: false,
      other: '',
    },
  });

  // useMemo로 context 값 메모이제이션 (React 19 Best Practice)
  // setContext 함수 재생성 방지를 위해 의존성 배열에 context만 포함
  const contextValue = useMemo<ConsultingContextValue>(() => ({
    ...context,
    setContext: (value: Partial<ConsultingContextValue>) => {
      setContextState(prev => ({
        ...prev,
        ...value,
        // koreanCulture는 중첩 객체이므로 spread operator로 병합
        koreanCulture: value.koreanCulture 
          ? { ...prev.koreanCulture, ...value.koreanCulture }
          : prev.koreanCulture,
      }));
    },
  }), [context]);

  return (
    <ConsultingContext.Provider value={contextValue}>
      {children}
    </ConsultingContext.Provider>
  );
};

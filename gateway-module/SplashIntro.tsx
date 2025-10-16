'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Users, BarChart3, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SplashIntroProps {
  onComplete: () => void;
}

const features = [
  {
    icon: Brain,
    title: 'AI 기반 분석',
    description: '인공지능이 AAR 패턴을 분석하고 인사이트를 제공합니다',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Users,
    title: '실시간 협업',
    description: '팀원들과 동시에 AAR을 작성하고 공유합니다',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: BarChart3,
    title: '데이터 기반 인사이트',
    description: '축적된 데이터로 더 나은 의사결정을 지원합니다',
    color: 'from-orange-500 to-red-500',
  },
];

export function SplashIntro({ onComplete }: SplashIntroProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    // Skip 버튼 0.5초 후 표시
    const skipTimer = setTimeout(() => setShowSkip(true), 500);

    // 첫 화면 (로고): 3.5초
    const logoTimer = setTimeout(() => {
      setCurrentStep(1);
    }, 3500);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(logoTimer);
    };
  }, []);

  useEffect(() => {
    if (currentStep === 0) return;

    // 기능 소개 화면: 각 3초씩
    if (currentStep <= features.length) {
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 3000);

      return () => clearTimeout(timer);
    }

    // 마지막 화면 후 완료
    if (currentStep > features.length) {
      const finalTimer = setTimeout(() => {
        onComplete();
      }, 500);

      return () => clearTimeout(finalTimer);
    }
  }, [currentStep, onComplete]);

  const handleComplete = () => {
    // 완료 처리만 수행 (localStorage 저장 안 함)
    onComplete();
  };

  const handleSkip = () => {
    handleComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 flex items-center justify-center overflow-hidden">
      {/* 배경 애니메이션 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -top-48 -left-48 animate-pulse" />
        <div className="absolute w-96 h-96 bg-purple-500/20 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse delay-1000" />
      </div>

      {/* Skip 버튼 */}
      <AnimatePresence>
        {showSkip && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-8 right-8 z-10"
          >
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="text-white/70 hover:text-white hover:bg-white/10 backdrop-blur-sm"
            >
              건너뛰기 <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 컨텐츠 */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <motion.div
              key="logo"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="flex flex-col items-center"
            >
              {/* AWA 로고 */}
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="mb-8"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 blur-2xl opacity-50 animate-pulse" />
                  <h1 className="relative text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 tracking-tight">
                    AWA
                  </h1>
                </div>
              </motion.div>

              {/* 서브타이틀 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-center space-y-2"
              >
                <p className="text-2xl font-semibold text-white/90">
                  After Action Review
                </p>
                <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-300">
                  With AI
                </p>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                  className="flex items-center justify-center gap-2 mt-4 text-blue-200/70"
                >
                  <Sparkles className="w-5 h-5" />
                  <span className="text-sm">AI와 함께하는 스마트한 AAR</span>
                  <Sparkles className="w-5 h-5" />
                </motion.div>
              </motion.div>
            </motion.div>
          )}

          {currentStep > 0 && currentStep <= features.length && (
            <motion.div
              key={`feature-${currentStep}`}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center text-center"
            >
              {(() => {
                const feature = features[currentStep - 1];
                const Icon = feature.icon;

                return (
                  <>
                    {/* 아이콘 */}
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="mb-8"
                    >
                      <div className={`p-8 rounded-3xl bg-gradient-to-br ${feature.color} shadow-2xl`}>
                        <Icon className="w-20 h-20 text-white" strokeWidth={1.5} />
                      </div>
                    </motion.div>

                    {/* 텍스트 */}
                    <motion.h2
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.4 }}
                      className="text-4xl font-bold text-white mb-4"
                    >
                      {feature.title}
                    </motion.h2>

                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.4 }}
                      className="text-xl text-blue-100/80 max-w-md"
                    >
                      {feature.description}
                    </motion.p>

                    {/* 진행 표시기 */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="flex gap-2 mt-12"
                    >
                      {features.map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-2 rounded-full transition-all duration-300 ${
                            idx === currentStep - 1
                              ? 'w-8 bg-white'
                              : 'w-2 bg-white/30'
                          }`}
                        />
                      ))}
                    </motion.div>
                  </>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 로딩 바 (하단) */}
      {currentStep === 0 && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 3.5, ease: 'easeInOut' }}
          style={{ transformOrigin: 'left' }}
        />
      )}
    </div>
  );
}

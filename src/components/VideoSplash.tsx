import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './VideoSplash.css';

interface VideoSplashProps {
  onComplete: () => void;
}

const features = [
  {
    icon: '🗺️',
    title: '컬쳐맵 시각화',
    description: 'Dave Gray-Schein 4층위 모델로 조직문화 요소들의 연결관계를 한눈에',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: '🤖',
    title: 'AI 기반 분석',
    description: 'Gemini가 인터뷰 데이터를 깊이있게 분석하여 인사이트 제공',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    icon: '📸',
    title: '워크샵 모드',
    description: '포스트잇 사진 업로드만으로 실시간 컬쳐맵 생성',
    gradient: 'from-orange-500 to-red-500',
  },
];

export default function VideoSplash({ onComplete }: VideoSplashProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showSkip, setShowSkip] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Skip 버튼 0.5초 후 표시
    const skipTimer = setTimeout(() => setShowSkip(true), 500);

    return () => clearTimeout(skipTimer);
  }, []);

  // 비디오 시간 업데이트에 따라 슬라이드 전환
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    
    const currentTime = videoRef.current.currentTime;
    
    // 8초 영상을 3단계로 분할
    if (currentTime < 2.7) {
      setCurrentSlide(0);
    } else if (currentTime < 5.4) {
      setCurrentSlide(1);
    } else {
      setCurrentSlide(2);
    }
  };

  // 비디오 종료 시 자동 완료
  const handleVideoEnd = () => {
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="video-splash-container">
      {/* Skip 버튼 */}
      <AnimatePresence>
        {showSkip && (
          <motion.button
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={handleSkip}
            className="skip-button"
          >
            건너뛰기 →
          </motion.button>
        )}
      </AnimatePresence>

      <div className="split-screen">
        {/* 왼쪽: 비디오 영역 */}
        <div className="video-section">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnd}
            className="splash-video"
          >
            <source src="/videos/culture-analyzer-intro.mp4" type="video/mp4" />
            {/* Fallback: 비디오 로드 실패 시 그라데이션 배경 */}
          </video>
          
          {/* 비디오 로드 중 또는 없을 때 대체 배경 */}
          <div className="video-fallback">
            <div className="fallback-animation">
              <motion.div
                className="fallback-circle"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <div className="fallback-logo">
                <h1>조직문화 분석기</h1>
                <p>Culture Map Analyzer</p>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: 애니메이션 텍스트 영역 */}
        <div className="content-section">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.5 }}
              className="content-slide"
            >
              {/* 아이콘 */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="feature-icon-wrapper"
              >
                <div className={`feature-icon bg-gradient-to-br ${features[currentSlide].gradient}`}>
                  <span className="icon-emoji">{features[currentSlide].icon}</span>
                </div>
              </motion.div>

              {/* 제목 */}
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="feature-title"
              >
                {features[currentSlide].title}
              </motion.h2>

              {/* 설명 */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="feature-description"
              >
                {features[currentSlide].description}
              </motion.p>

              {/* 진행 표시기 */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="progress-indicators"
              >
                {features.map((_, idx) => (
                  <div
                    key={idx}
                    className={`indicator ${idx === currentSlide ? 'active' : ''}`}
                  />
                ))}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

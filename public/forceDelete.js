// src/utils/forceDelete.js
// 🔥 망할 테스트 프로젝트 강제 삭제 유틸리티

window.forceDeleteAllTestProjects = async () => {
  try {
    console.log('🔥 강제 삭제 시작...');

    if (window.sqlite) {
      // 모든 테스트 프로젝트 삭제
      await window.sqlite.query('DELETE FROM project_insights');
      await window.sqlite.query('DELETE FROM interview_sessions');
      await window.sqlite.query('DELETE FROM culture_projects');

      // 데이터베이스 정리
      await window.sqlite.query('VACUUM');

      console.log('✅ 모든 테스트 프로젝트 삭제 완료!');

      // 강제 새로고침
      window.location.reload();
    }
  } catch (error) {
    console.error('❌ 강제 삭제 실패:', error);
  }
};

console.log(
  '💀 강제 삭제 함수 준비 완료! 콘솔에서 window.forceDeleteAllTestProjects() 실행하세요.'
);

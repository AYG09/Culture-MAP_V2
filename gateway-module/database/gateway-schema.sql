-- Gateway Module 데이터베이스 스키마
-- 임시 비밀번호 관리를 위한 테이블

-- 임시 비밀번호 테이블
CREATE TABLE IF NOT EXISTS temp_passwords (
    id SERIAL PRIMARY KEY,
    password VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_by VARCHAR(100) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_count INTEGER DEFAULT 0,
    max_uses INTEGER DEFAULT NULL, -- NULL이면 무제한
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    last_used_ip VARCHAR(45),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_temp_passwords_password ON temp_passwords(password);
CREATE INDEX IF NOT EXISTS idx_temp_passwords_expires_at ON temp_passwords(expires_at);
CREATE INDEX IF NOT EXISTS idx_temp_passwords_is_active ON temp_passwords(is_active);
CREATE INDEX IF NOT EXISTS idx_temp_passwords_created_at ON temp_passwords(created_at);

-- 게이트웨이 접근 로그 테이블 (선택사항)
CREATE TABLE IF NOT EXISTS gateway_access_logs (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45),
    user_agent TEXT,
    password_type VARCHAR(20), -- 'admin' 또는 'temp'
    password_used VARCHAR(50),
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100),
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_token VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 접근 로그 인덱스
CREATE INDEX IF NOT EXISTS idx_gateway_logs_accessed_at ON gateway_access_logs(accessed_at);
CREATE INDEX IF NOT EXISTS idx_gateway_logs_ip_address ON gateway_access_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_gateway_logs_success ON gateway_access_logs(success);

-- 만료된 임시 비밀번호 자동 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_passwords()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM temp_passwords 
    WHERE expires_at < NOW() AND is_active = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- 로그에 정리 작업 기록
    INSERT INTO gateway_access_logs (
        password_type, 
        success, 
        failure_reason, 
        metadata
    ) VALUES (
        'cleanup', 
        true, 
        'Automatic cleanup', 
        json_build_object('deleted_count', deleted_count)::jsonb
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 임시 비밀번호 사용 횟수 증가 함수
CREATE OR REPLACE FUNCTION increment_password_usage(pwd VARCHAR(50), client_ip VARCHAR(45))
RETURNS BOOLEAN AS $$
DECLARE
    current_uses INTEGER;
    max_allowed INTEGER;
BEGIN
    -- 현재 사용 횟수와 최대 허용 횟수 조회
    SELECT used_count, max_uses 
    INTO current_uses, max_allowed
    FROM temp_passwords 
    WHERE password = pwd AND is_active = true AND expires_at > NOW();
    
    IF NOT FOUND THEN
        RETURN false; -- 비밀번호가 존재하지 않거나 만료됨
    END IF;
    
    -- 최대 사용 횟수 확인
    IF max_allowed IS NOT NULL AND current_uses >= max_allowed THEN
        RETURN false; -- 사용 한도 초과
    END IF;
    
    -- 사용 횟수 증가
    UPDATE temp_passwords 
    SET 
        used_count = used_count + 1,
        last_used_at = NOW(),
        last_used_ip = client_ip
    WHERE password = pwd;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 활성 임시 비밀번호 조회 뷰
CREATE OR REPLACE VIEW active_temp_passwords AS
SELECT 
    id,
    password,
    description,
    created_by,
    created_at,
    expires_at,
    used_count,
    max_uses,
    CASE 
        WHEN expires_at <= NOW() THEN 'expired'
        WHEN max_uses IS NOT NULL AND used_count >= max_uses THEN 'exhausted'
        ELSE 'active'
    END as status,
    EXTRACT(EPOCH FROM (expires_at - NOW())) / 3600 as hours_remaining,
    last_used_at,
    last_used_ip
FROM temp_passwords 
WHERE is_active = true
ORDER BY created_at DESC;

-- Row Level Security (RLS) 정책 설정 (Supabase용)
ALTER TABLE temp_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_access_logs ENABLE ROW LEVEL SECURITY;

-- 관리자만 임시 비밀번호를 관리할 수 있도록 정책 설정
-- 주의: 실제 환경에서는 더 세밀한 권한 관리가 필요할 수 있습니다
CREATE POLICY "Enable all operations for service role" ON temp_passwords
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Enable all operations for service role" ON gateway_access_logs
    FOR ALL USING (auth.role() = 'service_role');

-- 초기 데이터 (선택사항)
-- 테스트용 임시 비밀번호 생성 (24시간 후 만료)
INSERT INTO temp_passwords (password, description, expires_at) 
VALUES ('DEMO123', '데모용 임시 비밀번호', NOW() + INTERVAL '24 hours')
ON CONFLICT (password) DO NOTHING;

-- 정리 작업을 위한 스케줄러 힌트 (실제 스케줄링은 애플리케이션 레벨에서 처리)
-- 매시간마다 만료된 비밀번호 정리를 권장합니다.
-- 예: cron job 또는 Supabase Edge Functions의 Cron Jobs 사용

COMMENT ON TABLE temp_passwords IS 'Gateway 시스템용 임시 비밀번호 저장 테이블';
COMMENT ON TABLE gateway_access_logs IS 'Gateway 접근 시도 로그 테이블';
COMMENT ON FUNCTION cleanup_expired_passwords() IS '만료된 임시 비밀번호 자동 정리 함수';
COMMENT ON FUNCTION increment_password_usage(VARCHAR, VARCHAR) IS '임시 비밀번호 사용 횟수 증가 함수';
COMMENT ON VIEW active_temp_passwords IS '활성 임시 비밀번호 조회 뷰';

-- 설치 완료 확인
SELECT 
    'Gateway 데이터베이스 스키마가 성공적으로 설치되었습니다!' as message,
    NOW() as installed_at;
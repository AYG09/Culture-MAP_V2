// Gateway 인증 API
// 경로: /api/gateway-auth.js

import { createClient } from '@supabase/supabase-js';
import { getEnvConfig } from '../utils/config.js';

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // CORS 처리
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { password } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';

    if (!password) {
      await logAccess(clientIp, userAgent, null, false, 'No password provided');
      res.status(400).json({ 
        success: false, 
        error: '비밀번호를 입력해주세요.' 
      });
      return;
    }

    console.log(`[Gateway Auth] Password attempt from ${clientIp}`);

    // 관리자 비밀번호 확인
    const envConfig = getEnvConfig();
    if (password === envConfig.adminPassword) {
      const sessionToken = generateSessionToken();
      
      await logAccess(clientIp, userAgent, 'admin', true, null, sessionToken);
      
      res.status(200).json({
        success: true,
        isAdmin: true,
        sessionToken,
        message: '관리자로 로그인되었습니다.',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24시간
      });
      return;
    }

    // 임시 비밀번호 확인
    const tempPasswordResult = await checkTempPassword(password, clientIp);
    
    if (tempPasswordResult.success) {
      const sessionToken = generateSessionToken();
      
      await logAccess(clientIp, userAgent, 'temp', true, null, sessionToken);
      
      res.status(200).json({
        success: true,
        isAdmin: false,
        sessionToken,
        message: '임시 비밀번호로 로그인되었습니다.',
        expiresAt: tempPasswordResult.expiresAt,
        passwordInfo: {
          description: tempPasswordResult.description,
          usesRemaining: tempPasswordResult.usesRemaining
        }
      });
      return;
    }

    // 로그인 실패
    await logAccess(clientIp, userAgent, password, false, tempPasswordResult.error || 'Invalid password');
    
    res.status(401).json({
      success: false,
      error: tempPasswordResult.error || '잘못된 비밀번호입니다.'
    });

  } catch (error) {
    console.error('[Gateway Auth] Error:', error);
    res.status(500).json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    });
  }
}

// 임시 비밀번호 확인 함수
async function checkTempPassword(password, clientIp) {
  try {
    // 활성 임시 비밀번호 조회
    const { data, error } = await supabase
      .from('temp_passwords')
      .select('*')
      .eq('password', password)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return { success: false, error: '잘못된 비밀번호입니다.' };
    }

    // 만료 확인
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    
    if (now > expiresAt) {
      return { success: false, error: '만료된 비밀번호입니다.' };
    }

    // 사용 횟수 확인
    if (data.max_uses && data.used_count >= data.max_uses) {
      return { success: false, error: '사용 한도가 초과된 비밀번호입니다.' };
    }

    // 사용 횟수 증가
    const { error: updateError } = await supabase
      .from('temp_passwords')
      .update({
        used_count: data.used_count + 1,
        last_used_at: now.toISOString(),
        last_used_ip: clientIp
      })
      .eq('id', data.id);

    if (updateError) {
      console.error('Failed to update password usage:', updateError);
    }

    const usesRemaining = data.max_uses ? data.max_uses - (data.used_count + 1) : null;

    return {
      success: true,
      expiresAt: expiresAt.getTime(),
      description: data.description,
      usesRemaining
    };

  } catch (error) {
    console.error('Temp password check error:', error);
    return { success: false, error: '비밀번호 확인 중 오류가 발생했습니다.' };
  }
}

// 접근 로그 기록
async function logAccess(ipAddress, userAgent, passwordUsed, success, failureReason, sessionToken = null) {
  try {
    const passwordType = passwordUsed === 'admin' ? 'admin' : 
                        passwordUsed === null ? null : 'temp';

    await supabase
      .from('gateway_access_logs')
      .insert({
        ip_address: ipAddress,
        user_agent: userAgent,
        password_type: passwordType,
        password_used: passwordType === 'admin' ? 'admin' : passwordUsed,
        success,
        failure_reason: failureReason,
        session_token: sessionToken,
        metadata: {
          timestamp: new Date().toISOString(),
          userAgent: userAgent
        }
      });
  } catch (error) {
    console.error('Failed to log access:', error);
  }
}

// 세션 토큰 생성
function generateSessionToken() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return `gw_${timestamp}_${random}`;
}
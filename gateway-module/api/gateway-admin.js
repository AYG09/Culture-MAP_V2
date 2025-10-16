// Gateway 관리자 API - 임시 비밀번호 관리
// 경로: /api/gateway-admin.js

import { createClient } from '@supabase/supabase-js';
import { getEnvConfig } from '../utils/config.js';
import { generateRandomPassword, getExpiryDate } from '../utils/gateway-utils.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // CORS 처리
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 관리자 권한 확인
    const authResult = await verifyAdminAuth(req);
    if (!authResult.success) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    const { method } = req;

    switch (method) {
      case 'GET':
        return await getTempPasswords(req, res);
      case 'POST':
        return await createTempPassword(req, res);
      case 'DELETE':
        return await deleteTempPassword(req, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('[Gateway Admin] Error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}

// 관리자 권한 확인
async function verifyAdminAuth(req) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: '인증 토큰이 필요합니다.' };
  }

  const token = authHeader.substring(7);
  
  // 간단한 토큰 검증 (실제로는 더 복잡한 JWT 검증 등을 사용할 수 있음)
  if (!token.startsWith('gw_')) {
    return { success: false, error: '유효하지 않은 토큰입니다.' };
  }

  // 추가 검증 로직 (필요시)
  // 예: 데이터베이스에서 세션 토큰 확인, 만료 시간 확인 등

  return { success: true };
}

// 임시 비밀번호 목록 조회
async function getTempPasswords(req, res) {
  try {
    const { includeExpired = 'false', limit = '50' } = req.query;
    
    let query = supabase
      .from('active_temp_passwords')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    // 만료된 비밀번호 제외 여부
    if (includeExpired === 'false') {
      query = query.gt('expires_at', new Date().toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Get temp passwords error:', error);
      res.status(500).json({ error: '비밀번호 목록을 가져올 수 없습니다.' });
      return;
    }

    // 추가 정보 계산
    const passwords = data.map(pwd => ({
      ...pwd,
      status: getPasswordStatus(pwd),
      timeRemaining: getTimeRemaining(pwd.expires_at),
      usageInfo: pwd.max_uses ? `${pwd.used_count}/${pwd.max_uses}` : `${pwd.used_count}/무제한`
    }));

    res.status(200).json({
      success: true,
      passwords,
      total: passwords.length
    });

  } catch (error) {
    console.error('Get temp passwords error:', error);
    res.status(500).json({ error: '비밀번호 목록 조회 중 오류가 발생했습니다.' });
  }
}

// 임시 비밀번호 생성
async function createTempPassword(req, res) {
  try {
    const { 
      password, 
      description = '', 
      expireHours = 24, 
      maxUses = null,
      autoGenerate = false 
    } = req.body;

    let finalPassword = password;
    
    // 자동 생성 요청시
    if (autoGenerate || !password) {
      finalPassword = generateRandomPassword();
    }

    // 비밀번호 유효성 검사
    if (!finalPassword || finalPassword.length < 3) {
      res.status(400).json({ 
        error: '비밀번호는 최소 3자 이상이어야 합니다.' 
      });
      return;
    }

    // 중복 확인
    const { data: existing } = await supabase
      .from('temp_passwords')
      .select('password')
      .eq('password', finalPassword)
      .eq('is_active', true);

    if (existing && existing.length > 0) {
      res.status(400).json({ 
        error: '이미 존재하는 비밀번호입니다.' 
      });
      return;
    }

    // 만료 시간 계산
    const expiresAt = getExpiryDate(expireHours);

    // 데이터베이스에 저장
    const { data, error } = await supabase
      .from('temp_passwords')
      .insert({
        password: finalPassword,
        description: description || '관리자가 생성한 임시 비밀번호',
        expires_at: expiresAt.toISOString(),
        max_uses: maxUses,
        created_by: 'admin'
      })
      .select()
      .single();

    if (error) {
      console.error('Create temp password error:', error);
      res.status(500).json({ error: '비밀번호 생성에 실패했습니다.' });
      return;
    }

    res.status(201).json({
      success: true,
      message: '임시 비밀번호가 생성되었습니다.',
      password: {
        id: data.id,
        password: data.password,
        description: data.description,
        expiresAt: data.expires_at,
        maxUses: data.max_uses,
        createdAt: data.created_at,
        timeRemaining: getTimeRemaining(data.expires_at)
      }
    });

  } catch (error) {
    console.error('Create temp password error:', error);
    res.status(500).json({ error: '비밀번호 생성 중 오류가 발생했습니다.' });
  }
}

// 임시 비밀번호 삭제
async function deleteTempPassword(req, res) {
  try {
    const { id, password } = req.query;

    if (!id && !password) {
      res.status(400).json({ 
        error: 'ID 또는 비밀번호를 지정해주세요.' 
      });
      return;
    }

    let query = supabase.from('temp_passwords');
    
    if (id) {
      query = query.eq('id', id);
    } else {
      query = query.eq('password', password);
    }

    const { data, error } = await query
      .update({ is_active: false })
      .select()
      .single();

    if (error || !data) {
      res.status(404).json({ 
        error: '해당 비밀번호를 찾을 수 없습니다.' 
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: '비밀번호가 삭제되었습니다.',
      deletedPassword: {
        id: data.id,
        password: data.password,
        description: data.description
      }
    });

  } catch (error) {
    console.error('Delete temp password error:', error);
    res.status(500).json({ error: '비밀번호 삭제 중 오류가 발생했습니다.' });
  }
}

// 비밀번호 상태 확인
function getPasswordStatus(pwd) {
  const now = new Date();
  const expiresAt = new Date(pwd.expires_at);
  
  if (expiresAt <= now) {
    return 'expired';
  }
  
  if (pwd.max_uses && pwd.used_count >= pwd.max_uses) {
    return 'exhausted';
  }
  
  return 'active';
}

// 남은 시간 계산
function getTimeRemaining(expiresAt) {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires - now;
  
  if (diffMs <= 0) {
    return '만료됨';
  }
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}일 ${hours % 24}시간`;
  } else if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  } else {
    return `${minutes}분`;
  }
}
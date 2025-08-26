import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import qrcode from 'qrcode-terminal';
import { networkInterfaces } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const port = process.env.PORT || 54321;

// 활성 세션 관리
const activeSessions = new Map();
const sessionData = new Map(); // 각 세션의 데이터 저장

// 고유 코드 생성
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 세션 생성
function createSession() {
  let code = generateCode();
  while (activeSessions.has(code)) {
    code = generateCode();
  }

  activeSessions.set(code, {
    createdAt: new Date(),
    connectedUsers: new Set(),
  });

  sessionData.set(code, {
    projects: [],
    currentProject: null,
    stickyNotes: [],
    connections: [],
    analysisData: null,
    workshopData: [],
    editingStatus: {}, // 편집 상태 관리: { noteId: { userId: socketId, timestamp: Date } }
    layerState: null, // 층위 시스템 상태
  });

  console.log(`✨ New culture analysis session created: ${code}`);

  // 2시간 후 세션 자동 삭제
  setTimeout(
    () => {
      activeSessions.delete(code);
      sessionData.delete(code);
      console.log(`🧹 Cleaned up session: ${code}`);
    },
    1000 * 60 * 60 * 2
  );

  return code;
}

// 로컬 IP 주소 찾기
function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

// 접속 안내 출력
function displayConnectionInfo() {
  const localIP = getLocalIP();
  const clientPort = process.env.NODE_ENV === 'production' ? port : 5178;
  const networkUrl = `http://${localIP}:${clientPort}?multiuser=true`;
  const localUrl = `http://localhost:${clientPort}?multiuser=true`;

  console.log('\n' + '='.repeat(60));
  console.log('🚀 조직문화 분석기 멀티유저 서버가 시작되었습니다!');
  console.log('='.repeat(60));
  console.log(`📱 모바일/다른 컴퓨터 접속: ${networkUrl}`);
  console.log(`💻 이 컴퓨터에서 접속: ${localUrl}`);
  console.log('\n📱 모바일 접속 방법:');
  console.log('1. 모바일 브라우저에서 위 IP 주소 직접 입력');
  console.log('2. 또는 아래 QR 코드 스캔:');

  try {
    qrcode.generate(networkUrl, { small: true });
  } catch (error) {
    console.log('\n[QR 코드 표시 오류 - 대안 방법]');
    console.log(`직접 입력: ${networkUrl}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 팁: 모든 기기가 같은 Wi-Fi에 연결되어 있어야 합니다');
  console.log('='.repeat(60) + '\n');
}

// 정적 파일 제공 (Vite dev server와 함께 사용하는 경우)
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.json());

// 세션 생성 API
app.post('/api/create-session', (req, res) => {
  const code = createSession();
  res.json({ code });
});

// 세션 유효성 검사 API
app.get('/api/validate-session/:code', (req, res) => {
  const { code } = req.params;
  const isValid = activeSessions.has(code);
  res.json({ valid: isValid });
});

// 네트워크 정보 제공 API (모바일 접속용)
app.get('/api/network-info', (req, res) => {
  const localIP = getLocalIP();
  // 개발 모드에서는 Vite 서버 주소 사용 (5178), 프로덕션에서는 백엔드 서버 주소 사용 (54321)
  const clientPort = process.env.NODE_ENV === 'production' ? port : 5178;
  const clientUrl = `http://${localIP}:${clientPort}`;
  res.json({
    ip: localIP,
    port: clientPort,
    url: clientUrl,
    multiuserUrl: `${clientUrl}?multiuser=true`,
    serverPort: port, // 실제 서버 포트도 제공
  });
});

// Socket.IO 연결 처리
io.on('connection', socket => {
  console.log('🔌 New client connected:', socket.id);

  // 세션 참가
  socket.on('join-session', code => {
    if (!activeSessions.has(code)) {
      socket.emit('error', { message: 'Invalid session code' });
      return;
    }

    socket.join(code);
    socket.currentSession = code;

    const session = activeSessions.get(code);
    session.connectedUsers.add(socket.id);

    console.log(`🙋 Client ${socket.id} joined session: ${code}`);

    // 현재 세션 데이터 전송
    const data = sessionData.get(code);
    socket.emit('session-data', data);

    // 모든 사용자들에게 새 사용자 참가 알림 (본인 포함)
    io.to(code).emit('user-joined', {
      userId: socket.id,
      userCount: session.connectedUsers.size,
    });
  });

  // 스티키 노트 추가/수정
  socket.on('update-sticky-note', data => {
    const { code, note } = data;
    if (!activeSessions.has(code)) return;

    console.log(`📝 [SERVER] Received sticky note update:`, {
      id: note.id,
      content: note.content?.substring(0, 30) + '...',
      x: note.x,
      y: note.y,
      type: note.type,
      concept: note.concept,
      basis: note.basis,
      author: note.author,
    });

    const sessionData_ = sessionData.get(code);
    const existingNoteIndex = sessionData_.stickyNotes.findIndex(n => n.id === note.id);

    if (existingNoteIndex >= 0) {
      sessionData_.stickyNotes[existingNoteIndex] = note;
    } else {
      sessionData_.stickyNotes.push(note);
    }

    const broadcastData = {
      ...note,
      authorId: note.author || socket.id,
    };

    console.log(`📤 [SERVER] Broadcasting sticky note update:`, {
      id: broadcastData.id,
      content: broadcastData.content?.substring(0, 30) + '...',
      x: broadcastData.x,
      y: broadcastData.y,
      type: broadcastData.type,
      concept: broadcastData.concept,
      basis: broadcastData.basis,
      authorId: broadcastData.authorId,
      sessionCode: code,
    });

    // 모든 사용자에게 업데이트 전송 (송신자 정보 포함)
    io.to(code).emit('sticky-note-updated', broadcastData);
  });

  // 스티키 노트 삭제
  socket.on('delete-sticky-note', data => {
    const { code, noteId } = data;
    if (!activeSessions.has(code)) return;

    const sessionData_ = sessionData.get(code);
    sessionData_.stickyNotes = sessionData_.stickyNotes.filter(n => n.id !== noteId);

    io.to(code).emit('sticky-note-deleted', { noteId });
    console.log(`🗑️ Sticky note deleted in session ${code}: ${noteId}`);
  });

  // 연결선 추가/수정
  socket.on('update-connection', data => {
    const { code, connection } = data;
    if (!activeSessions.has(code)) return;

    const sessionData_ = sessionData.get(code);
    const existingIndex = sessionData_.connections.findIndex(c => c.id === connection.id);

    if (existingIndex >= 0) {
      sessionData_.connections[existingIndex] = connection;
    } else {
      sessionData_.connections.push(connection);
    }

    // 모든 사용자에게 연결선 업데이트 전송
    io.to(code).emit('connection-updated', connection);
    console.log(`🔗 Connection updated in session ${code}: ${connection.id}`);
  });

  // 연결선 삭제
  socket.on('delete-connection', data => {
    const { code, connectionId } = data;
    if (!activeSessions.has(code)) return;

    const sessionData_ = sessionData.get(code);
    sessionData_.connections = sessionData_.connections.filter(c => c.id !== connectionId);

    io.to(code).emit('connection-deleted', { connectionId });
    console.log(`🗑️ Connection deleted in session ${code}: ${connectionId}`);
  });

  // 편집 시작 알림
  socket.on('start-editing', data => {
    const { code, itemId, itemType } = data; // itemType: 'note' | 'connection'
    if (!activeSessions.has(code)) return;

    const sessionData_ = sessionData.get(code);
    if (!sessionData_.editingStatus[itemId]) {
      sessionData_.editingStatus[itemId] = {};
    }

    sessionData_.editingStatus[itemId] = {
      userId: socket.id,
      itemType,
      timestamp: new Date(),
    };

    // 다른 사용자들에게 편집 시작 알림
    socket.to(code).emit('editing-started', {
      itemId,
      itemType,
      userId: socket.id,
    });

    console.log(`✏️ ${socket.id} started editing ${itemType} ${itemId} in session ${code}`);
  });

  // 편집 완료 알림
  socket.on('stop-editing', data => {
    const { code, itemId, itemType } = data;
    if (!activeSessions.has(code)) return;

    const sessionData_ = sessionData.get(code);
    if (sessionData_.editingStatus[itemId]) {
      delete sessionData_.editingStatus[itemId];
    }

    // 다른 사용자들에게 편집 완료 알림
    socket.to(code).emit('editing-stopped', {
      itemId,
      itemType,
      userId: socket.id,
    });

    console.log(`✅ ${socket.id} stopped editing ${itemType} ${itemId} in session ${code}`);
  });

  // 프로젝트 데이터 동기화
  socket.on('sync-project-data', data => {
    const { code, projectData } = data;
    if (!activeSessions.has(code)) return;

    const sessionData_ = sessionData.get(code);
    if (projectData.projects) sessionData_.projects = projectData.projects;
    if (projectData.currentProject) sessionData_.currentProject = projectData.currentProject;
    if (projectData.analysisData) sessionData_.analysisData = projectData.analysisData;

    // 다른 사용자들에게 프로젝트 데이터 동기화
    socket.to(code).emit('project-data-synced', projectData);
    console.log(`🔄 Project data synced in session ${code}`);
  });

  // 분석 데이터 업데이트
  socket.on('update-analysis-data', data => {
    const { code, analysisData } = data;
    if (!activeSessions.has(code)) return;

    const sessionData_ = sessionData.get(code);
    sessionData_.analysisData = analysisData;

    io.to(code).emit('analysis-data-updated', analysisData);
    console.log(`📊 Analysis data updated in session ${code}`);
  });

  // 워크샵 데이터 업데이트
  socket.on('update-workshop-data', data => {
    const { code, workshopData } = data;
    if (!activeSessions.has(code)) return;

    const sessionData_ = sessionData.get(code);
    sessionData_.workshopData = workshopData;

    io.to(code).emit('workshop-data-updated', workshopData);
    console.log(`👥 Workshop data updated in session ${code}`);
  });

  // 층위 상태 업데이트
  socket.on('update-layer-state', data => {
    const { code, layerState } = data;
    if (!activeSessions.has(code)) return;

    const sessionData_ = sessionData.get(code);
    sessionData_.layerState = layerState;

    // 다른 사용자들에게 층위 상태 업데이트 전송 (송신자 제외)
    socket.to(code).emit('layer-state-updated', layerState);
    console.log(`📏 Layer state updated in session ${code}`);
  });

  // 연결 해제
  socket.on('disconnect', () => {
    console.log('🔥 Client disconnected:', socket.id);

    if (socket.currentSession) {
      const session = activeSessions.get(socket.currentSession);
      const sessionData_ = sessionData.get(socket.currentSession);

      if (session) {
        session.connectedUsers.delete(socket.id);

        // 해당 사용자가 편집 중인 항목들 정리
        if (sessionData_ && sessionData_.editingStatus) {
          const editingItems = Object.keys(sessionData_.editingStatus).filter(
            itemId => sessionData_.editingStatus[itemId].userId === socket.id
          );

          editingItems.forEach(itemId => {
            const itemType = sessionData_.editingStatus[itemId].itemType;
            delete sessionData_.editingStatus[itemId];

            // 다른 사용자들에게 편집 완료 알림
            socket.to(socket.currentSession).emit('editing-stopped', {
              itemId,
              itemType,
              userId: socket.id,
            });
          });
        }

        // 모든 사용자들에게 사용자 퇴장 알림
        io.to(socket.currentSession).emit('user-left', {
          userId: socket.id,
          userCount: session.connectedUsers.size,
        });
      }
    }
  });
});

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Multi-user server listening on 0.0.0.0:${port}`);
  displayConnectionInfo();
});

import { app, BrowserWindow, Menu, dialog, shell, ipcMain } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let viteServer;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    icon: path.join(__dirname, '../public/vite.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // Electron 앱에서 로컬 파일 접근을 위해 비활성화
      allowRunningInsecureContent: true,
    },
    show: false,
    titleBarStyle: 'default',
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 마우스 휠 확대/축소 기능 활성화 - webContents 내장 기능 사용
  mainWindow.webContents.setVisualZoomLevelLimits(1, 5); // 최소 1배, 최대 5배

  // DOM이 준비된 후 이벤트 리스너 주입
  mainWindow.webContents.once('dom-ready', () => {
    mainWindow.webContents
      .executeJavaScript(
        `
      document.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          const currentZoom = require('electron').webFrame.getZoomFactor();
          let newZoom;
          if (e.deltaY < 0) {
            // 휠 위로 = 확대
            newZoom = Math.min(currentZoom * 1.1, 5.0);
          } else if (e.deltaY > 0) {
            // 휠 아래로 = 축소  
            newZoom = Math.max(currentZoom * 0.9, 0.5);
          }
          if (newZoom) {
            require('electron').webFrame.setZoomFactor(newZoom);
          }
        }
      }, { passive: false });
      console.log('🖱️ 마우스 휠 확대/축소 이벤트 리스너 등록됨');
    `
      )
      .catch(console.error);
  });

  // 추가적인 확대/축소 단축키 처리
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.type === 'keyDown') {
      const currentZoom = mainWindow.webContents.getZoomFactor();
      if (input.key === '=' || input.key === '+') {
        // Ctrl + = 또는 Ctrl + + (확대)
        mainWindow.webContents.setZoomFactor(currentZoom * 1.1);
        event.preventDefault();
      } else if (input.key === '-') {
        // Ctrl + - (축소)
        mainWindow.webContents.setZoomFactor(currentZoom * 0.9);
        event.preventDefault();
      } else if (input.key === '0') {
        // Ctrl + 0 (실제 크기)
        mainWindow.webContents.setZoomFactor(1.0);
        event.preventDefault();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: '파일',
      submenu: [
        {
          label: '새 프로젝트',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            console.log('📝 새 프로젝트 메뉴 클릭됨');
            mainWindow.webContents.executeJavaScript(`
              window.dispatchEvent(new CustomEvent('menu-new-project'));
            `);
          },
        },
        {
          label: '프로젝트 열기',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            console.log('📁 프로젝트 열기 메뉴 클릭됨');
            mainWindow.webContents.executeJavaScript(`
              window.dispatchEvent(new CustomEvent('menu-open-project'));
            `);
          },
        },
        { type: 'separator' },
        {
          label: '저장',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            console.log('💾 저장 메뉴 클릭됨');
            mainWindow.webContents.executeJavaScript(`
              window.dispatchEvent(new CustomEvent('menu-save'));
            `);
          },
        },
        { type: 'separator' },
        {
          label: '종료',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    // 편집 메뉴 제거됨 - 사용하지 않는 기능
    {
      label: '보기',
      submenu: [
        { role: 'reload', label: '새로고침', accelerator: 'CmdOrCtrl+R' },
        { role: 'forceReload', label: '강제 새로고침', accelerator: 'CmdOrCtrl+Shift+R' },
        { role: 'toggleDevTools', label: '개발자 도구', accelerator: 'F12' },
        { type: 'separator' },
        {
          label: '실제 크기',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            mainWindow.webContents.setZoomFactor(1.0);
          },
        },
        {
          label: '확대',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            const currentZoom = mainWindow.webContents.getZoomFactor();
            mainWindow.webContents.setZoomFactor(currentZoom * 1.1);
          },
        },
        {
          label: '축소',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            const currentZoom = mainWindow.webContents.getZoomFactor();
            mainWindow.webContents.setZoomFactor(currentZoom * 0.9);
          },
        },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '전체 화면', accelerator: 'F11' },
      ],
    },
    {
      label: '도움말',
      submenu: [
        {
          label: '조직문화 분석기 정보',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '조직문화 분석기',
              message: '조직문화 분석기 v1.0.0',
              detail: `조직의 문화를 시각적으로 분석하고 개선방안을 제시하는 도구입니다.

🔧 개발자: 안영규 with AI Agent

📄 라이센스 및 사용 제한:
본 소프트웨어는 안영규의 지적 재산입니다.
안영규의 승인이나 허가 없이는 다음 행위가 금지됩니다:
• 외부 배포 및 유출
• 판매 및 상업적 이용
• 무단 복제 및 수정

⚠️ 무단 사용 시 법적 책임을 질 수 있습니다.

문의: 안영규에게 직접 연락`,
            });
          },
        },
        { type: 'separator' },
        {
          label: '라이센스 정보',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'warning',
              title: '라이센스 및 사용 제한',
              message: '🔒 저작권 보호 소프트웨어',
              detail: `본 조직문화 분석기는 안영규의 지적 재산입니다.

⛔ 금지 사항:
• 안영규의 승인 없는 외부 배포
• 안영규의 허가 없는 상업적 이용
• 무단 복제, 수정, 재배포
• 소스코드 역공학 및 분석
• 제3자에게 양도 또는 대여

✅ 허용 사항:
• 정당한 사용자의 개인적 사용
• 안영규가 승인한 교육 목적 사용

📞 라이센스 문의:
사용 권한이나 상업적 이용에 대해서는
안영규에게 직접 문의하시기 바랍니다.

© 2024 안영규 with AI Agent. All rights reserved.`,
            });
          },
        },
      ],
    },
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about', label: '정보' },
        { type: 'separator' },
        { role: 'services', label: '서비스', submenu: [] },
        { type: 'separator' },
        { role: 'hide', label: '숨기기' },
        { role: 'hideothers', label: '다른 항목 숨기기' },
        { role: 'unhide', label: '모두 표시' },
        { type: 'separator' },
        { role: 'quit', label: '종료' },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (viteServer) {
    viteServer.kill();
  }
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('오류 발생', `예기치 않은 오류가 발생했습니다:\n${error.message}`);
});

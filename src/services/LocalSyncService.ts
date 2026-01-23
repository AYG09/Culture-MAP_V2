import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';

/**
 * 로컬 우선 저장 및 P2P 실시간 협업 서비스 (Y.js)
 */
class LocalSyncService {
  private doc: Y.Doc;
  private persistence: IndexeddbPersistence;
  private provider: WebrtcProvider | null = null;
  private roomName: string;

  constructor(roomName: string = 'culture-map-default') {
    this.roomName = roomName;
    this.doc = new Y.Doc();
    
    // 1. IndexedDB를 통한 로컬 영구 저장
    this.persistence = new IndexeddbPersistence(roomName, this.doc);
    
    this.persistence.on('synced', () => {
      console.log(`[Y.js] 로컬 데이터(${roomName}) 동기화 완료`);
    });
  }

  /**
   * 실시간 협업 시작 (WebRTC)
   */
  public connectWebRTC(roomCode: string) {
    if (this.provider) {
      this.provider.destroy();
    }
    
    // 별도의 서버 없이 시그널링 서버만 공유하여 P2P 연결
    this.provider = new WebrtcProvider(roomCode, this.doc, {
      signaling: ['wss://signaling.yjs.dev'] // 공용 시그널링 서버 사용
    });

    console.log(`[Y.js] WebRTC 방(${roomCode}) 연결됨`);
  }

  public getDoc(): Y.Doc {
    return this.doc;
  }

  public getMap(name: string): Y.Map<unknown> {
    return this.doc.getMap(name);
  }

  public getArray(name: string): Y.Array<unknown> {
    return this.doc.getArray(name);
  }

  public destroy() {
    this.persistence.destroy();
    this.provider?.destroy();
    this.doc.destroy();
  }
}

export const localSyncService = new LocalSyncService();
export default localSyncService;

// Firebase 설정 및 초기화
import { initializeApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase 설정
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// 서비스 인스턴스 생성
export const database: Database = getDatabase(app);
export const firestore: Firestore = getFirestore(app);
export const auth = getAuth(app);

export default app;

// 개발 모드에서 Firebase 설정 로깅
if (import.meta.env.DEV) {
  console.log('🔥 Firebase initialized with config:', {
    projectId: firebaseConfig.projectId,
    databaseURL: firebaseConfig.databaseURL,
    authDomain: firebaseConfig.authDomain
  });
}
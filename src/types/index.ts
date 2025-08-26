// src/types/index.ts

// Culture analysis types
export * from './culture';
export * from './report';

/**
 * 포스트잇의 위치 (x, y 좌표)
 */
export interface Position {
  x: number;
  y: number;
}

// NoteData와 ConnectionData는 culture.ts에서 정의됨 (중복 제거)

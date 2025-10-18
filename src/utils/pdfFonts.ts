import { jsPDF } from 'jspdf';

const FONT_FILE_NAME = 'NanumGothic.ttf';
const FONT_FAMILY_NAME = 'NanumGothic';
const FONT_URL = '/fonts/NanumGothic.ttf';

let cachedFontData: string | null = null;
let fontFetchPromise: Promise<string> | null = null;

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    let chunkString = '';
    for (let index = 0; index < chunk.length; index += 1) {
      chunkString += String.fromCharCode(chunk[index]);
    }
    binary += chunkString;
  }

  return btoa(binary);
};

const loadFontData = async (): Promise<string> => {
  const response = await fetch(FONT_URL);

  if (!response.ok) {
    throw new Error(`Failed to load PDF font (${response.status} ${response.statusText})`);
  }

  const buffer = await response.arrayBuffer();
  return arrayBufferToBase64(buffer);
};

export const ensurePdfFont = async (pdf: jsPDF): Promise<void> => {
  if (!cachedFontData) {
    if (!fontFetchPromise) {
      fontFetchPromise = loadFontData();
    }

    cachedFontData = await fontFetchPromise;
    fontFetchPromise = null;
  }

  pdf.addFileToVFS(FONT_FILE_NAME, cachedFontData);
  pdf.addFont(FONT_FILE_NAME, FONT_FAMILY_NAME, 'normal');
  pdf.setFont(FONT_FAMILY_NAME, 'normal');
};

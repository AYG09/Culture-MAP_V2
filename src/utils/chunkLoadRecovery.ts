const CHUNK_RELOAD_KEY = 'culturemap:last-chunk-reload-at';
const CHUNK_RELOAD_WINDOW_MS = 60 * 1000;
const CHUNK_LOAD_ERROR_PATTERN = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed/i;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error
    ? `${error.message}\n${error.stack || ''}`
    : String(error || '');

  return CHUNK_LOAD_ERROR_PATTERN.test(message);
}

export function reloadOnceForChunkLoadError(error: unknown): boolean {
  if (!isChunkLoadError(error) || typeof window === 'undefined') {
    return false;
  }

  const lastReloadAt = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
  if (Number.isFinite(lastReloadAt) && Date.now() - lastReloadAt < CHUNK_RELOAD_WINDOW_MS) {
    return false;
  }

  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  window.location.reload();
  return true;
}
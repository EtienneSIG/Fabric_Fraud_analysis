// User-managed Web IQ API key. Stored only in this browser (localStorage) and sent to the backend
// proxy per request via the x-webiq-key header; never bundled or logged. Lets an analyst light up
// the live Web IQ pillar without a build-time env flag or a redeploy.
const STORAGE_KEY = 'ffi.webiq.apiKey';

export function getWebIqKey(): string {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setWebIqKey(value: string): void {
  try {
    const v = value.trim();
    if (v) globalThis.localStorage?.setItem(STORAGE_KEY, v);
    else globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode / SSR) — key simply won't persist */
  }
}

export function hasWebIqKey(): boolean {
  return getWebIqKey().length > 0;
}

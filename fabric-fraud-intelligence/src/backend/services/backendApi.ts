import { getBackendApiUrl } from '@/backend/services/generalSettings';
import { diag } from '@/backend/diag';

const DEFAULT_TIMEOUT_MS = 15000;

function base(): string {
  return getBackendApiUrl();
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** POST JSON to the Rayfin/Azure backend. Throws on non-2xx so callers can fall back to mock. */
export async function postJson<T>(
  path: string,
  body: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  headers?: Record<string, string>
): Promise<T> {
  return withTimeout(async (signal) => {
    const res = await fetch(`${base()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      credentials: 'include',
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      diag('backend', `POST ${path} -> ${res.status}`, undefined, 'error');
      throw new Error(`Backend POST ${path} failed: ${res.status}`);
    }
    return (await res.json()) as T;
  }, timeoutMs);
}

/** GET JSON from the backend with optional query params. Throws on non-2xx. */
export async function getJson<T>(
  path: string,
  params?: Record<string, string>,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  return withTimeout(async (signal) => {
    const res = await fetch(`${base()}${path}${qs}`, { credentials: 'include', signal });
    if (!res.ok) {
      diag('backend', `GET ${path} -> ${res.status}`, undefined, 'error');
      throw new Error(`Backend GET ${path} failed: ${res.status}`);
    }
    return (await res.json()) as T;
  }, timeoutMs);
}

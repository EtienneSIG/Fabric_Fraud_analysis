// Runtime, browser-local general/advanced settings. Stored only in this browser (localStorage),
// never bundled or sent anywhere except the telemetry endpoint the analyst configures.
const KEY_APPINSIGHTS = 'ffi.telemetry.appInsights';
const KEY_AGENT_TIMEOUT = 'ffi.agent.timeoutMs';
const KEY_BACKEND = 'ffi.backend.apiUrl';

// The live Foundry agent is a reasoning model (reasoning + web_search); a real round-trip takes
// ~30-60s, so the default must be generous or every live call times out into the mock answer.
export const DEFAULT_AGENT_TIMEOUT_MS = 90_000;
const MIN_AGENT_TIMEOUT_MS = 1_000;
const MAX_AGENT_TIMEOUT_MS = 120_000;

function read(key: string): string {
  try {
    return globalThis.localStorage?.getItem(key)?.trim() ?? '';
  } catch {
    return '';
  }
}

function write(key: string, value: string): void {
  try {
    const v = value.trim();
    if (v) globalThis.localStorage?.setItem(key, v);
    else globalThis.localStorage?.removeItem(key);
  } catch {
    /* storage unavailable (private mode / SSR) */
  }
}

export const getAppInsightsConnectionString = (): string => read(KEY_APPINSIGHTS);
export const setAppInsightsConnectionString = (value: string): void => write(KEY_APPINSIGHTS, value);

/** Effective backend proxy URL: the browser override when set, else the build-time env var.
 *  Trailing slashes are trimmed so callers can append paths directly. Setting it enables the
 *  backend-gated live pillars (Web IQ, Foundry proxy) without a rebuild. */
export function getBackendApiUrl(): string {
  const raw = read(KEY_BACKEND) || ((import.meta.env.VITE_BACKEND_API_URL as string | undefined) ?? '');
  return raw.replace(/\/+$/, '');
}
export const setBackendApiUrl = (value: string): void => write(KEY_BACKEND, value);

/** Effective agent timeout: the stored value when valid, else the default. */
export function getAgentTimeoutMs(): number {
  const n = Number(read(KEY_AGENT_TIMEOUT));
  return Number.isFinite(n) && n >= MIN_AGENT_TIMEOUT_MS && n <= MAX_AGENT_TIMEOUT_MS
    ? n
    : DEFAULT_AGENT_TIMEOUT_MS;
}

export function setAgentTimeoutMs(value: number | ''): void {
  const n = Number(value);
  if (value === '' || !Number.isFinite(n)) {
    write(KEY_AGENT_TIMEOUT, '');
    return;
  }
  const clamped = Math.min(Math.max(Math.round(n), MIN_AGENT_TIMEOUT_MS), MAX_AGENT_TIMEOUT_MS);
  write(KEY_AGENT_TIMEOUT, String(clamped));
}

// Structured, greppable client diagnostics. Makes silent real→mock fallbacks visible so
// failures are found fast — filter the browser console by "[diag:".
type Level = 'warn' | 'error' | 'info';

export function diag(scope: string, message: string, detail?: unknown, level: Level = 'warn'): void {
  const line = `[diag:${scope}] ${message}`;
  if (level === 'error') console.error(line, detail ?? '');
  else if (level === 'info') console.info(line, detail ?? '');
  else console.warn(line, detail ?? '');
}

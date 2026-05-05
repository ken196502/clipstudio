/**
 * WebSocket URL for live job updates (must match server `attachJobWebSocket` path).
 */
export function jobsWebSocketUrl(): string {
  const raw = (import.meta as any).env?.VITE_API_ORIGIN as string | undefined;
  if (raw) {
    const s = String(raw).trim();
    const normalized = /^:\d+$/.test(s) ? `http://localhost${s}` : s;
    const trimmed = normalized.replace(/\/+$/, '');
    const wsBase = trimmed.replace(/^http/, 'ws');
    if (wsBase.endsWith('/api')) {
      return `${wsBase.slice(0, -4)}/ws/jobs`;
    }
    return `${wsBase}/ws/jobs`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/jobs`;
}

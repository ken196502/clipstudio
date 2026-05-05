import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { listJobsForClient } from './jobs-list';

let wss: WebSocketServer | null = null;
let throttleTimer: ReturnType<typeof setTimeout> | null = null;

function broadcast(): void {
  if (!wss || wss.clients.size === 0) return;
  const payload = JSON.stringify({ type: 'jobs', jobs: listJobsForClient() });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

/**
 * Notify subscribers that jobs changed. Throttled during rapid progress updates.
 */
export function notifyJobsChanged(immediate = false): void {
  if (!wss) return;

  if (immediate) {
    if (throttleTimer) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
    broadcast();
    return;
  }

  if (throttleTimer) return;
  throttleTimer = setTimeout(() => {
    throttleTimer = null;
    broadcast();
  }, 200);
}

export function attachJobWebSocket(server: Server, path = '/ws/jobs'): void {
  if (wss) {
    return;
  }

  wss = new WebSocketServer({ server, path });

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'jobs', jobs: listJobsForClient() }));
  });
}

export function closeJobWebSocket(): void {
  if (throttleTimer) {
    clearTimeout(throttleTimer);
    throttleTimer = null;
  }
  if (wss) {
    wss.close();
    wss = null;
  }
}

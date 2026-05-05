import { db } from '../db/init';

export interface ClientJobRow {
  id: number;
  kol_id: number;
  video_id?: string;
  stage: string;
  status: string;
  progress: number;
  error_message?: string | null;
  started_at?: string;
  completed_at?: string;
  kolName: string;
  videoTitle: string;
  time?: string;
  duration?: string;
}

function formatDuration(startedAt: string, completedAt: string): string {
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const sec = Math.floor(ms / 1000);
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

/**
 * Jobs joined with KOL names for API + WebSocket payloads (matches frontend Job shape).
 */
export function listJobsForClient(status?: string): ClientJobRow[] {
  let query = `
    SELECT j.*, k.name AS kol_name
    FROM jobs j
    LEFT JOIN kols k ON j.kol_id = k.id
    ORDER BY j.started_at DESC
  `;
  const params: string[] = [];

  if (status) {
    query = `
      SELECT j.*, k.name AS kol_name
      FROM jobs j
      LEFT JOIN kols k ON j.kol_id = k.id
      WHERE j.status = ?
      ORDER BY j.started_at DESC
    `;
    params.push(status as string);
  }

  const rows = (params.length ? db.prepare(query).all(...params) : db.prepare(query).all()) as any[];

  return rows.map((row) => ({
    id: row.id,
    kol_id: row.kol_id,
    video_id: row.video_id,
    stage: row.stage,
    status: row.status,
    progress: row.progress,
    error_message: row.error_message,
    started_at: row.started_at,
    completed_at: row.completed_at,
    kolName: row.kol_name || 'Unknown',
    videoTitle: row.video_id || 'Processing...',
    time: row.started_at
      ? new Date(row.started_at).toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        })
      : undefined,
    duration:
      row.started_at && row.completed_at ? formatDuration(row.started_at, row.completed_at) : undefined,
  }));
}

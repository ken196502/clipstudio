import type Database from 'better-sqlite3';

function normalizeChannelUrl(input: string): string {
  return input.trim().replace(/\/+$/, '');
}

export function dedupeKols(db: Database.Database): {
  normalized: number;
  groups: number;
  movedVideos: number;
  movedJobs: number;
  deleted: number;
} {
  let normalized = 0;
  let groups = 0;
  let movedVideos = 0;
  let movedJobs = 0;
  let deleted = 0;

  const tx = db.transaction(() => {
    // Normalize existing data so near-duplicates collapse.
    const rows = db
      .prepare(`SELECT id, channel_url FROM kols WHERE channel_url IS NOT NULL`)
      .all() as Array<{ id: number; channel_url: string }>;

    const updateUrl = db.prepare(`UPDATE kols SET channel_url = ? WHERE id = ?`);
    for (const r of rows) {
      const next = normalizeChannelUrl(r.channel_url);
      if (next !== r.channel_url) {
        updateUrl.run(next, r.id);
        normalized += 1;
      }
    }

    const dupGroups = db
      .prepare(
        `
        SELECT channel_url, MAX(id) AS keep_id, COUNT(*) AS cnt
        FROM kols
        GROUP BY channel_url
        HAVING cnt > 1
      `
      )
      .all() as Array<{ channel_url: string; keep_id: number; cnt: number }>;

    const selectDupIds = db.prepare(
      `SELECT id FROM kols WHERE channel_url = ? AND id <> ?`
    );
    const moveVideosStmt = db.prepare(`UPDATE videos SET kol_id = ? WHERE kol_id = ?`);
    const moveJobsStmt = db.prepare(`UPDATE jobs SET kol_id = ? WHERE kol_id = ?`);
    const deleteKolStmt = db.prepare(`DELETE FROM kols WHERE id = ?`);

    for (const g of dupGroups) {
      groups += 1;
      const dupIds = selectDupIds.all(g.channel_url, g.keep_id) as Array<{ id: number }>;
      for (const { id: dupId } of dupIds) {
        const v = moveVideosStmt.run(g.keep_id, dupId);
        const j = moveJobsStmt.run(g.keep_id, dupId);
        movedVideos += v.changes;
        movedJobs += j.changes;
        const d = deleteKolStmt.run(dupId);
        deleted += d.changes;
      }
    }
  });

  tx();
  return { normalized, groups, movedVideos, movedJobs, deleted };
}


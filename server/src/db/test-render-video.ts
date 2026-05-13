import { db } from './init';
import { renderVerticalVideo } from '../services/vertical-renderer';

async function main() {
  // Find a short clip (under 60 seconds)
  const clip = db.prepare(`
    SELECT * FROM clips
    WHERE (end_sec - start_sec) < 60
    ORDER BY id DESC
    LIMIT 1
  `).get() as any;

  if (!clip) {
    console.log('No short clip found');
    process.exit(1);
  }

  const duration = clip.end_sec - clip.start_sec;
  console.log(`Rendering vertical video for clip ${clip.id} (${duration.toFixed(1)}s): ${clip.title.substring(0, 50)}`);

  const path = await renderVerticalVideo({
    id: clip.id,
    video_id: clip.video_id,
    kol_name: clip.kol_name,
    start_sec: clip.start_sec,
    end_sec: clip.end_sec,
    title: clip.title,
    thumbnail: clip.thumbnail,
    subtitles: clip.subtitles ? JSON.parse(clip.subtitles) : undefined,
  });

  console.log('Rendered to:', path);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
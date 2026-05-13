import { db } from './src/db/init';

const clip = db.prepare('SELECT * FROM clips WHERE id = 1169').get() as any;
console.log('clip start_sec:', clip.start_sec, 'end_sec:', clip.end_sec);

const subtitles = JSON.parse(clip.subtitles);
console.log('total subtitles:', subtitles.length);
console.log('first 5 subs (with relative time):');
for (let i = 0; i < Math.min(5, subtitles.length); i++) {
  const s = subtitles[i];
  const relStart = Math.max(0, s.start - clip.start_sec);
  const relEnd = Math.min(clip.end_sec - clip.start_sec, s.end - clip.start_sec);
  console.log(`  [${relStart.toFixed(2)} - ${relEnd.toFixed(2)}] ${s.text}`);
}

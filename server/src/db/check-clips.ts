import { db } from './init';

const clips = db.prepare('SELECT id,video_id,title,start_sec,end_sec,kol_name FROM clips ORDER BY id DESC LIMIT 10').all() as any[];
console.log('Top 10 clips:', JSON.stringify(clips, null, 2));

process.exit(0);
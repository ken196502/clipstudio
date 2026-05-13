import { db } from './init';

const videos = db.prepare('SELECT id,title,duration,subtitles FROM videos ORDER BY published_at DESC LIMIT 10').all() as any[];
console.log('Recent videos:', JSON.stringify(videos, null, 2));

process.exit(0);
import { db } from './init';

let prevStatus = '';
let attempts = 0;
const MAX = 30; // 30*3s=90s

async function poll() {
  while (attempts < MAX) {
    const j = db.prepare('SELECT * FROM jobs WHERE id=2').get() as any;
    if (j) {
      const now = `${j.stage}:${j.status} (${j.progress}%)`;
      if(now!==prevStatus) {
        console.log(`[${new Date().toISOString()}] Job 2 -`, now);
        if(j.error_message) {
          console.log('  🔴 Error:', j.error_message);
        } else if(j.stage==='crawl' && j.progress>0) {
          console.log('  🟡 Crawling...');
        } else if(j.stage==='process') {
          console.log('  🟡 Processing subtitles...');
        } else if(j.stage==='clip') {
          console.log('  🟡 LLM clipping...');
        } else if(j.stage==='index') {
          console.log('  🟡 Indexing...');
        }
        prevStatus = now;
      }
      if(j.status==='success' || j.status==='failed') {
        console.log('  ✅ Job finished.');
        break;
      }
    } else {
      console.log('No job 2 found.');
    }
    attempts++;
    await new Promise(x=>setTimeout(x, 3000));
  }
  process.exit(0);
}

poll().catch(e=>{console.error(e);process.exit(1);});
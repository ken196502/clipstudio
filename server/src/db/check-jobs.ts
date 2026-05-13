import { db } from './init';

const jobs = db.prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT 5').all();
console.log('Recent jobs:', JSON.stringify(jobs, null, 2));

const kols = db.prepare('SELECT * FROM kols').all();
console.log('\nKOLs:', JSON.stringify(kols, null, 2));

process.exit(0);
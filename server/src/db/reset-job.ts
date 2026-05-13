import { db } from './init';

const JOB_ID = 1;

// Mark job 1 as failed so we can run new one
db.prepare(`
  UPDATE jobs
  SET status='failed', progress=0, error_message='Forcibly reset',
      completed_at=?
  WHERE id=?
`).run(new Date().toISOString(), JOB_ID);

const j = db.prepare('SELECT * FROM jobs WHERE id=1').get() as any;
console.log('Job 1 reset to:', JSON.stringify(j, null, 2));

process.exit(0);
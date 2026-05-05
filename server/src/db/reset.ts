import { db } from './init';

const FORCE = process.env.FORCE_RESET_DB === 'true';

if (!FORCE) {
  console.error(
    [
      'Refusing to reset DB without explicit confirmation.',
      'Run with: FORCE_RESET_DB=true pnpm --dir server run db:reset',
    ].join('\n')
  );
  process.exit(1);
}

console.log('Resetting database (jobs, clips, videos, kols)...');

const tx = db.transaction(() => {
  db.exec('PRAGMA foreign_keys = OFF;');
  db.prepare('DELETE FROM jobs').run();
  db.prepare('DELETE FROM clips').run();
  db.prepare('DELETE FROM videos').run();
  db.prepare('DELETE FROM kols').run();
  db.exec('PRAGMA foreign_keys = ON;');
});

tx();

console.log('Database reset complete.');

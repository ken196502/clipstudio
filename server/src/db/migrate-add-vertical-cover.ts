import { db } from './init';

try {
  db.prepare('ALTER TABLE clips ADD COLUMN vertical_cover TEXT').run();
  console.log('Added vertical_cover column to clips table');
} catch (e: any) {
  if (e.message.includes('duplicate column')) {
    console.log('vertical_cover column already exists');
  } else {
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
}

process.exit(0);
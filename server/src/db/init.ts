import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { dedupeKols } from './dedupe-kols';

const DB_PATH = process.env.DATABASE_URL || './data/engine_vec.db';

export function initDatabase(): Database.Database {
  // Ensure data directory exists
  const dataDir = join(process.cwd(), 'data');
  try {
    mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    // Directory might already exist
  }

  const db = new Database(DB_PATH);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Read and execute schema
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  // Clean duplicates and then enforce uniqueness.
  // This keeps the API idempotent and prevents UI duplication.
  try {
    const stats = dedupeKols(db);
    if (stats.groups > 0 || stats.normalized > 0) {
      console.log('[db] kols dedupe:', stats);
    }
  } catch (error) {
    console.warn('[db] kols dedupe failed (continuing):', error);
  }

  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_kols_channel_url_unique ON kols(channel_url);');
  } catch (error) {
    console.warn('[db] failed to create unique index on kols.channel_url:', error);
  }

  console.log(`Database initialized at ${DB_PATH}`);

  return db;
}

export const db = initDatabase();

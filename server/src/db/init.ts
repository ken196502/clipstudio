import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

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

  console.log(`Database initialized at ${DB_PATH}`);

  return db;
}

export const db = initDatabase();

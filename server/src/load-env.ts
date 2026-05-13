import { config } from 'dotenv';
import { dirname, join } from 'path';

const here = dirname(__dirname);
const cliPortOverride = process.env.PORT;
const cliDatabaseOverride = process.env.DATABASE_URL;
const cliSchedulerOverride = process.env.ENABLE_SCHEDULER;
config({
  path: join(here, '..', '.env'),
  // Empty OPENAI_API_KEY in the parent shell should not block values from server/.env
  override: true,
});
// Allow `PORT=3011 pnpm dev` so .env defaults do not collide with other local services on 3001.
if (cliPortOverride !== undefined && cliPortOverride !== '') {
  process.env.PORT = cliPortOverride;
}
// Keep explicit CLI DB path for test/isolation runs.
if (cliDatabaseOverride !== undefined && cliDatabaseOverride !== '') {
  process.env.DATABASE_URL = cliDatabaseOverride;
}
// Keep explicit scheduler toggle from CLI.
if (cliSchedulerOverride !== undefined && cliSchedulerOverride !== '') {
  process.env.ENABLE_SCHEDULER = cliSchedulerOverride;
}

if (!(process.env.OPENAI_API_KEY || '').trim()) {
  console.warn('OPENAI_API_KEY is not set after loading server/.env. LLM calls will fail.');
}

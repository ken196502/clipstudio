import { config } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const cliPortOverride = process.env.PORT;
config({
  path: join(here, '..', '.env'),
  // Empty OPENAI_API_KEY in the parent shell should not block values from server/.env
  override: true,
});
// Allow `PORT=3011 pnpm dev` so .env defaults do not collide with other local services on 3001.
if (cliPortOverride !== undefined && cliPortOverride !== '') {
  process.env.PORT = cliPortOverride;
}

if (!(process.env.OPENAI_API_KEY || '').trim()) {
  console.warn('OPENAI_API_KEY is not set after loading server/.env. LLM calls will fail.');
}

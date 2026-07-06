import 'dotenv/config';
import fs from 'fs';
import { run } from './index.js';
import { seed } from '../seed/seed.js';

const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
for (const stmt of schema.split(';').map(s => s.trim()).filter(Boolean)) {
  await run(stmt);
}
await seed();
console.log('The Counting House: schema + seed complete.');
process.exit(0);

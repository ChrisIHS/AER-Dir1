import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';

import os from 'node:os';
const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(here, '../..');
const dir = path.join(os.tmpdir(), 'core-ssla-pgharness-data');
fs.rmSync(dir, { recursive: true, force: true });
const server = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'pw', port: 54399, persistent: false });
await server.initialise();
await server.start();
await server.createDatabase('core');
const client = new pg.Client({ host: 'localhost', port: 54399, user: 'postgres', password: 'pw', database: 'core' });
await client.connect();

let failed = 0;
const run = async (label, sql) => {
  try { return await client.query(sql); }
  catch (e) { failed++; console.log(`!! ${label}: ${e.message}${e.where ? '\n   at ' + e.where.split('\n')[0] : ''}`); return null; }
};
await run('bootstrap', fs.readFileSync(path.join(here, 'bootstrap.sql'), 'utf8'));
for (const f of fs.readdirSync(path.join(PROJECT, 'supabase/migrations')).sort()) {
  const r = await run(f, fs.readFileSync(path.join(PROJECT, 'supabase/migrations', f), 'utf8'));
  console.log(r ? `migrated ${f}` : `FAILED  ${f}`);
  if (!r) break;
}
const seed = await run('seed.sql', fs.readFileSync(path.join(PROJECT, 'supabase/seed.sql'), 'utf8'));
console.log(seed ? 'seeded' : 'SEED FAILED');
await run('tapshim', fs.readFileSync(path.join(here, 'tapshim.sql'), 'utf8'));

{
  const testDir = path.join(PROJECT, 'supabase/tests/database');
  for (const f of fs.readdirSync(testDir).filter((x) => x.endsWith('.sql')).sort()) {
    let results;
    try { results = await client.query(fs.readFileSync(path.join(testDir, f), 'utf8')); }
    catch (e) { failed++; console.log(`\n== ${f}: ERROR ${e.message}${e.where ? '\n   ' + e.where.split('\n')[0] : ''}`); await client.query('rollback').catch(() => {}); continue; }
    const lines = (Array.isArray(results) ? results : [results]).flatMap((r) => (r.rows ?? []).map((row) => Object.values(row)[0])).filter((v) => typeof v === 'string' && /^(not )?ok/.test(v));
    const bad = lines.filter((l) => l.startsWith('not ok'));
    console.log(`\n== ${f}: ${lines.length - bad.length}/${lines.length} passed`);
    for (const b of bad) { failed++; console.log(b); }
  }
}
await client.end();
await server.stop();
process.exit(failed ? 1 : 0);

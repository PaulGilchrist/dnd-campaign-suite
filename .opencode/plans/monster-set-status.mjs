#!/usr/bin/env node
// Set verified status for one monster-action row and regenerate queue:
// node .opencode/plans/monster-set-status.mjs MA-1839 "verified"
import { readFileSync, writeFileSync } from 'fs';
const [id, status] = process.argv.slice(2);
if (!id || !status) { console.error('usage: monster-set-status.mjs <id> <status>'); process.exit(1); }
// Guard (MA-2008/2009/2010/2040 self-inflicted literal writes): only real verdicts allowed.
const OK = ['not verified', 'verified'];
const OK_PREFIX = ['broken — see .opencode/plans/bug-mon-', 'incomplete — needs manual setup'];
if (!OK.includes(status) && !OK_PREFIX.some((p) => status.startsWith(p))) {
  console.error(`REJECTED status "${status}" — must be "not verified" | "verified" | "broken — see .opencode/plans/bug-mon-…" | "incomplete — needs manual setup"`);
  process.exit(3);
}
const manPath = new URL('../../docs/monster-actions-manifest.json', import.meta.url);
const m = JSON.parse(readFileSync(manPath, 'utf8'));
const row = m.monsterActionEntries.find(r => r.id === id);
if (!row) { console.error('row not found: ' + id); process.exit(2); }
row.verified = status;
writeFileSync(manPath, JSON.stringify(m, null, 2) + '\n');
const remaining = m.monsterActionEntries.filter(r => r.verified === 'not verified').map(r => r.id);
writeFileSync(new URL('queue.txt', import.meta.url), remaining.join('\n') + (remaining.length ? '\n' : ''));
console.log(`${id} -> ${status}; remaining not verified: ${remaining.length}`);

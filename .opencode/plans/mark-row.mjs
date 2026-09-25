#!/usr/bin/env node
// Orchestrator-only surgical editor: flips ONE row's "verified" line in-place,
// byte-identical everywhere else; then regenerates queue.txt from parsed state.
// usage: node .opencode/plans/mark-row.mjs MA-1185 verified
//        node .opencode/plans/mark-row.mjs MA-1185 broken "bug-mon-MA-1185-slug.md"
//        node .opencode/plans/mark-row.mjs MA-1185 incomplete "incomplete-mon-MA-1185-slug.md"
//        node .opencode/plans/mark-row.mjs MA-1185 incomplete-manual
//        node .opencode/plans/mark-row.mjs MA-1185 not-verified
import { readFileSync, writeFileSync } from 'fs';
const [id, status, file] = process.argv.slice(2);
if (!id || !status) { console.error('usage: mark-row.mjs <MA-id> <verified|broken|incomplete|incomplete-manual|not-verified> [file]'); process.exit(1); }
const label = {
  'verified': 'verified',
  'broken': `broken — see .opencode/plans/${file}`,
  'incomplete': `incomplete — see .opencode/plans/${file}`,
  'incomplete-manual': 'incomplete — needs manual setup',
  'not-verified': 'not verified'
}[status];
if (!label) { console.error('bad status: ' + status); process.exit(3); }
if ((status === 'broken' || status === 'incomplete') && !file) { console.error('broken/incomplete need a file'); process.exit(4); }
const manPath = new URL('../../docs/monster-actions-manifest.json', import.meta.url);
const text = readFileSync(manPath, 'utf8');
const lines = text.split('\n');
const idIdx = lines.findIndex(l => l.includes(`"id": "${id}"`));
if (idIdx < 0) { console.error('id line not found: ' + id); process.exit(2); }
let vIdx = -1;
for (let i = idIdx; i < Math.min(idIdx + 40, lines.length); i++) {
  if (lines[i].includes('"verified":')) { vIdx = i; break; }
  if (i > idIdx && lines[i].includes(`"id": "MA-`)) break;
}
if (vIdx < 0) { console.error('verified line not found near ' + id); process.exit(2); }
const indent = lines[vIdx].match(/^\s*/)[0];
const oldLine = lines[vIdx];
lines[vIdx] = `${indent}"verified": ${JSON.stringify(label)}`;
const out = lines.join('\n');
JSON.parse(out); // fail loudly if surgery broke JSON
writeFileSync(manPath, out);
const m = JSON.parse(out);
const rows = m.monsterActionEntries;
const queue = rows.filter(r => r.verified === 'not verified').map(r => r.id);
writeFileSync(new URL('queue.txt', import.meta.url), queue.join('\n') + (queue.length ? '\n' : ''));
const counts = { verified: 0, broken: 0, incomplete: 0, 'not verified': 0 };
for (const r of rows) {
  if (r.verified === 'verified') counts.verified++;
  else if (r.verified.startsWith('broken')) counts.broken++;
  else if (r.verified.startsWith('incomplete')) counts.incomplete++;
  else counts['not verified']++;
}
console.log(`marked ${id}:\n  old: ${oldLine.trim()}\n  new: ${lines[vIdx].trim()}\nqueue: ${queue.length} remaining | ${JSON.stringify(counts)}`);

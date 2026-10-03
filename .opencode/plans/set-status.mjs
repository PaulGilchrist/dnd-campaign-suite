#!/usr/bin/env node
// Set verified status for one row and regenerate queue: node .opencode/plans/set-status.mjs SP-013 "verified"
import { readFileSync, writeFileSync } from 'fs';
const [id, status] = process.argv.slice(2);
if (!id || !status) { console.error('usage: set-status.mjs <id> <status>'); process.exit(1); }
const manPath = new URL('../../docs/automations-manifest.json', import.meta.url);
const m = JSON.parse(readFileSync(manPath, 'utf8'));
const row = m.automationEntries.find(r => r.id === id);
if (!row) { console.error('row not found: ' + id); process.exit(2); }
row.verified = status;
writeFileSync(manPath, JSON.stringify(m, null, 2) + '\n');
const remaining = m.automationEntries.filter(r => r.verified === 'not verified').map(r => r.id);
writeFileSync(new URL('queue.txt', import.meta.url), remaining.join('\n') + (remaining.length ? '\n' : ''));
console.log(`${id} -> ${status}; remaining not verified: ${remaining.length}`);

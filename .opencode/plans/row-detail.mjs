#!/usr/bin/env node
// Extract one manifest row by id: node .opencode/plans/row-detail.mjs MA-1185
import { readFileSync } from 'fs';
const id = process.argv[2];
if (!id) { console.error('usage: row-detail.mjs <MA-id>'); process.exit(1); }
const m = JSON.parse(readFileSync(new URL('../../docs/monster-actions-manifest.json', import.meta.url), 'utf8'));
const row = m.monsterActionEntries.find(r => r.id === id);
if (!row) { console.error('row not found: ' + id); process.exit(2); }
console.log(JSON.stringify(row, null, 2));

#!/usr/bin/env node
// Extract one automations-manifest row by id: node .opencode/plans/automation-row.mjs SP-013
import { readFileSync } from 'fs';
const id = process.argv[2];
if (!id) { console.error('usage: automation-row.mjs <id>'); process.exit(1); }
const m = JSON.parse(readFileSync(new URL('../../docs/automations-manifest.json', import.meta.url), 'utf8'));
const row = m.automationEntries.find(r => r.id === id);
if (!row) { console.error('row not found: ' + id); process.exit(2); }
console.log(JSON.stringify(row, null, 2));

#!/usr/bin/env node
// One-time backfill for the test-maintain date-stamp extension.
// Stamps every dateless `// @maintained-by-ai` marker with the date of the
// last git commit that touched that marker line (pickaxe sweep) — i.e. when the
// file was actually maintained, NOT when it was last edited by feature work.
// Files already carrying a date are skipped (idempotent). Marked files with no
// pickaxe hit are left dateless on purpose and reported; they queue for
// re-maintenance under the delta rule.
//
// Usage:
//   node .opencode/plans/date-stamp-backfill.mjs           # dry run
//   node .opencode/plans/date-stamp-backfill.mjs --apply   # write
//
// Design + origin: .opencode/plans/test-maintain-date-stamp.md

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

const APPLY = process.argv.includes('--apply');
const MARKER = '@maintained-by-ai';
const DATED = /@maintained-by-ai \d{4}-\d{2}-\d{2}/;

// 1. Pickaxe sweep -> file -> date of newest commit that touched the marker.
const raw = execFileSync(
  'git',
  ['log', `-S${MARKER}`, '--name-only', '--format=C%x09%ad', '--date=short'],
  { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
);
const markerDate = new Map(); // git path -> 'YYYY-MM-DD'
let current = null;
for (const line of raw.split('\n')) {
  if (line.startsWith('C\t')) {
    current = line.slice(2).trim();
  } else if (line && current && !markerDate.has(line)) {
    markerDate.set(line, current); // newest-first: first hit wins
  }
}

// 2. Walk src for test files carrying the marker.
const testFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.test\.jsx?$/.test(entry)) testFiles.push(full);
  }
})('src');

// 3. Stamp dateless markers.
let alreadyDated = 0;
let stamped = 0;
const noGitDate = [];
for (const file of testFiles) {
  const content = readFileSync(file, 'utf8');
  if (!content.includes(MARKER)) continue;
  if (DATED.test(content)) {
    alreadyDated += 1;
    continue;
  }
  const date = markerDate.get(posix.normalize(file));
  if (!date) {
    noGitDate.push(file);
    continue;
  }
  const lines = content.split('\n');
  const idx = lines.findIndex((l) => l.includes(MARKER));
  lines[idx] = lines[idx].replace(MARKER, `${MARKER} ${date}`);
  if (APPLY) writeFileSync(file, lines.join('\n'));
  stamped += 1;
}

// 4. Report.
console.log(`${APPLY ? 'APPLIED' : 'DRY RUN'} — test files scanned: ${testFiles.length}`);
console.log(`already dated (skipped): ${alreadyDated}`);
console.log(`${APPLY ? 'stamped' : 'would stamp'}: ${stamped}`);
console.log(`left dateless (no marker commit found — will queue for re-maintenance): ${noGitDate.length}`);
for (const f of noGitDate) console.log(`  undated: ${f}`);

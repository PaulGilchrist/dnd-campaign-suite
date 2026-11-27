#!/usr/bin/env node
// Rebuilds the test-maintain queue from disk/git truth (date-stamp aware).
// A test file is queued when ANY of:
//   1. no `@maintained-by-ai` marker, or the marker has no date;
//   2. marker date < file's last-change date (latest commit touching the file,
//      or today if the file is dirty in the working tree).
// The commit sweep excludes the one-time `chore: date-stamp maintenance markers`
// batch commit: it touched every file without advancing their marker dates and
// would otherwise re-queue the whole corpus.
//
// Priority sort: marker date ascending (undated/unmarked first), then
// days-since-marker descending — oldest audit + most churn gets done first.
//
// Usage:
//   node .opencode/plans/test-maintain-delta-queue.mjs [--ignore-dirty]
//
// --ignore-dirty is only for sanity checks while the backfill stamp edits are
// still uncommitted; the normal run (after that batch commit) must count dirty
// files as changed-now.
//
// Design + origin: .opencode/plans/test-maintain-date-stamp.md

import { execFileSync } from 'node:child_process';
import { writeFileSync, readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, posix } from 'node:path';

const IGNORE_DIRTY = process.argv.includes('--ignore-dirty');
const MARKER = '@maintained-by-ai';
const STAMP_COMMIT_SUBJECTS = [
  'chore: date-stamp maintenance markers',
  // 2026-11-27: owner committed RUN4 lane work at 00:03 local under this subject;
  // its commit-date (27) post-dates the markers (26) of the very lanes it carries,
  // which re-queued 242 already-maintained files. Maintenance commits are not
  // "changes since maintained" — exclude by subject like the stamp commit.
  'Test maintenance',
];
// NOTE: no blanket "today" constant — the dirty-file comparison uses each file's
// LOCAL mtime (was a blanket TODAY from toISOString() = UTC, 5h ahead of EST,
// which poisoned the comparison — see fix note at step 3).

const testFiles = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.test\.jsx?$/.test(entry)) testFiles.push(full);
  }
})('src');
testFiles.sort();

// 1. Marker date per file (first line carrying the token; optional date after it).
const rows = testFiles.map((file) => {
  let marker = null;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.includes(MARKER)) {
      const m = line.match(/@maintained-by-ai (\d{4}-\d{2}-\d{2})/);
      marker = m ? m[1] : '';
      break;
    }
  }
  return { file, marker }; // '' = dateless, null = unmarked
});

// 2. Last commit date per test file, swept only since the oldest marker date
// (commits older than every marker cannot post-date any file's maintenance).
const dated = rows.map((r) => r.marker).filter(Boolean).sort();
const since = dated.length ? dated[0] : '2026-01-01';
const raw = execFileSync(
  'git',
  [
    'log', `--since=${since}`, '--name-only',
    '--format=C%x09%ad', '--date=short',
    ...STAMP_COMMIT_SUBJECTS.flatMap((s) => ['--invert-grep', `--grep=${s}`]),
    '--', 'src',
  ],
  { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
);
const lastChange = new Map();
let current = null;
for (const line of raw.split('\n')) {
  if (line.startsWith('C\t')) {
    current = line.slice(2).trim();
  } else if (line && current && !lastChange.has(line)) {
    lastChange.set(line, current); // newest-first: first hit wins
  }
}

// 3. Dirty working-tree files count as changed at their LOCAL file mtime date
// (unless --ignore-dirty). FIX 2026-11-27 (test-maintain orchestration): was a
// blanket TODAY stamp computed from the script's UTC date, which flips ahead of
// local at 19:00 EST and re-queued our own maintained-but-uncommitted lanes
// under a phantom future date (UTC-skew incident, batch #232; recurrence at the
// 26→27 local midnight rollover). mtime keeps the heuristic honest across day
// boundaries: a file edited and marker-stamped the same day stays out of queue.
if (!IGNORE_DIRTY) {
  const status = execFileSync('git', ['status', '--short', '--', 'src'], { encoding: 'utf8' });
  for (const line of status.split('\n')) {
    if (!line.trim()) continue;
    const path = line.slice(3).split(' -> ').pop().trim();
    if (/\.test\.jsx?$/.test(path) && existsSync(path)) {
      const mtimeLocal = new Date(statSync(path).mtimeMs).toLocaleDateString('en-CA');
      lastChange.set(posix.normalize(path), mtimeLocal);
    }
  }
}

// 4. Decide + sort.
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const queue = [];
for (const { file, marker } of rows) {
  const changed = lastChange.get(posix.normalize(file)) || '';
  if (!marker) {
    queue.push({ file, marker: marker ?? '', changed, reason: marker === '' ? 'undated-marker' : 'unmarked', age: 9999 });
  } else if (changed > marker) {
    queue.push({ file, marker, changed, reason: 'changed-since-maintained', age: daysBetween(marker, changed) });
  }
}
queue.sort((a, b) => (a.marker || '0000').localeCompare(b.marker || '0000') || b.age - a.age);

// 5. Emit queue + details + counts (paths list goes to /tmp + .opencode/plans,
// mirroring the command's historical queue locations).
const queueText = queue.map((q) => q.file).join('\n') + '\n';
writeFileSync('/tmp/test_maintain_queue.txt', queueText);
writeFileSync('.opencode/plans/test-maintain-queue.txt', queueText);
writeFileSync(
  '.opencode/plans/test-maintain-queue-details.tsv',
  ['marker\tlastChange\treason\tfile', ...queue.map((q) => [q.marker || '-', q.changed || '-', q.reason, q.file].join('\t'))].join('\n') + '\n'
);
const byReason = {};
for (const q of queue) byReason[q.reason] = (byReason[q.reason] || 0) + 1;
console.log(
  `total ${testFiles.length} | dated-marker ${rows.filter((r) => r.marker).length}` +
  ` | dateless ${rows.filter((r) => r.marker === '').length}` +
  ` | unmarked ${rows.filter((r) => r.marker === null).length}` +
  ` | QUEUE ${queue.length} (${Object.entries(byReason).map(([k, v]) => `${k}:${v}`).join(' ')})` +
  (IGNORE_DIRTY ? ' [--ignore-dirty]' : '')
);

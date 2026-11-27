# test-maintain Date-Stamp Extension

Origin: 2026-11-26 conversation. The `test-maintain` command (global,
`~/.config/opencode/commands/test-maintain.md`) has fully swept the corpus
(run2 + run3 closed 2026-11-14, 3,403/3,431 files marked `// @maintained-by-ai`).
A blind marker-wipe third sweep was rejected: ~3,400 dispatches for near-zero
return. Instead we make the marker **date-aware** so future runs queue only the
*delta*: files whose content changed after their last maintenance.

## Marker format

```js
// @maintained-by-ai 2026-11-26
```

- Token unchanged → every existing grep (`grep -q '@maintained-by-ai'`) still matches.
- Optional trailing `YYYY-MM-DD` = date the file was last maintained (stamp set as
  the LAST edit of the maintenance pass; precedent already on disk:
  `MonsterCardModal.ma0485-*.test.jsx` uses `@maintained-by-ai 2026-10-18 (notes)`).
- A marker with NO date means "not yet backfilled" → always queues (safety).

## Backfill (one-time) — `date-stamp-backfill.mjs`

Ground truth for "when was this file maintained" = the last git commit that
touched the marker line (pickaxe), NOT the file's last commit (which is later
for files edited by feature work afterwards):

```bash
git log -S'@maintained-by-ai' --name-only --format='C%x09%ad' --date=short
```

- 594 commits touch markers; covers 3,393 of 3,403 marked files
  (2,927 stamped Oct 2026, 648 Nov 2026).
- The script inserts the sweep date after the token on the marker line
  (position preserved — 35 files carry the marker on line ~2 after an import;
  moving them is out of scope and they get a 📌 tidy note).
- **10 outliers** (MusicPlayer ×8, CombatCues, Initiative.effectAdder-local):
  marked + clean but no pickaxe hit (rename/merge quirk) → left UNDATED on
  purpose, so they queue for re-maintenance. Do not guess dates.
- Idempotent: files already dated are skipped. Dry-run by default, `--apply` writes.

## Delta queue (reusable) — `test-maintain-delta-queue.mjs`

Queue a test file when ANY of:

1. No `@maintained-by-ai` marker, or marker has no date.
2. Marker date < file's last-change date. Last-change = latest commit touching
   the file (`git log --since=<oldest marker month> --name-only`, cheap sweep)
   or, if the file is dirty in the working tree, today.
   - The sweep EXCLUDES the one-time backfill commit by subject
     (`--invert-grep --grep='chore: date-stamp maintenance markers'`) —
     otherwise that commit, which touches every file without advancing their
     marker dates, would re-queue the entire corpus.

Priority sort: marker date ascending (undated first), then days-since-marker
descending → "oldest audit + most churn" first. Output:
`.opencode/plans/test-maintain-queue.txt` (paths) +
`.opencode/plans/test-maintain-queue-details.tsv` (`marker<TAB>lastChange<TAB>reason<TAB>path`).

**Sizing (verified 2026-11-26):** the first catch-up run is ~1,339 changed-since-
marker + 28 unmarked + 10 undated outliers ≈ **1,377 dispatches** (~40% of corpus).
Optionally raise the bar to "≥N commits since marker" to start with highest churn;
each batch is self-contained so the run can stop any time.

## Command file changes (`test-maintain.md`)

1. **Queue rebuild** — replace the `comm -13` marker-truth rebuild with
   `node .opencode/plans/test-maintain-delta-queue.mjs` (same contract: rebuilds
   from disk/git truth, survives compaction).
2. **Marker gate** (orchestrator, per subagent return) — becomes
   `grep -q "@maintained-by-ai $(date +%F)" <file>`: completion record for THIS
   run; stale-dated markers do not pass the gate.
3. **Orchestrator rare write** (reported green but unstamped) — stamp with today's date.
4. **Subagent preflight (a)** — STOP "already maintained" only when marker date ≥
   file's last-change date (i.e. only when `test-maintain-delta-queue.mjs` says
   the file isn't queued); otherwise proceed (re-maintenance).
5. **Subagent step (e)** — stamp exactly `// @maintained-by-ai YYYY-MM-DD`
   (today) as the LAST edit; verification grep uses the dated token.
6. Legacy `BASELINE` idea retired — real per-file dates replace it.

## Execution order

1. Write both scripts; run backfill **dry-run**, review anomalies.
2. Run backfill `--apply`.
3. Owner batch-commits the stamp sweep with EXACTLY the subject
   `chore: date-stamp maintenance markers` (the delta builder depends on it;
   commits are owner-only per repo policy).
4. Run `test-maintain-delta-queue.mjs` — sanity-check counts
   (expect ~1,377 at first, shrinking as lanes re-stamp with fresh dates).
5. Update `test-maintain.md` per §Command file changes.
6. First delta run proceeds in normal 15-file batches, oldest-marker-first.

## Caveats

- Queue build is only meaningful AFTER step 3 (while the 3,393 stamp edits sit
  uncommitted, every file looks "dirty" and would queue).
- e2e-improve workflow files that re-stamp markers themselves are handled for
  free: their stamp date == their commit date → strict `>` excludes them.

## EXECUTED 2026-11-26

- Backfill applied: 3,392 markers stamped with their git pickaxe dates
  (1 already dated skipped, 10 left dateless by design → they queue). Corpus now
  3,393 dated / 10 dateless / 28 unmarked of 3,431 files; every diff is exactly
  one comment line; sample eslint clean; 3 sample files green under vitest (178 tests).
- `test-maintain-delta-queue.mjs` verified: first catch-up queue = **1,274**
  (unmarked 28 + undated 10 + changed-since-maintained 1,236; the 1,339 estimate
  above used git author dates, the builder uses committer dates via `--since`).
  Queue written to `.opencode/plans/test-maintain-queue.txt` (+ `/tmp` copy) +
  details TSV; full rebuild takes ~0.3s.
- `~/.config/opencode/commands/test-maintain.md` updated: date-gated marker
  gate (`$(date +%F)`), date-aware preflight, dated step-(e) stamp, builder-based
  queue rebuild + PROGRESS recount, Numbers block replaced by the script.
- **STILL OWNER ACTION:** batch-commit the 3,392-file stamp sweep with EXACTLY
  `chore: date-stamp maintenance markers` (the delta builder's `--invert-grep`
  depends on that subject), ideally after a full `npm run lint && npm run test:run`
  cold check. Until that commit lands, run the builder with `--ignore-dirty`.
- 📌 tidy note: 35 test files carry the marker on line ~2 (after an import line),
  e.g. `src/models/SpellOverlay.test.js`. Backfill preserved position; normalize
  to line 1 when those files next enter a maintenance lane.

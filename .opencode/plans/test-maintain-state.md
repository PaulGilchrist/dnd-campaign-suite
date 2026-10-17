# Test-Maintain State (cursor — update BEFORE each dispatch, AFTER each completion)

Updated: 2026-10-17
Command spec: `.opencode/commands/test-coverage.md` (RE-READ after every compaction — disk is truth)
Queue: `.opencode/plans/test-maintain-queue.txt` (1359 entries, regenerated from marker truth at batch #136 boundary 2026-10-17)
Ledger: `.opencode/plans/test-maintain-ledger.md` (append-only outcomes)
Bugs: `.opencode/plans/test-maintain-bugs.md` (bug/recommendation ledger)

## Cursor
- Queue head (next dispatch): src/components/char-sheet/modals/shared/SaveAttackAoeModal.damage-resolution.test.jsx (verify vs /tmp/test_maintain_queue.txt)
- Files completed since last batch check: 0 (Batch #138 flush done after run2#209)
- Last batch boundary: #138 flush complete (runs #195-#209); lint+full-suite GREEN-PENDING — evidence /tmp/batch138.log
- Last progress report: total 2693 | completed 1363 | remaining 1330 (baseline for batch #139)
- Next run number: run2#210
- Next batch boundary flush: after run2#224

## Persistence mode (OWNER AMENDED 2026-10-17)
- Per-file: marker gate grep ONLY (plus rare orchestrator stamp if green-but-unmarked).
- Every 15 files: one-burst flush of ledger + bug ledger + this cursor, then lint + full suite once + PROGRESS REPORT.
- No IN-FLIGHT write-ahead anymore — marker recount is completion truth.

## Notes
- Queue was regenerated 2026-10-17 after discovering stale re-queues (subagents had improved files without stamping `@maintained-by-ai`; markers back-filled from 15 "Test Quality" commits + session lanes — 1,291 marked, 1,403 genuinely remaining).
- Recovery after compaction: re-read command spec → this file → ledger tail → regenerate queue from markers → resume. Do not dispatch anything already marked.

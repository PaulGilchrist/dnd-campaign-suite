# Test-Maintain State (cursor — update BEFORE each dispatch, AFTER each completion)

Updated: 2026-10-17
Command spec: `.opencode/commands/test-coverage.md` (RE-READ after every compaction — disk is truth)
Queue: `.opencode/plans/test-maintain-queue.txt` (1403 entries, regenerated from marker truth 2026-10-17)
Ledger: `.opencode/plans/test-maintain-ledger.md` (append-only outcomes)
Bugs: `.opencode/plans/test-maintain-bugs.md` (bug/recommendation ledger)

## Cursor
- Queue head (next dispatch): src/components/char-sheet/modals/HurlThroughHellModal.resultScreen.test.jsx
- Files completed since last batch check: 0
- Last batch boundary: #133 GREEN canon (2 known FIXME + 3 expected fail; 36,926 passed) — evidence /tmp/batch133.log
- Last progress report: total 2694 | completed 1291 | remaining 1403 (marker recount 2026-10-17; baseline for batch #134)
- IN-FLIGHT: none

## Notes
- Queue was regenerated 2026-10-17 after discovering stale re-queues (subagents had improved files without stamping `@maintained-by-ai`; markers back-filled from 15 "Test Quality" commits + session lanes — 1,291 marked, 1,403 genuinely remaining).
- Recovery after compaction: re-read command spec → this file → ledger tail → regenerate queue from markers → resume. Do not dispatch anything already marked.

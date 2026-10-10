# featFinder.js ships hardcoded console.error debug block

### Summary
`findFeat()` contains a leftover hardcoded debug block that logs `console.error` on every lookup of the feat "Boon Of Fortitude". Every 2024 character that has epic boons (e.g. Disciplined_Monk) emits this error on every app load.

### Steps to reproduce
1. Start the app (`npm run dev`) and open http://localhost:5173.
2. Select `test-campaign`.
3. Open DevTools console.
4. Observe (immediately, and again on every campaign re-select / reload):
   `[ERROR] [findFeat] LOOKING FOR: Boon Of Fortitude allFeats count: 71 first 3 names: [Ability Score Improvement, Actor, Athlete] @ .../src/services/shared/featFinder.js:3`

### Expected behavior
No console output for successful feat lookups. (The generic NOT FOUND error at line 13 may remain for genuine misses.)

### Actual behavior
A `console.error` is logged on every 'Boon Of Fortitude' lookup even though the feat is found (in `public/data/2024/feats.json`) — the lookup succeeds via a different code path/list and this debug log is pure noise. Verified twice in fresh sessions (localhost and LAN-IP player tab).

### Likely location
Confident: `src/services/shared/featFinder.js:4-6` — hardcoded `if (featName === 'Boon Of Fortitude') console.error(...)` block.

### Suggested fix
Delete lines 4–6. Check git history for the ticket that added it; if a real bug (feat-not-found for epic boons) motivated it, verify the 2024 feats list is now loaded for 2024 characters and keep only the generic NOT FOUND log.

### Severity
Minor UX issue — pollutes the console on every session, trains users to ignore errors; zero functional impact.

## Resolution
**FIXED** — confirmed diagnosis. The diagnosis in the bug file was correct.

**What was wrong:** `src/services/shared/featFinder.js` carried a hardcoded diagnostic block (lines 4–6, `if (featName === 'Boon Of Fortitude') console.error(...)`) left over from commit `77484c78d` ("Boon Of Fortitude - Feat - Fortified Health"). That ticket's real fix lived in `automationCollector.js` / `automationPassives.js` (routing the `fortified_health` passive correctly); the featFinder `console.error` was transient debug noise that shipped by mistake. The feat lookup itself succeeds via the exact-match branch (line 7) — every 2024 character with epic boons emitted a spurious `console.error` on load while the "NOT FOUND" line never fired, proving it was pure noise.

**Fix:** Deleted the hardcoded block. The generic `NOT FOUND` log (now line 10) remains for genuine misses. No dual-ruleset twin needed — `featFinder.js` is ruleset-agnostic (shared by 5e and 2024 callers in `featBuffService.js`), so the single file is the complete fix.

**Files changed:**
- `src/services/shared/featFinder.js` — removed the hardcoded `console.error` debug block.
- `src/services/shared/featFinder.test.js` — added 2 regression tests: (1) successful epic-boon lookup logs nothing to console; (2) genuine miss still logs `NOT FOUND`.

**Verification:**
- Live (Playwright, test-campaign): pre-fix reproduced `[ERROR] [findFeat] LOOKING FOR: Boon Of Fortitude allFeats count: 71 ...` on campaign select. Post-fix, fresh navigate + select test-campaign → **0 console errors**, no `findFeat` output. Adjacent feat-driven flows (featBuffService) load clean.
- `npx vitest run src/services/shared/featFinder.test.js` → 9 passed.
- `npx vitest run src/services/shared/` → 8 files, 109 passed.
- `npx vitest run` featBuffService sibling tests → 14 passed.
- `npm run lint` → clean (zero warnings).
- Cleanup: Admin → Clear Change Data + Clear Campaign Log for test-campaign.

## Summary
Removed a leftover hardcoded `console.error` debug block in `findFeat()` that fired on every lookup of "Boon Of Fortitude" despite the feat being found. The feat lookup succeeds via the exact-match path; the block was transient debug noise from the Fortified Health ticket that shipped by mistake. The generic NOT FOUND log is retained for genuine misses. Added regression tests locking silent-success and logged-miss behavior.


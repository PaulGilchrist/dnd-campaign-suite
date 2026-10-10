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

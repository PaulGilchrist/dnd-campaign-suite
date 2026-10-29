# Failed concentration save logs "Concentration broken; X ends." TWICE per save

### Summary
When a concentration saving throw from the app-wide ConcentrationPromptModal FAILS while the Initiative view is mounted, the campaign log receives TWO identical `ability_use` rows `Concentration broken; <spell> ends.` for the single failure. Root cause: two independent `window` consumers of the local `concentration-result` CustomEvent each call `cleanupConcentrationEffects()`, whose SP-011 emitter logs unconditionally when a spellName was captured.

### Steps to reproduce
Starting state: in `test-campaign`, Initiative board has the 12-PC skeleton plus one Goblin joined via Encounter Builder; victim concentration via full-store cs write (`GET /api/campaigns/test-campaign/combatSummary` → set `creatures[AasimarTest].concentration = {spell:'Hex',dc:10}` + hp 150/150 → `POST {value:cs}`).
1. On the Initiative view, arm the Goblin's own-card target-select to `AasimarTest`, open its avatar (`img.click()`), roll the Scimitar `+4` chip (`mc-dice-link`), press popup **Done** on a hit to apply damage.
2. The `.cnp-overlay` concentration prompt appears. Click `Roll Con Save` and get a FAILING total (< DC 10). (Ran twice-live odds: AasimarTest +2 vs DC 10 fails on nat ≤ 7, ~30%.)
3. `GET /api/campaigns/test-campaign/log` and count entries with `description: "Concentration broken; Hex ends."`.

### Expected behavior
Exactly ONE `ability_use` break row per failed save (the SP-011 contract: one row naming the spell that ended).

### Actual behavior
TWO identical `ability_use` rows fire within ~1 ms of the failing roll row. Live capture 2026-10-29 (run AA):
```
9  roll        concentration-save  success=False  total 9 vs DC 10  (t=...284931)
10 ability_use Hex  Concentration broken; Hex ends.   (t=...284932)
11 ability_use Hex  Concentration broken; Hex ends.   (t=...284933)
12 roll        concentration-save  success=True   (next queued save — logs ZERO extra rows, correct)
```
The `roll:concentration-save` row itself is correctly singular. Side effects also double: `stripSummonedFromCombatSummary`, `storage.set('combatSummary', …)` full-store persist, and every per-spell cleanup sweep inside `cleanupConcentrationEffects` run twice per failure (idempotent in effect but double the write chatter). Passive tabs do NOT duplicate (CustomEvent is window-local; total rows = 2, not 4).

### Likely location
Confident (code read + live):
- Consumer 1: `src/components/initiative/Initiative.jsx:471-488` — mounted ONLY while the Initiative view is open; reads the React-state `combatSummary`, nulls `creature.concentration`, calls `cleanupConcentrationEffects(...)` → logs row.
- Consumer 2: `src/hooks/combat/useLoggedDiceRollEventHandlers.js:582-625` (`setupEventListeners`, page-singleton via `window.__pendingResultHandlersInstalled`) — reads the IMPERATIVE store via `getCombatSummary()`, so it STILL sees `concentration: {spell:'Hex'}` after consumer 1 nulled only its own state copy → calls `cleanupConcentrationEffects(...)` → logs the second row.
- Row emitter: `src/services/combat/concentration/concentrationService.js:436-445` (`if (spellName) addEntry(...)`).
- Dispatch source: `src/components/common/ConcentrationPromptModal.jsx:169` (`window.dispatchEvent(new CustomEvent('concentration-result', …))`).
Both consumers predate the multi-hit fix (blame: 4c6b18313 2026-09-08, 7709e712a 2026-07-31) — this is NOT a regression from a3c10a0ea; it was merely invisible until failure legs got audited at row-count granularity.

### Suggested fix
Consolidate the failure adjudication in ONE consumer. Options:
1. Preferably delete the Initiative.jsx `concentration-result` listener's break branch (the useLogged singleton already does everything it does — plus the roll row and `mantleOfMajestyActive` clear). Check the Initiative copy for anything unique (`cleanupConcentrationEffects` is present in BOTH — that is the dup; Initiative adds nothing the hook lacks except using React state instead of the store).
2. Or make `cleanupConcentrationEffects` idempotent per failure: guard the SP-011 emitter on the spell still being active (e.g. re-read cs and skip when `creature.concentration` is already null), so the second caller is byte-inert.
Whichever lane: add a test pinning exactly ONE `Concentration broken` row per failed prompt-modal save with the Initiative view mounted.

### Severity
Minor UX issue / data-hygiene — no state corruption (cleanup is idempotent), but the GM-facing campaign log tells the story twice on a common lane (every failed con save during combat), and doubles the cs persist chatter.

## Resolution

**FIXED** (2026-10-29). Root cause confirmed as described: the local `concentration-result` CustomEvent (dispatched by `ConcentrationPromptModal.jsx:169` on the acting client) had TWO window consumers, each running `cleanupConcentrationEffects()` — whose SP-011 emitter logs `Concentration broken; <spell> ends.` unconditionally when a spellName was captured — so a failing save on the Initiative view wrote the row twice.

**Chosen lane: Suggested-fix option 1** (consolidate into the one consumer). The `useLoggedDiceRollEventHandlers.js` page-singleton (`setupEventListeners`, guarded by `window.__pendingResultHandlersInstalled`) is a strict superset of the Initiative copy — it logs the `roll:concentration-save` row, nulls concentration in the imperative store, strips summons, clears `mantleOfMajestyActive`, persists via `storage.set`, and dispatches `combat-summary-updated`. The Initiative view already re-adopts the summary through its existing `combat-summary-updated` listener (`Initiative.jsx:540`), so deleting its duplicate `concentration-result` listener loses nothing and the card still clears its badge. The Initiative copy added nothing the hook lacked except reading React state instead of the store (the stale-copy read is exactly what produced the second row). No 2024 twin listener exists — the adjudication seam is shared across both rulesets, so the single fix covers 5e and 2024.

**Files changed:**
- `src/components/initiative/Initiative.jsx` — deleted the duplicate `concentration-result` `useEffect` listener (+ its now-unused `cleanupConcentrationEffects` / `stripSummonedFromCombatSummary` imports), replaced with a NOTE pointing at the single consumer.
- `src/components/initiative/initiative-callbacks.test.jsx` — replaced the removed consumer's positive assertion with a **single-consumer regression pin**: with the Initiative view mounted, a dispatched `concentration-result` (fail/success/unknown-target) is fully inert on the view (zero `storage.set` / `setRuntimeValue` / `cleanupConcentrationEffects`). Updated the file's owned-contract header comment.
- `src/components/initiative/initiative-init-rolled-handler.test.jsx` — updated the delegation pointer comment (listener is now pinned ABSENT).
- `src/hooks/combat/useLoggedDiceRollEventHandlers.test.js` — strengthened the surviving single-consumer test to assert **exactly-once** adjudication (`storage.set`, `cleanupConcentrationEffects`, `logEntry` all `toHaveBeenCalledTimes(1)`).

**Verification:**
- **Live repro pre-fix** (test-campaign, dev:locked :5173, header verified `test-campaign`): 12-PC board + EB Goblin; AasimarTest concentration `{Hex,DC10}` via full-store cs POST; armed own-card target-select; Scimitar chip → Done → `.cnp-overlay` → Roll Con Save. A failing save (total 6 < DC10) produced **2** break rows at +1/+2ms (matching the filed fingerprint).
- **Live re-verify post-fix** (Vite HMR reload, same rig): a fresh failing save (total 3 < DC10) produced **exactly 1** `ability_use` break row (+1ms), `creature.concentration` null in the store, BROKEN panel shown, card badge cleared. Machine-counted the whole session log: 13 roll rows, 0 roll-row dupes (<5ms), 11 successes each with 0 break rows, 2 failures → 2 attributed break rows (1 pre-fix, 1 post-fix), 0 orphan break rows.
- `npx vitest run` on touched files (2 files/36), full `src/components/initiative` (65 files/509), `src/hooks/combat` (229 files/1941), and `src/services/combat/concentration`+`src/components/common` (54 files/594) — all green. `npm run lint` zero warnings. `no-timers-guard` OK (35 benign UI sites).
- Cleanup: Admin `clear-change-data` + `clear-log` (API POST, 200 no-dialog) → `change-data {}` + `log []` GET-verified two-pass from closed-tab quiet.

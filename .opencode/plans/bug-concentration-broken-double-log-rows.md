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
